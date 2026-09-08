import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ChevronLeft, 
  Lock, 
  Unlock, 
  Plus, 
  Trash2, 
  Printer, 
  Save, 
  FileText, 
  RotateCcw,
  Check, 
  Wrench,
  UserPlus,
  Database,
  Download,
  Upload,
  BarChart3,
  FileSpreadsheet,
  TrendingUp,
  Users,
  PieChart as PieIcon,
  Calendar,
  Pencil
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import CompanyLogo from './CompanyLogo';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export const PRE_REGISTERED_EMPLOYEES = [
  { name: "ANDRE LUIS SOARES RAMALHO", cargo: "ANALISTA" },
  { name: "ALEX SANDRO SILVA DE OLIVEIRA", cargo: "AUXILIAR" },
  { name: "THAYS SILVA LISBOA", cargo: "AUXILIAR" },
  { name: "EDUARDO NUNES DOS SANTOS JUNIOR", cargo: "AUXILIAR" },
  { name: "RENNAN KELVEN ALVES SILVA", cargo: "AUXILIAR" },
  { name: "IVANILDO SANTOS RABELO", cargo: "ALMOXARIFE" },
  { name: "ALINE PINHEIRO LEAL", cargo: "ALMOXARIFE" },
  { name: "WARLLEM PEREIRA NAUE", cargo: "OP. DE MÁQUINAS" },
  { name: "ROGERIO FONSECA RIBEIRO", cargo: "SINALEIRO" },
  { name: "FABIO SERGIO NASCIMENTO SOUSA", cargo: "ENCARREGADO" },
  { name: "FABIO JOSE PEREIRA DE OLIVEIRA", cargo: "ALMOXARIFE" },
  { name: "ERECIAS SILVA DIAS", cargo: "ALMOXARIFE" },
  { name: "WIDERLEY VIEIRA DA SILVA", cargo: "ALMOXARIFE" },
  { name: "JOSE SANTANA BARBOSA", cargo: "ALMOXARIFE" },
  { name: "JORGE LUIS FERREIRA MENDES", cargo: "ALMOXARIFE" },
  { name: "LEOMAR AMORIM MARTINS", cargo: "ELETRICISTA" },
  { name: "JOSE PAULO AGUIAR CARVALHO JUNIOR", cargo: "ELETRICISTA" },
  { name: "MARCELO BALDEZ VIANA", cargo: "ELETRICISTA" },
  { name: "SEBASTIÃO FERNANDO RIBEIRO SOUSA", cargo: "AJUDANTE" },
  { name: "MAICON CUNHA", cargo: "COORDENADOR" },
  { name: "JOAO LUIS LIMA RIBEIRO FILHO", cargo: "ALMOXARIFE" }
].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

interface ExtraHoursPanelProps {
  onBackToHub: () => void;
  allowedPins: string[];
}

interface WorkerRow {
  atv: string;
  name: string;
  cargo: string;
  provedor: string;
}

interface SavedForm {
  id: string;
  dateCreated: string;
  dataSolicitacao: string;
  dtPrevExecucao: string;
  jornadaPrevista: string;
  horaInicio?: string;
  horaFim?: string;
  centroCusto: string;
  responsavel: string;
  justificativa: string;
  previsaoHe: string;
  obs: string;
  responsavelPreenchimento: string;
  gestorAutorizador: string;
  workers: WorkerRow[];
  tipoHora?: '50%' | '100%';
  horasPorColaborador?: number;
  criado_por?: string;
  atualizado_por?: string;
}

function convertToYmd(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (str.includes('-') && !str.includes('/')) {
    const cleanStr = str.includes('T') ? str.split('T')[0] : (str.includes(' ') ? str.split(' ')[0] : str);
    return cleanStr;
  }
  const parts = str.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length === 2) {
      year = '20' + year;
    }
    return `${year}-${month}-${day}`;
  }
  if (parts.length === 2) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${month}-${day}`;
  }
  return str;
}

function convertToDmy(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  const cleanStr = str.includes('T') ? str.split('T')[0] : (str.includes(' ') ? str.split(' ')[0] : str);
  if (cleanStr.includes('/')) return cleanStr; // already DD/MM/YYYY
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    return `${day}/${month}/${year}`;
  }
  return str;
}

function formatarDataParaInput(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return convertToDmy(dateStr);
}

export default function ExtraHoursPanel({ onBackToHub }: ExtraHoursPanelProps) {
  // Capture authenticated user email and format username for audit trail
  const { session } = useAuth();
  const currentUserEmail = session?.email || session?.user?.email || '';
  const usernameAuditoria = currentUserEmail ? currentUserEmail.split('@')[0] : 'usuario.desconhecido';

  const dataDeHoje = new Date().toLocaleDateString('pt-BR');

  // Form Fields - Data da Solicitação inicia com a data atual (metadado de auditoria)
  const [dataSolicitacao, setDataSolicitacao] = useState<string>(dataDeHoje);
  const [dtPrevExecucao, setDtPrevExecucao] = useState<string>(dataDeHoje);
  const [horaInicio, setHoraInicio] = useState<string>('17:00');
  const [horaFim, setHoraFim] = useState<string>('20:00');
  const [centroCusto, setCentroCusto] = useState<string>('ALMOXARIFADO CENTRAL');
  const [responsavel, setResponsavel] = useState<string>('MAICON CUNHA');
  const [justificativa, setJustificativa] = useState<string>(
    `ANÁLISE DE RM's\nALIMENTAÇÃO DE REPORT\nDEFINIÇÃO ESTRATÉGIA DE ATENDIMENTOS DE ADMISSÕES\nSEPARAÇÃO DE KITS PARA FARDAR NOVOS COLABORADORES NO DIA 03/06 (29 COLABORADORES)`
  );
  const [previsaoHe, setPrevisaoHe] = useState<string>('PREVISÃO DE 10:00 HE 50%');
  const [obs, setObs] = useState<string>('');
  const [responsavelPreenchimento, setResponsavelPreenchimento] = useState<string>('MAICON CUNHA');
  const [gestorAutorizador, setGestorAutorizador] = useState<string>('ANDRE LUIS SOARES RAMALHO');

  // Tipo de Hora Extra: '50%' or '100%'
  const [tipoHora, setTipoHora] = useState<'50%' | '100%'>('50%');

  // Rows of Workers (up to 31 rows are rendered on sheet)
  const [workers, setWorkers] = useState<WorkerRow[]>([
    { atv: 'ATENDIMENTO DE RM E ANÁLISES', name: 'ALEX SANDRO SILVA DE OLIVEIRA', cargo: 'AUXILIAR ADM', provedor: 'CMPC' },
    { atv: 'SEPARAÇÃO', name: 'IVANILDO SANTOS RABELO', cargo: 'ALMOXARIFE', provedor: 'CMPC' },
    { atv: 'SEPARAÇÃO', name: 'ALINE PINHEIRO LEAL', cargo: 'ALMOXARIFE', provedor: 'CMPC' },
    { atv: 'REPORT', name: 'EDUARDO NUNES DOS SANTOS JUNIOR', cargo: 'AUXILIAR DE PLANEJAMENTO', provedor: 'CMPC' },
    { atv: 'ESTRATÉGIA', name: 'ANDRE LUIS SOARES RAMALHO', cargo: 'ANALISTA', provedor: 'CMPC' }
  ]);

  // Business logic: calculation of hours per collaborator
  const getCalculatedHours = (): number => {
    if (tipoHora === '50%') {
      return 2;
    } else {
      // 100%
      if (!horaInicio || !horaFim) return 0;
      const [hStart, mStart] = horaInicio.split(':').map(Number);
      const [hEnd, mEnd] = horaFim.split(':').map(Number);
      
      let startMinutes = hStart * 60 + mStart;
      let endMinutes = hEnd * 60 + mEnd;
      
      // Handle overnight wrap-around
      if (endMinutes < startMinutes) {
        endMinutes += 24 * 60;
      }
      
      const diffHours = (endMinutes - startMinutes) / 60;
      
      // CLT Art. 71 interval discounts:
      // Journey > 6 hours: subtract 1 hour
      // Journey > 4 hours and <= 6 hours: subtract 15 minutes (0.25 hours)
      // Journey <= 4 hours: subtract nothing (0 hours)
      let discount = 0;
      if (diffHours > 6) {
        discount = 1;
      } else if (diffHours > 4) {
        discount = 0.25;
      }
      
      return Math.max(0, diffHours - discount);
    }
  };

  const formatFriendlyHours = (hrs: number): string => {
    if (hrs === 0) return '0 horas';
    const hh = Math.floor(hrs);
    const mm = Math.round((hrs - hh) * 60);
    const formattedDecimal = hrs.toFixed(2).replace('.', ',').replace(',00', '').replace(/,(\d)0$/, ',$1');
    if (mm === 0) {
      return `${formattedDecimal} ${hrs === 1 ? 'hora' : 'horas'}`;
    }
    return `${formattedDecimal} horas (${hh}h e ${mm}m)`;
  };

  const horasPorColaborador = getCalculatedHours();

  // Automatic calculation effect to update previsaoHe
  useEffect(() => {
    const hours = getCalculatedHours();
    const totalHours = workers.length * hours;
    const formatHours = (hrs: number) => {
      const hh = Math.floor(hrs);
      const mm = Math.round((hrs - hh) * 60);
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    };
    setPrevisaoHe(`PREVISÃO DE ${formatHours(totalHours)} HE ${tipoHora}`);
  }, [tipoHora, horaInicio, horaFim, workers.length]);

  // Saved Drafts state
  const [savedForms, setSavedForms] = useState<SavedForm[]>(() => {
    const saved = localStorage.getItem('cmpc_saved_extra_hours');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [];
  });
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [showSavedToast, setShowSavedToast] = useState<boolean>(false);
  const [dbSearchQuery, setDbSearchQuery] = useState<string>('');

  const filteredForms = savedForms.filter(item => {
    const query = dbSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      (item.centroCusto || '').toLowerCase().includes(query) ||
      (item.dtPrevExecucao || '').toLowerCase().includes(query) ||
      (item.responsavel || '').toLowerCase().includes(query) ||
      (item.dataSolicitacao || '').toLowerCase().includes(query)
    );
  });

  // Editing Worker temporary state
  const [newAtv, setNewAtv] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newCargo, setNewCargo] = useState<string>('');
  const [newProvedor, setNewProvedor] = useState<string>('CMPC');
  const [editingWorkerIndex, setEditingWorkerIndex] = useState<number | null>(null);
  const [colaboradorQuery, setColaboradorQuery] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // Tab control state
  const [activeTab, setActiveTab] = useState<'form' | 'bi'>('form');

  // Supabase Table state
  const [supabaseForms, setSupabaseForms] = useState<any[]>([]);
  const [isLoadingBI, setIsLoadingBI] = useState<boolean>(false);

  // BI Date Filter state
  const [dataInicial, setDataInicial] = useState<string>('');
  const [dataFinal, setDataFinal] = useState<string>('');

  // ORDEM 1: CRIAR ESTADO DE INTERCEPTAÇÃO
  // null significa que o usuário ainda não escolheu o caminho
  const [modoEntrada, setModoEntrada] = useState<'nova' | 'editar' | null>(null);

  // Garante que o modal apareça toda vez que a aba for aberta/montada
  useEffect(() => {
    setModoEntrada(null);
  }, []);

  // Pull extra hours database sheets from server and merge to prevent data loss
  useEffect(() => {
    const pullExtraHoursFromServer = async () => {
      try {
        const res = await fetch('/api/sync');
        if (!res.ok) return;
        const data = await res.json();
        
        const serverForms = Array.isArray(data?.extraHoursForms) ? data.extraHoursForms : [];
        const localFormsStr = localStorage.getItem('cmpc_saved_extra_hours');
        let localForms: SavedForm[] = [];
        if (localFormsStr) {
          try { localForms = JSON.parse(localFormsStr); } catch (e) {}
        }
        
        // Merge list based on distinct form id
        const mergedMap = new Map<string, SavedForm>();
        localForms.forEach(f => {
          if (f && f.id) mergedMap.set(f.id, f);
        });
        serverForms.forEach((f: SavedForm) => {
          if (f && f.id) mergedMap.set(f.id, f);
        });
        
        const mergedList = Array.from(mergedMap.values());
        mergedList.sort((a, b) => b.id.localeCompare(a.id));
        
        setSavedForms(mergedList);
        localStorage.setItem('cmpc_saved_extra_hours', JSON.stringify(mergedList));
        
        // Post updates back if we merged local un-synced forms
        if (mergedList.length > serverForms.length) {
          await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ extraHoursForms: mergedList })
          });
        }
      } catch (err) {
        console.warn('Silent DB synchronization failed:', err);
      }
    };
    
    pullExtraHoursFromServer();
  }, []);

  const getItemDate = (item: any): Date | null => {
    if (!item) return null;
    const rawDate = item.data_servico || item.dt_prev_execucao || item.dtPrevExecucao || item.data_solicitacao || item.dataSolicitacao || item.created_at || '';
    if (!rawDate) return null;

    const rawStr = String(rawDate).trim().split('T')[0];
    const ymd = convertToYmd(rawStr);
    if (ymd && ymd.length === 10) {
      const parts = ymd.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          return new Date(y, m - 1, d);
        }
      }
    }
    const dt = new Date(rawDate);
    return isNaN(dt.getTime()) ? null : dt;
  };

  const rawBiSourceList = supabaseForms.length > 0 ? supabaseForms : savedForms;

  const biSourceList = rawBiSourceList.filter(item => {
    if (!item) return false;
    const itemDate = getItemDate(item);
    if (itemDate) {
      if (dataInicial) {
        const parts = dataInicial.split('-');
        if (parts.length === 3) {
          const inicio = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
          if (itemDate < inicio) return false;
        }
      }
      if (dataFinal) {
        const parts = dataFinal.split('-');
        if (parts.length === 3) {
          const fim = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 23, 59, 59, 999);
          if (itemDate > fim) return false;
        }
      }
    }
    return true;
  });

  const filteredSupabaseForms = biSourceList.filter(item => {
    const query = dbSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      (item.centro_custo || item.centroCusto || '').toLowerCase().includes(query) ||
      (item.dt_prev_execucao || item.dtPrevExecucao || item.data_solicitacao || item.dataSolicitacao || convertToDmy(item.data_servico) || '').toLowerCase().includes(query) ||
      (item.responsavel || '').toLowerCase().includes(query) ||
      (item.justificativa || item.motivo || '').toLowerCase().includes(query)
    );
  });

  const fetchSupabaseForms = async () => {
    setIsLoadingBI(true);
    try {
      // First try fetching directly from previsao_horas_extras table
      const { data, error } = await supabase
        .from('previsao_horas_extras')
        .select('*')
        .order('id', { ascending: false });
      
      if (error) {
        console.warn('Could not fetch from previsao_horas_extras table:', error);
      } else if (data) {
        const mappedData = data.map((item: any) => {
          let loadedWorkers: WorkerRow[] = [];
          if (Array.isArray(item.colaboradores)) {
            loadedWorkers = item.colaboradores.map((w: any) => ({
              id: w.id || Math.random(),
              name: w.nome || w.name || w.nome_completo || '',
              cargo: w.cargo || '',
              atv: w.atividade || w.atv || '',
              provedor: w.provedor || 'CMPC'
            }));
          } else if (item.colaboradores && typeof item.colaboradores === 'object') {
            if (Array.isArray(item.colaboradores.workers)) {
              loadedWorkers = item.colaboradores.workers.map((w: any) => ({
                id: w.id || Math.random(),
                name: w.nome || w.name || w.nome_completo || '',
                cargo: w.cargo || '',
                atv: w.atividade || w.atv || '',
                provedor: w.provedor || 'CMPC'
              }));
            }
          } else if (Array.isArray(item.previsao_horas_extras_funcionarios)) {
            loadedWorkers = item.previsao_horas_extras_funcionarios.map((w: any) => ({
              id: w.id || Math.random(),
              name: w.nome_completo || w.nome || w.name || '',
              cargo: w.cargo || '',
              atv: w.atividade || w.atv || '',
              provedor: w.provedor || 'CMPC'
            }));
          }

          const hasMetadata = item.colaboradores && typeof item.colaboradores === 'object' && !Array.isArray(item.colaboradores);
          const meta = hasMetadata ? item.colaboradores : {};
          
          // ORDEM 3: A Data da Solicitação vem de data_solicitacao com fallback para created_at (fichas antigas)
          const dataSolicitacaoFormatted = convertToDmy(item.data_solicitacao) || formatarDataParaInput(item.created_at) || meta.dataSolicitacao || dataDeHoje;
          // A Data de Execução vem da coluna data_servico
          const dataExecucaoFormatted = convertToDmy(item.data_servico) || item.dt_prev_execucao || meta.dtPrevExecucao || '';

          return {
            id: item.id,
            created_at: item.created_at,
            data_servico: item.data_servico,
            data_solicitacao: item.data_solicitacao,
            dataSolicitacao: dataSolicitacaoFormatted,
            dtPrevExecucao: dataExecucaoFormatted,
            dt_prev_execucao: dataExecucaoFormatted,
            horaInicio: item.hora_inicio || '',
            hora_inicio: item.hora_inicio || '',
            horaFim: item.hora_fim || '',
            hora_fim: item.hora_fim || '',
            jornadaPrevista: item.hora_inicio && item.hora_fim ? `${item.hora_inicio} AS ${item.hora_fim}` : '',
            jornada_prevista: item.hora_inicio && item.hora_fim ? `${item.hora_inicio} AS ${item.hora_fim}` : '',
            centroCusto: item.centro_custo || meta.centroCusto || 'ALMOXARIFADO CENTRAL',
            centro_custo: item.centro_custo || meta.centroCusto || 'ALMOXARIFADO CENTRAL',
            responsavel: item.responsavel || meta.responsavel || 'MAICON CUNHA',
            justificativa: item.motivo || item.justificativa || meta.justificativa || '',
            motivo: item.motivo || item.justificativa || meta.justificativa || '',
            previsaoHe: item.previsao_he || meta.previsaoHe || `PREVISÃO DE HE ${item.tipo_hora || ''}`,
            obs: item.obs || item.observacoes || meta.obs || '',
            responsavelPreenchimento: item.responsavel_preenchimento || meta.responsavelPreenchimento || item.responsavel || '',
            responsavel_preenchimento: item.responsavel_preenchimento || meta.responsavelPreenchimento || item.responsavel || '',
            gestorAutorizador: item.gestor_autorizador || meta.gestorAutorizador || '',
            gestor_autorizador: item.gestor_autorizador || meta.gestorAutorizador || '',
            workers: loadedWorkers,
            colaboradores: loadedWorkers,
            tipoHora: item.tipo_hora || item.tipo_hora_extra || meta.tipoHora || '50%',
            tipo_hora: item.tipo_hora || item.tipo_hora_extra || meta.tipoHora || '50%',
            horasPorColaborador: item.horas_por_colaborador || 2,
            horas_por_colaborador: item.horas_por_colaborador || 2,
            criado_por: item.criado_por || meta.criado_por || '',
            atualizado_por: item.atualizado_por || meta.atualizado_por || ''
          };
        });
        setSupabaseForms(mappedData);
      }
    } catch (err) {
      console.error('Error fetching Supabase forms:', err);
    } finally {
      setIsLoadingBI(false);
    }
  };

  useEffect(() => {
    fetchSupabaseForms();
  }, []);

  const getRecordHours = (item: any): number => {
    if (item?.horas_por_colaborador !== undefined && item?.horas_por_colaborador !== null) {
      const parsed = Number(item.horas_por_colaborador);
      if (!isNaN(parsed)) return parsed;
    }
    if (item?.horasPorColaborador !== undefined && item?.horasPorColaborador !== null) {
      const parsed = Number(item.horasPorColaborador);
      if (!isNaN(parsed)) return parsed;
    }
    // fallback calculation
    const tHora = item?.tipo_hora || item?.tipoHora || '50%';
    if (tHora === '50%') return 2;
    
    // check new time fields
    const hStart = item?.hora_inicio || item?.horaInicio;
    const hEnd = item?.hora_fim || item?.horaFim;
    if (hStart && hEnd) {
      const [hS, mS] = hStart.split(':').map(Number);
      const [hE, mE] = hEnd.split(':').map(Number);
      let startMinutes = hS * 60 + mS;
      let endMinutes = hE * 60 + mE;
      if (endMinutes < startMinutes) {
        endMinutes += 24 * 60;
      }
      const diffHours = (endMinutes - startMinutes) / 60;
      let discount = 0;
      if (diffHours > 6) {
        discount = 1;
      } else if (diffHours > 4) {
        discount = 0.25;
      }
      return Math.max(0, diffHours - discount);
    }

    // Calculate difference minus CLT interval discounts
    const jp = item?.jornada_prevista || item?.jornadaPrevista || '';
    const cleaned = jp.replace(/\s+/g, '').replace(/h/gi, ':');
    const matches = cleaned.match(/(\d{1,2}):(\d{2})/g);
    if (matches && matches.length >= 2) {
      const parseTime = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h + m / 60;
      };
      const t1 = parseTime(matches[0]);
      let t2 = parseTime(matches[1]);
      if (t2 < t1) {
        t2 += 24;
      }
      const diffHours = t2 - t1;
      let discount = 0;
      if (diffHours > 6) {
        discount = 1;
      } else if (diffHours > 4) {
        discount = 0.25;
      }
      return Math.max(0, diffHours - discount);
    }
    
    const numericMatches = cleaned.match(/\d+/g);
    if (numericMatches && numericMatches.length >= 2) {
      const h1 = Number(numericMatches[0]);
      let h2 = Number(numericMatches[1]);
      if (h2 < h1) h2 += 24;
      const diffHours = h2 - h1;
      let discount = 0;
      if (diffHours > 6) {
        discount = 1;
      } else if (diffHours > 4) {
        discount = 0.25;
      }
      return Math.max(0, diffHours - discount);
    }
    return 0;
  };

  const parseDDMMYYYY = (dStr: string) => {
    const pts = dStr.split('/');
    if (pts.length === 3) {
      return new Date(Number(pts[2]), Number(pts[1]) - 1, Number(pts[0]));
    }
    return new Date(dStr);
  };

  // Pre-calculate BI data
  const getBiData = () => {
    const topColabAcc: Record<string, number> = {};
    let totalHours50 = 0;
    let totalHours100 = 0;
    const dateAcc: Record<string, number> = {};
    const distinctWorkers = new Set<string>();

    biSourceList.forEach(form => {
      if (!form) return;
      const date = form.dt_prev_execucao || form.dtPrevExecucao || form.data_solicitacao || form.dataSolicitacao || '';
      const tipo = form.tipo_hora || form.tipoHora || '50%';
      const hrs = getRecordHours(form);

      // Safe extraction of collaborators array with defenses
      let workersList: any[] = [];
      if (Array.isArray(form.colaboradores)) {
        workersList = form.colaboradores;
      } else if (Array.isArray(form.workers)) {
        workersList = form.workers;
      } else if (form.colaboradores && typeof form.colaboradores === 'string') {
        try {
          workersList = JSON.parse(form.colaboradores);
        } catch (_) {
          workersList = [];
        }
      } else if (form.workers && typeof form.workers === 'string') {
        try {
          workersList = JSON.parse(form.workers);
        } catch (_) {
          workersList = [];
        }
      }
      
      if (!Array.isArray(workersList)) {
        workersList = [];
      }

      // Total duration of the sheet: (size of collaborators array) * (hours per collaborator)
      const formTotalHours = workersList.length * hrs;

      if (tipo === '100%') {
        totalHours100 += formTotalHours;
      } else {
        totalHours50 += formTotalHours;
      }

      if (date) {
        dateAcc[date] = (dateAcc[date] || 0) + formTotalHours;
      }

      // Aggregate individual collaborator hours safely
      workersList.forEach((worker: any) => {
        if (worker) {
          const nameValue = worker.name || worker.nome || worker.colaborador || '';
          if (nameValue && typeof nameValue === 'string') {
            const wName = nameValue.trim().toUpperCase();
            distinctWorkers.add(wName);
            topColabAcc[wName] = (topColabAcc[wName] || 0) + hrs;
          }
        }
      });
    });

    const topColabData = Object.entries(topColabAcc)
      .map(([name, value]) => ({ name, 'Horas': Number(value.toFixed(1)) }))
      .sort((a, b) => b['Horas'] - a['Horas'])
      .slice(0, 10);

    const pieData = [
      { name: '50% (Fixo)', value: Number(totalHours50.toFixed(1)), color: '#3a2573' },
      { name: '100% (Calculado)', value: Number(totalHours100.toFixed(1)), color: '#10b981' }
    ].filter(item => item.value > 0);

    const trendData = Object.entries(dateAcc)
      .map(([date, value]) => ({
        date,
        'Horas Totais': Number(value.toFixed(1)),
        parsedDate: parseDDMMYYYY(date)
      }))
      .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())
      .map(item => ({
        date: item.date,
        'Horas Totais': item['Horas Totais']
      }));

    const totalHoursAll = totalHours50 + totalHours100;

    return {
      topColabData,
      pieData,
      trendData,
      totalHoursAll,
      activeWorkersCount: distinctWorkers.size,
      totalFormsCount: biSourceList.length
    };
  };

  const biStats = getBiData();

  // Excel (CSV) export function
  const handleExportExcel = () => {
    const headers = ['Data', 'Colaborador', 'Tipo (50/100%)', 'Horas Totais'];
    const rows: string[][] = [];

    biSourceList.forEach(form => {
      if (!form) return;
      const date = form.dt_prev_execucao || form.dtPrevExecucao || form.data_solicitacao || form.dataSolicitacao || '';
      const tipo = form.tipo_hora || form.tipoHora || '50%';
      const hrs = getRecordHours(form);

      // Safe extraction of collaborators array with defenses
      let workersList: any[] = [];
      if (Array.isArray(form.colaboradores)) {
        workersList = form.colaboradores;
      } else if (Array.isArray(form.workers)) {
        workersList = form.workers;
      } else if (form.colaboradores && typeof form.colaboradores === 'string') {
        try {
          workersList = JSON.parse(form.colaboradores);
        } catch (_) {
          workersList = [];
        }
      } else if (form.workers && typeof form.workers === 'string') {
        try {
          workersList = JSON.parse(form.workers);
        } catch (_) {
          workersList = [];
        }
      }

      if (!Array.isArray(workersList)) {
        workersList = [];
      }

      workersList.forEach((worker: any) => {
        if (worker) {
          const nameValue = worker.name || worker.nome || worker.colaborador || '';
          if (nameValue) {
            rows.push([
              date,
              nameValue,
              tipo,
              hrs.toFixed(1).replace('.', ',') // Brazilian Excel standard uses comma decimal
            ]);
          }
        }
      });
    });

    if (rows.length === 0) {
      alert("Nenhum dado disponível para exportação.");
      return;
    }

    // Generate CSV with semicolon delimiter (Portuguese Excel standard) and UTF-8 BOM for perfect Portuguese accent support
    const csvContent = "\uFEFF" + [
      headers.join(';'),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Previsao_Horas_Extras_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddWorker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    if (editingWorkerIndex === null && workers.length >= 31) {
      alert('Limite máximo de 31 funcionários atingido para este formulário.');
      return;
    }
    
    const workerData = { 
      atv: newAtv.trim().toUpperCase() || 'TRABALHO OPERACIONAL', 
      name: newName.trim().toUpperCase(), 
      cargo: newCargo.trim().toUpperCase() || 'COLABORADOR', 
      provedor: newProvedor.trim().toUpperCase() || 'CMPC'
    };

    if (editingWorkerIndex !== null) {
      const updated = [...workers];
      updated[editingWorkerIndex] = workerData;
      setWorkers(updated);
      setEditingWorkerIndex(null);
    } else {
      setWorkers([...workers, workerData]);
    }

    setNewAtv('');
    setNewName('');
    setNewCargo('');
    setNewProvedor('CMPC');
    setColaboradorQuery('');
  };

  const handleEditWorker = (index: number) => {
    const person = workers[index];
    setNewAtv(person.atv || '');
    setNewName(person.name || '');
    setNewCargo(person.cargo || '');
    setNewProvedor(person.provedor || 'CMPC');
    setColaboradorQuery(person.name || '');
    setEditingWorkerIndex(index);
  };

  const handleRemoveWorker = (index: number) => {
    const updated = workers.filter((_, idx) => idx !== index);
    setWorkers(updated);
  };

  const handleNovaSolicitacao = () => {
    const today = new Date().toLocaleDateString('pt-BR');
    setCurrentDraftId(null);
    setDataSolicitacao(today);
    setDtPrevExecucao(today);
    setHoraInicio('17:00');
    setHoraFim('20:00');
    setCentroCusto('ALMOXARIFADO CENTRAL');
    setResponsavel('MAICON CUNHA');
    setJustificativa('');
    setPrevisaoHe('PREVISÃO DE 0:00 HE 50%');
    setObs('');
    setResponsavelPreenchimento('MAICON CUNHA');
    setGestorAutorizador('ANDRE LUIS SOARES RAMALHO');
    setWorkers([]);
    setTipoHora('50%');
    setEditingWorkerIndex(null);
    setActiveTab('form');
  };

  const handleClearForm = () => {
    handleNovaSolicitacao();
  };

  // ORDEM 2: LÓGICA DOS BOTÕES DO MODAL INICIAL
  const handleEscolherNova = () => {
    handleNovaSolicitacao();
    setModoEntrada('nova');
  };

  const handleEscolherEditar = () => {
    // Apenas libera a tela. O usuário deverá clicar em um item no 
    // "HISTÓRICO DE FICHAS GERADAS" na barra lateral esquerda para carregar os dados.
    setModoEntrada('editar');
  };

  const handleSaveForm = async () => {
    // Verificação explícita do ID da solicitação: se null ou draft, cria nova (INSERT); caso contrário, atualiza a existente (UPDATE)
    const solicitacaoId = currentDraftId && !String(currentDraftId).startsWith('draft_') ? currentDraftId : null;
    const isNewForm = !solicitacaoId;

    // Calculate total hours per worker
    const calculatedHours = getCalculatedHours();

    // Map workers list to jsonb array format with keys expected by Supabase table
    const colaboradoresPayload = workers.map(w => ({
      nome: w.name || '',
      name: w.name || '',
      cargo: w.cargo || '',
      atividade: w.atv || '',
      atv: w.atv || '',
      provedor: w.provedor || 'CMPC'
    }));

    // ORDEM 2: AJUSTAR O PAYLOAD DE SALVAMENTO (SUPABASE)
    // Mapeia explicitamente cada estado para sua respectiva coluna no banco.
    // data_solicitacao: nova coluna para lançamentos retroativos
    // data_servico: coluna de execução real da hora extra
    const headerPayload: any = {
      data_solicitacao: convertToYmd(dataSolicitacao) || new Date().toISOString().split('T')[0],
      data_servico: convertToYmd(dtPrevExecucao) || new Date().toISOString().split('T')[0],
      hora_inicio: horaInicio || '17:00',
      hora_fim: horaFim || '20:00',
      tipo_hora: tipoHora || '50%',
      motivo: justificativa || '',
      horas_por_colaborador: calculatedHours,
      colaboradores: colaboradoresPayload,
      ...(isNewForm ? { criado_por: usernameAuditoria } : { atualizado_por: usernameAuditoria })
    };

    // Save directly to 'previsao_horas_extras' table in Supabase
    let savedDbId: any = solicitacaoId;
    try {
      if (isNewForm) {
        // Executa INSERT no Supabase
        const { data: headerData, error: headerError } = await supabase
          .from('previsao_horas_extras')
          .insert([headerPayload])
          .select('id')
          .single();
        
        if (headerError) {
          console.error('Direct Supabase insert to previsao_horas_extras failed:', headerError);
          alert('Erro ao salvar solicitação no banco de dados: ' + headerError.message);
          return;
        } else if (headerData) {
          // Atualiza o estado com o novo ID gerado para evitar duplicações em salvamentos subsequentes
          savedDbId = headerData.id;
          setCurrentDraftId(savedDbId);
        }
      } else {
        // Executa UPDATE no Supabase
        const { error: updateError } = await supabase
          .from('previsao_horas_extras')
          .update(headerPayload)
          .eq('id', solicitacaoId);
        
        if (updateError) {
          console.error('Direct Supabase update to previsao_horas_extras failed:', updateError);
          alert('Erro ao atualizar solicitação no banco de dados: ' + updateError.message);
          return;
        }
      }

      // Optional: attempt child table sync if previsao_horas_extras_funcionarios exists
      if (workers && workers.length > 0 && savedDbId) {
        try {
          const payloadFuncionarios = workers.map(func => ({
            previsao_id: savedDbId,
            nome_completo: func.name || (func as any).nome_completo || '',
            nome: func.name || (func as any).nome_completo || '',
            cargo: func.cargo || '',
            atividade: func.atv || (func as any).atividade || '',
            atv: func.atv || (func as any).atividade || '',
            provedor: func.provedor || 'CMPC'
          }));

          if (!isNewForm) {
            await supabase
              .from('previsao_horas_extras_funcionarios')
              .delete()
              .eq('previsao_id', savedDbId);
          }

          await supabase
            .from('previsao_horas_extras_funcionarios')
            .insert(payloadFuncionarios);
        } catch (childErr) {
          // Silent catch for relational child table if not present
          console.warn('Child table sync omitted or failed silently:', childErr);
        }
      }

      console.log('Direct Supabase save succeeded with ID:', savedDbId);
      
      // Also save to localStorage and server sync as backup
      const existingDraft = savedForms.find(item => item.id === savedDbId);
      const localDraft: SavedForm = {
        id: savedDbId || 'draft_' + Date.now(),
        dateCreated: new Date().toLocaleDateString('pt-BR'),
        dataSolicitacao,
        dtPrevExecucao,
        jornadaPrevista: `${horaInicio} AS ${horaFim}`,
        horaInicio,
        horaFim,
        centroCusto,
        responsavel,
        justificativa,
        previsaoHe,
        obs,
        responsavelPreenchimento,
        gestorAutorizador,
        workers,
        tipoHora,
        horasPorColaborador: calculatedHours,
        criado_por: isNewForm ? usernameAuditoria : (existingDraft?.criado_por || usernameAuditoria),
        ...(isNewForm ? {} : { atualizado_por: usernameAuditoria })
      };

      let updatedList: SavedForm[] = [];
      const localExists = savedForms.some(item => item.id === savedDbId);
      if (localExists) {
        updatedList = savedForms.map(item => item.id === savedDbId ? localDraft : item);
      } else {
        updatedList = [localDraft, ...savedForms];
      }
      setSavedForms(updatedList);
      localStorage.setItem('cmpc_saved_extra_hours', JSON.stringify(updatedList));

      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ extraHoursForms: updatedList })
        });
      } catch (e) {
        console.warn('Silent server sync failed on save:', e);
      }

      // Show floating feedback toast
      setShowSavedToast(true);
      setTimeout(() => {
        setShowSavedToast(false);
      }, 5000);

      // Trigger fetch to refresh history panel immediately
      await fetchSupabaseForms();

    } catch (err: any) {
      console.error('Error in direct Supabase save:', err);
      alert('Erro inesperado ao salvar no banco de dados: ' + (err.message || err));
    }
  };

  const handleLoadDraft = (draft: SavedForm) => {
    setCurrentDraftId(draft.id);
    const dataExecucao = draft.dtPrevExecucao || convertToDmy((draft as any).data_servico) || '';
    const dataSol = convertToDmy((draft as any).data_solicitacao) || draft.dataSolicitacao || formatarDataParaInput((draft as any).created_at) || draft.dateCreated || dataDeHoje;
    setDataSolicitacao(dataSol);
    setDtPrevExecucao(dataExecucao);
    if (draft.horaInicio && draft.horaFim) {
      setHoraInicio(draft.horaInicio);
      setHoraFim(draft.horaFim);
    } else if (draft.jornadaPrevista) {
      const cleaned = draft.jornadaPrevista.replace(/\s+/g, '').replace(/h/gi, ':');
      const matches = cleaned.match(/(\d{1,2}):(\d{2})/g);
      if (matches && matches.length >= 2) {
        setHoraInicio(matches[0]);
        setHoraFim(matches[1]);
      } else {
        setHoraInicio('17:00');
        setHoraFim('20:00');
      }
    } else {
      setHoraInicio('17:00');
      setHoraFim('20:00');
    }
    setCentroCusto(draft.centroCusto);
    setResponsavel(draft.responsavel);
    setJustificativa(draft.justificativa);
    setPrevisaoHe(draft.previsaoHe);
    setObs(draft.obs);
    setResponsavelPreenchimento(draft.responsavelPreenchimento);
    setGestorAutorizador(draft.gestorAutorizador);
    setWorkers(draft.workers);
    setTipoHora(draft.tipoHora || '50%');
  };

  const handleLoadSupabaseForm = (item: any) => {
    setCurrentDraftId(item.id);
    // ORDEM 3: AJUSTAR O CARREGAMENTO DE FICHAS EXISTENTES
    // Puxa os dados das colunas corretas de forma independente.
    // Fallback para created_at apenas para fichas antigas que não tinham a nova coluna data_solicitacao
    const dataSol = convertToDmy(item.data_solicitacao) || formatarDataParaInput(item.created_at) || item.dataSolicitacao || dataDeHoje;
    const dataExecucao = convertToDmy(item.data_servico) || item.dt_prev_execucao || item.dtPrevExecucao || '';

    setDataSolicitacao(dataSol);
    setDtPrevExecucao(dataExecucao);
    
    const hStart = item.hora_inicio || item.horaInicio;
    const hEnd = item.hora_fim || item.horaFim;
    if (hStart && hEnd) {
      setHoraInicio(hStart);
      setHoraFim(hEnd);
    } else {
      const jp = item.jornada_prevista || item.jornadaPrevista || '';
      const cleaned = jp.replace(/\s+/g, '').replace(/h/gi, ':');
      const matches = cleaned.match(/(\d{1,2}):(\d{2})/g);
      if (matches && matches.length >= 2) {
        setHoraInicio(matches[0]);
        setHoraFim(matches[1]);
      } else {
        setHoraInicio('17:00');
        setHoraFim('20:00');
      }
    }
    
    setCentroCusto(item.centro_custo || item.centroCusto || '');
    setResponsavel(item.responsavel || '');
    setJustificativa(item.justificativa || '');
    setPrevisaoHe(item.previsao_he || item.previsaoHe || '');
    setObs(item.obs || '');
    setResponsavelPreenchimento(item.responsavel_preenchimento || item.responsavelPreenchimento || '');
    setGestorAutorizador(item.gestor_autorizador || item.gestorAutorizador || '');
    setWorkers(item.colaboradores || item.workers || []);
    setTipoHora(item.tipo_hora || item.tipoHora || '50%');
  };

  const handleDeleteDraft = async (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Deseja excluir permanentemente este rascunho da base de dados?')) {
      const updated = savedForms.filter(item => item.id !== draftId);
      setSavedForms(updated);
      localStorage.setItem('cmpc_saved_extra_hours', JSON.stringify(updated));
      if (currentDraftId === draftId) {
        setCurrentDraftId(null);
      }

      // Delete from cloud DB
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ extraHoursForms: updated })
        });
      } catch (e) {
        console.warn('Silent server sync failed on delete:', e);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };


  // Blank Rows list mapping up to 31 printed slots
  const renderRowsCount = 31;
  const blankRowsNeeded = Math.max(0, renderRowsCount - workers.length);

  return (
    <div className="relative min-h-screen bg-slate-100 flex flex-col font-sans print:bg-white print:p-0" id="extra-hours-panel">
      {/* MODAL DE ESCOLHA INICIAL (INTERCEPTADOR) */}
      {modoEntrada === null && (
        <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center backdrop-blur-sm print:hidden">
          <div className="bg-slate-800 border border-slate-700 p-8 rounded-xl shadow-2xl max-w-md w-full text-center animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-bold text-white mb-2">Previsão de Horas Extras</h2>
            <p className="text-slate-400 text-sm mb-8">O que você deseja fazer nesta sessão?</p>
            
            <div className="flex flex-col gap-4">
              <button 
                type="button"
                onClick={handleEscolherNova}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg hover:shadow-emerald-900/30"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                Nova Solicitação
              </button>
              
              <button 
                type="button"
                onClick={handleEscolherEditar}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg hover:shadow-indigo-900/30"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                Editar Solicitação Existente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Styling override for Printing - ensures EXACT document size matching and hide inputs */}
      <style>{`
        /* Force readable high-contrast dark text colors for inputs and all text when on screen, even if global html has .dark class */
        @media screen {
          /* 1. All form inputs, selects, textareas */
          #extra-hours-panel input,
          #extra-hours-panel select,
          #extra-hours-panel textarea {
            color: #0d1b2a !important; /* Deep blackish color */
            background-color: #f8fafc !important; /* Slate-50 background */
          }
          #extra-hours-panel input:focus,
          #extra-hours-panel select:focus,
          #extra-hours-panel textarea:focus {
            background-color: #ffffff !important; /* Solid clean white background on focus */
            color: #0d1b2a !important;
          }
          #extra-hours-panel input::placeholder,
          #extra-hours-panel textarea::placeholder {
            color: #475569 !important; /* Visible slate-600 placeholder */
            opacity: 0.8 !important;
          }

          /* 2. Left Editor labels, texts, and legends */
          #print-left-editor label {
            color: #475569 !important; /* Slate-600 label text */
          }
          #print-left-editor h3,
          #print-left-editor h4 {
            color: #3a2573 !important; /* Brand CMPC Purple */
          }
          #print-left-editor p {
            color: #334155 !important; /* Slate-700 description */
          }
          #print-left-editor p.text-rose-600 {
            color: #dc2626 !important; /* Force red for validation errors on screen */
          }
          #print-left-editor div {
            color: #0f172a;
          }
          /* Prevent white text on white backgrounds inside list elements */
          #print-left-editor .text-slate-800 {
            color: #1e293b !important;
          }
          #print-left-editor .text-slate-450 {
            color: #64748b !important;
          }

          /* 3. Right Document Live Preview */
          #print-right-preview h2,
          #print-right-preview h3,
          #print-right-preview h4,
          #print-right-preview th,
          #print-right-preview td,
          #print-right-preview span,
          #print-right-preview p {
            color: #0f172a !important; /* Clear black/slate-900 on paper representation */
          }
          /* Ensure column labels on paper are grey for contrast */
          #print-right-preview .text-slate-500,
          #print-right-preview .text-slate-450 {
            color: #4b4c59 !important;
          }
          /* Keep table head cells white since their background is solid dark slate-900 */
          #print-right-preview thead bg-[#1e293b],
          #print-right-preview .bg-[#1e293b],
          #print-right-preview .bg-[#1e293b] *,
          #print-right-preview .print-header-color,
          #print-right-preview .print-header-color * {
            color: #ffffff !important;
          }
        }

        @media print {
          body, html {
            background-color: #fff !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }

          /* Override index.css visibility reset for the Extra Hours Panel printable sheet */
          #root, #root * {
            visibility: hidden !important;
          }

          #extra-hours-panel, 
          #extra-hours-panel #print-right-preview, 
          #extra-hours-panel #print-right-preview * {
            visibility: visible !important;
          }

          #print-header-controls, 
          #print-left-editor, 
          #extra-hours-footer-bar, 
          #hub-footer {
            display: none !important;
            visibility: hidden !important;
          }

          #print-right-preview {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            box-shadow: none !important;
            border: none !important;
            background: #fff !important;
            z-index: 9999999 !important;
          }

          .custom-sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
          }
        }
      `}</style>

      {/* Navigation Topbar */}
      <header className="bg-slate-900 text-white py-4 px-6 md:px-8 border-b border-slate-800 shadow-md print:hidden" id="print-header-controls">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={onBackToHub}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 rounded-xl hover:bg-slate-755 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar ao Portal</span>
            </button>
            <div className="border-l border-slate-700 pl-3">
              <span className="text-[10px] uppercase font-black tracking-widest text-[#a3b8cc] block leading-none">Área de Estratégia</span>
              <h1 className="text-sm font-bold tracking-tight text-white mt-0.5 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-cmpc-purple" />
                <span>Previsão de Horas Extraordinárias CMPC</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <button
              onClick={handleNovaSolicitacao}
              className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-sm cursor-pointer border border-emerald-500/20 active:scale-95"
              title="Criar nova solicitação limpa"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nova Solicitação</span>
            </button>

            <button
              onClick={handleSaveForm}
              className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-[#3a2573] hover:bg-[#2b1b58] text-white rounded-xl transition-all shadow-sm cursor-pointer border border-[#3a2573]/20"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar solicitação</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-black bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Salvar PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tab Switcher - Print Hidden */}
      <div className="bg-slate-900 border-b border-slate-800 py-2.5 px-6 md:px-8 print:hidden flex justify-center sm:justify-start">
        <div className="max-w-7xl w-full flex items-center justify-start space-x-2">
          <button
            onClick={() => setActiveTab('form')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'form'
                ? 'bg-[#3a2573] text-white shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Formulário & Folha de Previsão</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('bi');
              fetchSupabaseForms();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'bi'
                ? 'bg-[#3a2573] text-white shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Painel de Business Intelligence (BI)</span>
          </button>
        </div>
      </div>

      {/* BI Dashboard Container */}
      {activeTab === 'bi' && (
        <div className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 space-y-6 print:hidden">
          {/* BI Header with Excel Export */}
          <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 animate-fadeIn">
            <div>
              <span className="text-[10px] font-black uppercase text-[#3a2573] tracking-widest bg-[#3a2573]/10 px-2.5 py-1 rounded-full border border-[#3a2573]/20">
                Painel Estratégico BI
              </span>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 mt-2 font-sans">
                Acompanhamento de Horas Extraordinárias
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Indicadores consolidados e gráficos de tendência para apoiar decisões estratégicas na CMPC.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={fetchSupabaseForms}
                disabled={isLoadingBI}
                className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer border border-slate-200"
              >
                <span>{isLoadingBI ? 'Carregando...' : 'Atualizar Dados'}</span>
              </button>

              <button
                onClick={handleExportExcel}
                className="flex items-center space-x-2 px-4 py-2.5 text-xs font-black bg-gradient-to-r from-[#3a2573] to-[#2b1b58] text-white rounded-xl shadow-md transition-all hover:opacity-95 active:scale-95 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Exportar para Excel</span>
              </button>
            </div>
          </div>

          {/* Filtro de Período BI */}
          <div className="bg-white border border-slate-200 rounded-[24px] p-5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 animate-fadeIn">
            <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#3a2573]" />
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={dataInicial}
                  onChange={(e) => setDataInicial(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-[#3a2573] outline-none shadow-2xs transition-all cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#3a2573]" />
                  Data Final
                </label>
                <input
                  type="date"
                  value={dataFinal}
                  onChange={(e) => setDataFinal(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-[#3a2573] outline-none shadow-2xs transition-all cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto pt-1">
                <button
                  type="button"
                  onClick={fetchSupabaseForms}
                  className="px-4 py-2 bg-[#3a2573] hover:bg-[#2b1b58] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  Filtrar
                </button>

                {(dataInicial || dataFinal) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDataInicial('');
                      setDataFinal('');
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border border-slate-200"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {(dataInicial || dataFinal) && (
              <div className="text-left sm:text-right text-[11px] font-bold text-[#3a2573] bg-[#3a2573]/5 border border-[#3a2573]/20 px-3.5 py-2 rounded-2xl">
                Período: <span className="font-mono">{dataInicial ? convertToDmy(dataInicial) : 'Início'}</span> até <span className="font-mono">{dataFinal ? convertToDmy(dataFinal) : 'Hoje'}</span>
              </div>
            )}
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Metric 1 */}
            <div className="bg-white border border-slate-200 rounded-[24px] p-5 shadow-xs flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-inner">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Volume Total Previsto</span>
                <span className="text-2xl font-black text-slate-800 tracking-tight font-mono">
                  {biStats.totalHoursAll.toFixed(1).replace('.0', '')}h
                </span>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="bg-white border border-slate-200 rounded-[24px] p-5 shadow-xs flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-inner">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Colaboradores Distintos</span>
                <span className="text-2xl font-black text-slate-800 tracking-tight font-mono">
                  {biStats.activeWorkersCount}
                </span>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="bg-white border border-slate-200 rounded-[24px] p-5 shadow-xs flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-[#3a2573] flex items-center justify-center border border-purple-100 shadow-inner">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Folhas de Previsão</span>
                <span className="text-2xl font-black text-slate-800 tracking-tight font-mono">
                  {biStats.totalFormsCount}
                </span>
              </div>
            </div>
          </div>

          {biSourceList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-[24px] p-12 text-center text-slate-400 text-xs font-bold uppercase tracking-wider shadow-xs">
              Sem dados para visualização. Salve uma Previsão de Horas primeiro.
            </div>
          ) : (
            <>
              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Colaboradores (BarChart) */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[24px] p-6 shadow-xs flex flex-col h-[380px]">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-[#3a2573]" />
                      Top Colaboradores (Soma de Horas Extras)
                    </h3>
                    <span className="text-[10px] font-bold text-slate-500 font-sans">Top 10 colaboradores</span>
                  </div>
                  <div className="flex-grow w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={biStats.topColabData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fill: '#334155', fontSize: 8, fontWeight: 'bold' }} stroke="#cbd5e1" />
                        <YAxis tick={{ fill: '#334155', fontSize: 10, fontWeight: 'bold' }} stroke="#cbd5e1" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          labelStyle={{ color: '#0f172a', fontWeight: 'bold', fontSize: 11 }}
                        />
                        <Bar dataKey="Horas" fill="#2563eb" radius={[4, 4, 0, 0]}>
                          {biStats.topColabData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? '#3a2573' : index % 2 === 0 ? '#10b981' : '#f97316'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Distribuição de Tipo (PieChart) */}
                <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-xs flex flex-col h-[380px]">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <PieIcon className="w-4 h-4 text-[#3a2573]" />
                      Distribuição de Tipo
                    </h3>
                    <span className="text-[10px] font-bold text-slate-500 font-sans">Proporção 50% vs 100%</span>
                  </div>
                  <div className="flex-grow w-full relative">
                    <ResponsiveContainer width="100%" height="80%">
                      <PieChart>
                        <Pie
                          data={biStats.pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {biStats.pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    
                    {/* Pie Legends */}
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center space-x-4 text-[10px] font-bold text-slate-600 font-sans">
                      {biStats.pieData.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span>{item.name}: {item.value}h</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tendência Diária (LineChart) */}
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-xs flex flex-col h-[320px]">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#3a2573]" />
                    Tendência Diária de Horas Extras (Evolução de Horas)
                  </h3>
                  <span className="text-[10px] font-bold text-slate-500 font-sans">Linha de Evolução</span>
                </div>
                <div className="flex-grow w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={biStats.trendData} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fill: '#334155', fontSize: 10, fontWeight: 'bold' }} stroke="#cbd5e1" />
                      <YAxis tick={{ fill: '#334155', fontSize: 10, fontWeight: 'bold' }} stroke="#cbd5e1" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ color: '#0f172a', fontWeight: 'bold', fontSize: 11 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 10, fontWeight: 'bold', color: '#475569' }} />
                      <Line
                        type="monotone"
                        dataKey="Horas Totais"
                        stroke="#eab308"
                        strokeWidth={3}
                        activeDot={{ r: 8 }}
                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Main Dual columns container */}
      <div className={`flex-grow max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 items-stretch print:p-0 print:m-0 ${activeTab !== 'form' ? 'hidden' : ''}`}>
        
        {/* Left Column - Form Editor Fields */}
        <div className="lg:w-5/12 space-y-6 flex flex-col print:hidden" id="print-left-editor">
          
          {/* Historical Database Manager Box */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
            <h4 className="text-[10px] font-black text-[#3a2573] uppercase tracking-widest mb-3 border-b border-slate-100 pb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-500" />
                <span>Histórico de Fichas Geradas</span>
              </span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-150 px-2.5 py-0.5 rounded-full font-sans font-black text-[8.5px] uppercase tracking-wider animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                <span>Sincronizado</span>
              </span>
            </h4>
            
            {/* Search Input */}
            <div className="mb-3">
              <input
                type="text"
                placeholder="🔍 Buscar por data, centro ou responsável..."
                value={dbSearchQuery}
                onChange={(e) => setDbSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:bg-white focus:border-[#3a2573] outline-hidden font-medium text-slate-700 shadow-3xs transition-all"
              />
            </div>

            {filteredSupabaseForms.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                Nenhum relatório encontrado no histórico.
              </div>
            ) : (
              <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white shadow-4xs">
                <div className="max-h-[190px] overflow-y-auto pr-1" id="history-scrollbar">
                  <table className="w-full text-left border-collapse table-fixed text-[10px]">
                    <thead className="bg-slate-50 border-b border-slate-150 text-slate-500 font-bold uppercase text-[8px] sticky top-0 z-10">
                      <tr>
                        <th className="py-2 px-2.5 w-[20%]">Data</th>
                        <th className="py-2 px-2 w-[22%]">Responsável</th>
                        <th className="py-2 px-2 w-[18%]">C. Custo</th>
                        <th className="py-2 px-2 w-[20%]">Criado Por</th>
                        <th className="py-2 px-2 w-[20%]">Última Alteração</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSupabaseForms.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => handleLoadSupabaseForm(item)}
                          className={`cursor-pointer transition-all hover:bg-[#3a2573]/5 ${
                            currentDraftId === item.id 
                              ? 'bg-[#3a2573]/5 font-bold text-[#3a2573]' 
                              : 'text-slate-700'
                          }`}
                        >
                          <td className="py-2 px-2.5 font-mono truncate font-semibold">
                            {item.dt_prev_execucao || item.dtPrevExecucao || item.data_solicitacao || item.dataSolicitacao || '---'}
                          </td>
                          <td className="py-2 px-2 truncate uppercase text-[9px]">
                            {item.responsavel || '---'}
                          </td>
                          <td className="py-2 px-2 truncate uppercase text-[9px] font-medium text-slate-500">
                            {item.centro_custo || item.centroCusto || '---'}
                          </td>
                          <td className="py-2 px-2 truncate uppercase text-[9px] font-medium text-slate-600">
                            {item.criado_por || 'SISTEMA'}
                          </td>
                          <td className="py-2 px-2 truncate uppercase text-[9px]">
                            {item.atualizado_por ? (
                              <span className="text-indigo-600 font-bold">{item.atualizado_por}</span>
                            ) : (
                              <span className="text-slate-400 font-medium italic text-[8.5px]">SEM ALTERAÇÃO</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Core Fields Form Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4 flex-grow">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2.5 flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cmpc-purple" />
              <span>Campos de Cabeçalho & Justificativa</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">DATA DA SOLICITAÇÃO</label>
                <input
                  type="text"
                  value={dataSolicitacao}
                  onChange={(e) => setDataSolicitacao(e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-[#3a2573] outline-hidden text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">DT. PREV. EXECUÇÃO</label>
                <input
                  type="text"
                  value={dtPrevExecucao}
                  onChange={(e) => setDtPrevExecucao(e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-[#3a2573] outline-hidden text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">HORA DE INÍCIO</label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-[#3a2573] outline-hidden text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">HORA DE FIM</label>
                <input
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-[#3a2573] outline-hidden text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">RESPONSÁVEL</label>
                <input
                  type="text"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-[#3a2573] outline-hidden text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">CENTRO DE CUSTO</label>
              <input
                type="text"
                value={centroCusto}
                onChange={(e) => setCentroCusto(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-[#3a2573] outline-hidden text-slate-800"
              />
            </div>

            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">JUSTIFICATIVA SOLICITAÇÃO</label>
              <textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-[#3a2573] outline-hidden font-sans leading-relaxed text-slate-800"
                placeholder="Insira as justificativas..."
              />
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-3">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1.5">TIPO DE HORA EXTRA *</label>
                <div className="flex items-center space-x-4">
                  <label className="inline-flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoHora"
                      value="50%"
                      checked={tipoHora === '50%'}
                      onChange={() => setTipoHora('50%')}
                      className="w-4 h-4 text-cmpc-purple border-slate-300 focus:ring-cmpc-purple"
                    />
                    <span className="text-xs font-bold text-slate-700">50% (2h fixas)</span>
                  </label>
                  <label className="inline-flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoHora"
                      value="100%"
                      checked={tipoHora === '100%'}
                      onChange={() => setTipoHora('100%')}
                      className="w-4 h-4 text-cmpc-purple border-slate-300 focus:ring-cmpc-purple"
                    />
                    <span className="text-xs font-bold text-slate-700">100% (Calculado)</span>
                  </label>
                </div>
              </div>

              {/* Feedback Visual do Cálculo Automático */}
              <div className="bg-emerald-50 border border-emerald-250 rounded-xl p-3 flex items-center justify-between shadow-3xs">
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  Cálculo automático:
                </span>
                <span className="text-xs font-black text-emerald-700 font-mono">
                  {formatFriendlyHours(horasPorColaborador)} por colaborador
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">PREVISÃO H.E. / % (CÁLCULO AUTOMÁTICO)</label>
                <input
                  type="text"
                  value={previsaoHe}
                  readOnly
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 cursor-not-allowed select-none"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 font-sans">OBSERVAÇÕES (OPCIONAL)</label>
                <input
                  type="text"
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-[#3a2573] outline-hidden text-slate-800"
                  placeholder="Nenhuma..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">RESP. PREENCHIMENTO</label>
                <input
                  type="text"
                  value={responsavelPreenchimento}
                  onChange={(e) => setResponsavelPreenchimento(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-[#3a2573] outline-hidden text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">GESTOR AUTORIZADOR</label>
                <input
                  type="text"
                  value={gestorAutorizador}
                  onChange={(e) => setGestorAutorizador(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-[#3a2573] outline-hidden text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Add Workers to list Form */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2 flex items-center space-x-1.5">
              <UserPlus className="w-4 h-4 text-[#3a2573]" />
              <span>Inserir Funcionário ({workers.length}/31)</span>
            </h3>

            <form onSubmit={handleAddWorker} className="space-y-3">
              <div className="relative">
                <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">COLABORADOR (BUSCAR / SUGERIR)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={colaboradorQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setColaboradorQuery(val);
                      setNewName(val);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setShowSuggestions(false)}
                    placeholder="Digite para buscar funcionário..."
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:border-[#3a2573] focus:ring-1 focus:ring-[#3a2573] outline-hidden font-bold text-slate-700"
                  />
                  {colaboradorQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setColaboradorQuery('');
                        setNewName('');
                        setNewCargo('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 font-bold text-[10px]"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {showSuggestions && (
                  <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                    {(() => {
                      const filtered = PRE_REGISTERED_EMPLOYEES.filter(emp =>
                        emp.name.toLowerCase().includes(colaboradorQuery.toLowerCase()) ||
                        emp.cargo.toLowerCase().includes(colaboradorQuery.toLowerCase())
                      );

                      if (filtered.length === 0) {
                        return (
                          <div className="p-2 text-[10px] text-slate-400 font-medium">
                            Nenhum resultado encontrado. Pode digitar manualmente!
                          </div>
                        );
                      }

                      return filtered.map((emp, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onMouseDown={() => {
                            setColaboradorQuery(emp.name);
                            setNewName(emp.name);
                            setNewCargo(emp.cargo);
                            setShowSuggestions(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-[#3a2573]/10 text-slate-600 font-bold transition-colors border-b border-slate-50 last:border-b-0 flex justify-between items-center"
                        >
                          <span>{emp.name}</span>
                          <span className="text-[8px] text-[#3a2573] bg-[#3a2573]/5 px-1 py-0.2 rounded font-black uppercase">
                            {emp.cargo}
                          </span>
                        </button>
                      ));
                    })()}
                  </div>
                )}
                <p className="text-[8px] text-slate-400 mt-1">
                  Digite para filtrar automaticamente ou continue escrevendo para digitar manualmente.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">ATIVIDADE (ATV)</label>
                  <input
                    type="text"
                    value={newAtv}
                    onChange={(e) => setNewAtv(e.target.value)}
                    placeholder="Ex: SEPARAÇÃO"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:border-[#3a2573] outline-hidden text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">CARGO</label>
                  <input
                    type="text"
                    value={newCargo}
                    onChange={(e) => setNewCargo(e.target.value)}
                    placeholder="Ex: ALMOXARIFE"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:border-[#3a2573] outline-hidden text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">NOME COMPLETO</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nome do colaborador"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:border-[#3a2573] outline-hidden font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">PROVEDOR</label>
                  <input
                    type="text"
                    value={newProvedor}
                    onChange={(e) => setNewProvedor(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:border-[#3a2573] outline-hidden text-slate-800"
                  />
                </div>
              </div>

              {editingWorkerIndex !== null ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] py-2 rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-3xs uppercase tracking-wider"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Atualizar Item</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWorkerIndex(null);
                      setNewAtv('');
                      setNewName('');
                      setNewCargo('');
                      setNewProvedor('CMPC');
                      setColaboradorQuery('');
                    }}
                    className="w-full bg-slate-400 hover:bg-slate-500 text-white font-bold text-[10px] py-2 rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-3xs uppercase tracking-wider"
                  >
                    <span>Cancelar</span>
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  className="w-full bg-[#4b4c59] hover:bg-slate-700 text-white font-bold text-[10px] py-2 rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-3xs uppercase tracking-wider"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar na Tabela</span>
                </button>
              )}
            </form>

            {/* List with deletion of currently added */}
            {workers.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-[160px] overflow-y-auto">
                <table className="w-full text-[10px] text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[8px]">
                    <tr>
                      <th className="py-1 px-2 text-left">NOME</th>
                      <th className="py-1 px-2 text-center w-20">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {workers.map((person, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-2">
                          <p className="font-bold text-slate-800">{idx + 1}. {person.name}</p>
                          <p className="text-[8px] text-slate-400 capitalize">{person.atv} | {person.cargo}</p>
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditWorker(idx)}
                              className="text-[#4b4c59] hover:text-[#3a2573] hover:bg-[#3a2573]/10 p-1.5 rounded-md transition-colors cursor-pointer"
                              title="Editar funcionário"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveWorker(idx)}
                              className="text-[#4b4c59] hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-md transition-colors cursor-pointer"
                              title="Remover funcionário"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - A4 Sheet Live Preview */}
        <div className="lg:w-7/12 flex flex-col items-center print:w-full print:p-0" id="print-right-preview">
          
          {/* Virtual Floating Toast when Saved */}
          {showSavedToast && (
            <div className="fixed bottom-6 right-6 bg-[#3a2573] text-white px-5 py-3.5 rounded-2xl shadow-xl z-50 flex items-center space-x-2 border border-[#3a2573]/30 font-sans text-xs font-bold animate-bounce print:hidden">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Formulário salvo nos rascunhos locais com sucesso!</span>
            </div>
          )}

          {/* Frame representing physical paper page size */}
          <div className="bg-white border border-slate-350 shadow-xl p-5 md:p-8 w-full max-w-[820px] aspect-[1/1.414] mx-auto text-black relative select-text custom-sheet print:border-none print:shadow-none print:p-0">
            
            {/* Outline Document Wrapper mimicking exact CMPC industrial design */}
            <div className="border-[1.5px] border-black h-full flex flex-col p-4">
              
              {/* Core header of PDF container */}
              <div className="border border-black grid grid-cols-12 mb-3">
                
                {/* 1. Left CMPC branding */}
                <div className="col-span-3 border-r border-black p-2.5 bg-white" id="cmpc-branding-blank">
                  {/* Blank branding box as requested */}
                </div>

                {/* 2. Middle Form type */}
                <div className="col-span-6 border-r border-black p-2 flex flex-col justify-center items-center text-center">
                  <h2 className="font-sans font-bold text-sm md:text-base leading-snug tracking-tight text-slate-900 uppercase">
                    Formulário de Solicitação de Serviço Extraordinário
                  </h2>
                </div>

                {/* 3. Right SGI and numbering codes */}
                <div className="col-span-3 text-[8px] font-mono flex flex-col h-full bg-white justify-between">
                  {/* SGI design icon section */}
                  <div className="p-1 border-b border-black flex items-center justify-between">
                    <span className="font-bold text-[7px] text-[#4b4c59]">SISTEMA SGI</span>
                    {/* Subtle micro branding for template match */}
                    <div className="w-5 h-3 bg-[#3a2573] rounded-xs flex items-center justify-center">
                      <span className="text-[5px] text-white font-black">CMPC</span>
                    </div>
                  </div>
                  <div className="p-1.5 flex flex-col space-y-0.5 justify-center flex-grow">
                    <div className="flex justify-between">
                      <span className="font-bold">DOC. Nº:</span>
                      <span className="font-normal font-sans">CMPC-FOR-0242</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">DATA:</span>
                      <span className="font-normal font-sans">01/08/2025</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">REVISÃO:</span>
                      <span className="font-normal font-sans">00</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Form Metadata Fields Layout */}
              <div className="border border-black text-[9px] grid grid-cols-12 mb-3 bg-white divide-x divide-black">
                <div className="col-span-4 p-2 flex flex-col justify-between h-11">
                  <span className="font-bold uppercase tracking-wider text-[8px] text-slate-500">DATA DA SOLICITAÇAO:</span>
                  <span className="font-mono text-[10px] font-bold text-slate-800">{dataSolicitacao || dataDeHoje}</span>
                </div>
                <div className="col-span-4 p-2 flex flex-col justify-between h-11">
                  <span className="font-bold uppercase tracking-wider text-[8px] text-slate-500">DT PREV. EXECUCAO:</span>
                  <span className="font-mono text-[10px] font-bold text-slate-800">{dtPrevExecucao}</span>
                </div>
                <div className="col-span-4 p-2 flex flex-col justify-between h-11">
                  <span className="font-bold uppercase tracking-wider text-[8px] text-slate-500">JORNADA PREVISTA:</span>
                  <span className="font-mono text-[10px] font-bold text-slate-800">{horaInicio} AS {horaFim}</span>
                </div>
              </div>

              <div className="border border-black text-[9px] grid grid-cols-12 mb-3 bg-white divide-x divide-black">
                <div className="col-span-6 p-2 flex flex-col justify-between h-11">
                  <span className="font-bold uppercase tracking-wider text-[8px] text-slate-500">CENTRO CUSTO :</span>
                  <span className="font-sans text-[10px] font-bold text-slate-800">{centroCusto}</span>
                </div>
                <div className="col-span-6 p-2 flex flex-col justify-between h-11">
                  <span className="font-bold uppercase tracking-wider text-[8px] text-slate-500">RESPONSÁVEL:</span>
                  <span className="font-sans text-[10px] font-bold text-slate-800">{responsavel}</span>
                </div>
              </div>

              {/* Justificativa wrapper */}
              <div className="border border-black text-[9px] grid grid-cols-12 mb-3 bg-white">
                <div className="col-span-12 p-2.5 min-h-[55px] flex flex-col justify-start">
                  <span className="font-bold uppercase tracking-wider text-[8px] text-slate-500 block mb-1">JUSTIFICATIVA:</span>
                  <p className="text-[9.5px] font-bold text-slate-800 leading-normal font-sans whitespace-pre-line uppercase select-text">
                    {justificativa || '(Nenhuma justificativa inserida)'}
                  </p>
                </div>
              </div>

              {/* Table of Workers Core Grid (31 total items) */}
              <div className="border border-black overflow-hidden flex-grow flex flex-col bg-white">
                <table className="w-full text-left border-collapse table-fixed text-[8.5px]">
                  <thead>
                    <tr className="bg-[#1e293b] text-white border-b border-black font-sans uppercase font-bold text-[8px]">
                      <th className="py-1.5 px-2 border-r border-black font-bold h-6 text-center w-12">ITEM</th>
                      <th className="py-1.5 px-2 border-r border-black font-bold text-center w-28">ATV</th>
                      <th className="py-1.5 px-3 border-r border-black font-bold">NOME COMPLETO DO FUNCIONÁRIO</th>
                      <th className="py-1.5 px-2 border-r border-black font-bold text-center w-36">CARGO</th>
                      <th className="py-1.5 px-2 font-bold text-center w-24">PROVEDOR / RESP CUSTO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black font-sans">
                    {/* Rendered registered workers */}
                    {workers.map((worker, index) => (
                      <tr key={index} className="hover:bg-slate-50 group relative">
                        <td className="py-1 px-1.5 text-center border-r border-black font-mono font-bold text-[8px] leading-tight">{index + 1}</td>
                        <td className="py-1 px-1.5 border-r border-black font-semibold uppercase break-words whitespace-normal text-[7.5px] leading-normal">{worker.atv}</td>
                        <td className="py-1 px-3 border-r border-black truncate font-bold text-slate-900 uppercase text-[8px] leading-tight">{worker.name}</td>
                        <td className="py-1 px-1.5 text-center border-r border-black truncate uppercase text-[8px] leading-tight">{worker.cargo}</td>
                        <td className="py-1 px-1.5 text-center truncate font-mono uppercase font-semibold text-[8px] leading-tight">{worker.provedor}</td>
                      </tr>
                    ))}

                    {/* Rendered trailing empty rows to maintain exactly 31 printed sheets slots */}
                    {Array.from({ length: blankRowsNeeded }).map((_, bIdx) => {
                      const itemNum = workers.length + bIdx + 1;
                      return (
                        <tr key={'blank_' + bIdx} className="h-5">
                          <td className="py-0.5 px-1.5 text-center border-r border-black font-mono text-slate-350">{itemNum}</td>
                          <td className="py-0.5 px-1.5 border-r border-black"></td>
                          <td className="py-0.5 px-3 border-r border-black"></td>
                          <td className="py-0.5 px-1.5 border-r border-black"></td>
                          <td className="py-0.5 px-1.5"></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Observations & Prediction stats */}
              <div className="border-x border-b border-black grid grid-cols-12 bg-white p-2 text-[9px] items-center">
                <div className="col-span-8">
                  <span className="font-bold text-slate-500 uppercase text-[8px]">OBS: </span>
                  <span className="font-bold text-slate-800 font-sans">{obs || 'Nenhuma.'}</span>
                </div>
                <div className="col-span-4 text-right py-1">
                  <span className="font-mono font-black text-slate-900 text-[10px] bg-slate-50 border border-slate-300 px-3 py-1 rounded-sm uppercase tracking-wider block">
                    {previsaoHe}
                  </span>
                </div>
              </div>

              {/* Signature Areas Block */}
              <div className="border-x border-b border-black grid grid-cols-2 divide-x divide-black bg-white mt-auto h-20">
                <div className="flex flex-col justify-end h-full">
                  <div className="bg-[#1e293b] text-white text-center font-bold text-[8px] py-1.5 uppercase border-t border-black">
                    RESPONSAVEL PELO PREENCHIMENTO
                  </div>
                </div>
                <div className="flex flex-col justify-end h-full">
                  <div className="bg-[#1e293b] text-white text-center font-bold text-[8px] py-1.5 uppercase border-t border-black">
                    GESTOR AUTORIZADOR
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* Auxiliary print/save overlay warning */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 py-3 text-[10px] text-center print:hidden" id="extra-hours-footer-bar">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Wrench className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span>Use o botão "Imprimir / Salvar PDF" no menu superior para salvar o documento formatado em A4 como PDF corporativo oficial.</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            Desenvolvido por André Ramalho
          </div>
        </div>
      </footer>
    </div>
  );
}
