import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useDashboardAutomacao, separarCodigoEDescricao, DashboardMetric, higienizarClasse, normalizarObra, safeNumber } from '../hooks/useDashboardAutomacao';
import { normalizarCC, processarItemMobilizacao } from '../hooks/useMobilizacoesProcessadas';
import SelecaoObrasView, { ObraStats } from './SelecaoObrasView';
import ModalAjusteStatusManual from './ModalAjusteStatusManual';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LabelList
} from 'recharts';
import { 
  ChevronLeft, 
  Upload, 
  FileSpreadsheet, 
  Search, 
  Filter, 
  CheckCircle2, 
  Package, 
  ShoppingCart, 
  AlertCircle,
  RefreshCw,
  Layers,
  Building2,
  Download,
  CloudUpload,
  History,
  ExternalLink,
  ArrowLeft,
  X,
  FileText,
  ChevronRight,
  Camera,
  Image as ImageIcon,
  Maximize2,
  Trash2,
  Plus,
  Database,
  RotateCcw,
  Sparkles,
  Zap,
  Activity,
  SlidersHorizontal
} from 'lucide-react';

interface MobilizacaoViewProps {
  onBackToHub: () => void;
}

export interface ItemMobilizacao {
  id: string;
  centroCusto: string;
  nome_arquivo?: string;
  apelido: string; // Coluna APELIDO (Classe Oficial)
  descricao: string;
  codigo?: string;
  'Descrição do item'?: string;
  'Código do item'?: string;
  qtdSolicitada: number; // Coluna Quantidade solicitada
  qtdMobilizado: number; // Coluna MOBILIZADO
  qtdDisponivel?: number; // Coluna DISPONÍVEL
  qtdSeparado: number;   // Coluna SEPARADO / DISPONÍVEL
  qtdCompra: number;     // Coluna COMPRA
  emCompras?: number;
  qtdTriagem?: number;   // Coluna TRIAGEM
  qtdAnalise: number;    // Coluna EM TRIAGEM / EM ANÁLISE
  previsaoEntrega?: string | null;
  statusPrazo?: 'NO PRAZO' | 'ATRASADO' | 'SEM PREVISÃO';
  numero_pc?: string | null;
  pedido_compra?: string | null;
  pc?: string | null;
  status_override_manual?: string | null;
  statusCalculado?: string;
  requisicaoIds?: (string | number)[];
  debugSources?: string[];
  [key: string]: any;
}

// Fallback helper to infer category/class from item description if APELIDO is empty
export function inferirClasse(descricao: string): string {
  if (!descricao) return 'DIVERSOS';
  const descUpper = descricao.toUpperCase().trim();

  if (
    descUpper.includes('BROCA') || 
    descUpper.includes('ALICATE') || 
    descUpper.includes('CHAVE') || 
    descUpper.includes('MARTELO') || 
    descUpper.includes('FERRAMENTA') || 
    descUpper.includes('SERRA') || 
    descUpper.includes('ESMERILHADEIRA') || 
    descUpper.includes('DISCO') || 
    descUpper.includes('TORQUIMETRO') || 
    descUpper.includes('SOQUETE') ||
    descUpper.includes('FURADEIRA') ||
    descUpper.includes('TALHA')
  ) {
    return 'FERRAMENTAS';
  }

  if (
    descUpper.includes('COLETE') || 
    descUpper.includes('LUVA') || 
    descUpper.includes('CAPACETE') || 
    descUpper.includes('OCULOS') || 
    descUpper.includes('MASCARA') || 
    descUpper.includes('PROTETOR') || 
    descUpper.includes('EPI') || 
    descUpper.includes('BOTINA') || 
    descUpper.includes('CALCADO') || 
    descUpper.includes('CINTO') ||
    descUpper.includes('TALABARTE')
  ) {
    return 'EPI';
  }

  if (
    descUpper.includes('OLEO') || 
    descUpper.includes('LUBRIFICANTE') || 
    descUpper.includes('GRAXA') || 
    descUpper.includes('TINTA') || 
    descUpper.includes('SOLVENTE') || 
    descUpper.includes('ESTOPA') || 
    descUpper.includes('DESENGRAXANTE') || 
    descUpper.includes('USO') || 
    descUpper.includes('CONSUMO') || 
    descUpper.includes('FITA') || 
    descUpper.includes('PAPEL') || 
    descUpper.includes('SILICONE') ||
    descUpper.includes('LIMPEZA')
  ) {
    return 'USO E CONSUMO';
  }

  if (
    descUpper.includes('PARAFUSO') || 
    descUpper.includes('PORCA') || 
    descUpper.includes('ARRUELA') || 
    descUpper.includes('ABRACADEIRA') || 
    descUpper.includes('CHAVETA') || 
    descUpper.includes('PREGO') || 
    descUpper.includes('REBITE') || 
    descUpper.includes('PRISIONEIRO')
  ) {
    return 'FIXAÇÃO';
  }

  if (
    descUpper.includes('CABO') || 
    descUpper.includes('FIO') || 
    descUpper.includes('DISJUNTOR') || 
    descUpper.includes('CONTATOR') || 
    descUpper.includes('FUSIVEL') || 
    descUpper.includes('PLUG') || 
    descUpper.includes('TOMADA') || 
    descUpper.includes('LAMPADA') || 
    descUpper.includes('PAINEL') ||
    descUpper.includes('CONECTOR')
  ) {
    return 'ELÉTRICA';
  }

  if (
    descUpper.includes('MOTOR') || 
    descUpper.includes('BOMBA') || 
    descUpper.includes('VALVULA') || 
    descUpper.includes('MANGUEIRA') || 
    descUpper.includes('CILINDRO') || 
    descUpper.includes('ROLAMENTO') || 
    descUpper.includes('CORREIA') || 
    descUpper.includes('REDUTOR') || 
    descUpper.includes('FILTRO') ||
    descUpper.includes('GAXETA')
  ) {
    return 'MECÂNICA';
  }

  if (
    descUpper.includes('CONTAINER') || 
    descUpper.includes('GERADOR') || 
    descUpper.includes('COMPRESSOR') || 
    descUpper.includes('TORRE') || 
    descUpper.includes('MAQUINA') || 
    descUpper.includes('SOLDA') ||
    descUpper.includes('VEICULO')
  ) {
    return 'EQUIPAMENTOS';
  }

  return 'OUTROS';
}

// Robust numeric parser for CSV and Excel columns
function parseNum(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim().replace(/\./g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export default function MobilizacaoView({ onBackToHub }: MobilizacaoViewProps) {
  // Navigation Flow State: FONTE (Source Selection) -> OBRAS (Selection Grid) -> DASHBOARD (BI Dashboard with Tabs)
  const [step, setStep] = useState<'FONTE' | 'OBRAS' | 'DASHBOARD'>('FONTE');
  const [obrasSelecionadas, setObrasSelecionadas] = useState<string[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<string>('');

  // Obras disponíveis otimizadas para a tela de seleção (Bypass de paginação e payload optimization)
  const [obrasDisponiveis, setObrasDisponiveis] = useState<string[]>([]);
  const [dadosBrutosNomes, setDadosBrutosNomes] = useState<string[]>([]);
  const [statsObrasDisponiveis, setStatsObrasDisponiveis] = useState<Record<string, ObraStats>>({});
  const [isLoadingObrasDisponiveis, setIsLoadingObrasDisponiveis] = useState(false);

  // Operation Mode State: Manual (Spreadsheet), Autonomous (Supabase Live)
  const [dashboardMode, setDashboardMode] = useState<'selection' | 'manual' | 'autonomous'>('selection');

  // Autonomous Live Data Hook from Supabase (runs immediately in background, filtered when obrasSelecionadas are active)
  const liveMetrics = useDashboardAutomacao(obrasSelecionadas.length > 0 ? obrasSelecionadas : undefined);

  // Agrupa os registros leves de requisições por Obra gerando cards
  const gerarCardsDeObras = useCallback((dadosRequisicoes: any[]) => {
    const obrasSet = new Set<string>();

    if (Array.isArray(dadosRequisicoes)) {
      dadosRequisicoes.forEach((item) => {
        const rawObra = item.setor || item.centro_custo || item.centroCusto || item.obra || '';
        const nomeObra = normalizarCC(rawObra);

        if (nomeObra && nomeObra !== 'SEM OBRA DEFINIDA' && nomeObra !== 'NÃO INFORMADA') {
          obrasSet.add(nomeObra);
        }
      });
    }

    // MARRETA: FORÇAR A D1A NA LISTA INDEPENDENTE DO BANCO
    obrasSet.add('ALU D1A CALC 3 SLZ 08-26');

    // Gera o array final limpo sem contadores numéricos, ordenado.
    const listaOrdenada = Array.from(obrasSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return {
      obras: listaOrdenada,
      stats: {}
    };
  }, []);

  // Busca ultra-rápida e otimizada de todas as obras disponíveis da base inteira
  const fetchObrasDisponiveis = useCallback(async () => {
    try {
      setIsLoadingObrasDisponiveis(true);
      
      const { data, error } = await supabase
        .from('requisicoes')
        .select('*')
        .limit(100000);

      if (error) throw error;

      // 1. Array com nomes originais ÚNICOS (sem passar pela Roseta) diretamente da busca Supabase
      const rawNomesUnicos = Array.from(
        new Set(
          (data || [])
            .map((d: any) => (d.setor || d.centro_custo || d.centroCusto || d.obra || '').toString().trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

      setDadosBrutosNomes(rawNomesUnicos);

      const { obras, stats } = gerarCardsDeObras(data || []);
      
      // Injeção de força bruta absoluta: D1A garantida antes do setState
      let obrasFinais = [...obras];
      if (!obrasFinais.some(obra => (typeof obra === 'string' ? obra : (obra as any)?.nome || '').includes('D1A'))) {
        obrasFinais.unshift('ALU D1A CALC 3 SLZ 08-26');
      }

      setObrasDisponiveis(obrasFinais);
      setStatsObrasDisponiveis(stats);
    } catch (error) {
      console.error("Erro ao buscar obras:", error);
      const { obras, stats } = gerarCardsDeObras([]);
      let obrasFinais = [...obras];
      if (!obrasFinais.some(obra => (typeof obra === 'string' ? obra : (obra as any)?.nome || '').includes('D1A'))) {
        obrasFinais.unshift('ALU D1A CALC 3 SLZ 08-26');
      }
      setObrasDisponiveis(obrasFinais);
      setStatsObrasDisponiveis(stats);
    } finally {
      setIsLoadingObrasDisponiveis(false);
    }
  }, [gerarCardsDeObras]);

  // Carrega as obras disponíveis ao inicializar ou entrar na seleção
  useEffect(() => {
    fetchObrasDisponiveis();
  }, [fetchObrasDisponiveis]);

  // Validador de cache para limpar o state se houver corrupção ou bug do "24 de 23"
  useEffect(() => {
    const saved = localStorage.getItem('obrasSelecionadas');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Se houver mais seleções salvas do que o total disponível, o cache está corrompido
          if (obrasDisponiveis.length > 0 && parsed.length > obrasDisponiveis.length) {
            console.warn('Cache corrompido detectado. Limpando seleções.');
            localStorage.removeItem('obrasSelecionadas');
            setObrasSelecionadas([]);
          }
        }
      } catch (e) {
        localStorage.removeItem('obrasSelecionadas');
      }
    }
  }, [obrasDisponiveis]);

  const [data, setData] = useState<ItemMobilizacao[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingInitialData, setIsFetchingInitialData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters state for Sidebar Cascading Analysis (declared before effects)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');
  const [selectedClasse, setSelectedClasse] = useState<string>('TODAS');
  const [obraSelecionada, setObraSelecionada] = useState<string>('Todas');

  // Saved Reports History Modal State
  const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historicoReports, setHistoricoReports] = useState<Array<{ id?: string; obra_selecionada: string; nome_arquivo?: string; html_content?: string; dados_json?: any; created_at: string }>>([]);
  const [savedReports, setSavedReports] = useState<Array<{ id?: string; obra_selecionada: string; nome_arquivo?: string; html_content?: string; dados_json?: any; created_at: string }>>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Version Selector Modal State
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [targetObraForVersion, setTargetObraForVersion] = useState<string>('');
  const [availableVersions, setAvailableVersions] = useState<Array<{
    id: string;
    created_at: string;
    nome_arquivo?: string;
    obra_selecionada?: string;
    dados_json?: any;
  }>>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [versaoSelecionada, setVersaoSelecionada] = useState<string | null>(null);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  // Toast feedback state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Album de Fotos (Supabase Storage) & Lightbox State
  const [albumFotos, setAlbumFotos] = useState<Array<{ name: string; url: string; obra: string; created_at?: string }>>([]);
  const [isLoadingFotos, setIsLoadingFotos] = useState(false);
  const [fotoExpandidaIndex, setFotoExpandidaIndex] = useState<number | null>(null);

  // Quick Upload Modal state inside MobilizacaoView
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFileSelected, setUploadFileSelected] = useState<File | null>(null);
  const [uploadFilePreview, setUploadFilePreview] = useState<string | null>(null);
  const [isUploadingFoto, setIsUploadingFoto] = useState(false);

  // State for inline manual classification learning
  const [savingClassId, setSavingClassId] = useState<string | null>(null);
  const [triggerUpdate, setTriggerUpdate] = useState(0);

  // State for Modal de Ajuste Manual de Status (Override)
  const [itemParaAjusteStatus, setItemParaAjusteStatus] = useState<ItemMobilizacao | null>(null);

  // Dynamic Logo State from Supabase
  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    return localStorage.getItem('sidebar_logo_url');
  });

  useEffect(() => {
    let active = true;
    const fetchLogoUrl = async () => {
      try {
        const { data } = await supabase
          .from('configuracoes_sistema')
          .select('logo_url')
          .eq('id', 'geral')
          .maybeSingle();

        if (active && data && (data as any).logo_url) {
          const url = (data as any).logo_url;
          setLogoUrl(url);
          localStorage.setItem('sidebar_logo_url', url);
          return;
        }
      } catch (err) {
        console.warn('Erro ao carregar logo de configuracoes_sistema:', err);
      }

      // Fallback check to configuracao_sistema
      try {
        const { data } = await supabase
          .from('configuracao_sistema')
          .select('logo_url')
          .eq('id', 'geral')
          .maybeSingle();

        if (active && data && (data as any).logo_url) {
          const url = (data as any).logo_url;
          setLogoUrl(url);
          localStorage.setItem('sidebar_logo_url', url);
        }
      } catch (_) {}
    };

    fetchLogoUrl();
    return () => {
      active = false;
    };
  }, []);

  // Fetch history from Supabase to populate Obras / Arquivos dropdown options
  const fetchHistorico = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const { data: spData, error } = await supabase
        .from('relatorios_mobilizacao')
        .select('id, obra_selecionada, nome_arquivo, created_at, html_content, dados_json')
        .order('created_at', { ascending: false });

      if (!error && spData) {
        setHistoricoReports(spData);
        setSavedReports(spData);
      } else {
        // Fallback query if nome_arquivo column doesn't exist yet
        const { data: fbData, error: fbErr } = await supabase
          .from('relatorios_mobilizacao')
          .select('id, obra_selecionada, created_at, html_content, dados_json')
          .order('created_at', { ascending: false });

        if (!fbErr && fbData) {
          setHistoricoReports(fbData);
          setSavedReports(fbData);
        } else {
          console.warn('Erro ao carregar histórico:', error || fbErr);
          const localSaved = JSON.parse(localStorage.getItem('relatorios_mobilizacao_saved') || '[]');
          setHistoricoReports(localSaved);
          setSavedReports(localSaved);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar histórico:', err);
      const localSaved = JSON.parse(localStorage.getItem('relatorios_mobilizacao_saved') || '[]');
      setHistoricoReports(localSaved);
      setSavedReports(localSaved);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Auto-Load do último relatório salvo e do histórico de obras no mount
  useEffect(() => {
    let active = true;

    // Dispara a busca inicial das obras e relatórios salvos no Supabase
    fetchHistorico();

    const loadLatestReport = async () => {
      try {
        setIsFetchingInitialData(true);
        const { data: reports, error } = await supabase
          .from('relatorios_mobilizacao')
          .select('id, obra_selecionada, nome_arquivo, dados_json')
          .not('dados_json', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          // Fallback select if nome_arquivo column fails
          const { data: fbReports } = await supabase
            .from('relatorios_mobilizacao')
            .select('id, obra_selecionada, dados_json')
            .not('dados_json', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1);

          if (active && fbReports && fbReports.length > 0) {
            const latest = fbReports[0];
            const dadosSalvos = latest.dados_json;
            if (Array.isArray(dadosSalvos) && dadosSalvos.length > 0) {
              setSelectedClasse('TODAS');
              setSelectedStatus('TODOS');
              const rawObra = latest.obra_selecionada;
              const obraToSet = (!rawObra || rawObra === 'TODAS AS OBRAS' || rawObra === 'Todas as Obras' || rawObra === 'Todas')
                ? 'Todas'
                : rawObra;
              setObraSelecionada(obraToSet);
              setData(dadosSalvos);
              setFileName('Última base salva no banco');
            } else {
              setData([]);
            }
          } else if (active) {
            setData([]);
          }
        } else if (active && reports && reports.length > 0) {
          const latest = reports[0];
          const dadosSalvos = latest.dados_json;
          
          if (Array.isArray(dadosSalvos) && dadosSalvos.length > 0) {
            // Reset explícito de todos os filtros
            setSelectedClasse('TODAS');
            setSelectedStatus('TODOS');

            const rawObra = latest.obra_selecionada;
            const obraToSet = (!rawObra || rawObra === 'TODAS AS OBRAS' || rawObra === 'Todas as Obras' || rawObra === 'Todas')
              ? 'Todas'
              : rawObra;

            setObraSelecionada(obraToSet);
            setData(dadosSalvos);
            setFileName(latest.nome_arquivo || 'Última base salva no banco');
          } else {
            setData([]);
          }
        } else if (active) {
          setData([]);
        }
      } catch (err) {
        console.error('Erro ao auto-carregar último relatório:', err);
        if (active) setData([]);
      } finally {
        if (active) {
          setIsFetchingInitialData(false);
        }
      }
    };

    loadLatestReport();
    return () => {
      active = false;
    };
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Handler to switch operation mode back to Selection
  const handleTrocarModo = () => {
    setDashboardMode('selection');
    setSelectedClasse('TODAS');
    setSelectedStatus('TODOS');
    setObraSelecionada('Todas');
    setVersaoSelecionada(null);
    setSearchTerm('');
  };

  // Unique list of Obras / Arquivos (derived from file names and reports in memory & DB, or live hook in autonomous mode)
  const listObras = useMemo(() => {
    if (dashboardMode === 'autonomous') {
      const setObras = new Set<string>();
      liveMetrics.data.forEach(item => {
        if (item.obra) setObras.add(normalizarCC(item.obra));
      });
      setObras.add('ALU D1A CALC 3 SLZ 08-26');
      return Array.from(setObras).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }

    const setObras = new Set<string>();

    if (fileName && fileName !== 'Última base salva no banco') {
      setObras.add(fileName);
    }

    if (data && Array.isArray(data)) {
      data.forEach(item => {
        if (item.nome_arquivo) setObras.add(item.nome_arquivo);
        else if (item.centroCusto) setObras.add(item.centroCusto);
      });
    }

    historicoReports.forEach(rep => {
      if (rep.nome_arquivo) setObras.add(rep.nome_arquivo);
      if (rep.obra_selecionada && rep.obra_selecionada !== 'TODAS AS OBRAS' && rep.obra_selecionada !== 'Todas as Obras' && rep.obra_selecionada !== 'Todas') {
        setObras.add(rep.obra_selecionada);
      }
    });

    savedReports.forEach(rep => {
      if (rep.nome_arquivo) setObras.add(rep.nome_arquivo);
      if (rep.obra_selecionada && rep.obra_selecionada !== 'TODAS AS OBRAS' && rep.obra_selecionada !== 'Todas as Obras' && rep.obra_selecionada !== 'Todas') {
        setObras.add(rep.obra_selecionada);
      }
    });

    return Array.from(setObras).sort();
  }, [dashboardMode, liveMetrics.data, data, fileName, historicoReports, savedReports]);

  // Handler for Obra/Arquivo filter change (Triggers Version Selector Modal if specific Obra selected in manual mode)
  const handleSelectObra = async (val: string) => {
    setSelectedClasse('TODAS');
    setObraSelecionada(val);

    if (dashboardMode === 'autonomous') {
      setVersaoSelecionada(null);
      return;
    }

    if (val === 'Todas' || val === 'Todas as Obras' || val === 'TODAS AS OBRAS') {
      setObraSelecionada('Todas');
      setVersaoSelecionada(null);
      return;
    }

    setTargetObraForVersion(val);
    setIsLoadingVersions(true);
    setIsVersionModalOpen(true);

    try {
      const { data: spVersions, error } = await supabase
        .from('relatorios_mobilizacao')
        .select('id, obra_selecionada, nome_arquivo, created_at, dados_json')
        .or(`nome_arquivo.eq.${val},obra_selecionada.eq.${val}`)
        .order('created_at', { ascending: false });

      let versionsList: Array<{
        id: string;
        created_at: string;
        nome_arquivo?: string;
        obra_selecionada?: string;
        dados_json?: any;
      }> = spVersions || [];

      if (error || versionsList.length === 0) {
        const fromHistory = historicoReports.filter(rep =>
          rep.nome_arquivo === val || rep.obra_selecionada === val
        );
        versionsList = fromHistory.map(r => ({
          id: r.id || 'hist-' + r.created_at,
          created_at: r.created_at,
          nome_arquivo: r.nome_arquivo,
          obra_selecionada: r.obra_selecionada,
          dados_json: r.dados_json
        }));
      }

      versionsList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setAvailableVersions(versionsList);
      if (versionsList.length > 0) {
        setSelectedVersionId(versionsList[0].id);
      } else {
        setSelectedVersionId('');
      }
    } catch (err) {
      console.warn('Erro ao carregar versões da obra:', err);
      const fromHistory = historicoReports.filter(rep =>
        rep.nome_arquivo === val || rep.obra_selecionada === val
      );
      setAvailableVersions(fromHistory.map(r => ({
        id: r.id || 'hist-' + r.created_at,
        created_at: r.created_at,
        nome_arquivo: r.nome_arquivo,
        obra_selecionada: r.obra_selecionada,
        dados_json: r.dados_json
      })));
      if (fromHistory.length > 0) {
        setSelectedVersionId(fromHistory[0].id || '');
      }
    } finally {
      setIsLoadingVersions(false);
    }
  };

  // Handler to confirm loading specific version dataset
  const handleConfirmVersion = async () => {
    if (!targetObraForVersion) {
      setIsVersionModalOpen(false);
      return;
    }

    if (!selectedVersionId || availableVersions.length === 0) {
      setObraSelecionada(targetObraForVersion);
      setIsVersionModalOpen(false);
      return;
    }

    const chosenVersion = availableVersions.find(v => v.id === selectedVersionId);
    if (!chosenVersion) {
      setObraSelecionada(targetObraForVersion);
      setIsVersionModalOpen(false);
      return;
    }

    setIsLoadingVersions(true);
    try {
      let dados = chosenVersion.dados_json;

      if (!dados && chosenVersion.id && !chosenVersion.id.startsWith('hist-')) {
        const { data: dbRow } = await supabase
          .from('relatorios_mobilizacao')
          .select('dados_json, nome_arquivo, obra_selecionada, created_at')
          .eq('id', chosenVersion.id)
          .single();

        if (dbRow && dbRow.dados_json) {
          dados = dbRow.dados_json;
        }
      }

      if (dados) {
        const parsed = typeof dados === 'string' ? JSON.parse(dados) : dados;
        const mappedItems = Array.isArray(parsed) ? parsed.map((item: any) => ({
          ...item,
          nome_arquivo: item.nome_arquivo || chosenVersion.nome_arquivo || targetObraForVersion
        })) : [];

        setData(mappedItems);
        setFileName(chosenVersion.nome_arquivo || targetObraForVersion);
        setObraSelecionada(targetObraForVersion);
        setVersaoSelecionada(formatarDataBR(chosenVersion.created_at));
        setSelectedClasse('TODAS');
        setSelectedStatus('TODOS');
        showToast(`Versão de ${formatarDataBR(chosenVersion.created_at)} carregada com sucesso!`, 'success');
      } else {
        setObraSelecionada(targetObraForVersion);
        setVersaoSelecionada(formatarDataBR(chosenVersion.created_at));
      }
    } catch (err) {
      console.error('Erro ao carregar versão selecionada:', err);
      showToast('Erro ao carregar dados da versão selecionada.', 'error');
    } finally {
      setIsLoadingVersions(false);
      setIsVersionModalOpen(false);
    }
  };

  // Obra ativa atual no Dashboard (resolvida da aba selecionada no topo)
  const obraAtiva = abaAtiva || (obrasSelecionadas.length > 0 ? obrasSelecionadas[0] : (obraSelecionada !== 'Todas' ? obraSelecionada : ''));

  // Fetch estrito de fotos do Supabase Storage bucket 'fotos_mobilizacao' (apenas da obra ativa)
  const fetchAlbumFotos = useCallback(async (obraTarget: string) => {
    if (!obraTarget) {
      setAlbumFotos([]);
      return;
    }

    setIsLoadingFotos(true);
    try {
      // Lista APENAS o conteúdo da pasta com o nome exato da obra ativa
      const { data: files, error } = await supabase.storage
        .from('fotos_mobilizacao')
        .list(obraTarget, {
          limit: 50,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      // Se a pasta não existir ou estiver vazia, encerra com o álbum limpo
      if (error || !files || files.length === 0) {
        setAlbumFotos([]);
        return;
      }

      const fotosValidas = files
        .filter(x => x.name !== '.emptyFolderPlaceholder' && !x.name.startsWith('.'))
        .map(file => {
          const { data: publicUrlData } = supabase.storage
            .from('fotos_mobilizacao')
            .getPublicUrl(`${obraTarget}/${file.name}`);

          return {
            id: file.id || file.name,
            name: file.name,
            url: publicUrlData.publicUrl,
            obra: obraTarget,
            created_at: file.created_at || new Date().toISOString()
          };
        });

      setAlbumFotos(fotosValidas);
    } catch (err) {
      console.warn('Erro ao buscar álbum de fotos do Supabase Storage:', err);
      setAlbumFotos([]);
    } finally {
      setIsLoadingFotos(false);
    }
  }, []);

  useEffect(() => {
    // Limpa as fotos imediatamente ao trocar de aba para evitar "fantasmas"
    setAlbumFotos([]);
    if (obraAtiva) {
      fetchAlbumFotos(obraAtiva);
    }
  }, [obraAtiva, fetchAlbumFotos]);

  // Lightbox keyboard navigation listener
  useEffect(() => {
    if (fotoExpandidaIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFotoExpandidaIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setFotoExpandidaIndex(prev => (prev === null || prev <= 0 ? albumFotos.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setFotoExpandidaIndex(prev => (prev === null || prev >= albumFotos.length - 1 ? 0 : prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fotoExpandidaIndex, albumFotos.length]);

  const handleSelectQuickUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast('Selecione uma imagem (.png, .jpg, .jpeg) válida.', 'error');
        return;
      }
      setUploadFileSelected(file);
      setUploadFilePreview(URL.createObjectURL(file));
    }
  };

  const handleQuickUploadFoto = async () => {
    if (!uploadFileSelected) {
      showToast('Selecione uma imagem (.png, .jpg, .jpeg) para enviar.', 'error');
      return;
    }
    if (!obraAtiva) {
      showToast('Nenhuma obra selecionada para o upload.', 'error');
      return;
    }

    setIsUploadingFoto(true);
    try {
      const fileExt = uploadFileSelected.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      // Caminho estrito: [nome exato da aba]/[nome do arquivo]
      const filePath = `${obraAtiva}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('fotos_mobilizacao')
        .upload(filePath, uploadFileSelected, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        showToast(`Erro ao enviar foto: ${uploadError.message}`, 'error');
      } else {
        showToast('Foto salva no Álbum com sucesso!', 'success');
        setIsUploadModalOpen(false);
        setUploadFileSelected(null);
        setUploadFilePreview(null);
        // Recarrega o álbum da obra ativa após o sucesso
        fetchAlbumFotos(obraAtiva);
      }
    } catch (err: any) {
      showToast(`Erro: ${err.message || 'Falha de conexão'}`, 'error');
    } finally {
      setIsUploadingFoto(false);
    }
  };

  // Handler para vincular classe manualmente com tratamento rigoroso de erro, atualização otimista e refetch
  const handleVincularClasse = async (item: any, novaClasse: string) => {
    const rawDesc = item['Descrição do item'] || item.descricao || '';
    const rawCod = item['Código do item'] || item.codigo || '';
    const { codigo, descricao } = separarCodigoEDescricao(rawDesc, rawCod);

    if (!descricao || !novaClasse) return;

    setSavingClassId(item.id);
    try {
      // 1. Tenta inserir / atualizar no Supabase
      const { error: insertError } = await supabase.from('dicionario_classes').upsert(
        {
          codigo_material: codigo || null,
          descricao_material: descricao,
          classe_financeira: novaClasse
        },
        { onConflict: 'codigo_material' }
      );

      // 2. Se houver erro no upsert (ex: sem constraint única), tenta insert direto
      if (insertError) {
        const { error: rawInsertError } = await supabase.from('dicionario_classes').insert({
          codigo_material: codigo || null,
          descricao_material: descricao,
          classe_financeira: novaClasse
        });

        // Se o banco recusar (ex: RLS, erro de conexão), joga o erro e interrompe aqui
        if (rawInsertError) throw rawInsertError;
      }

      // 3. Notificação de sucesso confirmada
      showToast(`Classe "${novaClasse}" vinculada com sucesso!`, 'success');

      // 4. ATUALIZAÇÃO OTIMISTA: Muda a classe do item na memória imediatamente
      item.apelido = novaClasse;
      if (item.classeFinanceira) {
        item.classeFinanceira = novaClasse;
      }
      setTriggerUpdate(prev => prev + 1); // Força a tabela e os filtros a re-renderizarem e removerem o item da lista

      // 5. Roda o refetch em background para atualizar o dicionário e as métricas oficiais
      liveMetrics.refetch().catch(console.error);

    } catch (err: any) {
      console.error('Erro ao vincular classe:', err);
      showToast(`Falha ao salvar: ${err.message || 'Erro desconhecido'}`, 'error');
    } finally {
      setSavingClassId(null);
    }
  };

  // Handler para sinalizar início / mobilização manual de serviços e locações (Intangíveis)
  const [sinalizandoServicoId, setSinalizandoServicoId] = useState<string | null>(null);

  const handleSinalizarServico = async (item: any) => {
    const descItem = item.descricao || item['Descrição do item'] || '';
    if (!window.confirm(`Confirma o início da operação deste serviço na obra?\n\n${descItem}`)) return;

    setSinalizandoServicoId(item.id);
    try {
      // Atualiza as RMs abertas deste material específico para constarem como mobilizadas
      const rawObra = item.centroCusto || item.obra || '';
      const obraLimpa = rawObra.includes(' - ') ? rawObra.split(' - ')[1] : rawObra;

      const { error } = await supabase
        .from('requisicoes')
        .update({ item_status: 'MOBILIZADO' })
        .ilike('material', `%${descItem}%`)
        .ilike('centroCusto', `%${obraLimpa}%`)
        .not('status', 'ilike', '%reprovado%');

      if (error) {
        showToast('Erro ao sinalizar serviço: ' + error.message, 'error');
      } else {
        showToast('Serviço sinalizado com sucesso como MOBILIZADO!', 'success');
        // Recarrega os dados do dashboard em tempo real
        await liveMetrics.refetch();
      }
    } catch (err: any) {
      console.error('Erro ao sinalizar serviço:', err);
      showToast('Falha ao sinalizar serviço: ' + (err.message || 'Erro desconhecido'), 'error');
    } finally {
      setSinalizandoServicoId(null);
    }
  };

  // Active consolidated dataset (Autonomous vs Manual)
  const activeData = useMemo<ItemMobilizacao[]>(() => {
    if (dashboardMode === 'autonomous') {
      return liveMetrics.data.map((m, idx) => ({
        id: `live-${idx}-${m.obra}-${m.classeFinanceira}-${m.codigo}-${m.descricao}`,
        centroCusto: m.obra,
        nome_arquivo: m.obra,
        apelido: m.classeFinanceira || 'Sem Classe Vinculada',
        descricao: m.descricao || 'Item sem Descrição',
        codigo: m.codigo || '',
        'Descrição do item': m.descricao || 'Item sem Descrição',
        'Código do item': m.codigo || '',
        qtdSolicitada: m.totalSolicitado,
        qtdMobilizado: m.qtdMobilizado ?? m.mobilizado,
        qtdDisponivel: m.qtdDisponivel ?? m.disponivel,
        qtdSeparado: m.qtdDisponivel ?? m.disponivel,
        qtdCompra: m.qtdCompra ?? m.emCompras,
        emCompras: m.qtdCompra ?? m.emCompras,
        qtdTriagem: m.qtdTriagem ?? m.emTriagem,
        qtdAnalise: m.qtdTriagem ?? m.emTriagem,
        previsaoEntrega: m.previsaoEntrega || null,
        statusPrazo: m.statusPrazo || 'SEM PREVISÃO',
        numero_pc: m.numero_pc,
        pedido_compra: m.pedido_compra,
        pc: m.pc,
        status_override_manual: m.status_override_manual,
        statusCalculado: m.statusCalculado,
        requisicaoIds: m.requisicaoIds,
        debugSources: m.debugSources
      }));
    }
    return data;
  }, [dashboardMode, liveMetrics.data, data]);

  // Statistics per Obra for selection grid display
  const statsPorObra = useMemo(() => {
    const map: Record<string, ObraStats> = {};
    if (!activeData || !Array.isArray(activeData)) return map;

    activeData.forEach(item => {
      const obraName = item.nome_arquivo || item.centroCusto || item.obra || 'Geral';
      if (!map[obraName]) {
        map[obraName] = {
          totalItens: 0,
          totalSolicitado: 0,
          totalMobilizado: 0,
          totalDisponivel: 0,
          totalCompras: 0,
          totalTriagem: 0
        };
      }
      map[obraName].totalItens += 1;
      map[obraName].totalSolicitado += (item.qtdSolicitada || 0);
      map[obraName].totalMobilizado = (map[obraName].totalMobilizado || 0) + (item.qtdMobilizado || 0);
      map[obraName].totalDisponivel = (map[obraName].totalDisponivel || 0) + (item.qtdDisponivel ?? item.qtdSeparado ?? 0);
      map[obraName].totalCompras = (map[obraName].totalCompras || 0) + (item.qtdCompra ?? item.emCompras ?? 0);
      map[obraName].totalTriagem = (map[obraName].totalTriagem || 0) + (item.qtdTriagem ?? item.qtdAnalise ?? 0);
    });

    return map;
  }, [activeData]);

  // 1. Base dataset filtered strictly by active Obra Tab (abaAtiva)
  const dataFiltradaObra = useMemo(() => {
    if (!activeData || !Array.isArray(activeData) || activeData.length === 0) return [];

    // The active tab takes top priority
    const currentObra = abaAtiva || (obrasSelecionadas.length > 0 ? obrasSelecionadas[0] : obraSelecionada);
    
    if (!currentObra || currentObra === 'Todas' || currentObra === 'Todas as Obras' || currentObra === 'TODAS AS OBRAS') {
      return activeData;
    }
    
    const setorFoco = normalizarCC(currentObra);

    // Filtra os itens apenas para a obra selecionada no momento com normalizarCC em ambos os lados
    const filtered = activeData.filter(item => {
      const setorItem = normalizarCC(item.centroCusto || item.nome_arquivo || item.obra || (item as any).setor || (item as any).centro_custo);
      return setorItem === setorFoco;
    });

    // Removida qualquer lógica de fallback que retornaria activeData
    return filtered;
  }, [activeData, abaAtiva, obrasSelecionadas, obraSelecionada, triggerUpdate]);

  // 2. Unique list of Classes (Apelido) based on current Obra selection
  const uniqueClasses = useMemo(() => {
    if (!dataFiltradaObra || !Array.isArray(dataFiltradaObra) || dataFiltradaObra.length === 0) return [];
    const setCls = new Set<string>();
    dataFiltradaObra.forEach(i => {
      if (i.apelido && String(i.apelido).trim()) {
        setCls.add(String(i.apelido).trim());
      }
    });
    return Array.from(setCls).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [dataFiltradaObra, triggerUpdate]);

  // 3. Full Cascaded Dataset (Obra + Classe + Status)
  const dataFiltradaCascata = useMemo(() => {
    if (!dataFiltradaObra || !Array.isArray(dataFiltradaObra) || dataFiltradaObra.length === 0) return [];

    return dataFiltradaObra.filter(item => {
      // Filter by Classe
      if (selectedClasse && selectedClasse !== 'TODAS') {
        const itemClasse = String(item.apelido || '').trim().toUpperCase();
        const targetClasse = selectedClasse.trim().toUpperCase();
        if (itemClasse !== targetClasse && item.apelido !== selectedClasse) {
          return false;
        }
      }
      
      // Filter by Status (Robust checking for both manual and autonomous)
      if (selectedStatus && selectedStatus !== 'TODOS') {
        if (selectedStatus.includes('Mobilizado')) return (item.qtdMobilizado ?? 0) > 0;
        if (selectedStatus.includes('Separado') || selectedStatus.includes('Disponível')) return (item.qtdDisponivel ?? item.qtdSeparado ?? 0) > 0;
        if (selectedStatus.includes('Compras') || selectedStatus.includes('Compra')) return (item.qtdCompra ?? item.emCompras ?? 0) > 0;
        if (selectedStatus.includes('Triagem') || selectedStatus.includes('Análise') || selectedStatus.includes('Analise')) return (item.qtdTriagem ?? item.qtdAnalise ?? 0) > 0;
      }

      return true;
    });
  }, [dataFiltradaObra, selectedClasse, selectedStatus, triggerUpdate]);

  // Process uploaded Excel / CSV file
  const handleFileProcess = (file: File) => {
    setIsLoading(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert worksheet to JSON rows
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawRows || rawRows.length === 0) {
          showToast('A planilha importada parece estar vazia.', 'error');
          setIsLoading(false);
          return;
        }

        // Parse and standardize items matching Overhaul(Tbl_pedidos).csv columns
        const parsedItems: ItemMobilizacao[] = rawRows.map((row, index) => {
          const rawCc = 
            row['Centro de Custo'] || 
            row['CENTRO_DE_CUSTO'] || 
            row['Centro de custo'] || 
            row['CC'] || 
            row['Obra'] || 
            row['Solicitante'] || 
            'CC-1020 GERAL';

          const rawDesc = 
            row['Descrição do item'] || 
            row['Descrição do Item'] || 
            row['DESCRIÇÃO DO ITEM'] || 
            row['DESCRICAO DO ITEM'] || 
            row['Descrição'] || 
            row['DESCRICAO'] || 
            row['Descricao'] || 
            row['Descrição do Material'] || 
            row['Material'] || 
            row['ITEM'] || 
            row['Item'] || 
            'Item sem Descrição';

          const descricaoStr = String(rawDesc).trim();

          const rawCodigo = 
            row['Código do item'] || 
            row['Codigo do item'] || 
            row['CÓDIGO DO ITEM'] || 
            row['CODIGO DO ITEM'] || 
            row['Código'] || 
            row['Codigo'] || 
            row['CÓDIGO'] || 
            row['CODIGO'] || 
            '';

          const codigoStr = String(rawCodigo).trim();

          const rawApelido = 
            row['APELIDO'] || 
            row['Apelido'] || 
            row['apelido'] || 
            row['CLASSE'] || 
            row['Classe'] || 
            row['classe'] || 
            inferirClasse(descricaoStr);

          const sanitizedApelido = higienizarClasse(rawApelido);
          const apelidoStr = sanitizedApelido !== 'Sem Classe Vinculada' ? sanitizedApelido : (String(rawApelido).trim() || 'DIVERSOS');

          const qtdSolicitada = parseNum(
            row['Quantidade solicitada'] || 
            row['Qtd. Solicitada'] || 
            row['QUANTIDADE SOLICITADA'] || 
            row['Quantidade Solicitada'] || 
            row['Qtd Solicitada'] || 
            row['Quantidade'] || 
            row['Qtd'] || 
            row['QUANTIDADE']
          );

          const qtdMobilizado = parseNum(
            row['MOBILIZADO'] || 
            row['Mobilizado'] || 
            row['mobilizado'] || 
            row['Qtd Mobilizado']
          );

          const qtdSeparado = parseNum(
            row['SEPARADO'] || 
            row['Separado'] || 
            row['separado'] || 
            row['DISPONIVEL'] || 
            row['Disponível'] || 
            row['DISPONÍVEL']
          );

          const qtdCompra = parseNum(
            row['COMPRA'] || 
            row['Compra'] || 
            row['compra'] || 
            row['EM COMPRAS'] || 
            row['Em Compras']
          );

          const qtdAnalise = parseNum(
            row['EM ANÁLISE'] || 
            row['EM ANALISE'] || 
            row['Em Análise'] || 
            row['Em Analise'] || 
            row['Análise'] || 
            row['ANALISE']
          );

          const calculatedTotal = qtdMobilizado + qtdSeparado + qtdCompra + qtdAnalise;
          const finalQtdSolicitada = qtdSolicitada > 0 ? qtdSolicitada : (calculatedTotal > 0 ? calculatedTotal : 1);

          return {
            id: `tbl-${index}-${Date.now()}`,
            centroCusto: normalizarObra(rawCc),
            apelido: apelidoStr,
            descricao: descricaoStr,
            codigo: codigoStr,
            'Descrição do item': descricaoStr,
            'Código do item': codigoStr,
            qtdSolicitada: finalQtdSolicitada,
            qtdMobilizado,
            qtdSeparado,
            qtdCompra,
            qtdAnalise
          };
        });

        setData(parsedItems);
        setObraSelecionada('Todas');
        setSelectedClasse('TODAS');
        setSelectedStatus('TODOS');
        showToast(`Planilha "${file.name}" carregada (${parsedItems.length} pedidos).`, 'success');
      } catch (err) {
        console.error('Erro ao ler planilha/CSV:', err);
        showToast('Erro ao ler planilha. Verifique o formato (.csv/.xls/.xlsx).', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileProcess(e.target.files[0]);
    }
  };

  // Helper for formatting created_at to Brazilian date format
  const formatarDataBR = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    const horas = String(d.getHours()).padStart(2, '0');
    const minutos = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} às ${horas}:${minutos}`;
  };

  // Saved Reports History Handler
  const handleOpenHistory = async () => {
    setIsHistoricoModalOpen(true);
    setIsHistoryOpen(true);
    await fetchHistorico();
  };

  const handleAbrirRelatorio = (report: { obra_selecionada: string; nome_arquivo?: string; created_at?: string; html_content?: string; dados_json?: any }) => {
    let parsedData: ItemMobilizacao[] = [];
    if (report.dados_json) {
      if (typeof report.dados_json === 'string') {
        try {
          parsedData = JSON.parse(report.dados_json);
        } catch (e) {
          console.error('Erro ao fazer parse de dados_json:', e);
        }
      } else if (Array.isArray(report.dados_json)) {
        parsedData = report.dados_json;
      }
    }

    if (parsedData && parsedData.length > 0) {
      setData(parsedData);
      const obraToSet = report.obra_selecionada === 'TODAS AS OBRAS' ? 'Todas' : (report.obra_selecionada || 'Todas');
      setObraSelecionada(obraToSet);
      setAbaAtiva(obraToSet);
      setObrasSelecionadas(prev => (obraToSet !== 'Todas' && !prev.includes(obraToSet)) ? [obraToSet, ...prev] : prev);
      setSelectedClasse('TODAS');
      setSelectedStatus('TODOS');
      if (report.nome_arquivo) {
        setFileName(report.nome_arquivo);
      } else if (report.created_at) {
        setFileName('Relatório de ' + formatarDataBR(report.created_at));
      }
      showToast(`Relatório (${obraToSet}) restaurado no Dashboard!`, 'success');
    } else {
      showToast('Aviso: Este registro antigo não possui dados JSON para restauração.', 'error');
    }

    setIsHistoricoModalOpen(false);
    setIsHistoryOpen(false);
  };

  // KPI Calculations (Exact mathematical sums based on dataFiltradaCascata)
  const metrics = useMemo(() => {
    if (dataFiltradaCascata.length === 0) {
      return {
        totalSolicitado: 0,
        totalMobilizado: 0,
        totalSeparado: 0,
        totalCompra: 0,
        totalAnalise: 0,
        mobilizadoPct: '0.0',
        disponivelPct: '0.0',
        emComprasPct: '0.0',
        emAnalisePct: '0.0'
      };
    }

    let totalSolicitado = 0;
    let totalMobilizado = 0;
    let totalSeparado = 0;
    let totalCompra = 0;
    let totalAnalise = 0;

    dataFiltradaCascata.forEach((item) => {
      totalSolicitado += (item.qtdSolicitada || 0);
      totalMobilizado += (item.qtdMobilizado || 0);
      totalSeparado += (item.qtdDisponivel ?? item.qtdSeparado ?? 0);
      totalCompra += (item.qtdCompra ?? item.emCompras ?? 0);
      totalAnalise += (item.qtdTriagem ?? item.qtdAnalise ?? 0);
    });

    const base = totalSolicitado > 0 ? totalSolicitado : 1;

    return {
      totalSolicitado,
      totalMobilizado,
      totalSeparado,
      totalCompra,
      totalAnalise,
      mobilizadoPct: ((totalMobilizado / base) * 100).toFixed(1),
      disponivelPct: ((totalSeparado / base) * 100).toFixed(1),
      emComprasPct: ((totalCompra / base) * 100).toFixed(1),
      emAnalisePct: ((totalAnalise / base) * 100).toFixed(1)
    };
  }, [dataFiltradaCascata, triggerUpdate]);

  // Data Grouping by APELIDO for Charts (based on dataFiltradaCascata)
  const chartDataByStatus = useMemo(() => {
    const mapClasses: Record<string, {
      apelido: string;
      qtdMobilizado: number;
      qtdSeparado: number;
      qtdCompra: number;
      qtdAnalise: number;
    }> = {};

    dataFiltradaCascata.forEach((item) => {
      const key = item.apelido.toUpperCase().trim() || 'DIVERSOS';
      if (!mapClasses[key]) {
        mapClasses[key] = {
          apelido: item.apelido || 'DIVERSOS',
          qtdMobilizado: 0,
          qtdSeparado: 0,
          qtdCompra: 0,
          qtdAnalise: 0
        };
      }
      mapClasses[key].qtdMobilizado += (item.qtdMobilizado || 0);
      mapClasses[key].qtdSeparado += (item.qtdDisponivel ?? item.qtdSeparado ?? 0);
      mapClasses[key].qtdCompra += (item.qtdCompra ?? item.emCompras ?? 0);
      mapClasses[key].qtdAnalise += (item.qtdTriagem ?? item.qtdAnalise ?? 0);
    });

    const allList = Object.values(mapClasses);

    const mobList = [...allList]
      .filter(x => x.qtdMobilizado > 0)
      .sort((a, b) => b.qtdMobilizado - a.qtdMobilizado)
      .slice(0, 7)
      .map(x => {
        const pct = metrics.totalMobilizado > 0 ? (x.qtdMobilizado / metrics.totalMobilizado) * 100 : 0;
        const pctVal = parseFloat(pct.toFixed(1));
        return {
          ...x,
          pctMobilizado: pctVal,
          labelMobilizado: `${pctVal}% (${x.qtdMobilizado.toLocaleString('pt-BR')} un.)`
        };
      });

    const dispList = [...allList]
      .filter(x => x.qtdSeparado > 0)
      .sort((a, b) => b.qtdSeparado - a.qtdSeparado)
      .slice(0, 7)
      .map(x => {
        const pct = metrics.totalSeparado > 0 ? (x.qtdSeparado / metrics.totalSeparado) * 100 : 0;
        const pctVal = parseFloat(pct.toFixed(1));
        return {
          ...x,
          pctSeparado: pctVal,
          labelSeparado: `${pctVal}% (${x.qtdSeparado.toLocaleString('pt-BR')} un.)`
        };
      });

    const compList = [...allList]
      .filter(x => x.qtdCompra > 0)
      .sort((a, b) => b.qtdCompra - a.qtdCompra)
      .slice(0, 7)
      .map(x => {
        const pct = metrics.totalCompra > 0 ? (x.qtdCompra / metrics.totalCompra) * 100 : 0;
        const pctVal = parseFloat(pct.toFixed(1));
        return {
          ...x,
          pctCompra: pctVal,
          labelCompra: `${pctVal}% (${x.qtdCompra.toLocaleString('pt-BR')} un.)`
        };
      });

    const anaList = [...allList]
      .filter(x => x.qtdAnalise > 0)
      .sort((a, b) => b.qtdAnalise - a.qtdAnalise)
      .slice(0, 7)
      .map(x => {
        const pct = metrics.totalAnalise > 0 ? (x.qtdAnalise / metrics.totalAnalise) * 100 : 0;
        const pctVal = parseFloat(pct.toFixed(1));
        return {
          ...x,
          pctAnalise: pctVal,
          labelAnalise: `${pctVal}% (${x.qtdAnalise.toLocaleString('pt-BR')} un.)`
        };
      });

    return {
      mobilizado: mobList,
      disponivel: dispList,
      emCompras: compList,
      emAnalise: anaList
    };
  }, [dataFiltradaCascata, metrics, triggerUpdate]);

  // Filtered Items for Analytical Table
  const filteredData = useMemo(() => {
    if (!searchTerm) return dataFiltradaCascata;
    const term = searchTerm.toLowerCase();
    return dataFiltradaCascata.filter(item => {
      const descVal = item['Descrição do item'] || item.descricao || '';
      const codVal = item['Código do item'] || item.codigo || '';
      return (
        descVal.toLowerCase().includes(term) ||
        codVal.toLowerCase().includes(term) ||
        item.centroCusto.toLowerCase().includes(term) ||
        item.apelido.toLowerCase().includes(term)
      );
    });
  }, [dataFiltradaCascata, searchTerm, triggerUpdate]);

  // HTML Executive Report String Generator
  const generateHTMLReportString = (): string => {
    const dataHora = new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const nomeObra = abaAtiva || (obrasSelecionadas.length > 0 ? obrasSelecionadas[0] : (obraSelecionada === 'Todas' ? 'Todas as Obras (Visão Consolidada)' : obraSelecionada));

    const renderTopRows = (items: any[], campoKey: string, corBadge: string, totalStatus: number, rgbaCor: string) => {
      if (!items || items.length === 0) {
        return `<tr><td colspan="2" style="padding: 10px 14px; color: #64748b; font-size: 11px; font-style: italic;">Nenhuma quantidade neste status</td></tr>`;
      }
      return items.slice(0, 5).map((item, idx) => {
        const val = item[campoKey] || 0;
        const pct = totalStatus > 0 ? (val / totalStatus) * 100 : 0;
        const pctStr = pct.toFixed(1) + '%';
        const pctBg = Math.min(100, Math.max(0, parseFloat(pct.toFixed(1))));
        return `
          <tr style="border-bottom: 1px solid #1e293b; background: linear-gradient(90deg, ${rgbaCor} ${pctBg}%, transparent ${pctBg}%);">
            <td style="padding: 10px 14px; font-weight: 700; color: #f1f5f9; font-size: 12px;">#${idx + 1} ${item.apelido}</td>
            <td style="padding: 10px 14px; text-align: right; font-family: monospace; font-weight: 800; color: ${corBadge}; font-size: 12px;">${pctStr} (${val.toLocaleString('pt-BR')} un.)</td>
          </tr>
        `;
      }).join('');
    };

    const renderDetailTable = (
      idAnchor: string,
      tituloStatus: string,
      corBadge: string,
      campoQtd: 'qtdMobilizado' | 'qtdSeparado' | 'qtdCompra' | 'qtdAnalise'
    ) => {
      const isCompras = campoQtd === 'qtdCompra';
      const itemsStatus = dataFiltradaCascata.filter(i => (i[campoQtd] || 0) > 0 || (isCompras && (i.emCompras || 0) > 0));

      let rowsHtml = '';
      if (itemsStatus.length === 0) {
        rowsHtml = `<tr><td colspan="${isCompras ? 5 : 4}" style="padding: 16px; text-align: center; color: #64748b; font-style: italic;">Nenhum item com quantidade neste status.</td></tr>`;
      } else if (isCompras) {
        rowsHtml = itemsStatus.map(item => {
          let badgePrazo = '<span style="background: #334155; color: #94a3b8; padding: 3px 6px; border-radius: 4px; font-size: 9px; text-transform: uppercase;">Sem Previsão</span>';
          let dataPrazo = '-';

          if (item.statusPrazo === 'ATRASADO') {
            badgePrazo = '<span style="background: rgba(244, 63, 94, 0.2); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3); padding: 3px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; text-transform: uppercase;">Atrasado</span>';
            if (item.previsaoEntrega) {
              dataPrazo = new Date(item.previsaoEntrega + (item.previsaoEntrega.includes('T') ? '' : 'T12:00:00Z')).toLocaleDateString('pt-BR');
            }
          } else if (item.statusPrazo === 'NO PRAZO') {
            badgePrazo = '<span style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 3px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; text-transform: uppercase;">No Prazo</span>';
            if (item.previsaoEntrega) {
              dataPrazo = new Date(item.previsaoEntrega + (item.previsaoEntrega.includes('T') ? '' : 'T12:00:00Z')).toLocaleDateString('pt-BR');
            }
          }

          return `
            <tr>
              <td><span style="background: #1e293b; color: #fbbf24; padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 10px; border: 1px solid #334155;">${item.apelido || item.classeFinanceira || 'N/A'}</span></td>
              <td style="font-family: monospace; font-weight: 700; color: #cbd5e1;">${item.centroCusto || item.obra || 'N/A'}</td>
              <td style="font-weight: 700; color: #ffffff;">
                <div style="font-family: monospace; font-size: 10px; color: #94a3b8; margin-bottom: 2px;">Cod: ${item.codigo || item['Código do item'] || '-'}</div>
                ${item.descricao || item['Descrição do item'] || 'Item sem descrição'}
              </td>
              <td>
                <div style="font-family: monospace; font-size: 11px; color: #cbd5e1; margin-bottom: 4px;">${dataPrazo}</div>
                ${badgePrazo}
              </td>
              <td style="text-align: right; font-family: monospace; font-weight: 800; color: #cbd5e1;">${(item.emCompras || item.qtdCompra || 0).toLocaleString('pt-BR')} un.</td>
            </tr>
          `;
        }).join('');
      } else {
        rowsHtml = itemsStatus.map(item => {
          const descItem = item['Descrição do item'] || item.descricao || 'Item sem Descrição';
          const codItem = item['Código do item'] || item.codigo || '';
          return `
            <tr>
              <td><span style="background: #1e293b; color: #fbbf24; padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 10px; border: 1px solid #334155;">${item.apelido || item.classeFinanceira || 'N/A'}</span></td>
              <td style="font-family: monospace; font-weight: 700; color: #cbd5e1;">${item.centroCusto || item.obra || 'N/A'}</td>
              <td style="font-weight: 700; color: #ffffff;">
                ${codItem ? `<div style="font-family: monospace; font-size: 10px; color: #94a3b8; margin-bottom: 2px;">Cod: ${codItem}</div>` : ''}
                ${descItem}
              </td>
              <td style="text-align: right; font-family: monospace; font-weight: 800; color: ${corBadge};">${item[campoQtd].toLocaleString('pt-BR')} un.</td>
            </tr>
          `;
        }).join('');
      }

      return `
        <div id="${idAnchor}" class="detail-section">
          <div class="detail-header">
            <div class="detail-title" style="color: ${corBadge};">
              ${tituloStatus} (${itemsStatus.length} itens)
            </div>
            <a href="#top" class="btn-top">⬆ Voltar ao topo</a>
          </div>
          <div style="overflow-x: auto;">
            <table class="detail-table">
              <thead>
                <tr>
                  <th>Classe (Apelido)</th>
                  <th>Centro de Custo</th>
                  <th>Descrição do Material</th>
                  ${isCompras ? '<th>Previsão / Prazo</th>' : ''}
                  <th style="text-align: right;">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    };

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de Mobilização - ${nomeObra}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #020617;
      color: #f8fafc;
      padding: 32px 20px;
      line-height: 1.5;
    }
    .container {
      max-width: 1100px;
      margin: 0 auto;
    }
    .header {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 20px;
      padding: 24px 32px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
    }
    .header-title h1 {
      font-size: 22px;
      font-weight: 900;
      color: #fbbf24;
      text-transform: uppercase;
      letter-spacing: -0.5px;
    }
    .header-title p {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 4px;
    }
    .header-meta {
      text-align: right;
      font-size: 12px;
      color: #cbd5e1;
    }
    .badge-obra {
      display: inline-block;
      background: #1e293b;
      border: 1px solid #334155;
      color: #fbbf24;
      font-weight: 800;
      padding: 6px 14px;
      border-radius: 20px;
      margin-bottom: 6px;
      font-family: monospace;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .card-kpi {
      background: #0f172a;
      border-radius: 16px;
      padding: 20px;
      position: relative;
    }
    .card-kpi-link {
      text-decoration: none;
      display: block;
      cursor: pointer;
      transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .card-kpi-link:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 20px -5px rgba(0,0,0,0.4);
    }
    .kpi-mob { border: 1px solid rgba(59, 130, 246, 0.4); }
    .kpi-disp { border: 1px solid rgba(16, 185, 129, 0.4); }
    .kpi-comp { border: 1px solid rgba(148, 163, 184, 0.4); }
    .kpi-ana { border: 1px solid rgba(244, 63, 94, 0.4); }

    .kpi-label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
    .kpi-mob .kpi-label { color: #60a5fa; }
    .kpi-disp .kpi-label { color: #34d399; }
    .kpi-comp .kpi-label { color: #cbd5e1; }
    .kpi-ana .kpi-label { color: #f87171; }

    .kpi-val { font-size: 32px; font-weight: 900; line-height: 1; color: #ffffff; }
    .kpi-unit { font-size: 12px; font-weight: 700; margin-top: 8px; font-family: monospace; }
    .kpi-mob .kpi-unit { color: #93c5fd; }
    .kpi-disp .kpi-unit { color: #6ee7b7; }
    .kpi-comp .kpi-unit { color: #e2e8f0; }
    .kpi-ana .kpi-unit { color: #fda4af; }

    .kpi-action {
      margin-top: 12px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .kpi-mob .kpi-action { color: #60a5fa; }
    .kpi-disp .kpi-action { color: #34d399; }
    .kpi-comp .kpi-action { color: #cbd5e1; }
    .kpi-ana .kpi-action { color: #f87171; }

    .section-title {
      font-size: 15px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #e2e8f0;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title::before {
      content: '';
      display: inline-block;
      width: 8px;
      height: 8px;
      background: #fbbf24;
      border-radius: 50%;
    }
    .grid-2x2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .card-top {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      overflow: hidden;
    }
    .card-top-header {
      padding: 12px 16px;
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #1e293b;
    }
    .hdr-mob { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border-bottom-color: rgba(59, 130, 246, 0.3); }
    .hdr-disp { background: rgba(16, 185, 129, 0.15); color: #34d399; border-bottom-color: rgba(16, 185, 129, 0.3); }
    .hdr-comp { background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border-bottom-color: rgba(148, 163, 184, 0.3); }
    .hdr-ana { background: rgba(244, 63, 94, 0.15); color: #f87171; border-bottom-color: rgba(244, 63, 94, 0.3); }

    .tbl-top { width: 100%; border-collapse: collapse; }

    .detail-section {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 20px 24px;
      margin-bottom: 24px;
      scroll-margin-top: 24px;
    }
    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .detail-title {
      font-size: 14px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .btn-top {
      font-size: 11px;
      font-weight: 800;
      color: #fbbf24;
      background: #1e293b;
      border: 1px solid #334155;
      padding: 5px 12px;
      border-radius: 12px;
      text-decoration: none;
      transition: background 0.2s;
    }
    .btn-top:hover {
      background: #334155;
    }
    .detail-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .detail-table th {
      background: #1e293b;
      padding: 10px 12px;
      text-align: left;
      color: #94a3b8;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #334155;
    }
    .detail-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #1e293b;
      color: #f1f5f9;
    }
    .detail-table tr:hover {
      background: rgba(30, 41, 59, 0.5);
    }

    .footer {
      text-align: center;
      font-size: 11px;
      color: #64748b;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #1e293b;
    }
  </style>
</head>
<body>
  <div class="container" id="top">
    
    <!-- HEADER -->
    <div class="header">
      <div class="header-title">
        <h1>Status de Mobilização</h1>
        <p>Relatório Executivo Interativo • Base Overhaul(Tbl_pedidos)</p>
      </div>
      <div class="header-meta">
        <div class="badge-obra">Obra: ${nomeObra}</div>
        <div>Data da Emissão: <strong>${dataHora}</strong></div>
        <div>Total Solicitado: <strong>${metrics.totalSolicitado.toLocaleString('pt-BR')} un.</strong> (${dataFiltradaCascata.length} pedidos)</div>
      </div>
    </div>

    <!-- CARDS RESUMO (TERMÔMETROS COM LINKS DE NAVEGAÇÃO) -->
    <div class="metrics-grid">
      <a href="#detalhes-mobilizado" class="card-kpi kpi-mob card-kpi-link" title="Clique para ver detalhes de itens Mobilizados">
        <div class="kpi-label">MOBILIZADO</div>
        <div class="kpi-val">${metrics.mobilizadoPct}%</div>
        <div class="kpi-unit">${metrics.totalMobilizado.toLocaleString('pt-BR')} un.</div>
        <div class="kpi-action">Ver Detalhes ↓</div>
      </a>
      <a href="#detalhes-separado" class="card-kpi kpi-disp card-kpi-link" title="Clique para ver detalhes de itens Separados">
        <div class="kpi-label">SEPARADO (DISPONÍVEL)</div>
        <div class="kpi-val">${metrics.disponivelPct}%</div>
        <div class="kpi-unit">${metrics.totalSeparado.toLocaleString('pt-BR')} un.</div>
        <div class="kpi-action">Ver Detalhes ↓</div>
      </a>
      <a href="#detalhes-compras" class="card-kpi kpi-comp card-kpi-link" title="Clique para ver detalhes de itens Em Compras">
        <div class="kpi-label">EM COMPRAS</div>
        <div class="kpi-val">${metrics.emComprasPct}%</div>
        <div class="kpi-unit">${metrics.totalCompra.toLocaleString('pt-BR')} un.</div>
        <div class="kpi-action">Ver Detalhes ↓</div>
      </a>
      <a href="#detalhes-triagem" class="card-kpi kpi-ana card-kpi-link" title="Clique para ver detalhes de itens Em Triagem">
        <div class="kpi-label">EM TRIAGEM</div>
        <div class="kpi-val">${metrics.emAnalisePct}%</div>
        <div class="kpi-unit">${metrics.totalAnalise.toLocaleString('pt-BR')} un.</div>
        <div class="kpi-action">Ver Detalhes ↓</div>
      </a>
    </div>

    <!-- TOP CLASSES POR STATUS -->
    <div class="section-title">Top 5 Classes (Apelido) por Status de Abastecimento (%)</div>
    <div class="grid-2x2">
      
      <!-- Top Mobilizado -->
      <div class="card-top">
        <div class="card-top-header hdr-mob">1. Mobilizados por Classe (%)</div>
        <table class="tbl-top">
          <tbody>
            ${renderTopRows(chartDataByStatus.mobilizado, 'qtdMobilizado', '#60a5fa', metrics.totalMobilizado, 'rgba(59, 130, 246, 0.25)')}
          </tbody>
        </table>
      </div>

      <!-- Top Disponível -->
      <div class="card-top">
        <div class="card-top-header hdr-disp">2. Disponíveis por Classe (%)</div>
        <table class="tbl-top">
          <tbody>
            ${renderTopRows(chartDataByStatus.disponivel, 'qtdSeparado', '#34d399', metrics.totalSeparado, 'rgba(16, 185, 129, 0.25)')}
          </tbody>
        </table>
      </div>

      <!-- Top Em Compras -->
      <div class="card-top">
        <div class="card-top-header hdr-comp">3. Em Compras por Classe (%)</div>
        <table class="tbl-top">
          <tbody>
            ${renderTopRows(chartDataByStatus.emCompras, 'qtdCompra', '#cbd5e1', metrics.totalCompra, 'rgba(148, 163, 184, 0.25)')}
          </tbody>
        </table>
      </div>

      <!-- Top Em Triagem -->
      <div class="card-top">
        <div class="card-top-header hdr-ana">4. Em Triagem por Classe (%)</div>
        <table class="tbl-top">
          <tbody>
            ${renderTopRows(chartDataByStatus.emAnalise, 'qtdAnalise', '#f87171', metrics.totalAnalise, 'rgba(244, 63, 94, 0.25)')}
          </tbody>
        </table>
      </div>

    </div>

    <!-- SEÇÃO DE DETALHAMENTO DE ITENS POR STATUS (DRILL-DOWN) -->
    <div class="section-title" style="margin-top: 40px;">Detalhamento de Itens por Status (Drill-Down)</div>
    
    <div style="margin-bottom: 24px;">
      <input type="text" id="searchInput" placeholder="🔍 Pesquisar por código, descrição, classe ou centro de custo..." 
        style="width: 100%; padding: 14px 20px; border-radius: 12px; border: 1px solid #334155; background: #0f172a; color: #f8fafc; font-size: 14px; outline: none; transition: border-color 0.2s;"
        onfocus="this.style.borderColor='#fbbf24'" onblur="this.style.borderColor='#334155'">
    </div>

    ${renderDetailTable('detalhes-mobilizado', '1. Itens Mobilizados', '#60a5fa', 'qtdMobilizado')}
    ${renderDetailTable('detalhes-separado', '2. Itens Separados / Disponíveis', '#34d399', 'qtdSeparado')}
    ${renderDetailTable('detalhes-compras', '3. Itens Em Compras', '#cbd5e1', 'qtdCompra')}
    ${renderDetailTable('detalhes-triagem', '4. Itens Em Triagem', '#f87171', 'qtdAnalise')}

    <div class="footer">
      Relatório corporativo acionável com navegação drill-down • Overhaul BI
    </div>

  </div>

  <script>
    document.getElementById('searchInput').addEventListener('keyup', function() {
      const filter = this.value.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
      const tables = document.querySelectorAll('.detail-table');

      tables.forEach(table => {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
          if (row.cells.length <= 1) return; // Ignora linha de "Nenhum item"
          const rowText = row.textContent.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
          row.style.display = rowText.includes(filter) ? '' : 'none';
        });
      });
    });
  </script>
</body>
</html>`;
  };

  // Download local HTML file
  const handleExportarHTML = () => {
    const htmlContent = generateHTMLReportString();
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const nomeSanitizado = (obraSelecionada === 'Todas' ? 'TODAS_AS_OBRAS' : obraSelecionada).replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `relatorio_mobilizacao_${nomeSanitizado}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Save Report HTML and dataset JSON directly to Supabase table relatorios_mobilizacao (with local fallback)
  const handleSalvarNoBanco = async () => {
    setIsSaving(true);
    try {
      const htmlContent = generateHTMLReportString();
      const nomeObra = obraSelecionada === 'Todas' ? 'TODAS AS OBRAS' : obraSelecionada;
      const nomeArquivoOrigem = fileName || 'planilha_mobilizacao.xlsx';

      let savedOk = false;
      
      try {
        const { error } = await supabase
          .from('relatorios_mobilizacao')
          .insert([
            {
              obra_selecionada: nomeObra,
              nome_arquivo: nomeArquivoOrigem,
              html_content: htmlContent,
              dados_json: data,
              created_at: new Date().toISOString()
            }
          ]);

        if (!error) {
          savedOk = true;
          showToast(`Relatório (${nomeObra}) salvo na base de dados com sucesso!`, 'success');
        } else {
          console.warn('Supabase insert warning with nome_arquivo, trying fallback without nome_arquivo:', error.message);
          const { error: fbErr } = await supabase
            .from('relatorios_mobilizacao')
            .insert([
              {
                obra_selecionada: nomeObra,
                html_content: htmlContent,
                dados_json: data,
                created_at: new Date().toISOString()
              }
            ]);

          if (!fbErr) {
            savedOk = true;
            showToast(`Relatório (${nomeObra}) salvo na base de dados com sucesso!`, 'success');
          } else {
            console.warn('Supabase insert fallback failed:', fbErr.message);
          }
        }
      } catch (spErr) {
        console.warn('Supabase connection error, falling back to local database:', spErr);
      }

      if (!savedOk) {
        // Fallback: Save in local storage DB
        const reportEntry = {
          id: 'rep-' + Date.now(),
          obra_selecionada: nomeObra,
          nome_arquivo: nomeArquivoOrigem,
          html_content: htmlContent,
          dados_json: data,
          created_at: new Date().toISOString()
        };
        const localSaved = JSON.parse(localStorage.getItem('relatorios_mobilizacao_saved') || '[]');
        localSaved.unshift(reportEntry);
        localStorage.setItem('relatorios_mobilizacao_saved', JSON.stringify(localSaved.slice(0, 50)));
        showToast(`Relatório (${nomeObra}) salvo com sucesso na base!`, 'success');
      }

      await fetchHistorico();
    } catch (err: any) {
      console.error('Exceção ao salvar relatório:', err);
      showToast(`Erro ao salvar relatório: ${err.message || 'Falha no processamento'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Step 1: Tela de Seleção de Fonte (Manual vs Live)
  if (step === 'FONTE' || dashboardMode === 'selection') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-amber-500 selection:text-black overflow-y-auto" id="dashboard-mode-selection-screen">
        
        {/* Top Navbar */}
        <div className="w-full border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase text-white tracking-wide">
                Painel de Abastecimento de Mobilizações
              </h1>
              <p className="text-[11px] text-slate-400 font-semibold">
                Passo 1 de 3: Seleção de Fonte de Dados
              </p>
            </div>
          </div>

          <button
            onClick={onBackToHub}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-750 border border-slate-700/80 rounded-xl transition-all cursor-pointer shadow-sm hover:border-slate-600"
            id="btn-voltar-hub-selection"
          >
            <ChevronLeft className="w-4 h-4 text-amber-400" />
            <span>Voltar ao Hub</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 max-w-5xl mx-auto w-full">
          
          {/* Title and Intro */}
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-black uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ambiente de Inteligência Operacional</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
              Selecione a Fonte de Dados
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed font-medium">
              Escolha como deseja visualizar e auditar os saldos, requisições, pedidos de compra e frentes de mobilização.
            </p>
          </div>

          {/* 2 Big Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
            
            {/* Card 1: Modo Manual (Estático) */}
            <div
              onClick={() => {
                setDashboardMode('manual');
                setStep('OBRAS');
              }}
              className="group relative bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 rounded-3xl p-7 md:p-8 flex flex-col justify-between transition-all duration-300 shadow-2xl hover:shadow-amber-500/10 cursor-pointer transform hover:-translate-y-1"
              id="card-modo-manual"
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="p-3.5 bg-amber-500/10 group-hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-2xl transition-colors">
                    <FileSpreadsheet className="w-8 h-8" />
                  </span>
                  <span className="text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 group-hover:text-amber-400 group-hover:border-amber-500/30 transition-colors">
                    Arquivo XLSX / CSV
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight group-hover:text-amber-300 transition-colors">
                    Modo Manual (Estático)
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    Suba uma planilha XLSX para analisar o cenário de abastecimento em um momento específico do passado.
                  </p>
                </div>

                <ul className="space-y-2 text-[11px] text-slate-400 border-t border-slate-800/80 pt-4 font-medium">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                    <span>Upload e auditoria de planilhas locais (.xlsx, .csv)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                    <span>Histórico de versões de relatórios salvos</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                    <span>Geração e exportação de relatórios HTML corporativos</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-800/60 flex items-center justify-between">
                <span className="text-xs font-black text-amber-400 uppercase tracking-wider group-hover:underline">
                  Avançar para Seleção de Obras
                </span>
                <div className="p-2 rounded-xl bg-slate-800 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Card 2: Modo Autônomo (Live) */}
            <div
              onClick={() => {
                setDashboardMode('autonomous');
                setStep('OBRAS');
              }}
              className="group relative bg-slate-900/90 hover:bg-slate-850 border border-emerald-500/30 hover:border-emerald-400 rounded-3xl p-7 md:p-8 flex flex-col justify-between transition-all duration-300 shadow-2xl hover:shadow-emerald-500/20 cursor-pointer transform hover:-translate-y-1 overflow-hidden"
              id="card-modo-autonomo"
            >
              {/* Glow background effect */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />

              <div className="space-y-5 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="p-3.5 bg-emerald-500/10 group-hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-2xl transition-colors shadow-inner">
                    <Database className="w-8 h-8" />
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Tempo Real Live
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight group-hover:text-emerald-300 transition-colors flex items-center gap-2">
                    Modo Autônomo (Live)
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    Acompanhe o painel alimentado em tempo real pelas movimentações do Almoxarifado e Suprimentos.
                  </p>
                </div>

                <ul className="space-y-2 text-[11px] text-slate-400 border-t border-slate-800/80 pt-4 font-medium">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
                    <span>Sincronização ao vivo com banco de dados Supabase</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
                    <span>Cruzamento automático de RMs, Pedidos BI e Expedição</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
                    <span>Atualização instantânea sem necessidade de planilhas</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-800/60 flex items-center justify-between relative z-10">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-wider group-hover:underline">
                  Avançar para Seleção de Obras
                </span>
                <div className="p-2 rounded-xl bg-emerald-950 border border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Bottom Footer info */}
        <div className="border-t border-slate-800/60 py-4 px-6 text-center text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between max-w-5xl mx-auto w-full gap-2">
          <span>CMPC Industrial • Sistema Integrado de Gestão de Almoxarifado</span>
          <span className="font-mono text-slate-400">Overhaul BI Engine v3.0</span>
        </div>

      </div>
    );
  }

  // Step 2: Tela de Seleção de Obras (Cards interativos para escolher quais obras monitorar)
  if (step === 'OBRAS') {
    const displayedObras = dashboardMode === 'autonomous'
      ? (obrasDisponiveis.length > 0 ? obrasDisponiveis : listObras)
      : listObras;
    const displayedStats = dashboardMode === 'autonomous'
      ? (Object.keys(statsObrasDisponiveis).length > 0 ? statsObrasDisponiveis : statsPorObra)
      : statsPorObra;
    const displayedLoading = dashboardMode === 'autonomous'
      ? (isLoadingObrasDisponiveis && obrasDisponiveis.length === 0)
      : isFetchingInitialData;

    return (
      <>
        <SelecaoObrasView
          obras={displayedObras}
          obrasSelecionadasIniciais={obrasSelecionadas}
          isLoading={displayedLoading}
          dashboardMode={dashboardMode === 'autonomous' ? 'autonomous' : 'manual'}
          statsPorObra={displayedStats}
          dadosBrutosNomes={dadosBrutosNomes}
          onConfirmar={(selecionadas) => {
            setObrasSelecionadas(selecionadas);
            setAbaAtiva(selecionadas[0] || '');
            setStep('DASHBOARD');
          }}
          onVoltar={() => setStep('FONTE')}
          onRefresh={dashboardMode === 'autonomous' ? fetchObrasDisponiveis : () => liveMetrics.refetch()}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-900 text-slate-100 w-full font-sans" id="mobilizacao-view-root">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-2xl border text-xs font-black flex items-center gap-3 transition-all ${
          toast.type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300' 
            : 'bg-rose-950/90 border-rose-500/60 text-rose-300'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-rose-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* SIDEBAR DE FILTROS E UPLOAD (ESQUERDA NO DESKTOP, EMPILHADO NO MOBILE) */}
      <aside className="w-full lg:w-80 shrink-0 bg-slate-950 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col lg:h-screen font-sans shadow-2xl z-30">
        
        {/* ÁREA SUPERIOR DA SIDEBAR COM ROLAGEM ISOLADA */}
        <div className="flex-1 lg:overflow-y-auto p-3.5 space-y-3.5">
          {/* Header Sidebar */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                <Layers className="w-4 h-4" />
              </span>
              <div>
                <h1 className="text-xs font-black uppercase text-white tracking-tight">Mobilizações</h1>
                <p className="text-[9px] text-slate-400 font-bold">Painel de Abastecimento</p>
              </div>
            </div>

            <button
              onClick={handleTrocarModo}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-extrabold text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors border border-amber-500/30 cursor-pointer shadow-sm"
              id="mob-view-trocar-modo-btn"
              title="Voltar para seleção de modo"
            >
              <RotateCcw className="w-3 h-3 text-amber-400" />
              <span>Trocar Modo</span>
            </button>
          </div>

          {/* COMPACT UPLOAD CARD (Manual) OU MODO AUTÔNOMO INDICATOR (Live) */}
          {dashboardMode === 'manual' ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Carregar Planilha
                </span>
                {fileName && (
                  <span className="text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    {data.length} pds
                  </span>
                )}
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border border-dashed rounded-xl p-2.5 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-amber-400 bg-amber-500/10'
                    : 'border-slate-700 hover:border-amber-500/50 bg-slate-950/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <Upload className="w-4 h-4 text-amber-400 mx-auto mb-0.5 animate-pulse" />
                <span className="text-[10px] font-bold text-slate-200 block truncate">
                  {fileName ? fileName : 'Clique ou arraste .CSV / .XLS'}
                </span>
                <span className="text-[9px] text-slate-500 block mt-0.5">Base Overhaul(Tbl_pedidos)</span>
              </div>

              <button
                type="button"
                onClick={handleOpenHistory}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-[10px] font-black rounded-lg transition-colors border border-slate-700/80 flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                id="btn-ver-historico-relatorios"
              >
                <History className="w-3.5 h-3.5" />
                <span>Ver Histórico de Relatórios</span>
              </button>

              {isLoading && (
                <div className="flex items-center justify-center gap-2 text-amber-400 text-[10px] font-bold animate-pulse pt-0.5">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Processando...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3 shadow-lg space-y-2 relative overflow-hidden" id="sidebar-modo-autonomo-box">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  Modo Autônomo
                </span>
                <span className="flex items-center gap-1.5 text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  LIVE
                </span>
              </div>

              <div className="bg-slate-950/70 border border-emerald-500/20 rounded-lg p-2.5">
                <p className="text-[10px] text-slate-200 font-semibold leading-relaxed">
                  Base conectada ao vivo. Sincronização automática.
                </p>
                <p className="text-[9px] text-emerald-400/90 font-mono mt-1">
                  • Requisições, Pedidos BI e Expedição
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[9px] text-slate-400 font-medium font-mono">
                  {liveMetrics.summary.classesCount} classes • {liveMetrics.summary.obrasCount} obras
                </span>
                <button
                  type="button"
                  onClick={() => liveMetrics.refetch()}
                  disabled={liveMetrics.isLoading}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 rounded-md border border-emerald-500/20 transition-all"
                  id="btn-recarregar-autonomo"
                >
                  <RefreshCw className={`w-3 h-3 text-emerald-400 ${liveMetrics.isLoading ? 'animate-spin' : ''}`} />
                  <span>{liveMetrics.isLoading ? 'Atualizando...' : 'Atualizar'}</span>
                </button>
              </div>
            </div>
          )}

          {/* SEÇÃO DE FILTROS NA SIDEBAR */}
          <div className="space-y-2.5 pt-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-slate-200 tracking-wider flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-amber-400" />
                Filtros de Análise
              </span>
              {(selectedClasse !== 'TODAS' || selectedStatus !== 'TODOS' || searchTerm) && (
                <button
                  onClick={() => {
                    setSelectedClasse('TODAS');
                    setSelectedStatus('TODOS');
                    setSearchTerm('');
                  }}
                  className="text-[10px] font-bold text-amber-400 hover:underline cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* 1. Obra Selecionada (Aba Ativa) */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 space-y-1.5 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-3 h-3 text-amber-400" />
                  Obra em Foco (Aba)
                </label>
                <button
                  type="button"
                  onClick={() => setStep('OBRAS')}
                  className="text-[10px] font-bold text-amber-400 hover:text-amber-300 hover:underline cursor-pointer flex items-center gap-1"
                  title="Alterar obras monitoradas"
                >
                  <Layers className="w-2.5 h-2.5" />
                  <span>Trocar ({obrasSelecionadas.length})</span>
                </button>
              </div>
              <div className="bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs font-black text-amber-400 truncate flex items-center justify-between">
                <span className="truncate">{abaAtiva || (obrasSelecionadas.length > 0 ? obrasSelecionadas[0] : 'Todas as Obras')}</span>
                <span className="text-[9px] font-mono text-slate-500 shrink-0 ml-1">
                  {dataFiltradaObra.length} itens
                </span>
              </div>
            </div>

            {/* 2. Classe / Apelido */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-amber-400" />
                Classe (Apelido)
              </label>
              <select
                value={selectedClasse}
                onChange={(e) => setSelectedClasse(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-amber-400 transition-colors cursor-pointer"
                id="sidebar-select-classe"
              >
                <option value="TODAS" className="bg-slate-950 text-white font-bold">
                  Todas as Classes
                </option>
                {uniqueClasses.map((cls) => (
                  <option key={cls} value={cls} className="bg-slate-950 text-white font-bold">
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Status por Item */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-amber-400" />
                Status por Item
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-amber-400 transition-colors cursor-pointer"
                id="sidebar-select-status"
              >
                <option value="TODOS" className="bg-slate-950 text-white font-bold">Todos os Status</option>
                <option value="Mobilizado" className="bg-slate-950 text-blue-400 font-bold">Mobilizado</option>
                <option value="Disponível" className="bg-slate-950 text-emerald-400 font-bold">Disponível (Separado)</option>
                <option value="Em Compras" className="bg-slate-950 text-slate-300 font-bold">Em Compras</option>
                <option value="Em Triagem" className="bg-slate-950 text-rose-400 font-bold">Em Triagem</option>
              </select>
            </div>

            {/* SEÇÃO ÁLBUM DE REGISTROS (FOTOS DE MOBILIZAÇÃO) NA SIDEBAR */}
            <div className="space-y-2 pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-slate-200 tracking-wider flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-amber-400" />
                  Álbum de Registros
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadModalOpen(true);
                  }}
                  className="text-[10px] font-bold text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20"
                  title="Adicionar Foto"
                >
                  <Plus className="w-3 h-3" />
                  <span>Foto</span>
                </button>
              </div>

              {isLoadingFotos ? (
                <div className="py-4 text-center text-slate-400 text-[10px] font-medium flex items-center justify-center gap-1.5 animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                  <span>Buscando fotos...</span>
                </div>
              ) : albumFotos.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-center text-[10px] text-slate-500 italic space-y-1">
                  <p>Nenhum registro fotográfico para esta obra.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUploadModalOpen(true);
                    }}
                    className="text-amber-400 font-bold hover:underline not-italic cursor-pointer block mx-auto text-[10px]"
                  >
                    + Enviar primeira foto
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {albumFotos.map((foto, idx) => (
                      <div
                        key={foto.name + idx}
                        onClick={() => setFotoExpandidaIndex(idx)}
                        className="group relative h-20 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden cursor-pointer hover:border-amber-400 transition-all shadow"
                      >
                        <img
                          src={foto.url}
                          alt={foto.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Maximize2 className="w-4 h-4 text-white drop-shadow-md" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[9px] text-slate-400 flex items-center justify-between px-0.5">
                    <span>{albumFotos.length} foto(s)</span>
                    <span className="text-amber-400 font-medium">Clique para ampliar</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RODAPÉ DA SIDEBAR COM LOGO DINÂMICA FIXA */}
        {logoUrl && (
          <div className="shrink-0 p-3.5 border-t border-slate-800/80 text-center">
            <img 
              src={logoUrl} 
              alt="CMPC Almox" 
              className="w-32 opacity-40 mx-auto hover:opacity-100 transition-opacity object-contain" 
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}

      </aside>

      {/* ÁREA PRINCIPAL DO DASHBOARD (DIREITA NO DESKTOP, ABAIXO NO MOBILE) */}
      <main className="flex-1 min-h-screen lg:min-h-0 lg:h-screen flex flex-col min-w-0 bg-slate-900 overflow-y-auto">
        {/* Header Bar Superior com Ações de Relatório */}
        <header className="bg-slate-950 border-b border-slate-800 py-2.5 px-4 md:px-6 sticky top-0 z-20 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-black uppercase text-white tracking-tight font-sans">
                Abastecimento de Mobilizações
              </h2>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full font-mono flex items-center gap-1.5 ${
                dashboardMode === 'autonomous' 
                  ? 'text-emerald-300 bg-emerald-950/60 border border-emerald-500/40' 
                  : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
              }`}>
                {dashboardMode === 'autonomous' && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
                {dashboardMode === 'autonomous' ? 'Modo Autônomo (Live)' : 'Modo Manual'}
              </span>

              <span className="text-[11px] font-bold text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full font-mono">
                {abaAtiva || (obrasSelecionadas.length > 0 ? obrasSelecionadas[0] : (obraSelecionada === 'Todas' ? 'Todas as Obras' : obraSelecionada))}
              </span>

              {versaoSelecionada && (
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                  <History className="w-3 h-3" />
                  Versão: {versaoSelecionada}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">
              {dashboardMode === 'autonomous' 
                ? `Dashboard Executivo Live • Supabase BI Engine • ${dataFiltradaCascata.length === 1 ? '1 item' : `${dataFiltradaCascata.length} itens`} no recorte`
                : `Dashboard Executivo • Overhaul(Tbl_pedidos) • ${dataFiltradaCascata.length === 1 ? '1 item' : `${dataFiltradaCascata.length} itens`} no recorte`}
            </p>
          </div>

          {activeData.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              
              {/* Botão Gerar Relatório (HTML) */}
              <button
                onClick={handleExportarHTML}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg transition-all shadow-md cursor-pointer active:scale-95"
                id="btn-exportar-relatorio-html"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Gerar Relatório (HTML)</span>
              </button>

              {/* Botões do Modo Manual */}
              {dashboardMode === 'manual' && (
                <>
                  <button
                    onClick={handleSalvarNoBanco}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-black text-xs rounded-lg transition-all shadow-md cursor-pointer active:scale-95"
                    id="btn-salvar-no-banco"
                  >
                    {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
                    <span>{isSaving ? 'Salvando...' : 'Salvar Report na Base'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setData([]);
                      setFileName(null);
                      setObraSelecionada('Todas');
                      setAbaAtiva('');
                      setSelectedClasse('TODAS');
                      setSelectedStatus('TODOS');
                    }}
                    className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer font-bold"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span className="hidden sm:inline">Trocar Planilha</span>
                  </button>
                </>
              )}

              {/* Botão de Sincronização no Modo Autônomo */}
              {dashboardMode === 'autonomous' && (
                <button
                  onClick={() => liveMetrics.refetch()}
                  disabled={liveMetrics.isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/50 font-black text-xs rounded-lg transition-all shadow-md cursor-pointer active:scale-95"
                  id="btn-sync-live-top"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${liveMetrics.isLoading ? 'animate-spin' : ''}`} />
                  <span>{liveMetrics.isLoading ? 'Sincronizando...' : 'Sincronizar Live'}</span>
                </button>
              )}

            </div>
          )}
        </header>

        {/* 4. UI da Barra de Navegação de Obras (Tabs estilo navegador com scroll horizontal) */}
        {obrasSelecionadas.length > 0 && (
          <div className="bg-slate-950 px-3 sm:px-4 md:px-6 pt-2 border-b border-slate-800 flex items-center justify-between gap-3 sticky top-0 md:top-[49px] z-10 shadow-sm" id="nav-tabs-obras-bar">
            <div className="flex space-x-1 bg-slate-900 p-1 rounded-t-lg border-b border-slate-700 overflow-x-auto whitespace-nowrap scrollbar-hide flex-1 custom-scrollbar">
              {obrasSelecionadas.map(obra => {
                const isSelected = (abaAtiva === obra) || (!abaAtiva && obrasSelecionadas[0] === obra);
                return (
                  <button
                    key={obra}
                    onClick={() => setAbaAtiva(obra)}
                    className={`px-4 py-2 text-xs font-bold rounded-t-md whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                      isSelected
                        ? 'bg-slate-800 text-amber-400 border-t-2 border-amber-500 shadow-sm' 
                        : 'bg-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`}
                    id={`tab-obra-${obra.replace(/[^a-zA-Z0-9]/g, '_')}`}
                  >
                    {obra}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setStep('OBRAS')}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-amber-400 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Voltar para seleção de obras"
              id="btn-alterar-obras-top"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Alterar Obras ({obrasSelecionadas.length})</span>
            </button>
          </div>
        )}

        {/* Dashboard Content Container */}
        <div className="p-3 md:p-5 space-y-4 flex-grow">

          {dashboardMode === 'autonomous' ? (
            liveMetrics.isLoading && liveMetrics.data.length === 0 ? (
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 text-center max-w-xl mx-auto space-y-3 my-8 shadow-2xl">
                <RefreshCw className="w-10 h-10 text-emerald-400 mx-auto animate-spin" />
                <h3 className="text-base font-black text-white uppercase tracking-tight">Sincronizando com Supabase...</h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  Carregando requisições, pedidos de compra, recebimentos e expedições em tempo real...
                </p>
              </div>
            ) : liveMetrics.data.length === 0 ? (
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 text-center max-w-xl mx-auto space-y-3 my-8 shadow-2xl">
                <Database className="w-12 h-12 text-emerald-400 mx-auto" />
                <h3 className="text-base font-black text-white uppercase tracking-tight">Nenhum registro encontrado</h3>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  Não foram encontradas movimentações de requisições ou pedidos nas tabelas do Supabase.
                </p>
              </div>
            ) : null
          ) : isFetchingInitialData ? (
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 text-center max-w-xl mx-auto space-y-3 my-8 shadow-2xl">
              <RefreshCw className="w-10 h-10 text-amber-400 mx-auto animate-spin" />
              <h3 className="text-base font-black text-white uppercase tracking-tight">Carregando última base...</h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Buscando o relatório mais recente salvo no banco de dados para iniciar o painel automaticamente...
              </p>
            </div>
          ) : data.length === 0 ? (
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 text-center max-w-xl mx-auto space-y-3 my-8 shadow-2xl">
              <FileSpreadsheet className="w-12 h-12 text-amber-400 mx-auto" />
              <h3 className="text-base font-black text-white uppercase tracking-tight">Nenhuma base de dados ativa</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                Nenhuma base de dados ativa. Faça o upload da planilha <strong className="text-amber-400 font-bold">Overhaul(Tbl_pedidos).csv</strong> na barra lateral para carregar o painel.
              </p>
            </div>
          ) : null}

          {activeData.length > 0 && (
            <div className="space-y-4 animate-fade-in">

              {/* 1. KPI TERMÔMETROS CARDS */}
              <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 mb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-amber-400 rounded-full inline-block animate-pulse" />
                    Painel Executivo • Termômetros de Status
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Solicitado no Recorte: <strong className="text-amber-400 font-bold">{metrics.totalSolicitado.toLocaleString('pt-BR')} un.</strong> ({dataFiltradaCascata.length === 1 ? '1 item' : `${dataFiltradaCascata.length} itens`})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  
                  {/* 1. AZUL: ITENS MOBILIZADOS */}
                  <div className="bg-slate-950 border border-blue-500/30 rounded-xl p-3.5 relative overflow-hidden shadow-lg group hover:border-blue-500/60 transition-all">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/20 transition-all" />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                        MOBILIZADO
                      </span>
                      <span className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-white tracking-tight font-sans">
                        {metrics.mobilizadoPct}%
                      </span>
                      <span className="text-[11px] font-bold text-blue-300 bg-blue-950/80 px-2 py-0.5 rounded-md border border-blue-800/50 font-mono">
                        {metrics.totalMobilizado.toLocaleString('pt-BR')} un.
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="mt-2 w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                      <div 
                        className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, parseFloat(metrics.mobilizadoPct))}%` }} 
                      />
                    </div>
                  </div>

                  {/* 2. VERDE: ITENS SEPARADOS (DISPONÍVEIS) */}
                  <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-3.5 relative overflow-hidden shadow-lg group hover:border-emerald-500/60 transition-all">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all" />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                        SEPARADO (DISPONÍVEL)
                      </span>
                      <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                        <Package className="w-4 h-4" />
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-white tracking-tight font-sans">
                        {metrics.disponivelPct}%
                      </span>
                      <span className="text-[11px] font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800/50 font-mono">
                        {metrics.totalSeparado.toLocaleString('pt-BR')} un.
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="mt-2 w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, parseFloat(metrics.disponivelPct))}%` }} 
                      />
                    </div>
                  </div>

                  {/* 3. CINZA: ITENS EM COMPRAS */}
                  <div className="bg-slate-950 border border-slate-600/40 rounded-xl p-3.5 relative overflow-hidden shadow-lg group hover:border-slate-500 transition-all">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-slate-500/10 rounded-full blur-xl group-hover:bg-slate-500/20 transition-all" />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                        EM COMPRAS
                      </span>
                      <span className="p-1.5 bg-slate-800 text-slate-300 rounded-lg">
                        <ShoppingCart className="w-4 h-4" />
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-white tracking-tight font-sans">
                        {metrics.emComprasPct}%
                      </span>
                      <span className="text-[11px] font-bold text-slate-300 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-700 font-mono">
                        {metrics.totalCompra.toLocaleString('pt-BR')} un.
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="mt-2 w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                      <div 
                        className="bg-slate-400 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, parseFloat(metrics.emComprasPct))}%` }} 
                      />
                    </div>
                  </div>

                  {/* 4. VERMELHO: ITENS EM TRIAGEM */}
                  <div className="bg-slate-950 border border-rose-500/30 rounded-xl p-3.5 relative overflow-hidden shadow-lg group hover:border-rose-500/60 transition-all">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/10 rounded-full blur-xl group-hover:bg-rose-500/20 transition-all" />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">
                        EM TRIAGEM
                      </span>
                      <span className="p-1.5 bg-rose-500/20 text-rose-400 rounded-lg">
                        <AlertCircle className="w-4 h-4" />
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-white tracking-tight font-sans">
                        {metrics.emAnalisePct}%
                      </span>
                      <span className="text-[11px] font-bold text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded-md border border-rose-800/50 font-mono">
                        {metrics.totalAnalise.toLocaleString('pt-BR')} un.
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="mt-2 w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                      <div 
                        className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, parseFloat(metrics.emAnalisePct))}%` }} 
                      />
                    </div>
                  </div>

                </div>
              </div>

              {/* 2. GRÁFICOS DE BARRAS HORIZONTAIS POR CLASSE (2x2 GRID) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-amber-400 rounded-full inline-block" />
                    DISTRIBUIÇÃO DE ITENS POR CLASSE (APELIDO)
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Valores em % e Unidades
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                  
                  {/* GRÁFICO 1: MOBILIZADOS (Azul) */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 shadow-xl">
                    <div className="flex items-center justify-between mb-2 border-b border-slate-800/80 pb-1.5">
                      <span className="text-[11px] font-extrabold uppercase text-blue-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Mobilizados por Classe (% do Status)
                      </span>
                      <span className="text-xs text-slate-400 font-light opacity-80 font-mono">{metrics.mobilizadoPct}% do Total</span>
                    </div>
                    {chartDataByStatus.mobilizado.length === 0 ? (
                      <div className="h-36 flex items-center justify-center text-xs text-slate-500">
                        Nenhuma quantidade registrada em MOBILIZADO
                      </div>
                    ) : (
                      <div className="h-44 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={chartDataByStatus.mobilizado} margin={{ top: 2, right: 100, left: 0, bottom: 2 }}>
                            <XAxis type="number" domain={[0, 100]} hide />
                            <YAxis 
                              dataKey="apelido" 
                              type="category" 
                              width={110} 
                              tick={{ fill: '#e2e8f0', fontSize: 10, fontWeight: 700 }} 
                              axisLine={{ stroke: '#334155' }} 
                              tickLine={false} 
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#3b82f6', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                              formatter={(val, name, entry: any) => [entry.payload.labelMobilizado, 'Mobilizado (% do Total)']}
                            />
                            <Bar dataKey="pctMobilizado" fill="#3b82f6" radius={[0, 5, 5, 0]} barSize={13}>
                              <LabelList dataKey="labelMobilizado" position="right" fill="#93c5fd" fontSize={9} fontWeight={800} />
                              {chartDataByStatus.mobilizado.map((entry, idx) => (
                                <Cell key={`cell-mob-${idx}`} fill="#3b82f6" />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* GRÁFICO 2: DISPONÍVEIS (SEPARADO - Verde) */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 shadow-xl">
                    <div className="flex items-center justify-between mb-2 border-b border-slate-800/80 pb-1.5">
                      <span className="text-[11px] font-extrabold uppercase text-emerald-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Disponíveis por Classe (% do Status)
                      </span>
                      <span className="text-xs text-slate-400 font-light opacity-80 font-mono">{metrics.disponivelPct}% do Total</span>
                    </div>
                    {chartDataByStatus.disponivel.length === 0 ? (
                      <div className="h-36 flex items-center justify-center text-xs text-slate-500">
                        Nenhuma quantidade registrada em SEPARADO
                      </div>
                    ) : (
                      <div className="h-44 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={chartDataByStatus.disponivel} margin={{ top: 2, right: 100, left: 0, bottom: 2 }}>
                            <XAxis type="number" domain={[0, 100]} hide />
                            <YAxis 
                              dataKey="apelido" 
                              type="category" 
                              width={110} 
                              tick={{ fill: '#e2e8f0', fontSize: 10, fontWeight: 700 }} 
                              axisLine={{ stroke: '#334155' }} 
                              tickLine={false} 
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#10b981', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                              formatter={(val, name, entry: any) => [entry.payload.labelSeparado, 'Separado / Disponível (% do Total)']}
                            />
                            <Bar dataKey="pctSeparado" fill="#10b981" radius={[0, 5, 5, 0]} barSize={13}>
                              <LabelList dataKey="labelSeparado" position="right" fill="#6ee7b7" fontSize={9} fontWeight={800} />
                              {chartDataByStatus.disponivel.map((entry, idx) => (
                                <Cell key={`cell-disp-${idx}`} fill="#10b981" />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* GRÁFICO 3: EM COMPRAS (COMPRA - Cinza) */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 shadow-xl">
                    <div className="flex items-center justify-between mb-2 border-b border-slate-800/80 pb-1.5">
                      <span className="text-[11px] font-extrabold uppercase text-slate-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        Em Compras por Classe (% do Status)
                      </span>
                      <span className="text-xs text-slate-400 font-light opacity-80 font-mono">{metrics.emComprasPct}% do Total</span>
                    </div>
                    {chartDataByStatus.emCompras.length === 0 ? (
                      <div className="h-36 flex items-center justify-center text-xs text-slate-500">
                        Nenhuma quantidade registrada em COMPRA
                      </div>
                    ) : (
                      <div className="h-44 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={chartDataByStatus.emCompras} margin={{ top: 2, right: 100, left: 0, bottom: 2 }}>
                            <XAxis type="number" domain={[0, 100]} hide />
                            <YAxis 
                              dataKey="apelido" 
                              type="category" 
                              width={110} 
                              tick={{ fill: '#e2e8f0', fontSize: 10, fontWeight: 700 }} 
                              axisLine={{ stroke: '#334155' }} 
                              tickLine={false} 
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#94a3b8', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                              formatter={(val, name, entry: any) => [entry.payload.labelCompra, 'Em Compras (% do Total)']}
                            />
                            <Bar dataKey="pctCompra" fill="#94a3b8" radius={[0, 5, 5, 0]} barSize={13}>
                              <LabelList dataKey="labelCompra" position="right" fill="#cbd5e1" fontSize={9} fontWeight={800} />
                              {chartDataByStatus.emCompras.map((entry, idx) => (
                                <Cell key={`cell-comp-${idx}`} fill="#94a3b8" />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* GRÁFICO 4: EM TRIAGEM (Vermelho) */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 shadow-xl">
                    <div className="flex items-center justify-between mb-2 border-b border-slate-800/80 pb-1.5">
                      <span className="text-[11px] font-extrabold uppercase text-rose-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        Em Triagem por Classe (% do Status)
                      </span>
                      <span className="text-xs text-slate-400 font-light opacity-80 font-mono">{metrics.emAnalisePct}% do Total</span>
                    </div>
                    {chartDataByStatus.emAnalise.length === 0 ? (
                      <div className="h-36 flex items-center justify-center text-xs text-slate-500">
                        Nenhuma quantidade registrada em EM TRIAGEM
                      </div>
                    ) : (
                      <div className="h-44 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={chartDataByStatus.emAnalise} margin={{ top: 2, right: 100, left: 0, bottom: 2 }}>
                            <XAxis type="number" domain={[0, 100]} hide />
                            <YAxis 
                              dataKey="apelido" 
                              type="category" 
                              width={110} 
                              tick={{ fill: '#e2e8f0', fontSize: 10, fontWeight: 700 }} 
                              axisLine={{ stroke: '#334155' }} 
                              tickLine={false} 
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#f43f5e', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                              formatter={(val, name, entry: any) => [entry.payload.labelAnalise, 'Em Triagem (% do Total)']}
                            />
                            <Bar dataKey="pctAnalise" fill="#f43f5e" radius={[0, 5, 5, 0]} barSize={13}>
                              <LabelList dataKey="labelAnalise" position="right" fill="#fda4af" fontSize={9} fontWeight={800} />
                              {chartDataByStatus.emAnalise.map((entry, idx) => (
                                <Cell key={`cell-ana-${idx}`} fill="#f43f5e" />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* 3. TABELA ANALÍTICA BASE */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-3">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-amber-400 rounded-full inline-block" />
                      TABELA ANALÍTICA DE PEDIDOS E MATERIAIS
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {filteredData.length === 1 ? '1 item exibido' : `${filteredData.length} itens exibidos`} de {dataFiltradaCascata.length === 1 ? '1 item' : `${dataFiltradaCascata.length} itens`} no filtro selecionado
                    </p>
                  </div>

                  {/* Campo de Busca por Descrição / Código */}
                  <div className="relative w-full md:w-80">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por código, descrição, obra..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-bold"
                    />
                  </div>
                </div>

                {/* Tabela de Dados com Wrapper de Rolagem Segura */}
                <div className="w-full overflow-x-auto rounded-lg border border-slate-800 custom-scrollbar">
                  <table className="w-full min-w-[800px] text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/60 text-[10px] font-black uppercase text-slate-400">
                        <th className="py-3 px-3">Classe (Apelido)</th>
                        <th className="py-3 px-3">Obra (Arquivo)</th>
                        <th className="py-3 px-3">Descrição & Código</th>
                        <th className="py-3 px-3 text-right">Solicitada</th>
                        <th className="py-3 px-3 text-right text-blue-400">Mobilizado</th>
                        <th className="py-3 px-3 text-right text-emerald-400">Disponível</th>
                        <th className="py-3 px-3 text-right text-slate-300">Compra</th>
                        <th className="py-3 px-3 text-right text-rose-400">Triagem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredData.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500 italic text-xs">
                            Nenhum pedido encontrado para o filtro selecionado.
                          </td>
                        </tr>
                      ) : (
                        filteredData.slice(0, 100).map((item) => {
                          const descItem = item['Descrição do item'] || item.descricao || 'Item sem Descrição';
                          const codItem = item['Código do item'] || item.codigo || '';
                          const nomeObraItem = item.nome_arquivo || fileName || item.centroCusto || 'Geral';
                          const isSemClasse = !item.apelido || item.apelido === 'Sem Classe Vinculada' || item.apelido === 'OUTROS';
                          const isAutonomous = dashboardMode === 'autonomous';

                          return (
                            <tr key={item.id} className="hover:bg-slate-900/80 transition-colors">
                              <td className="py-3 px-3 font-extrabold text-amber-400">
                                {isAutonomous && isSemClasse ? (
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      disabled={savingClassId === item.id}
                                      value=""
                                      onChange={async (e) => {
                                        const novaClasse = e.target.value;
                                        if (novaClasse) {
                                          await handleVincularClasse(item, novaClasse);
                                        }
                                      }}
                                      className="bg-slate-800 border border-amber-500/50 text-amber-400 text-[10px] p-1 rounded focus:outline-none w-full max-w-[150px] cursor-pointer"
                                    >
                                      <option value="" disabled className="bg-slate-900 text-slate-400">
                                        ⚡ Vincular Classe...
                                      </option>
                                      {liveMetrics.todasAsClassesUnicas.map((cls) => (
                                        <option key={cls} value={cls} className="bg-slate-900 text-white">
                                          {cls}
                                        </option>
                                      ))}
                                    </select>
                                    {savingClassId === item.id && (
                                      <span className="text-[10px] text-amber-400 animate-pulse font-mono">Salvando...</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className={`px-2 py-0.5 rounded-lg text-[11px] ${
                                    isSemClasse 
                                      ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' 
                                      : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                                  }`}>
                                    {item.apelido || 'Sem Classe Vinculada'}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 font-mono font-bold text-slate-300 max-w-xs truncate" title={nomeObraItem}>
                                <div className="flex items-center gap-1.5 truncate">
                                  <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span className="truncate">{nomeObraItem}</span>
                                </div>
                              </td>
                              <td className="py-3 px-3 font-bold text-white max-w-sm">
                                {codItem && (
                                  <div className="font-mono text-[10px] text-slate-400 mb-0.5">
                                    Cod: {codItem}
                                  </div>
                                )}
                                <div>{descItem}</div>
                                {item.debugSources && item.debugSources.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {Array.from(new Set(item.debugSources)).map((source, idx) => (
                                      <span 
                                        key={idx} 
                                        className="text-[9px] px-1.5 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 font-mono font-medium tracking-tight"
                                      >
                                        {source}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-extrabold text-white">
                                <button
                                  type="button"
                                  onClick={() => setItemParaAjusteStatus(item)}
                                  className="group/solicitada inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-800/90 transition-all cursor-pointer border border-transparent hover:border-amber-500/40 text-right justify-end ml-auto"
                                  title="Clique para ajustar manualmente o status deste item (Override)"
                                >
                                  <span className="group-hover/solicitada:text-amber-300 transition-colors">
                                    {item.qtdSolicitada.toLocaleString('pt-BR')}
                                  </span>
                                  {item.status_override_manual ? (
                                    <span 
                                      className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 font-mono uppercase tracking-tight font-bold" 
                                      title={`Override Ativo: ${item.status_override_manual}`}
                                    >
                                      {item.status_override_manual}
                                    </span>
                                  ) : (
                                    <span className="opacity-0 group-hover/solicitada:opacity-100 text-[10px] text-amber-400/80 transition-opacity">
                                      ✏️
                                    </span>
                                  )}
                                </button>
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-extrabold text-blue-400">
                                {(item.qtdMobilizado ?? 0) > 0 ? (item.qtdMobilizado ?? 0).toLocaleString('pt-BR') : '-'}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-400">
                                {(item.qtdDisponivel ?? item.qtdSeparado ?? 0) > 0 ? (item.qtdDisponivel ?? item.qtdSeparado ?? 0).toLocaleString('pt-BR') : '-'}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-300">
                                <div className="flex flex-col items-center md:items-end justify-center min-h-[40px]">
                                  <span className={`font-bold ${(item.qtdCompra ?? item.emCompras ?? 0) > 0 ? 'text-amber-500' : 'text-slate-600'}`}>
                                    {(item.qtdCompra ?? item.emCompras ?? 0) > 0 ? (item.qtdCompra ?? item.emCompras ?? 0).toLocaleString('pt-BR') : '-'}
                                  </span>

                                  {/* Exibição do Número do PC na Coluna de Compras */}
                                  {(item.numero_pc || item.pedido_compra || item.pc) && (item.qtdCompra ?? item.emCompras ?? 0) > 0 && (
                                    <span 
                                      className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700/60 mt-1 max-w-[150px] truncate"
                                      title={`Pedido de Compra: ${item.numero_pc || item.pedido_compra || item.pc}`}
                                    >
                                      PC: {item.numero_pc || item.pedido_compra || item.pc}
                                    </span>
                                  )}
                                  
                                  {(item.qtdCompra ?? item.emCompras ?? 0) > 0 && (
                                    <div className="mt-1 flex flex-col items-center md:items-end gap-0.5">
                                      {item.previsaoEntrega && item.statusPrazo !== 'SEM PREVISÃO' ? (
                                        <>
                                          <span className="text-[10px] text-slate-300 font-mono tracking-tight">
                                            {new Date(item.previsaoEntrega + (item.previsaoEntrega.includes('T') ? '' : 'T12:00:00Z')).toLocaleDateString('pt-BR')}
                                          </span>
                                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider whitespace-nowrap ${
                                            item.statusPrazo === 'ATRASADO' 
                                              ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                          }`}>
                                            {item.statusPrazo}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-600/50 uppercase whitespace-nowrap">
                                          Sem Previsão
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Botão de Sinalizar Início / Mobilização Manual para Itens Intangíveis */}
                                  {isAutonomous && (item.qtdCompra ?? item.emCompras ?? 0) > 0 && /(LOCAÇÃO|LOCACAO|SERVIÇO|SERVICO|FACILITIES|CONSULTORIA)/.test(`${item.classeFinanceira || item.apelido || ''} ${item.descricao || ''}`.toUpperCase()) && (
                                    <button 
                                      type="button"
                                      disabled={sinalizandoServicoId === item.id}
                                      onClick={() => handleSinalizarServico(item)}
                                      className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] px-2 py-1 rounded-md font-bold uppercase transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap active:scale-95"
                                      title="Sinalizar início da operação deste serviço na obra"
                                    >
                                      {sinalizandoServicoId === item.id ? (
                                        <span className="animate-pulse">Sinalizando...</span>
                                      ) : (
                                        <>
                                          <span>✅</span>
                                          <span>Sinalizar Início</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-extrabold text-rose-400">
                                {(item.qtdTriagem ?? item.qtdAnalise ?? 0) > 0 ? (item.qtdTriagem ?? item.qtdAnalise ?? 0).toLocaleString('pt-BR') : '-'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {filteredData.length > 100 && (
                  <div className="text-center pt-2 text-[11px] text-slate-500 font-mono">
                    Exibindo as primeiras 100 linhas de {filteredData.length} resultados. Use a busca para filtrar itens específicos.
                  </div>
                )}

              </div>

            </div>
          )}

        </div>
      </main>

      {/* MODAL HISTÓRICO DE RELATÓRIOS SALVOS */}
      {(isHistoricoModalOpen || isHistoryOpen) && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <History className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-black uppercase text-white tracking-tight">Histórico de Relatórios Salvos</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Relatórios salvos e armazenados no banco de dados (Supabase)</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsHistoricoModalOpen(false);
                  setIsHistoryOpen(false);
                }}
                className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {isLoadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-amber-400 text-xs font-bold animate-pulse">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  <span>Buscando relatórios no banco de dados...</span>
                </div>
              ) : (historicoReports.length === 0 && savedReports.length === 0) ? (
                <div className="py-12 text-center text-slate-500 text-xs italic font-medium">
                  Nenhum relatório salvo encontrado na base de dados.
                </div>
              ) : (
                <div className="w-full overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950 custom-scrollbar">
                  <table className="w-full min-w-[650px] text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/60 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        <th className="p-3">Data e Hora</th>
                        <th className="p-3">Arquivo Origem</th>
                        <th className="p-3">Recorte / Obra</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs">
                      {(historicoReports.length > 0 ? historicoReports : savedReports).map((rep, idx) => (
                        <tr key={rep.id || idx} className="hover:bg-slate-900/50 transition-colors">
                          <td className="p-3 text-slate-300 font-mono text-[11px] font-medium whitespace-nowrap">
                            {formatarDataBR(rep.created_at)}
                          </td>
                          <td className="p-3 text-slate-300 font-medium max-w-xs truncate" title={rep.nome_arquivo || 'planilha_mobilizacao.xlsx'}>
                            <div className="flex items-center gap-1.5 truncate">
                              <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="truncate">{rep.nome_arquivo || 'planilha_mobilizacao.xlsx'}</span>
                            </div>
                          </td>
                          <td className="p-3 font-bold text-white whitespace-nowrap">
                            {rep.obra_selecionada || 'TODAS AS OBRAS'}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleAbrirRelatorio(rep)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-xl transition-all shadow-sm cursor-pointer active:scale-95"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Abrir Relatório</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 text-right">
              <button
                onClick={() => {
                  setIsHistoricoModalOpen(false);
                  setIsHistoryOpen(false);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SELETOR DE VERSÕES DO ARQUIVO / OBRA */}
      {isVersionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full flex flex-col shadow-2xl overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <History className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-black uppercase text-white tracking-tight">
                    Qual versão do arquivo exibir?
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Obra / Arquivo: <strong className="text-amber-400 font-bold">{targetObraForVersion}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsVersionModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto max-h-[60vh] space-y-3">
              {isLoadingVersions ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-amber-400 text-xs font-bold animate-pulse">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  <span>Buscando versões salvas no banco de dados...</span>
                </div>
              ) : availableVersions.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl max-w-md mx-auto">
                    <AlertCircle className="w-6 h-6 text-amber-400 mx-auto mb-1.5" />
                    <p className="text-xs text-slate-200 font-bold">
                      Nenhuma versão salva no banco de dados para esta obra/arquivo.
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Você pode aplicar a filtragem diretamente nos dados carregados na tela.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Versões disponíveis (da mais recente para a mais antiga):
                  </span>
                  <div className="space-y-2">
                    {availableVersions.map((v, idx) => {
                      const isSelected = selectedVersionId === v.id;
                      const isNewest = idx === 0;
                      return (
                        <div
                          key={v.id || idx}
                          onClick={() => setSelectedVersionId(v.id)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500 text-white shadow-lg'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="versionSelect"
                              checked={isSelected}
                              onChange={() => setSelectedVersionId(v.id)}
                              className="accent-amber-400 w-4 h-4 cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-extrabold text-white">
                                  {formatarDataBR(v.created_at)}
                                </span>
                                {isNewest && (
                                  <span className="text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-md">
                                    Mais recente
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                                <FileText className="w-3 h-3 text-amber-400" />
                                {v.nome_arquivo || v.obra_selecionada || 'relatorio_mobilizacao.json'}
                              </span>
                            </div>
                          </div>

                          <span className={`text-xs font-bold px-2.5 py-1 rounded-xl font-mono ${
                            isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {v.dados_json ? `${Array.isArray(v.dados_json) ? v.dados_json.length : 'OK'} itens` : 'Versão salva'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsVersionModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmVersion}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition-all shadow-md cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Exibir Versão Selecionada</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VISUALIZADOR EM TELA CHEIA (LIGHTBOX) */}
      {fotoExpandidaIndex !== null && albumFotos[fotoExpandidaIndex] && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 select-none animate-fadeIn">
          {/* Header Bar */}
          <div className="w-full max-w-6xl flex items-center justify-between z-10 text-white">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                <Camera className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                  {albumFotos[fotoExpandidaIndex].obra || 'Obra'}
                </h3>
                <p className="text-[10px] text-slate-400 font-mono">
                  {albumFotos[fotoExpandidaIndex].name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs font-mono font-bold text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
                {fotoExpandidaIndex + 1} / {albumFotos.length}
              </span>
              <button
                type="button"
                onClick={() => setFotoExpandidaIndex(null)}
                className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-full transition-colors border border-slate-800 cursor-pointer"
                title="Fechar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Image Stage */}
          <div className="relative w-full max-w-6xl flex-1 flex items-center justify-center my-4 overflow-hidden">
            {/* Previous Button */}
            {albumFotos.length > 1 && (
              <button
                type="button"
                onClick={() => setFotoExpandidaIndex(prev => (prev === null || prev <= 0 ? albumFotos.length - 1 : prev - 1))}
                className="absolute left-2 sm:left-4 z-20 p-3 bg-slate-900/80 hover:bg-amber-500 text-white hover:text-slate-950 rounded-full transition-all border border-slate-700 shadow-2xl cursor-pointer active:scale-95"
                title="Anterior (Seta Esquerda)"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <img
              src={albumFotos[fotoExpandidaIndex].url}
              alt={albumFotos[fotoExpandidaIndex].name}
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-slate-800/80 transition-all duration-300"
            />

            {/* Next Button */}
            {albumFotos.length > 1 && (
              <button
                type="button"
                onClick={() => setFotoExpandidaIndex(prev => (prev === null || prev >= albumFotos.length - 1 ? 0 : prev + 1))}
                className="absolute right-2 sm:right-4 z-20 p-3 bg-slate-900/80 hover:bg-amber-500 text-white hover:text-slate-950 rounded-full transition-all border border-slate-700 shadow-2xl cursor-pointer active:scale-95"
                title="Próxima (Seta Direita)"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Footer Controls & Instructions */}
          <div className="w-full max-w-6xl flex items-center justify-between text-[11px] text-slate-400 font-sans z-10">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold">Dica:</span> Use as setas do teclado (← →) para navegar e ESC para fechar.
            </div>
            <a
              href={albumFotos[fotoExpandidaIndex].url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-800 transition-colors text-xs font-bold"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>Abrir Imagem em Nova Aba</span>
            </a>
          </div>
        </div>
      )}

      {/* QUICK UPLOAD PHOTO MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Camera className="w-4 h-4" />
                </span>
                <h3 className="text-xs font-black uppercase text-white tracking-wider">
                  Enviar Registro Fotográfico
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setUploadFileSelected(null);
                  setUploadFilePreview(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase text-slate-400">
                  Obra do Registro
                </label>
                <input
                  type="text"
                  value={obraAtiva || 'Nenhuma obra selecionada'}
                  disabled
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-400 cursor-not-allowed text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase text-slate-400">
                  Arquivo de Imagem (.png, .jpg, .jpeg)
                </label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleSelectQuickUploadFile}
                  disabled={isUploadingFoto}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer disabled:opacity-50"
                />
              </div>

              {uploadFilePreview && (
                <div className="p-3 bg-slate-950 border border-slate-850 rounded-2xl flex items-center gap-3">
                  <img
                    src={uploadFilePreview}
                    alt="Preview"
                    className="w-16 h-16 object-cover rounded-xl border border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block truncate max-w-[200px]">
                      {uploadFileSelected?.name}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {(uploadFileSelected?.size ? (uploadFileSelected.size / 1024).toFixed(1) : 0)} KB
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setUploadFileSelected(null);
                  setUploadFilePreview(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleQuickUploadFoto}
                disabled={isUploadingFoto || !uploadFileSelected}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 text-xs font-black rounded-xl transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
              >
                {isUploadingFoto ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Salvar Foto</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ajuste Manual de Status Oculto / Override */}
      <ModalAjusteStatusManual
        isOpen={!!itemParaAjusteStatus}
        onClose={() => setItemParaAjusteStatus(null)}
        item={itemParaAjusteStatus}
        onSuccess={async () => {
          await liveMetrics.refetch();
          showToast('Status manual do item atualizado com sucesso!', 'success');
        }}
      />

    </div>
  );
}
