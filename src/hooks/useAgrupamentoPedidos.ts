import { useMemo } from 'react';
import {
  PedidoCompraBI,
  PedidoCompraDocumento,
  ItemProdutoConsolidado,
  PedidoRateioDestino,
  ForecastStatusInfo
} from '../types/compras';

/**
 * Converte com segurança qualquer valor para número float válido.
 */
export function safeNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'number') {
    return isNaN(val) ? fallback : val;
  }
  if (typeof val === 'string') {
    // Normaliza separadores decimais (ex: 1.234,56 -> 1234.56 ou 1,234.56)
    let clean = val.trim().replace(/[R$\s]/g, '');
    if (clean.includes(',') && clean.includes('.')) {
      if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else {
        clean = clean.replace(/,/g, '');
      }
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    }
    const num = parseFloat(clean);
    return isNaN(num) ? fallback : num;
  }
  return fallback;
}

/**
 * Formata valores numéricos para a moeda brasileira (BRL).
 */
export function formatBRL(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Formata números com separador de milhar brasileiro (ex: 1.500).
 */
export function formatNumberBR(value: number, decimals = 0): string {
  if (isNaN(value) || value === null || value === undefined) return '0';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

/**
 * Formata datas do padrão ISO (YYYY-MM-DD) para exibição brasileira (DD/MM/YYYY).
 */
export function formatDateBR(dateStr?: string | null): string {
  if (!dateStr || dateStr === '-' || dateStr === 'N/A' || dateStr === 'null') return 'A definir';
  try {
    const raw = String(dateStr).trim();
    if (raw.match(/^\d{2}\/\d{2}\/\d{4}/)) return raw.substring(0, 10);
    if (raw.match(/^\d{4}-\d{2}-\d{2}/)) {
      const [yyyy, mm, dd] = raw.substring(0, 10).split('-');
      return `${dd}/${mm}/${yyyy}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    return raw;
  } catch {
    return dateStr;
  }
}

/**
 * Extrai estritamente a string YYYY-MM-DD para comparações diretas de calendário.
 */
export function extractIsoDate(dateStr?: string | null): string | null {
  if (!dateStr || dateStr === '-' || dateStr === 'N/A') return null;
  const raw = String(dateStr).trim();
  if (raw.match(/^\d{4}-\d{2}-\d{2}/)) {
    return raw.substring(0, 10);
  }
  if (raw.match(/^\d{2}\/\d{2}\/\d{4}/)) {
    const [dd, mm, yyyy] = raw.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  } catch {}
  return null;
}

/**
 * Retorna o status de previsão de entrega com regras prioritárias.
 */
export function getForecastStatus(
  dateStr?: string | null,
  isoExtractor: (d?: string | null) => string | null = extractIsoDate,
  statusPedido?: string | null
): ForecastStatusInfo {
  // 1. REGRA PRIORITÁRIA DE STATUS ("JÁ CHEGOU")
  if (statusPedido) {
    const normStatus = String(statusPedido).trim().toUpperCase();
    if (
      normStatus === 'PEDIDO ATENDIDO' ||
      normStatus === 'ATENDIDO' ||
      normStatus.includes('PEDIDO ATENDIDO') ||
      normStatus.includes('TOTALMENTE ATENDIDO') ||
      normStatus === 'CONCLUÍDO' ||
      normStatus === 'CONCLUIDO'
    ) {
      return {
        key: 'Já chegou',
        label: 'Já chegou',
        bgStyle: 'bg-teal-500/20 text-teal-300 border-teal-500/40 shadow-sm',
        dotStyle: 'bg-teal-400'
      };
    }
  }

  // 2. Se a data estiver indefinida
  const dataLimpa = isoExtractor(dateStr);
  if (!dataLimpa || !dataLimpa.includes('-')) {
    return {
      key: 'A definir',
      label: 'A definir',
      bgStyle: 'bg-slate-800 text-slate-400 border-slate-700',
      dotStyle: 'bg-slate-500'
    };
  }

  const [anoP, mesP, diaP] = dataLimpa.split('-').map(Number);
  if (!anoP || !mesP || !diaP) {
    return {
      key: 'A definir',
      label: 'A definir',
      bgStyle: 'bg-slate-800 text-slate-400 border-slate-700',
      dotStyle: 'bg-slate-500'
    };
  }

  const prevDate = new Date(anoP, mesP - 1, diaP, 0, 0, 0, 0);
  const hoje = new Date();
  const hojeZero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0, 0);

  const diffTime = prevDate.getTime() - hojeZero.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      key: 'Atrasado',
      label: 'Atrasado',
      bgStyle: 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm',
      dotStyle: 'bg-rose-400'
    };
  }
  if (diffDays === 0) {
    return {
      key: 'Chega hoje!',
      label: 'Chega hoje!',
      bgStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm',
      dotStyle: 'bg-emerald-400'
    };
  }
  if (diffDays === 1) {
    return {
      key: 'Chega amanhã',
      label: 'Chega amanhã',
      bgStyle: 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm',
      dotStyle: 'bg-sky-400'
    };
  }
  if (diffDays >= 2 && diffDays <= 4) {
    return {
      key: 'Chega em breve',
      label: 'Chega em breve',
      bgStyle: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm',
      dotStyle: 'bg-amber-400'
    };
  }
  if (diffDays >= 5 && diffDays <= 7) {
    return {
      key: 'Chega em uma semana',
      label: 'Chega em uma semana',
      bgStyle: 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm',
      dotStyle: 'bg-purple-400'
    };
  }
  return {
    key: 'Chega em mais de uma semana',
    label: 'Chega em mais de uma semana',
    bgStyle: 'bg-slate-700/60 text-slate-300 border-slate-600',
    dotStyle: 'bg-slate-400'
  };
}

/**
 * Retorna as classes CSS e rótulo do status ERP do pedido.
 */
export function getStatusBadgeStyle(statusRaw?: string) {
  const status = String(statusRaw || '').toLowerCase().trim();

  if (status.includes('entreg') || status.includes('conclu') || status.includes('atendido')) {
    return {
      bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      dot: 'bg-emerald-400',
      label: statusRaw || 'Atendido'
    };
  }
  if (status.includes('trânsit') || status.includes('transit') || status.includes('caminho') || status.includes('exped')) {
    return {
      bg: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      dot: 'bg-sky-400',
      label: statusRaw || 'Em trânsito'
    };
  }
  if (status.includes('aprov') || status.includes('faturam') || status.includes('emitid') || status.includes('process')) {
    return {
      bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      dot: 'bg-amber-400',
      label: statusRaw || 'Aprovado'
    };
  }
  if (status.includes('cota') || status.includes('pendent') || status.includes('análise')) {
    return {
      bg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      dot: 'bg-indigo-400',
      label: statusRaw || 'Em cotação'
    };
  }
  if (status.includes('cancel')) {
    return {
      bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      dot: 'bg-rose-400',
      label: statusRaw || 'Cancelado'
    };
  }

  return {
    bg: 'bg-slate-700/60 text-slate-300 border-slate-600',
    dot: 'bg-slate-400',
    label: statusRaw || 'Em andamento'
  };
}

/**
 * HOOK PRINCIPAL: useAgrupamentoPedidos
 * Transforma uma lista plana de linhas do Supabase em uma estrutura Mestre-Detalhe rica:
 * 1. Capa do Documento (Agrupada por `pedido` com metadados e soma do Valor Líquido Total).
 * 2. Relação de Itens (Agrupada por `produto_descricao` com soma da quantidade pedida e saldo a receber).
 * 3. Rateio Financeiro e Custos (Detalhamento por Linha/Centro de Custo/RM).
 */
export function useAgrupamentoPedidos(linhasPlanas: PedidoCompraBI[]) {
  return useMemo(() => {
    if (!linhasPlanas || linhasPlanas.length === 0) {
      return {
        documentos: [] as PedidoCompraDocumento[],
        kpis: {
          totalPedidos: 0,
          totalItensDistintos: 0,
          totalRms: 0,
          valorLiquidoTotalGeral: 0,
          quantidadeTotalPedidaGeral: 0,
          saldoTotalAReceberGeral: 0,
          quantidadeTotalRecebidaGeral: 0,
          percentualGeralAtendido: 0
        },
        listaCompradores: [] as string[],
        listaFornecedores: [] as string[],
        listaCentrosCusto: [] as string[],
        listaStatus: [] as string[]
      };
    }

    // 1. Agrupar linhas pelo número do Pedido de Compra (`pedido`)
    const mapaPedidos = new Map<string, PedidoCompraBI[]>();

    linhasPlanas.forEach((linha) => {
      const pedidoKey = String(linha.pedido || '-').trim() || 'SEM-PEDIDO';
      if (!mapaPedidos.has(pedidoKey)) {
        mapaPedidos.set(pedidoKey, []);
      }
      mapaPedidos.get(pedidoKey)!.push(linha);
    });

    const compradoresSet = new Set<string>();
    const fornecedoresSet = new Set<string>();
    const centrosCustoSet = new Set<string>();
    const statusSet = new Set<string>();
    const rmsSetGlobal = new Set<string>();

    let valorGeral = 0;
    let qtdPedidaGeral = 0;
    let saldoReceberGeral = 0;

    const documentos: PedidoCompraDocumento[] = [];

    mapaPedidos.forEach((linhasDoPedido, pedidoKey) => {
      // Metadados do Pedido a partir da primeira linha e/ou consolidados
      const primeiraLinha = linhasDoPedido[0];

      const statusConsolidado = primeiraLinha.status_pedido || 'Em processamento';
      const dataEmissaoConsolidada = primeiraLinha.data_emissao || '';
      const compradorConsolidado = primeiraLinha.comprador_real || 'Comprador não informado';
      const fornecedorConsolidado = primeiraLinha.fornecedor || 'Fornecedor não informado';

      if (compradorConsolidado && compradorConsolidado !== 'Comprador não informado') {
        compradoresSet.add(compradorConsolidado);
      }
      if (fornecedorConsolidado && fornecedorConsolidado !== 'Fornecedor não informado') {
        fornecedoresSet.add(fornecedorConsolidado);
      }
      if (statusConsolidado) {
        statusSet.add(statusConsolidado);
      }

      // Coleções para o pedido
      const rmsDoPedido = new Set<string>();
      const centrosCustoDoPedido = new Set<string>();
      let valorLiquidoPedido = 0;
      let qtdTotalPedidaPedido = 0;
      let saldoTotalReceberPedido = 0;
      let syncMaisRecente: string | null = null;
      let maxSyncMs = 0;

      // Rateios gerais de todo o pedido
      const rateiosGerais: PedidoRateioDestino[] = [];

      // 2. Agrupar itens dentro do pedido por `produto_descricao`
      const mapaProdutos = new Map<string, PedidoCompraBI[]>();

      linhasDoPedido.forEach((linha, idx) => {
        const rawRm = String(linha.solicitacao || '').trim();
        if (rawRm && rawRm !== 'RM-N/A' && rawRm !== '-') {
          rmsDoPedido.add(rawRm);
          rmsSetGlobal.add(rawRm);
        }

        const rawCc = String(linha.centro_custo || '').trim();
        if (rawCc) {
          centrosCustoDoPedido.add(rawCc);
          centrosCustoSet.add(rawCc);
        }

        // Quantidades e Valores
        const qtdPedida = safeNumber(linha.quantidade_pedida ?? linha.quantidade, 0);
        
        // Se saldo_a_receber não foi passado explicitamente, verifica status ou calcula
        let saldoReceber = linha.saldo_a_receber !== undefined && linha.saldo_a_receber !== null
          ? safeNumber(linha.saldo_a_receber, 0)
          : 0;

        // Se o status for atendido e saldo_a_receber estiver indefinido, saldo = 0
        const statusNorm = String(linha.status_pedido || '').trim().toUpperCase();
        if (
          (linha.saldo_a_receber === undefined || linha.saldo_a_receber === null) &&
          (statusNorm === 'PEDIDO ATENDIDO' || statusNorm === 'ATENDIDO' || statusNorm.includes('ATENDIDO'))
        ) {
          saldoReceber = 0;
        } else if (linha.saldo_a_receber === undefined || linha.saldo_a_receber === null) {
          // Fallback padrão se não informado
          saldoReceber = qtdPedida;
        }

        const vUnit = safeNumber(linha.valor_unitario, 0);
        let vTotal = safeNumber(linha.valor_total, 0);
        if (vTotal === 0 && vUnit > 0 && qtdPedida > 0) {
          vTotal = vUnit * qtdPedida;
        }

        valorLiquidoPedido += vTotal;
        qtdTotalPedidaPedido += qtdPedida;
        saldoTotalReceberPedido += saldoReceber;

        if (linha.atualizado_em) {
          const t = new Date(linha.atualizado_em).getTime();
          if (!isNaN(t) && t > maxSyncMs) {
            maxSyncMs = t;
            syncMaisRecente = linha.atualizado_em;
          }
        }

        // Criar registro de rateio da linha
        const rateioDestino: PedidoRateioDestino = {
          rawId: linha.id || `rateio-${pedidoKey}-${idx}`,
          solicitacao: rawRm || 'RM-N/A',
          centro_custo: rawCc || 'Centro de Custo não informado',
          quantidade_pedida: qtdPedida,
          saldo_a_receber: saldoReceber,
          qtd_recebida: Math.max(0, qtdPedida - saldoReceber),
          valor_total_rateio: vTotal,
          produto_descricao: linha.produto_descricao || 'Item sem descrição',
          previsao_entrega: linha.previsao_entrega || '-',
          status_linha: linha.status_pedido
        };

        rateiosGerais.push(rateioDestino);

        // Agrupador por produto
        const prodKey = String(linha.produto_descricao || 'PRODUTO-SEM-NOME').trim().toLowerCase();
        if (!mapaProdutos.has(prodKey)) {
          mapaProdutos.set(prodKey, []);
        }
        mapaProdutos.get(prodKey)!.push(linha);
      });

      // Consolidação dos Produtos do Pedido
      const itensConsolidados: ItemProdutoConsolidado[] = [];
      let previsaoDestaque = '-';

      mapaProdutos.forEach((linhasProduto, prodKey) => {
        const prodDesc = linhasProduto[0].produto_descricao || 'Item sem descrição';
        let somaQtdPedida = 0;
        let somaSaldoReceber = 0;
        let somaValorTotal = 0;
        let somaValorUnitario = 0;
        let countUnits = 0;
        const previsoesProdSet = new Set<string>();
        const rateiosItem: PedidoRateioDestino[] = [];

        linhasProduto.forEach((lp, i) => {
          const qP = safeNumber(lp.quantidade_pedida ?? lp.quantidade, 0);
          let sR = lp.saldo_a_receber !== undefined && lp.saldo_a_receber !== null
            ? safeNumber(lp.saldo_a_receber, 0)
            : 0;

          const stN = String(lp.status_pedido || '').trim().toUpperCase();
          if (
            (lp.saldo_a_receber === undefined || lp.saldo_a_receber === null) &&
            (stN === 'PEDIDO ATENDIDO' || stN === 'ATENDIDO' || stN.includes('ATENDIDO'))
          ) {
            sR = 0;
          } else if (lp.saldo_a_receber === undefined || lp.saldo_a_receber === null) {
            sR = qP;
          }

          const vU = safeNumber(lp.valor_unitario, 0);
          let vT = safeNumber(lp.valor_total, 0);
          if (vT === 0 && vU > 0 && qP > 0) {
            vT = vU * qP;
          }

          somaQtdPedida += qP;
          somaSaldoReceber += sR;
          somaValorTotal += vT;
          if (vU > 0) {
            somaValorUnitario += vU;
            countUnits++;
          }

          if (lp.previsao_entrega && lp.previsao_entrega !== '-' && lp.previsao_entrega !== 'N/A') {
            previsoesProdSet.add(lp.previsao_entrega);
            if (previsaoDestaque === '-') {
              previsaoDestaque = lp.previsao_entrega;
            }
          }

          rateiosItem.push({
            rawId: lp.id || `item-rateio-${prodKey}-${i}`,
            solicitacao: String(lp.solicitacao || 'RM-N/A').trim(),
            centro_custo: String(lp.centro_custo || 'Centro de Custo não informado').trim(),
            quantidade_pedida: qP,
            saldo_a_receber: sR,
            qtd_recebida: Math.max(0, qP - sR),
            valor_total_rateio: vT,
            produto_descricao: prodDesc,
            previsao_entrega: lp.previsao_entrega || '-',
            status_linha: lp.status_pedido
          });
        });

        const qtdRecebida = Math.max(0, somaQtdPedida - somaSaldoReceber);
        const percentual = somaQtdPedida > 0 ? Math.min(100, Math.round((qtdRecebida / somaQtdPedida) * 100)) : 0;

        let statusItem: 'TOTALMENTE ENTREGUE' | 'PARCIALMENTE ENTREGUE' | 'PENDENTE' = 'PENDENTE';
        if (somaSaldoReceber <= 0 && somaQtdPedida > 0) {
          statusItem = 'TOTALMENTE ENTREGUE';
        } else if (qtdRecebida > 0 && somaSaldoReceber > 0) {
          statusItem = 'PARCIALMENTE ENTREGUE';
        }

        const vMedio = countUnits > 0 ? (somaValorUnitario / countUnits) : (somaQtdPedida > 0 ? (somaValorTotal / somaQtdPedida) : 0);

        const listPrevisoes = Array.from(previsoesProdSet);

        itensConsolidados.push({
          id_produto: prodKey,
          produto_descricao: prodDesc,
          quantidade_pedida_total: somaQtdPedida,
          saldo_a_receber_total: somaSaldoReceber,
          qtd_recebida_total: qtdRecebida,
          percentual_atendido: percentual,
          valor_unitario_medio: vMedio,
          valor_total_produto: somaValorTotal,
          previsoes: listPrevisoes,
          previsao_mais_recente: listPrevisoes[0] || '-',
          status_item: statusItem,
          rateios: rateiosItem
        });
      });

      // Acumula no Totalizador Geral
      valorGeral += valorLiquidoPedido;
      qtdPedidaGeral += qtdTotalPedidaPedido;
      saldoReceberGeral += saldoTotalReceberPedido;

      const qtdRecebidaPedido = Math.max(0, qtdTotalPedidaPedido - saldoTotalReceberPedido);
      const percPedido = qtdTotalPedidaPedido > 0
        ? Math.min(100, Math.round((qtdRecebidaPedido / qtdTotalPedidaPedido) * 100))
        : 0;

      documentos.push({
        pedido: pedidoKey,
        status_pedido: statusConsolidado,
        data_emissao: dataEmissaoConsolidada,
        comprador_real: compradorConsolidado,
        fornecedor: fornecedorConsolidado,
        valor_liquido_total: valorLiquidoPedido,
        quantidade_total_pedida: qtdTotalPedidaPedido,
        saldo_total_a_receber: saldoTotalReceberPedido,
        quantidade_total_recebida: qtdRecebidaPedido,
        percentual_geral_atendido: percPedido,
        previsao_entrega_destaque: previsaoDestaque !== '-' ? previsaoDestaque : (primeiraLinha.previsao_entrega || '-'),
        itens: itensConsolidados,
        rateios_gerais: rateiosGerais,
        centros_custo_unicos: Array.from(centrosCustoDoPedido),
        rms_unicas: Array.from(rmsDoPedido),
        total_itens_distintos: itensConsolidados.length,
        linhas_originais_count: linhasDoPedido.length,
        atualizado_em: syncMaisRecente || primeiraLinha.atualizado_em || ''
      });
    });

    const qtdRecebidaGeral = Math.max(0, qtdPedidaGeral - saldoReceberGeral);
    const percGeral = qtdPedidaGeral > 0
      ? Math.min(100, Math.round((qtdRecebidaGeral / qtdPedidaGeral) * 100))
      : 0;

    return {
      documentos,
      kpis: {
        totalPedidos: documentos.length,
        totalItensDistintos: documentos.reduce((acc, doc) => acc + doc.total_itens_distintos, 0),
        totalRms: rmsSetGlobal.size,
        valorLiquidoTotalGeral: valorGeral,
        quantidadeTotalPedidaGeral: qtdPedidaGeral,
        saldoTotalAReceberGeral: saldoReceberGeral,
        quantidadeTotalRecebidaGeral: qtdRecebidaGeral,
        percentualGeralAtendido: percGeral
      },
      listaCompradores: Array.from(compradoresSet).sort(),
      listaFornecedores: Array.from(fornecedoresSet).sort(),
      listaCentrosCusto: Array.from(centrosCustoSet).sort(),
      listaStatus: Array.from(statusSet).sort()
    };
  }, [linhasPlanas]);
}
