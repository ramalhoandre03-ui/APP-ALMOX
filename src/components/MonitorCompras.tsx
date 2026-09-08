import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PackageSearch,
  Search,
  RefreshCw,
  Calendar,
  Building2,
  Boxes,
  Clock,
  AlertCircle,
  FileText,
  X,
  Database,
  Tag,
  Filter,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  DollarSign,
  UserCheck,
  LayoutGrid,
  Table as TableIcon,
  ChevronsDown,
  ChevronsUp,
  PieChart,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PedidoCompraBI } from '../types/compras';
import {
  useAgrupamentoPedidos,
  formatBRL,
  formatNumberBR,
  formatDateBR,
  extractIsoDate,
  getForecastStatus,
  getStatusBadgeStyle,
  safeNumber
} from '../hooks/useAgrupamentoPedidos';
import { PedidoDocumentoCard } from './compras/PedidoDocumentoCard';

export const FORECAST_FILTERS = [
  'Todos',
  'Já chegou',
  'Atrasado',
  'Chega hoje!',
  'Chega amanhã',
  'Chega em breve',
  'Chega em uma semana',
  'Chega em mais de uma semana'
];

interface MonitorComprasProps {
  /**
   * RM ou termo inicial opcional para filtrar automaticamente ao carregar
   */
  initialRm?: string;
  /**
   * Classes adicionais de estilização Tailwind
   */
  className?: string;
  /**
   * Título customizado do card
   */
  title?: string;
  /**
   * Modos de exibição (standalone = container completo com fundo, compact = para dashboards)
   */
  variant?: 'card' | 'standalone' | 'compact';
  /**
   * Callback opcional de fechamento/voltar
   */
  onClose?: () => void;
}

export function MonitorCompras({
  initialRm = '',
  className = '',
  title = "RASTREIO DE RM'S COM PEDIDOS DE COMPRA",
  variant = 'card',
  onClose
}: MonitorComprasProps) {
  const [inputPesquisa, setInputPesquisa] = useState<string>(initialRm);
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [selectedObra, setSelectedObra] = useState<string>('');
  const [selectedFornecedor, setSelectedFornecedor] = useState<string>('');
  const [selectedComprador, setSelectedComprador] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedForecastFilter, setSelectedForecastFilter] = useState<string>('Todos');

  // Modo de visualização: Documento Mestre-Detalhe (padrão) ou Tabela Flat
  const [viewMode, setViewMode] = useState<'documento' | 'tabela'>('documento');
  const [expandAll, setExpandAll] = useState<boolean>(true);

  // Paginação de pedidos
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [logoUrl, setLogoUrl] = useState<string>(() => {
    return localStorage.getItem('sidebar_logo_url') || '';
  });

  // Tenta obter o logotipo oficial 'logo_almox.png' do bucket assets do Supabase
  useEffect(() => {
    try {
      const { data } = supabase.storage.from('assets').getPublicUrl('logo_almox.png');
      if (data?.publicUrl) {
        setLogoUrl(data.publicUrl);
      }
    } catch (err) {
      console.warn('Erro ao carregar logo_almox.png:', err);
    }
  }, []);

  const [purchases, setPurchases] = useState<PedidoCompraBI[]>([]);
  const [recebimentos, setRecebimentos] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastSyncDate, setLastSyncDate] = useState<string | null>(null);
  const [syncTimestamp, setSyncTimestamp] = useState<string | null>(null);
  const [totalRowsInDatabase, setTotalRowsInDatabase] = useState<number>(0);
  const [lastFetchTime, setLastFetchTime] = useState<string>('');
  const [nowTick, setNowTick] = useState<number>(Date.now());

  // Atualiza o relógio local a cada 30s
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // ============================================================================
  // FETCH DE ALTA PERFORMANCE COM AUTO-PAGINAÇÃO (CHUNKED FETCH COMPLETO)
  // ============================================================================
  const carregarDadosBi = useCallback(async (isManualRefresh: boolean = false) => {
    setLoading(true);
    setFetchError(null);
    if (isManualRefresh) {
      setPurchases([]);
    }

    try {
      // 1. Busca o carimbo oficial de atualização na tabela configuracao_sistema
      try {
        const { data: configRow } = await supabase
          .from('configuracao_sistema')
          .select('ultima_atualizacion, ultima_atualizacao, updated_at, created_at')
          .eq('id', 'geral')
          .maybeSingle();

        if (configRow) {
          const ts =
            configRow.ultima_atualizacion ||
            configRow.ultima_atualizacao ||
            configRow.updated_at ||
            configRow.created_at;
          if (ts) {
            setSyncTimestamp(ts);
          }
        }
      } catch (cfgErr) {
        console.warn('Busca de carimbo em configuracao_sistema:', cfgErr);
      }

      // 2. BUSCA COMPLETA E SEM CORTE EM pedidos_compras_bi (PAGINANDO DE 1000 EM 1000 NO SUPABASE)
      let allRows: any[] = [];
      let from = 0;
      const CHUNK_SIZE = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: chunk, error: chunkError } = await supabase
          .from('pedidos_compras_bi')
          .select('*')
          .order('id', { ascending: true })
          .range(from, from + CHUNK_SIZE - 1);

        if (chunkError) {
          throw chunkError;
        }

        if (chunk && chunk.length > 0) {
          allRows = allRows.concat(chunk);
          if (chunk.length < CHUNK_SIZE) {
            hasMore = false;
          } else {
            from += CHUNK_SIZE;
          }
        } else {
          hasMore = false;
        }
      }

      // 3. FETCH DUPLO: Dados de conferência física de recebimentos_itens
      try {
        const { data: recData, error: recError } = await supabase
          .from('recebimentos_itens')
          .select(
            'numero_pc, qtd_recebida, qtd_entregue, quantidade, qtd, status_fisico, conferente, nota_fiscal, data_recebimento, created_at'
          )
          .limit(2000);
        if (!recError && recData) {
          setRecebimentos(recData);
        }
      } catch (recErr) {
        console.warn('Erro ao carregar recebimentos_itens:', recErr);
      }

      setTotalRowsInDatabase(allRows.length);
      setLastFetchTime(new Date().toLocaleTimeString('pt-BR'));

      if (allRows.length > 0) {
        // MAPEAR 100% DOS REGISTROS COM O NOVO ESQUEMA DO SUPABASE
        const listFormatada: PedidoCompraBI[] = allRows.map((row: any, index: number) => {
          // Extração segura da RM / Solicitação
          const rawSolicitacao =
            row.solicitacao ??
            row.rm ??
            row.numero_solicitacao ??
            row.solicitacao_numero ??
            row.rm_numero ??
            row.num_rm ??
            row.rm_num;
          const solicitacaoVal =
            rawSolicitacao !== undefined && rawSolicitacao !== null && String(rawSolicitacao).trim() !== ''
              ? String(rawSolicitacao).trim()
              : 'RM-N/A';

          // Extração segura do Pedido de Compra (PC)
          const rawPedido =
            row.pedido ??
            row.numero_pc ??
            row.pc ??
            row.numero_pedido ??
            row.pedido_numero ??
            row.num_pedido ??
            row.pc_numero;
          const pedidoVal =
            rawPedido !== undefined && rawPedido !== null && String(rawPedido).trim() !== ''
              ? String(rawPedido).trim()
              : '-';

          // Comprador Real
          const compradorVal =
            row.comprador_real ??
            row.comprador ??
            row.nome_comprador ??
            row.comprador_nome ??
            'Comprador não informado';

          // Fornecedor
          const fornecedorVal =
            row.fornecedor ||
            row.nome_fornecedor ||
            row.razao_social ||
            row.fornecedor_nome ||
            row.fornecedor_razao ||
            'Fornecedor não informado';

          // Descrição do Produto / Item
          const produtoVal =
            row.produto_descricao ||
            row.descricao_item ||
            row.descricao ||
            row.produto ||
            row.item_descricao ||
            row.item ||
            'Item sem descrição';

          // Quantidade Pedida (Total Autorizada)
          const qtdPedidaVal = safeNumber(
            row.quantidade_pedida ?? row.quantidade ?? row.qtd_pedida ?? row.qtd ?? row.quant,
            0
          );

          // Saldo a Receber (Pendente)
          const saldoVal =
            row.saldo_a_receber !== undefined && row.saldo_a_receber !== null
              ? safeNumber(row.saldo_a_receber, 0)
              : null;

          // Valor Unitário e Valor Total
          const valorUnitVal = safeNumber(
            row.valor_unitario ?? row.vl_unitario ?? row.preco_unitario ?? row.unitario,
            0
          );
          const valorTotalVal = safeNumber(
            row.valor_total ?? row.vl_total ?? row.total ?? (valorUnitVal * qtdPedidaVal),
            0
          );

          // Status do Pedido
          const statusVal =
            row.status_pedido || row.status || row.situacao || row.status_compra || 'Em processamento';

          // Data de Emissão
          const dataEmissaoVal =
            row.data_emissao || row.dt_emissao || row.emissao || row.data_pedido || '';

          // Previsão de Entrega
          const previsaoVal =
            row.previsao_entrega ||
            row.data_previsao ||
            row.dt_previsao ||
            row.dt_entrega ||
            row.data_entrega ||
            row.previsao ||
            '-';

          // Centro de Custo / Obra
          const ccVal = row.centro_custo || row.cc || row.centro_de_custo || row.obra || '';

          // Timestamp de sincronização
          const atualizadoVal = row.atualizado_em || row.created_at || row.updated_at || null;

          return {
            id: row.id || `row-${index}`,
            solicitacao: solicitacaoVal,
            pedido: pedidoVal,
            comprador_real: compradorVal,
            fornecedor: fornecedorVal,
            produto_descricao: produtoVal,
            quantidade_pedida: qtdPedidaVal,
            saldo_a_receber: saldoVal !== null ? saldoVal : qtdPedidaVal,
            valor_unitario: valorUnitVal,
            valor_total: valorTotalVal,
            status_pedido: statusVal,
            data_emissao: dataEmissaoVal,
            previsao_entrega: previsaoVal,
            atualizado_em: atualizadoVal || '',
            centro_custo: ccVal,
            quantidade: qtdPedidaVal
          };
        });

        // Identifica a data mais recente nos registros
        let latestDateStr: string | null = null;
        let maxTimestampMs = 0;
        for (const item of listFormatada) {
          if (item.atualizado_em) {
            const timeMs = new Date(item.atualizado_em).getTime();
            if (!isNaN(timeMs) && timeMs > maxTimestampMs) {
              maxTimestampMs = timeMs;
              latestDateStr = item.atualizado_em;
            }
          }
        }

        setPurchases(listFormatada);
        setLastSyncDate(latestDateStr);
      } else {
        setPurchases([]);
        setLastSyncDate(null);
      }
    } catch (err: any) {
      console.error('Fetch falhou em pedidos_compras_bi:', err);
      setFetchError(`Erro ao conectar com o Supabase: ${err?.message || 'Falha na requisição'}`);
      setPurchases([]);
      setLastSyncDate(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    carregarDadosBi(false);
  }, [carregarDadosBi]);

  // Sincronização em Tempo Real (Supabase Realtime Channel)
  useEffect(() => {
    try {
      const channel = supabase
        .channel('realtime_pedidos_compras_bi')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pedidos_compras_bi' },
          (payload) => {
            console.log('[Supabase Realtime] Alteração detectada em pedidos_compras_bi:', payload.eventType);
            carregarDadosBi(false);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn('Realtime subscription error:', e);
    }
  }, [carregarDadosBi]);

  // Status dinâmico da sincronização (Alerta para > 1h30 / 90 min)
  const syncStatus = useMemo(() => {
    let latestTs: string | null = syncTimestamp || lastSyncDate;

    if (purchases && purchases.length > 0) {
      let maxTimeMs = 0;
      for (const item of purchases) {
        if (item.atualizado_em) {
          const t = new Date(item.atualizado_em).getTime();
          if (!isNaN(t) && t > maxTimeMs) {
            maxTimeMs = t;
            latestTs = item.atualizado_em;
          }
        }
      }
    }

    if (!latestTs) {
      return {
        isUpToDate: false,
        formattedTime: 'Indisponível',
        diffMinutes: null,
        statusLabel: 'ATENÇÃO: ATRASADO (> 1H30)',
        statusDetail: 'Sem dados ou sem carimbo de atualização',
        timeAgoText: ''
      };
    }

    const syncDate = new Date(latestTs);
    if (isNaN(syncDate.getTime())) {
      return {
        isUpToDate: false,
        formattedTime: latestTs,
        diffMinutes: null,
        statusLabel: 'ATENÇÃO: ATRASADO (> 1H30)',
        statusDetail: 'Data de sincronização inválida',
        timeAgoText: ''
      };
    }

    const now = new Date();
    const diffMs = now.getTime() - syncDate.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    const hh = String(syncDate.getHours()).padStart(2, '0');
    const mm = String(syncDate.getMinutes()).padStart(2, '0');
    const dd = String(syncDate.getDate()).padStart(2, '0');
    const mes = String(syncDate.getMonth() + 1).padStart(2, '0');
    const yyyy = syncDate.getFullYear();
    const formattedTime = `${dd}/${mes}/${yyyy} às ${hh}:${mm}`;

    let timeAgoText = '';
    if (diffMinutes <= 0) {
      timeAgoText = 'há menos de 1 min';
    } else if (diffMinutes === 1) {
      timeAgoText = 'há 1 min';
    } else if (diffMinutes < 60) {
      timeAgoText = `há ${diffMinutes} min`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      if (hours < 24) {
        timeAgoText = `há ${hours}h${mins > 0 ? ` ${mins}m` : ''}`;
      } else {
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        timeAgoText = `há ${days}d${remHours > 0 ? ` ${remHours}h` : ''}`;
      }
    }

    const isUpToDate = diffMinutes >= -5 && diffMinutes <= 90;

    return {
      isUpToDate,
      formattedTime,
      diffMinutes,
      statusLabel: isUpToDate ? 'SINCRONIZADO' : 'ATENÇÃO: ATRASADO (> 1H30)',
      statusDetail: isUpToDate
        ? `Sincronizado recentemente (${timeAgoText})`
        : `Última sincronização ${timeAgoText} (> 1h30)`,
      timeAgoText
    };
  }, [syncTimestamp, lastSyncDate, purchases, nowTick]);

  // Lógica de pesquisa e filtragem avançada sobre os dados brutos
  const purchasesDeduplicadas = useMemo(() => {
    if (!purchases) return [];
    
    const mapaUnico = new Map();
    
    purchases.forEach((item: any) => {
      // Cria uma chave única juntando o PC e o Código/Descrição do Material
      const chaveUnica = `${item.pedido || item.numero_pc || 'SEM_PC'}_${item.codigo || item.codigo_material || item.codigo_item || item.produto_descricao || item.descricao_item || 'SEM_COD'}`;
      
      if (!mapaUnico.has(chaveUnica)) {
        // Se é a primeira vez que vemos esse PC+Item, guardamos ele
        mapaUnico.set(chaveUnica, { ...item, rmsVinculadas: [item.solicitacao || item.rmNumber || item.rm] });
      } else {
        // Se já existe, não somamos a quantidade! Apenas registramos que ele atende outra RM.
        const itemExistente = mapaUnico.get(chaveUnica);
        if (item.solicitacao || item.rmNumber || item.rm) {
           if (!itemExistente.rmsVinculadas) itemExistente.rmsVinculadas = [];
           itemExistente.rmsVinculadas.push(item.solicitacao || item.rmNumber || item.rm);
        }
      }
    });

    return Array.from(mapaUnico.values());
  }, [purchases]);

  const dadosFiltrados = useMemo(() => {
    const termo = inputPesquisa.toLowerCase().trim();
    return purchasesDeduplicadas.filter((item) => {
      // 1. Pesquisa Omni-Search
      if (termo) {
        const matchText =
          String(item.solicitacao || '').toLowerCase().includes(termo) ||
          String(item.pedido || '').toLowerCase().includes(termo) ||
          String(item.comprador_real || '').toLowerCase().includes(termo) ||
          String(item.fornecedor || '').toLowerCase().includes(termo) ||
          String(item.produto_descricao || '').toLowerCase().includes(termo) ||
          String(item.centro_custo || '').toLowerCase().includes(termo);
        if (!matchText) return false;
      }

      // 2. Filtro por Obra / Centro de Custo
      if (selectedObra && item.centro_custo !== selectedObra) {
        return false;
      }

      // 3. Filtro por Fornecedor
      if (selectedFornecedor && item.fornecedor !== selectedFornecedor) {
        return false;
      }

      // 4. Filtro por Comprador
      if (selectedComprador && item.comprador_real !== selectedComprador) {
        return false;
      }

      // 5. Filtro por Status do Pedido
      if (selectedStatus && item.status_pedido !== selectedStatus) {
        return false;
      }

      // 6. Filtro por Intervalo de Datas
      const itemDate =
        extractIsoDate(item.previsao_entrega) ||
        extractIsoDate(item.data_emissao) ||
        extractIsoDate(item.atualizado_em);
      if (itemDate) {
        if (dataInicio && itemDate < dataInicio) {
          return false;
        }
        if (dataFim && itemDate > dataFim) {
          return false;
        }
      }

      // 7. Filtro por Status de Previsão de Entrega
      if (selectedForecastFilter && selectedForecastFilter !== 'Todos') {
        const forecastInfo = getForecastStatus(item.previsao_entrega, extractIsoDate, item.status_pedido);
        if (forecastInfo.key !== selectedForecastFilter) {
          return false;
        }
      }

      return true;
    });
  }, [
    purchases,
    inputPesquisa,
    selectedObra,
    selectedFornecedor,
    selectedComprador,
    selectedStatus,
    dataInicio,
    dataFim,
    selectedForecastFilter
  ]);

  // ESTRUTURAÇÃO MESTRE-DETALHE COM O HOOK DEDICADO
  const {
    documentos,
    kpis,
    listaCompradores,
    listaFornecedores,
    listaCentrosCusto,
    listaStatus
  } = useAgrupamentoPedidos(dadosFiltrados);

  // Chips dinâmicos para atalhos
  const quickChips = useMemo(() => {
    const set = new Set<string>();
    purchases.forEach((p) => {
      if (p.solicitacao && p.solicitacao !== 'RM-N/A' && p.solicitacao.length >= 3) {
        set.add(p.solicitacao);
      }
      if (p.fornecedor && p.fornecedor !== 'Fornecedor não informado') {
        const primeNome = p.fornecedor.split(' ')[0];
        if (primeNome && primeNome.length > 2) set.add(primeNome);
      }
    });
    return Array.from(set).slice(0, 8);
  }, [purchases]);

  // Contagem dinâmica para a barra de filtros de previsão
  const forecastCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Todos: purchases.length,
      'Já chegou': 0,
      Atrasado: 0,
      'Chega hoje!': 0,
      'Chega amanhã': 0,
      'Chega em breve': 0,
      'Chega em uma semana': 0,
      'Chega em mais de uma semana': 0
    };

    purchases.forEach((p) => {
      const st = getForecastStatus(p.previsao_entrega, extractIsoDate, p.status_pedido);
      if (counts[st.key] !== undefined) {
        counts[st.key]++;
      }
    });

    return counts;
  }, [purchases]);

  const hasActiveFilters = Boolean(
    inputPesquisa ||
      dataInicio ||
      dataFim ||
      selectedObra ||
      selectedFornecedor ||
      selectedComprador ||
      selectedStatus ||
      (selectedForecastFilter && selectedForecastFilter !== 'Todos')
  );

  const resetFilters = () => {
    setInputPesquisa('');
    setDataInicio('');
    setDataFim('');
    setSelectedObra('');
    setSelectedFornecedor('');
    setSelectedComprador('');
    setSelectedStatus('');
    setSelectedForecastFilter('Todos');
    setCurrentPage(1);
  };

  // Resetar página quando os filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [
    inputPesquisa,
    selectedObra,
    selectedFornecedor,
    selectedComprador,
    selectedStatus,
    dataInicio,
    dataFim,
    selectedForecastFilter,
    pageSize,
    viewMode
  ]);

  // Paginação dos Documentos de Pedido
  const totalDocPages = useMemo(() => {
    if (pageSize === -1 || documentos.length === 0) return 1;
    return Math.ceil(documentos.length / pageSize);
  }, [documentos.length, pageSize]);

  const documentosParaRenderizar = useMemo(() => {
    if (pageSize === -1) {
      return documentos;
    }
    const startIndex = (currentPage - 1) * pageSize;
    return documentos.slice(startIndex, startIndex + pageSize);
  }, [documentos, currentPage, pageSize]);

  // Paginação da Tabela Flat
  const totalTablePages = useMemo(() => {
    if (pageSize === -1 || dadosFiltrados.length === 0) return 1;
    return Math.ceil(dadosFiltrados.length / pageSize);
  }, [dadosFiltrados.length, pageSize]);

  const dadosTabelaParaRenderizar = useMemo(() => {
    if (pageSize === -1) {
      return dadosFiltrados;
    }
    const startIndex = (currentPage - 1) * pageSize;
    return dadosFiltrados.slice(startIndex, startIndex + pageSize);
  }, [dadosFiltrados, currentPage, pageSize]);

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100 flex flex-col font-sans transition-all w-full relative ${className}`}
      id="monitor-compras-card"
    >
      {/* SEÇÃO SUPERIOR FIXA / STICKY */}
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 p-4 lg:p-6 space-y-4 shadow-2xl">
        
        {/* TOPO: LOGO OFICIAL, TÍTULO E BADGE DE SINCRONIZAÇÃO */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3.5 text-center sm:text-left">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo Almoxarifado CMPC"
                className="h-10 sm:h-12 w-auto object-contain shrink-0 max-w-[200px] filter drop-shadow-md"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : null}

            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                <h2 className="text-base lg:text-xl font-black uppercase tracking-wider text-white">
                  {title}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">
                  Supabase Live • {totalRowsInDatabase} Linhas
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Visão de Documento de Pedidos de Compra (Mestre-Detalhe) integrada à tabela{' '}
                <code className="text-amber-400 font-mono">pedidos_compras_bi</code>
              </p>
            </div>
          </div>

          {/* CANTO SUPERIOR DIREITO: INDICADOR DE SINCRONIZAÇÃO E BOTÕES DE AÇÃO */}
          <div className="flex flex-wrap items-center gap-2.5 justify-center md:justify-end shrink-0">
            
            {/* INDICADOR VISUAL DINÂMICO DE SINCRONIZAÇÃO */}
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border transition-all shadow-md ${
                syncStatus.isUpToDate
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
              }`}
              title={`Carimbo: ${syncStatus.formattedTime} (${syncStatus.statusDetail})`}
            >
              <span className="relative flex h-2 w-2 shrink-0">
                {syncStatus.isUpToDate ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
                  </>
                ) : (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-[0_0_8px_#f43f5e]"></span>
                  </>
                )}
              </span>

              {syncStatus.isUpToDate ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              )}

              <span>{syncStatus.statusLabel}</span>

              {syncStatus.timeAgoText && (
                <span className="font-mono text-[11px] opacity-90 border-l border-current/30 pl-1.5 ml-0.5 lowercase font-semibold">
                  {syncStatus.timeAgoText}
                </span>
              )}
            </div>

            {/* BOTÃO FORÇAR ATUALIZAÇÃO (QUEBRA DE CACHE) */}
            <button
              type="button"
              onClick={() => carregarDadosBi(true)}
              disabled={loading}
              className="p-2 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-lg hover:shadow-amber-500/20 disabled:opacity-50"
              title="Forçar nova busca de todos os dados no Supabase (Limpa cache)"
            >
              <RefreshCw className={`w-4 h-4 text-slate-950 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Buscando...' : 'Atualizar'}</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer border border-slate-700"
                title="Fechar card"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* BARRA DE PESQUISA (AZUL MARINHO COM OPACIDADE DE 50%) */}
        <div className="relative space-y-3">
          <div className="relative flex items-center bg-blue-950/50 backdrop-blur-md border-2 border-blue-800/60 focus-within:border-amber-400 rounded-2xl p-1.5 transition-all shadow-xl group">
            <div className="pl-3 pr-2 text-blue-400 group-focus-within:text-amber-400 transition-colors">
              <Search className="w-5 h-5" />
            </div>

            <input
              type="text"
              value={inputPesquisa}
              onChange={(e) => setInputPesquisa(e.target.value)}
              placeholder="Pesquisar por Pedido de Compra, RM, Comprador, Fornecedor, Produto ou Centro de Custo..."
              className="bg-transparent text-sm font-semibold text-white placeholder-blue-300/60 focus:outline-none w-full px-2 py-2"
            />

            {inputPesquisa && (
              <button
                type="button"
                onClick={() => setInputPesquisa('')}
                className="p-1.5 text-blue-300 hover:text-white transition cursor-pointer mr-2"
                title="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* FILTROS RÁPIDOS INTELIGENTES DE PREVISÃO */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3 space-y-2 shadow-inner">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-400 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Filtros Rápidos de Previsão de Entrega</span>
              </div>
              {selectedForecastFilter !== 'Todos' && (
                <button
                  type="button"
                  onClick={() => setSelectedForecastFilter('Todos')}
                  className="text-[10px] font-bold text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Ver Todos</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
              {FORECAST_FILTERS.map((filterKey) => {
                const isSelected = selectedForecastFilter === filterKey;
                const count = forecastCounts[filterKey] || 0;
                return (
                  <button
                    key={filterKey}
                    type="button"
                    onClick={() => setSelectedForecastFilter(filterKey)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer border whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black scale-[1.02]'
                        : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700/80'
                    }`}
                  >
                    <span>{filterKey}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black ${
                        isSelected
                          ? 'bg-slate-950/20 text-slate-950'
                          : 'bg-slate-800 text-amber-400 border border-slate-700'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CHIPS DE ATALHOS RÁPIDOS */}
          {quickChips.length > 0 && (
            <div className="flex items-center gap-2 mt-2 px-1 overflow-x-auto text-[11px] no-scrollbar">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] shrink-0">
                Atalhos rápidos:
              </span>
              {quickChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setInputPesquisa(chip)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer border whitespace-nowrap ${
                    inputPesquisa.toLowerCase() === chip.toLowerCase()
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-400 border-slate-700'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CORPO PRINCIPAL DO PAINEL */}
      <div className="p-4 lg:p-6 space-y-6 flex-1">
        
        {/* DASHBOARD DE KPIS GERAIS CONSOLIDADOS */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          
          {/* KPI 1: TOTAL DE PEDIDOS DE COMPRA */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 space-y-2 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-bold uppercase tracking-wider text-[10px]">Pedidos de Compra</span>
              <FileText className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white font-mono">
                {kpis.totalPedidos}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                pedidos
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 pt-1 border-t border-slate-850">
              <span className="text-amber-400 font-bold">{kpis.totalItensDistintos} itens</span>
              <span>•</span>
              <span className="text-sky-400 font-bold">{kpis.totalRms} RMs</span>
            </div>
          </div>

          {/* KPI 2: VALOR LÍQUIDO TOTAL DA CARTEIRA */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 space-y-2 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-bold uppercase tracking-wider text-[10px]">Valor Total em Compras</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono truncate">
                {formatBRL(kpis.valorLiquidoTotalGeral)}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-850 truncate">
              Soma do valor das linhas consolidadas
            </div>
          </div>

          {/* KPI 3: QUANTIDADE AUTORIZADA E SALDO PENDENTE */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 space-y-2 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-bold uppercase tracking-wider text-[10px]">Saldo Pendente (A Receber)</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-400 font-mono">
                {formatNumberBR(kpis.saldoTotalAReceberGeral)}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                un pendentes
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-850">
              Total Autorizado: <strong className="text-white">{formatNumberBR(kpis.quantidadeTotalPedidaGeral)}</strong> un
            </div>
          </div>

          {/* KPI 4: % ATENDIMENTO GLOBAL */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 space-y-2 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-bold uppercase tracking-wider text-[10px]">Nível de Atendimento</span>
              <TrendingUp className="w-4 h-4 text-sky-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-sky-400 font-mono">
                {kpis.percentualGeralAtendido}%
              </span>
              <span className="text-xs text-slate-400 font-mono">
                entregue
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-linear-to-r from-amber-500 to-emerald-400"
                style={{ width: `${kpis.percentualGeralAtendido}%` }}
              />
            </div>
          </div>
        </div>

        {/* PAINEL DE FILTROS AVANÇADOS */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 space-y-3.5 shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase tracking-wider">
              <Filter className="w-4 h-4 text-amber-400" />
              <span>Filtros Estruturados</span>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold transition cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/30"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Limpar Filtros</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
            {/* DATA INÍCIO */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1 truncate">
                <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                Data Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-2.5 py-2 text-white font-mono text-xs focus:outline-none transition"
              />
            </div>

            {/* DATA FIM */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1 truncate">
                <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                Data Fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-2.5 py-2 text-white font-mono text-xs focus:outline-none transition"
              />
            </div>

            {/* COMPRADOR */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1 truncate">
                <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                Comprador
              </label>
              <select
                value={selectedComprador}
                onChange={(e) => setSelectedComprador(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-2.5 py-2 text-white text-xs focus:outline-none transition truncate"
              >
                <option value="">Todos ({listaCompradores.length})</option>
                {listaCompradores.map((comp) => (
                  <option key={comp} value={comp}>
                    {comp}
                  </option>
                ))}
              </select>
            </div>

            {/* OBRA / CENTRO DE CUSTO */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1 truncate">
                <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                Obra / Centro Custo
              </label>
              <select
                value={selectedObra}
                onChange={(e) => setSelectedObra(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-2.5 py-2 text-white text-xs focus:outline-none transition truncate"
              >
                <option value="">Todas as Obras ({listaCentrosCusto.length})</option>
                {listaCentrosCusto.map((obra) => (
                  <option key={obra} value={obra}>
                    {obra}
                  </option>
                ))}
              </select>
            </div>

            {/* FORNECEDOR */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1 truncate">
                <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                Fornecedor
              </label>
              <select
                value={selectedFornecedor}
                onChange={(e) => setSelectedFornecedor(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-2.5 py-2 text-white text-xs focus:outline-none transition truncate"
              >
                <option value="">Todos os Fornecedores ({listaFornecedores.length})</option>
                {listaFornecedores.map((forn) => (
                  <option key={forn} value={forn}>
                    {forn}
                  </option>
                ))}
              </select>
            </div>

            {/* STATUS DO PEDIDO */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1 truncate">
                <Boxes className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                Status do Pedido
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-2.5 py-2 text-white text-xs focus:outline-none transition truncate"
              >
                <option value="">Todos os Status ({listaStatus.length})</option>
                {listaStatus.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ÁREA DE RESULTADOS */}
        {loading ? (
          <div className="p-12 text-center bg-slate-950/40 border border-slate-800 rounded-2xl space-y-3">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Buscando e agrupando registros da tabela <span className="text-amber-400 font-mono">pedidos_compras_bi</span>...
            </p>
            <p className="text-[11px] text-slate-500">
              Construindo estrutura Mestre-Detalhe de Documentos de Compra.
            </p>
          </div>
        ) : fetchError ? (
          /* TRATAMENTO DE ERRO */
          <div className="p-8 text-center bg-rose-950/30 border border-rose-500/40 rounded-2xl space-y-3">
            <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-400 w-fit mx-auto border border-rose-500/20">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-rose-200 leading-snug">
              Erro ao consultar a tabela pedidos_compras_bi no Supabase.
            </h3>
            <p className="text-xs text-slate-300 max-w-lg mx-auto font-mono bg-slate-900/90 p-3 rounded-xl border border-slate-800 text-rose-300">
              {fetchError}
            </p>
            <button
              type="button"
              onClick={() => carregarDadosBi(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs transition cursor-pointer mt-2 shadow-lg"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tentar Novamente</span>
            </button>
          </div>
        ) : documentos.length === 0 ? (
          /* ESTADO SEM RESULTADOS */
          <div className="p-8 text-center bg-amber-950/20 border border-amber-500/30 rounded-2xl space-y-3">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 w-fit mx-auto border border-amber-500/20">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-amber-200 leading-snug">
              {purchases.length === 0
                ? 'Nenhum registro retornado da tabela pedidos_compras_bi'
                : 'Nenhum pedido de compra encontrado para os filtros selecionados'}
            </h3>
            <p className="text-xs text-slate-400 max-w-lg mx-auto">
              {purchases.length === 0
                ? 'A consulta à tabela pedidos_compras_bi retornou 0 registros. Clique em "Atualizar" para forçar uma nova sincronização.'
                : 'Tente redefinir o termo de pesquisa, ajustar a data ou limpar as opções de Comprador, Obra, Fornecedor e Status.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition cursor-pointer mt-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpar Todos os Filtros</span>
              </button>
            )}
          </div>
        ) : (
          /* EXIBIÇÃO DE RESULTADOS COM VISÃO MESTRE-DETALHE */
          <div className="space-y-4">
            
            {/* CABEÇALHO DO RESULTADO COM CONTROLE DE VISUALIZAÇÃO E PAGINAÇÃO */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-300 uppercase tracking-wider">
                  Documentos de Pedido:
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">
                  {documentos.length} {documentos.length === 1 ? 'Pedido' : 'Pedidos'} ({dadosFiltrados.length} linhas agrupadas)
                </span>
                {lastFetchTime && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    (Última consulta: {lastFetchTime})
                  </span>
                )}
              </div>

              {/* CONTROLES DE MODO DE EXIBIÇÃO E PAGINAÇÃO */}
              <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
                
                {/* ALTERNÂNCIA: DOCUMENTO MESTRE-DETALHE VS TABELA PLANA */}
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setViewMode('documento')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      viewMode === 'documento'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Visão Documento de Pedido de Compra (Mestre-Detalhe)"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Documento</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode('tabela')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      viewMode === 'tabela'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Visão Tabela Flat (Linha a Linha)"
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    <span>Tabela Flat</span>
                  </button>
                </div>

                {/* SELETOR DE ITENS POR PÁGINA */}
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>Exibir:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value={10}>10 por página</option>
                    <option value={20}>20 por página</option>
                    <option value={50}>50 por página</option>
                    <option value={100}>100 por página</option>
                    <option value={-1}>Todos ({documentos.length})</option>
                  </select>
                </div>
              </div>
            </div>

            {/* MODO 1: DOCUMENTO DE PEDIDO DE COMPRA (MESTRE-DETALHE) */}
            {viewMode === 'documento' ? (
              <div className="space-y-4">
                {documentosParaRenderizar.map((doc) => {
                  // Procura se tem recebimento no balcão
                  const normItemPedido = String(doc.pedido || '').trim().toLowerCase();
                  const digitsItemPedido = normItemPedido.replace(/\D/g, '');
                  const recebimentoBalcao = recebimentos?.find((r: any) => {
                    const rPc = String(r.numero_pc || '').trim().toLowerCase();
                    if (!rPc || rPc === '-' || !normItemPedido || normItemPedido === '-') return false;
                    if (rPc === normItemPedido) return true;
                    const rDigits = rPc.replace(/\D/g, '');
                    return rDigits && digitsItemPedido && rDigits === digitsItemPedido;
                  });

                  return (
                    <PedidoDocumentoCard
                      key={doc.pedido}
                      documento={doc}
                      defaultExpanded={true}
                      recebimentoBalcao={recebimentoBalcao}
                    />
                  );
                })}
              </div>
            ) : (
              /* MODO 2: TABELA DE RESULTADOS FLAT (COMPLETA) */
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/80 shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                        <th className="p-3.5">RM / Pedido</th>
                        <th className="p-3.5">Comprador</th>
                        <th className="p-3.5">Produto / Descrição</th>
                        <th className="p-3.5 text-center">Qtd Pedida</th>
                        <th className="p-3.5 text-center">Saldo a Receber</th>
                        <th className="p-3.5 text-right">Valor Total</th>
                        <th className="p-3.5">Fornecedor / Centro de Custo</th>
                        <th className="p-3.5 text-center">Status Compra</th>
                        <th className="p-3.5 text-center">Previsão Entrega</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-xs">
                      {dadosTabelaParaRenderizar.map((item, idx) => {
                        const statusStyle = getStatusBadgeStyle(item.status_pedido);
                        const formattedDate = formatDateBR(item.previsao_entrega);

                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-800/40 transition">
                            {/* RM E PEDIDO */}
                            <td className="p-3.5 whitespace-nowrap">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-mono font-bold text-amber-400 text-xs">
                                  {item.solicitacao}
                                </span>
                                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                                  <FileText className="w-3 h-3 text-slate-500" />
                                  <span>{item.pedido}</span>
                                </div>
                              </div>
                            </td>

                            {/* COMPRADOR */}
                            <td className="p-3.5 text-slate-300 font-medium whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span>{item.comprador_real}</span>
                              </div>
                            </td>

                            {/* PRODUTO / DESCRIÇÃO */}
                            <td className="p-3.5 font-bold text-slate-100 min-w-[240px]">
                              <span className="line-clamp-2" title={item.produto_descricao}>
                                {item.produto_descricao}
                              </span>
                            </td>

                            {/* QUANTIDADE PEDIDA */}
                            <td className="p-3.5 text-center font-black text-white text-sm whitespace-nowrap font-mono">
                              {formatNumberBR(item.quantidade_pedida)}
                            </td>

                            {/* SALDO A RECEBER */}
                            <td className="p-3.5 text-center font-black text-amber-400 text-sm whitespace-nowrap font-mono">
                              {formatNumberBR(item.saldo_a_receber)}
                            </td>

                            {/* VALOR TOTAL */}
                            <td className="p-3.5 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                              {item.valor_total > 0 ? formatBRL(item.valor_total) : '-'}
                            </td>

                            {/* FORNECEDOR E CENTRO DE CUSTO */}
                            <td className="p-3.5 text-slate-300 font-semibold min-w-[200px]">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 truncate" title={item.fornecedor}>
                                  <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  <span className="truncate">{item.fornecedor}</span>
                                </div>
                                {item.centro_custo && (
                                  <div
                                    className="flex items-center gap-1 text-[10px] text-slate-400 font-mono truncate"
                                    title={item.centro_custo}
                                  >
                                    <Tag className="w-3 h-3 text-amber-500/70 shrink-0" />
                                    <span className="truncate">{item.centro_custo}</span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* STATUS DO PEDIDO */}
                            <td className="p-3.5 text-center whitespace-nowrap">
                              <span
                                className={`px-3 py-1 rounded-full text-[10.5px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 border ${statusStyle.bg}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                                {statusStyle.label}
                              </span>
                            </td>

                            {/* PREVISÃO DE ENTREGA */}
                            <td className="p-3.5 text-center whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs shadow-md border border-amber-400 font-mono">
                                <Calendar className="w-3.5 h-3.5 text-slate-950" />
                                <span>{formattedDate}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* BARRA DE NAVEGAÇÃO DE PÁGINAS (PAGINAÇÃO COMPLETA) */}
            {((viewMode === 'documento' ? totalDocPages : totalTablePages) > 1) && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 px-1 border-t border-slate-800 text-xs">
                <div className="text-slate-400 font-medium">
                  {viewMode === 'documento' ? (
                    <>
                      Exibindo página <strong className="text-white font-mono">{currentPage}</strong> de{' '}
                      <strong className="text-white font-mono">{totalDocPages}</strong> (Pedidos{' '}
                      {(currentPage - 1) * pageSize + 1} a{' '}
                      {Math.min(currentPage * pageSize, documentos.length)} de {documentos.length})
                    </>
                  ) : (
                    <>
                      Exibindo página <strong className="text-white font-mono">{currentPage}</strong> de{' '}
                      <strong className="text-white font-mono">{totalTablePages}</strong> (Linhas{' '}
                      {(currentPage - 1) * pageSize + 1} a{' '}
                      {Math.min(currentPage * pageSize, dadosFiltrados.length)} de {dadosFiltrados.length})
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800 transition cursor-pointer border border-slate-700 flex items-center gap-1"
                    title="Primeira página"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800 transition cursor-pointer border border-slate-700 flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Anterior</span>
                  </button>

                  <div className="px-3 py-1 bg-slate-950 border border-slate-700 rounded-lg text-amber-400 font-mono font-bold">
                    {currentPage} / {viewMode === 'documento' ? totalDocPages : totalTablePages}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((prev) =>
                        Math.min(prev + 1, viewMode === 'documento' ? totalDocPages : totalTablePages)
                      )
                    }
                    disabled={currentPage === (viewMode === 'documento' ? totalDocPages : totalTablePages)}
                    className="p-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800 transition cursor-pointer border border-slate-700 flex items-center gap-1"
                  >
                    <span>Próxima</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage(viewMode === 'documento' ? totalDocPages : totalTablePages)
                    }
                    disabled={currentPage === (viewMode === 'documento' ? totalDocPages : totalTablePages)}
                    className="p-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800 transition cursor-pointer border border-slate-700 flex items-center gap-1"
                    title="Última página"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RODAPÉ COM STATUS DO SUPABASE */}
      <div className="bg-slate-950/90 border-t border-slate-800 p-3.5 px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-2 flex-wrap">
          <Database className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
          <span className="font-medium flex items-center gap-2 flex-wrap">
            <span>Sincronização ERP:</span>
            <strong className="text-slate-200 font-semibold font-mono">
              {syncStatus.formattedTime || 'Data indisponível'}
            </strong>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                syncStatus.isUpToDate
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              {syncStatus.isUpToDate ? 'OK (≤ 1h30)' : 'Atenção: Atrasado (> 1h30)'}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
          <Clock className="w-3 h-3 text-slate-500" />
          <span>
            Tabela Supabase: <strong className="text-slate-400">pedidos_compras_bi</strong> ({totalRowsInDatabase} linhas carregadas)
          </span>
        </div>
      </div>
    </div>
  );
}

export { MonitorCompras as MonitorComprasCard };
export default MonitorCompras;
