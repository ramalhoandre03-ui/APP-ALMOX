import { supabase } from '../lib/supabase';

export interface SyncHistoricoResult {
  success: boolean;
  totalVerificados: number;
  totalSemCompradorOuValor: number;
  totalAtualizados: number;
  totalNaoEncontradosNoBI: number;
  erros: string[];
  detalhes?: {
    atualizados: Array<{
      id: string;
      numero_pc: string;
      descricao_item: string;
      comprador_real: string;
      valor_unitario: number;
      valor_total_item: number;
    }>;
    naoEncontrados: Array<{
      id: string;
      numero_pc: string;
      descricao_item: string;
    }>;
  };
}

/**
 * Normaliza strings para matching insensível a caixa, acentos e espaços múltiplos
 */
function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Função utilitária para sincronizar e enriquecer registros legados em `recebimentos_itens`
 * com os campos `comprador_real`, `valor_unitario` e `valor_total_item` a partir de `pedidos_compras_bi`.
 */
export async function syncHistoricoRecebimentos(options?: {
  forceAll?: boolean; // Se true, reprocessa inclusive os que já têm comprador_real
  onProgress?: (msg: string, percentual: number) => void;
}): Promise<SyncHistoricoResult> {
  const erros: string[] = [];
  const reportProgress = (msg: string, pct: number) => {
    if (options?.onProgress) {
      options.onProgress(msg, pct);
    }
  };

  try {
    reportProgress('Consultando registros de recebimentos no Supabase...', 10);

    // 1. Buscar todos os registros de recebimentos_itens (com paginação segura)
    let allRecebimentos: any[] = [];
    let recFrom = 0;
    const REC_CHUNK_SIZE = 1000;
    let recHasMore = true;

    while (recHasMore) {
      const { data: recChunk, error: recError } = await supabase
        .from('recebimentos_itens')
        .select('*')
        .range(recFrom, recFrom + REC_CHUNK_SIZE - 1);

      if (recError) {
        throw new Error(`Erro ao consultar recebimentos_itens: ${recError.message}`);
      }

      if (recChunk && recChunk.length > 0) {
        allRecebimentos = allRecebimentos.concat(recChunk);
        if (recChunk.length < REC_CHUNK_SIZE) {
          recHasMore = false;
        } else {
          recFrom += REC_CHUNK_SIZE;
        }
      } else {
        recHasMore = false;
      }
    }

    // Filtrar itens que precisam de enriquecimento
    const itensParaAtualizar = options?.forceAll
      ? allRecebimentos
      : allRecebimentos.filter(item => {
          const semComprador = !item.comprador_real || String(item.comprador_real).trim() === '';
          const semValorUnit = item.valor_unitario === null || item.valor_unitario === undefined || Number(item.valor_unitario) === 0;
          return semComprador || semValorUnit;
        });

    if (itensParaAtualizar.length === 0) {
      reportProgress('Nenhum registro pendente de sincronização encontrado.', 100);
      return {
        success: true,
        totalVerificados: allRecebimentos.length,
        totalSemCompradorOuValor: 0,
        totalAtualizados: 0,
        totalNaoEncontradosNoBI: 0,
        erros: []
      };
    }

    reportProgress(`Carregando catálogo completo do BI (${itensParaAtualizar.length} recebimentos legados encontrados)...`, 30);

    // 2. Buscar todos os registros de pedidos_compras_bi (com paginação de 1000 em 1000)
    let allBIRows: any[] = [];
    let biFrom = 0;
    const BI_CHUNK_SIZE = 1000;
    let biHasMore = true;

    while (biHasMore) {
      const { data: biChunk, error: biError } = await supabase
        .from('pedidos_compras_bi')
        .select('*')
        .range(biFrom, biFrom + BI_CHUNK_SIZE - 1);

      if (biError) {
        throw new Error(`Erro ao consultar pedidos_compras_bi: ${biError.message}`);
      }

      if (biChunk && biChunk.length > 0) {
        allBIRows = allBIRows.concat(biChunk);
        if (biChunk.length < BI_CHUNK_SIZE) {
          biHasMore = false;
        } else {
          biFrom += BI_CHUNK_SIZE;
        }
      } else {
        biHasMore = false;
      }
    }

    reportProgress('Indexando dados do BI e cruzando correspondências...', 50);

    // 3. Indexar base do BI para busca eficiente
    // Mapa exato: "pedido|||descricao" -> linha BI
    const biMapExact = new Map<string, any>();
    // Mapa por pedido: "pedido" -> array de linhas BI
    const biMapByPC = new Map<string, any[]>();

    for (const biRow of allBIRows) {
      const pc = normalizeString(biRow.pedido || biRow.numero_pc);
      const desc = normalizeString(biRow.produto_descricao || biRow.descricao_item);

      if (pc) {
        // Indexa no mapa exato
        if (desc) {
          const exactKey = `${pc}|||${desc}`;
          if (!biMapExact.has(exactKey)) {
            biMapExact.set(exactKey, biRow);
          }
        }

        // Indexa no mapa por PC
        if (!biMapByPC.has(pc)) {
          biMapByPC.set(pc, []);
        }
        biMapByPC.get(pc)!.push(biRow);
      }
    }

    // 4. Iterar sobre os recebimentos antigos e buscar matches no BI
    const arrayAtualizado: any[] = [];
    const detalhesAtualizados: any[] = [];
    const detalhesNaoEncontrados: any[] = [];

    for (const item of itensParaAtualizar) {
      const recPC = normalizeString(item.numero_pc || item.pedido);
      const recDesc = normalizeString(item.descricao_item || item.produto_descricao);

      let biMatch: any = null;

      // Match 1: Chave exata (PC + Descrição)
      const exactKey = `${recPC}|||${recDesc}`;
      if (biMapExact.has(exactKey)) {
        biMatch = biMapExact.get(exactKey);
      }

      // Match 2: Fallback buscando nas linhas do mesmo PC por similaridade de descrição
      if (!biMatch && biMapByPC.has(recPC)) {
        const linhasDoPC = biMapByPC.get(recPC)!;

        // Se o PC só tem 1 linha no BI, assume ela
        if (linhasDoPC.length === 1) {
          biMatch = linhasDoPC[0];
        } else {
          // Busca descrição parcial
          biMatch = linhasDoPC.find(b => {
            const bDesc = normalizeString(b.produto_descricao || b.descricao_item);
            return bDesc && recDesc && (bDesc.includes(recDesc) || recDesc.includes(bDesc));
          });

          // Se ainda não encontrou, pega a primeira com comprador/valor válido
          if (!biMatch) {
            biMatch = linhasDoPC.find(b => b.comprador_real || b.valor_unitario);
          }
        }
      }

      if (biMatch) {
        const compradorReal = biMatch.comprador_real || biMatch.comprador || '';
        const valorUnitario = Number(biMatch.valor_unitario) || 0;
        const qtdRecebida = Number(item.qtd_recebida ?? item.qtd_entregue ?? item.quantidade ?? item.qtd ?? 0);
        const valorTotalItem = Number((valorUnitario * qtdRecebida).toFixed(2));

        arrayAtualizado.push({
          id: item.id,
          comprador_real: compradorReal,
          valor_unitario: valorUnitario,
          valor_total_item: valorTotalItem
        });

        detalhesAtualizados.push({
          id: item.id,
          numero_pc: item.numero_pc || item.pedido,
          descricao_item: item.descricao_item || item.produto_descricao || '-',
          comprador_real: compradorReal,
          valor_unitario: valorUnitario,
          valor_total_item: valorTotalItem
        });
      } else {
        detalhesNaoEncontrados.push({
          id: item.id,
          numero_pc: item.numero_pc || item.pedido,
          descricao_item: item.descricao_item || item.produto_descricao || '-'
        });
      }
    }

    reportProgress(`Salvando ${arrayAtualizado.length} registros enriquecidos no Supabase via upsert...`, 75);

    // 5. Salvar no Supabase em lotes de 100 registros usando upsert
    if (arrayAtualizado.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < arrayAtualizado.length; i += BATCH_SIZE) {
        const batch = arrayAtualizado.slice(i, i + BATCH_SIZE);
        const { error: upsertError } = await supabase
          .from('recebimentos_itens')
          .upsert(batch, { onConflict: 'id' });

        if (upsertError) {
          const errMsg = `Erro no lote ${Math.floor(i / BATCH_SIZE) + 1}: ${upsertError.message}`;
          console.error(errMsg);
          erros.push(errMsg);
        }
      }
    }

    reportProgress('Sincronização do histórico concluída com sucesso!', 100);

    return {
      success: erros.length === 0,
      totalVerificados: allRecebimentos.length,
      totalSemCompradorOuValor: itensParaAtualizar.length,
      totalAtualizados: arrayAtualizado.length,
      totalNaoEncontradosNoBI: detalhesNaoEncontrados.length,
      erros,
      detalhes: {
        atualizados: detalhesAtualizados,
        naoEncontrados: detalhesNaoEncontrados
      }
    };
  } catch (err: any) {
    console.error('Falha geral em syncHistoricoRecebimentos:', err);
    erros.push(err.message || String(err));
    return {
      success: false,
      totalVerificados: 0,
      totalSemCompradorOuValor: 0,
      totalAtualizados: 0,
      totalNaoEncontradosNoBI: 0,
      erros
    };
  }
}
