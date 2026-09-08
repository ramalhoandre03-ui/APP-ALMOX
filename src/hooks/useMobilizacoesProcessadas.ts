import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

/**
 * 1. Normalizador de Centro de Custo (A Pedra de Roseta):
 * Mapeia expressões parciais para o nome oficial unificado e garante cruzamento exato entre as tabelas.
 */
export const normalizarCC = (ccRaw?: string) => {
  if (!ccRaw) return 'SEM OBRA DEFINIDA';
  
  const cc = ccRaw.toUpperCase().trim();

  // Dicionário de Unificação (Obras Comuns vs Oficiais)
  if (cc.includes('D1A')) return 'ALU D1A CALC 3 SLZ 08-26';
  if (cc.includes('MO 21')) return 'ALU MO 21-22 SLZ 06-26';
  if (cc.includes('CAL 11')) return 'ALU CAL 11-12-13 SLZ 01-26';
  if (cc.includes('ALU PC')) return 'ALU PC-11 SLZ 02-26';
  if (cc.includes('ARB 10')) return 'ALU ARB 10 SLZ 06-26';
  
  // Novas correções identificadas no log:
  if (cc.includes('COMP 111R')) return 'ALU COMP 111R SLZ 07-26';
  if (cc.includes('CALC 2')) return 'ALU CALC 2 SLZ 04-26';
  if (cc.includes('CALC 3')) return 'ALU CALC 3 SLZ 07-26';
  if (cc.includes('CALC 4')) return 'ALU CALC 4 SLZ 06-26';
  if (cc.includes('CAL 31')) return 'ALU CAL 31 SLZ 03-26';

  // Fallback de segurança: se o nome veio sem "-26" do banco base, adiciona automaticamente
  // (Ajuste conforme o padrão da empresa, mas isso evita zerar telas)
  if (cc.startsWith('ALU ') && !cc.includes('-26')) {
     return `${cc}-26`;
  }

  return cc;
};

export interface ProcessedItemMobilizacao {
  id?: string | number;
  material?: string;
  setor?: string;
  centroCusto?: string;
  centro_custo?: string;
  quantidade?: number | string;
  quantidade_solicitada?: number | string;
  quantidade_atendida?: number | string;
  status?: string;
  status_interno?: string;
  motivo?: string;
  numero_rtd?: string | number;
  item_status?: string;
  qtdTriagem: number;
  qtdCompra: number;
  qtdDisponivel: number;
  qtdMobilizado: number;
  [key: string]: any;
}

/**
 * 2. A Matemática do Funil Logístico:
 * Itera sobre cada linha de requisições e processa em cascata:
 * Triagem -> Compra -> Disponível -> Mobilizado
 */
export const processarItemMobilizacao = (
  requisicao: any, 
  recebimentos: any[] = [], 
  expedicoes: any[] = []
): ProcessedItemMobilizacao => {
  const mat = requisicao.material?.trim();
  const setorNormalizado = normalizarCC(requisicao.setor || requisicao.centroCusto || requisicao.centro_custo || requisicao.obra);
  const qtdSolicitada = Number(requisicao.quantidade || requisicao.quantidade_solicitada || 0);
  
  let qtdTriagem = 0;
  let qtdCompra = 0;
  let qtdDisponivel = 0;
  let qtdMobilizado = 0;

  // Analisa o status da RM no fluxo de Diligenciamento
  const stInterno = requisicao.status_interno;
  // Consideramos "Em Triagem" se estiver presa nos setores iniciais ou não tratada
  const presaEmDiligenciamento = 
    !stInterno || 
    stInterno === 'Aguardando Aprovador' || 
    stInterno === 'Em tratamento' || 
    stInterno === 'Maternidade' || 
    stInterno === 'Direcionamento';

  const isTroca = requisicao.motivo?.toUpperCase().includes('TROCA');
  
  // -------------------------------------------------------------
  // REGRA DE OURO 1 (TROCA MANUAL: VETO MÁXIMO)
  // -------------------------------------------------------------
  if (isTroca && !presaEmDiligenciamento) {
    return { ...requisicao, qtdTriagem: 0, qtdCompra: 0, qtdDisponivel: 0, qtdMobilizado: qtdSolicitada };
  }

  // -------------------------------------------------------------
  // REGRA DE OURO 2 (BLOQUEIO DE DILIGENCIAMENTO)
  // -------------------------------------------------------------
  if (presaEmDiligenciamento) {
    // Se a RM está presa em qualquer tela pré-compra, TUDO fica em triagem. Fim de papo.
    return { ...requisicao, qtdTriagem: qtdSolicitada, qtdCompra: 0, qtdDisponivel: 0, qtdMobilizado: 0 };
  }

  // -------------------------------------------------------------
  // ETAPA 3: DEFINIÇÃO BASE PÓS-TRIAGEM (COMPRA vs SEPARADO)
  // -------------------------------------------------------------
  const temRTD = !!requisicao.numero_rtd && String(requisicao.numero_rtd).trim() !== '';
  const isReprovadoMega = requisicao.status === 'Reprovado pelo MEGA';
  const qtdAtendida = Number(requisicao.quantidade_atendida || 0);

  if (isReprovadoMega) {
    // Reprovado = Atendido com reaproveitamento do estoque físico
    qtdDisponivel = qtdSolicitada;
  } else if (temRTD || qtdAtendida > 0) {
    // Tem RTD ou tem quantidade atendida parcial
    qtdDisponivel = qtdAtendida > 0 ? Math.min(qtdAtendida, qtdSolicitada) : qtdSolicitada;
    qtdCompra = Math.max(0, qtdSolicitada - qtdDisponivel);
  } else if (requisicao.item_status === 'COMPRA' || mat?.toUpperCase().includes('LOCAÇÃO') || (!temRTD)) {
    // Direcionado a compra pelo status, por ser locação, ou porque foi tratado e não gerou RTD de estoque
    qtdCompra = qtdSolicitada;
  }

  // -------------------------------------------------------------
  // ETAPA 3: INTERVENÇÃO DA TABELA DE RECEBIMENTOS
  // -------------------------------------------------------------
  // Se chegou NF, tira de "Compra" e joga para "Disponível"
  const recsItem = recebimentos.filter(r => 
    r.descricao_item?.trim() === mat && 
    normalizarCC(r.centro_custo || r.centroCusto || r.setor || r.obra) === setorNormalizado
  );
  const totalRecebido = recsItem.reduce((acc, curr) => acc + Number(curr.qtd_recebida || 0), 0);

  if (totalRecebido > 0 && qtdCompra > 0) {
    const qtdMover = Math.min(qtdCompra, totalRecebido);
    qtdCompra -= qtdMover;
    qtdDisponivel += qtdMover;
  }

  // -------------------------------------------------------------
  // ETAPA 4: INTERVENÇÃO DA TABELA DE EXPEDIÇÃO
  // -------------------------------------------------------------
  // Se expediu, tira de "Disponível" e joga para "Mobilizado"
  const expsItem = expedicoes.filter(e => 
    e.descricao_item?.trim() === mat && 
    normalizarCC(e.centro_custo || e.centroCusto || e.setor || e.obra) === setorNormalizado
  );
  const totalExpedido = expsItem.reduce((acc, curr) => acc + Number(curr.quantidade || curr.qtd_expedida || 0), 0);

  if (totalExpedido > 0 && qtdDisponivel > 0) {
    const qtdMover = Math.min(qtdDisponivel, totalExpedido);
    qtdDisponivel -= qtdMover;
    qtdMobilizado += qtdMover;
  }

  return { ...requisicao, qtdTriagem, qtdCompra, qtdDisponivel, qtdMobilizado };
};

export interface UseMobilizacoesProcessadasReturn {
  itensProcessados: ProcessedItemMobilizacao[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  summary: {
    totalSolicitado: number;
    totalTriagem: number;
    totalCompra: number;
    totalDisponivel: number;
    totalMobilizado: number;
  };
}

/**
 * Hook principal para unificar as 4 tabelas e calcular o Funil Logístico
 */
export function useMobilizacoesProcessadas(obrasFiltro?: string[]): UseMobilizacoesProcessadasReturn {
  const [itensProcessados, setItensProcessados] = useState<ProcessedItemMobilizacao[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDados = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const safeQuery = async (queryPromise: any) => {
        try {
          const res = await queryPromise;
          return res || { data: [], error: null };
        } catch (err: any) {
          console.warn('Query Supabase falhou de forma controlada:', err?.message || err);
          return { data: [], error: err };
        }
      };

      const [
        requisicoesRes,
        recebimentosRes,
        expItensRes,
        expLegacyRes
      ] = await Promise.all([
        safeQuery(supabase.from('requisicoes').select('*').limit(100000)),
        safeQuery(supabase.from('recebimentos_itens').select('*').limit(100000)),
        safeQuery(supabase.from('expedicao_itens').select('*').limit(100000)),
        safeQuery(supabase.from('expedicao').select('*').limit(100000))
      ]);

      const requisicoes = requisicoesRes.data || [];
      const recebimentos = recebimentosRes.data || [];
      const expedicoes = [
        ...(expItensRes.data || []),
        ...(expLegacyRes.data || [])
      ];

      // Filtra por obra se informado
      let reqFiltradas = requisicoes;
      if (obrasFiltro && obrasFiltro.length > 0) {
        const normalizedFiltros = obrasFiltro.map(o => normalizarCC(o));
        reqFiltradas = requisicoes.filter((r: any) => {
          const cc = normalizarCC(r.setor || r.centroCusto || r.centro_custo || r.obra);
          return normalizedFiltros.includes(cc);
        });
      }

      // Processa cada linha de requisição
      const processados = reqFiltradas.map((r: any) => 
        processarItemMobilizacao(r, recebimentos, expedicoes)
      );

      setItensProcessados(processados);
    } catch (err: any) {
      console.error('Erro ao processar mobilizações:', err);
      setError(err?.message || 'Erro ao carregar dados do funil');
    } finally {
      setIsLoading(false);
    }
  }, [obrasFiltro ? obrasFiltro.join('|') : '']);

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  const summary = useMemo(() => {
    let totalSolicitado = 0;
    let totalTriagem = 0;
    let totalCompra = 0;
    let totalDisponivel = 0;
    let totalMobilizado = 0;

    itensProcessados.forEach(item => {
      totalSolicitado += Number(item.quantidade || item.quantidade_solicitada || 0);
      totalTriagem += Number(item.qtdTriagem || 0);
      totalCompra += Number(item.qtdCompra || 0);
      totalDisponivel += Number(item.qtdDisponivel || 0);
      totalMobilizado += Number(item.qtdMobilizado || 0);
    });

    return {
      totalSolicitado,
      totalTriagem,
      totalCompra,
      totalDisponivel,
      totalMobilizado
    };
  }, [itensProcessados]);

  return {
    itensProcessados,
    isLoading,
    error,
    refetch: fetchDados,
    summary
  };
}
