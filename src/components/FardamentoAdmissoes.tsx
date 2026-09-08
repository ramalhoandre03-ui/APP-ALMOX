import React, { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, 
  FileText, 
  Check, 
  CheckCircle, 
  Calendar, 
  Mail, 
  Search, 
  Users, 
  Printer, 
  Clock, 
  ArrowLeft, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Sparkles, 
  CheckSquare, 
  Square,
  Shield,
  Layers,
  Columns,
  Info,
  AlertTriangle,
  RefreshCw,
  Package,
  CheckCircle2,
  X,
  Pencil,
  Trash2,
  BarChart3,
  TrendingUp,
  Filter,
  CalendarRange,
  History
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { RhPendentesFlow } from './RhPendentesFlow';
import CpfMaskedView, { formatCpf } from './CpfMaskedView';

// Definition of Admission Interface
export interface AdmissionRecord {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  obra: string;
  data_agendamento: string; // YYYY-MM-DD
  hora_agendamento?: string; // HH:MM
  tamanhos: {
    camisa: string;
    calca: string;
    bota: string;
  };
  especificacoes: {
    cor_tecido: string;
    arco_eletrico: string; // 'Sim' | 'Não'
    tipo_calca: string;
    tipo_bota: string;
    email_tecnico?: string;
    hora_fardamento?: string;
  };
  kit_gerado: string | string[]; // Newline separated string or array of strings
  status: 'Aguardando RM' | 'RM Solicitada' | 'Agendado' | 'Fardado' | 'Aguardando Número RM' | 'Tratamento Almoxarifado' | 'Disponivel para Separar' | 'RM Reprovada' | 'Aguardando Fardamento' | 'Concluído' | 'Aguardando Reagendamento' | 'Concluído com Ressalva - Desistente' | string;
  numero_rm?: string;
  lote_id: string | null;
  status_lote?: string | null;
  created_at?: string;
  temp_local?: boolean; // Flag to indicate it is stored locally as fallback
  tipo_requisicao?: string;
  dt_solicitacao_rh?: string;
  dt_rm_atribuida?: string;
  dt_rm_aprovada?: string;
  dt_separado?: string;
  dt_fardado?: string;
  dt_reagendamento?: string;
  motivo_ressalva?: string;
  historico_eventos?: { data: string; etapa: string; detalhes: string; }[];
}

interface FardamentoAdmissoesProps {
  onBackToHub: () => void;
  allowedPins?: string[];
  fullAllowedPins?: any[];
}

// 1. Dicionários de Códigos Hardcoded do Catálogo Real CMPC
const DICIONARIO_BOTAS = {
  "Anti Torção": { "35":"16025", "36":"16026", "37":"16027", "38":"16028", "39":"16029", "40":"16030", "41":"16031", "42":"16032", "43":"16033", "44":"16036", "45":"16035", "46":"16244" },
  "Eletricista": { "35":"16049", "36":"16050", "37":"16051", "38":"16052", "39":"16053", "40":"16054", "41":"16055", "42":"16056", "43":"16057", "44":"16058", "45":"16059", "46":"16060", "47":"16061" }
};

const DICIONARIO_CAMISAS = {
  "Brim Cinza": { "2":"12749", "3":"12750", "4":"12751", "5":"12752", "6":"12753", "7":"12754", "8":"12755", "9":"15448" }
};

const DICIONARIO_CALCAS = {
  "Jeans": { "36":"15435", "38":"15436", "40":"15437", "42":"12724", "44":"15438", "46":"12726", "48":"15439", "50":"12728", "52":"12729", "54":"15440", "56":"12731", "60":"16242" },
  "Brim Cinza": { "36":"12706", "38":"15422", "40":"15423", "42":"15424", "52":"15429", "54":"15430", "56":"15431" }
};

// Mapeamentos de tamanho para códigos de camisa fallback se não estiver no dict de Brim Cinza
const getCamisaCode = (tipo: string, tamanho: string): string => {
  const dict = DICIONARIO_CAMISAS[tipo as keyof typeof DICIONARIO_CAMISAS];
  if (dict && dict[tamanho as keyof typeof dict]) {
    return dict[tamanho as keyof typeof dict];
  }
  const brimCinzaDict = DICIONARIO_CAMISAS["Brim Cinza"];
  if (brimCinzaDict && brimCinzaDict[tamanho as keyof typeof brimCinzaDict]) {
    return brimCinzaDict[tamanho as keyof typeof brimCinzaDict];
  }
  const fallbackMap: Record<string, string> = {
    "PP": "12748", "P": "12750", "M": "12751", "G": "12752", "GG": "12753", "XG": "12754", "XXG": "12755"
  };
  return fallbackMap[tamanho] || "12751";
};

// Mapeamentos de tamanho para códigos de calça fallback se não estiver no dict Jeans/Brim Cinza
const getCalcaCode = (tipo: string, tamanho: string): string => {
  const dict = DICIONARIO_CALCAS[tipo as keyof typeof DICIONARIO_CALCAS];
  if (dict && dict[tamanho as keyof typeof dict]) {
    return dict[tamanho as keyof typeof dict];
  }
  const fallbackMap: Record<string, string> = {
    "36": "12706", "38": "15422", "40": "15423", "42": "15424", "44": "15425", "46": "15426", "48": "15427", "50": "15428", "52": "15429", "54": "15430", "56": "15431", "60": "16242"
  };
  return fallbackMap[tamanho] || "15437";
};

const getBotaCode = (tipo: string, tamanho: string): string => {
  const dict = DICIONARIO_BOTAS[tipo as keyof typeof DICIONARIO_BOTAS];
  if (dict && dict[tamanho as keyof typeof dict]) {
    return dict[tamanho as keyof typeof dict];
  }
  return "16030";
};

// 2. Motor de Geração do Kit Completo (Dicionário Exato)
const compileKit = (
  cargo: string,
  tipoCamisa: string,
  tamanhoCamisa: string,
  tipoCalca: string,
  tamanhoCalca: string,
  tipoBota: string,
  tamanhoBota: string
): string[] => {
  const c = cargo.trim().toUpperCase();
  const list: string[] = [];

  // Fardamento e Bota (Interpolação de escolhas e dicionário)
  const camisaCode = getCamisaCode(tipoCamisa, tamanhoCamisa);
  const calcaCode = getCalcaCode(tipoCalca, tamanhoCalca);
  const botaCode = getBotaCode(tipoBota, tamanhoBota);

  // Clothing item names formatted elegantly
  const camisaDesc = tipoCamisa.toUpperCase().includes("BRIM") ? tipoCamisa.toUpperCase() : `BRIM ${tipoCamisa.toUpperCase()}`;
  const calcaDesc = tipoCalca.toUpperCase().includes("BRIM") ? tipoCalca.toUpperCase() : tipoCalca.toUpperCase();

  list.push(`2 UN - Cód ${camisaCode} - CAMISA ${camisaDesc} TAM ${tamanhoCamisa}`);
  list.push(`2 UN - Cód ${calcaCode} - CALCA ${calcaDesc} TAM ${tamanhoCalca}`);
  list.push(`1 UN - Cód ${botaCode} - BOTA ${tipoBota.toUpperCase()} TAM ${tamanhoBota}`);

  // EPIs Fixos
  list.push(`2 UN - Cód 12779 - CAPUZ COM PROTECAO QUIMICA`);
  list.push(`1 UN - Cód 7328 - OCULOS AMPLA VISAO`);
  list.push(`1 UN - Cód 14288 - PROTETOR AUDITIVO CONCHA`);

  // Regra do Capacete
  if (c.includes('TST') || c.includes('SEGURANÇA')) {
    list.push(`1 UN - Cód 7261 - CAPACETE VERDE`);
    list.push(`1 UN - Cód 7285 - JUGULAR`);
  } else {
    list.push(`1 UN - Cód 7253 - CAPACETE AMARELO`);
  }

  // Regra do Protetor Facial
  if (c.includes('ELETRICISTA')) {
    list.push(`1 UN - Cód 14188 - PROTETOR FACIAL V-GARD`);
  } else {
    list.push(`1 UN - Cód 7338 - PROTETOR FACIAL 3M V2C`);
  }

  return list;
};

// Conversor seguro de Kit de qualquer formato (String ou Array) para Array de strings
const getKitList = (kit: any): string[] => {
  if (!kit) return [];
  if (Array.isArray(kit)) return kit;
  try {
    const parsed = JSON.parse(kit);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}
  return String(kit).split('\n').filter(line => line.trim() !== '');
};

/**
 * Extrai apenas os 3 últimos números do CPF e dígitos verificadores (Ex: 123.456.789-00 -> 789-00)
 */
export const getFinalCpf = (cpfStr: string): string => {
  if (!cpfStr) return '';
  const digits = cpfStr.replace(/\D/g, '');
  if (digits.length >= 5) {
    return `${digits.slice(-5, -2)}-${digits.slice(-2)}`;
  }
  return cpfStr;
};

/**
 * Formata data para DD/MM/YYYY
 */
export const formatDateDDMMYYYY = (dateStr?: string | null): string => {
  if (!dateStr) return new Date().toLocaleDateString('pt-BR');
  try {
    const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = cleanStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return String(dateStr);
  } catch {
    return String(dateStr);
  }
};

// Default list of project sites as fallback
const DEFAULT_SITES = [
  'CMPC Industrial - Área 1',
  'CMPC Industrial - Área 2',
  'CMPC Industrial - Área Pelotização',
  'Frente Guaíba',
  'Frente Barra do Ribeiro',
  'Oficina Central'
];

// Format timestamp beautifully in Brazilian Portuguese
const formatTimestamp = (isoString?: string) => {
  if (!isoString) return 'N/A';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'N/A';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} às ${hours}:${minutes}`;
  } catch {
    return 'N/A';
  }
};

// Calculate Lead Time / SLA in days and hours
const calculateLeadTime = (startStr?: string, endStr?: string) => {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return "0h";
  
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHrs < 24) {
    return `${diffHrs}h`;
  }
  
  const diffDays = Math.floor(diffHrs / 24);
  const remainingHrs = diffHrs % 24;
  return remainingHrs > 0 ? `${diffDays}d ${remainingHrs}h` : `${diffDays}d`;
};

// Format date nicely as DD/MM/YYYY
const formatDateOnly = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  if (dateStr.includes('-') && dateStr.length === 10) {
    return dateStr.split('-').reverse().join('/');
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return 'N/A';
  }
};

// Format full datetime as DD/MM/YYYY HH:mm:ss
const formatDateTimeFull = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hrs = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hrs}:${mins}:${secs}`;
  } catch {
    return 'N/A';
  }
};

export interface LoteAdmissaoColaborador {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  obra: string;
  status: 'pendente' | 'concluido';
  tamanho_camisa?: string;
  tamanho_calca?: string;
  tamanho_bota?: string;
  tipo_camisa?: string;
  tipo_calca?: string;
  tipo_bota?: string;
}

const mapLoteToAdmissions = (lote: LoteAdmissaoColaborador[], dataAgendamentoLote: string): AdmissionRecord[] => {
  const nowStr = new Date().toISOString();
  return lote.map((colab, idx) => {
    const finalKit = compileKit(
      colab.cargo,
      colab.tipo_camisa || 'Brim Cinza',
      colab.tamanho_camisa || '3',
      colab.tipo_calca || 'Jeans',
      colab.tamanho_calca || '40',
      colab.tipo_bota || 'Anti Torção',
      colab.tamanho_bota || '40'
    );
    return {
      id: `lote_temp_${idx}`,
      nome: colab.nome.trim().toUpperCase(),
      cpf: colab.cpf.trim(),
      cargo: colab.cargo.trim().toUpperCase(),
      obra: colab.obra.trim(),
      data_agendamento: dataAgendamentoLote || new Date().toISOString().split('T')[0],
      tamanhos: {
        camisa: colab.tamanho_camisa || '3',
        calca: colab.tamanho_calca || '40',
        bota: colab.tamanho_bota || '40'
      },
      especificacoes: {
        cor_tecido: colab.tipo_camisa || 'Brim Cinza',
        arco_eletrico: (colab.tipo_camisa || 'Brim Cinza') === 'Anti Chama' ? 'Sim' : 'Não',
        tipo_calca: colab.tipo_calca || 'Jeans',
        tipo_bota: colab.tipo_bota || 'Anti Torção',
        email_tecnico: ''
      },
      kit_gerado: finalKit,
      status: 'Aguardando RM',
      created_at: nowStr,
      tipo_requisicao: 'Admissão',
      dt_solicitacao_rh: nowStr,
      lote_id: null,
      historico_eventos: [
        {
          data: nowStr,
          etapa: 'Solicitação Criada',
          detalhes: `Solicitação criada em lote via Excel`
        }
      ]
    };
  });
};

const isDataValida = (dataString?: string | null) => {
  if (!dataString) return false;
  const str = String(dataString);
  return !str.includes('10000') && !str.includes('9999') && !str.includes('1970');
};

export default function FardamentoAdmissoes({ onBackToHub }: FardamentoAdmissoesProps) {
  const { session } = useAuth();
  
  const userPerfil = useMemo(() => {
    if (!session?.perfil) return null;
    const p = session.perfil.toUpperCase();
    if (p === 'ADMINISTRADOR' || p === 'ADMIN') return 'ADMIN';
    if (p === 'ALMOXARIFADO') return 'ALMOXARIFADO';
    if (p === 'OPERAÇÃO' || p === 'RH') return 'RH';
    return null;
  }, [session]);

  // Append-only Event Log Helper
  const appendEventToRecord = (record: AdmissionRecord, etapa: string, detalhes: string) => {
    let existingEvents = record.historico_eventos || [];
    if (typeof existingEvents === 'string') {
      try {
        existingEvents = JSON.parse(existingEvents);
      } catch (e) {
        existingEvents = [];
      }
    }
    const list = Array.isArray(existingEvents) ? [...existingEvents] : [];
    list.push({
      data: new Date().toISOString(),
      etapa,
      detalhes
    });
    return list;
  };

  // Navigation / Tab Selection
  const [activeTab, setActiveTab] = useState<'rh' | 'almoxarifado' | 'historico' | 'bi'>('rh');
  const [expandedHistoryRowId, setExpandedHistoryRowId] = useState<string | null>(null);
  const [rhSubTab, setRhSubTab] = useState<'pendentes' | 'lotes_enviados'>('pendentes');

  // BI Dashboard Global Filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterObra, setFilterObra] = useState('Todos');
  const [filterRm, setFilterRm] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
    startDate: '',
    endDate: '',
    obra: 'Todos',
    rm: ''
  });
  
  // Real database connection vs localStorage contingency state
  const [usingFallback, setUsingFallback] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // RH Form States
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [timelineColaborador, setTimelineColaborador] = useState<AdmissionRecord | null>(null);
  const [cargo, setCargo] = useState('');
  const [obra, setObra] = useState('');
  const [dataAgendamento, setDataAgendamento] = useState('');
  const [emailTecnico, setEmailTecnico] = useState('');
  
  // Requisition Type & Troca Items State
  const [tipoRequisicao, setTipoRequisicao] = useState<'Admissão' | 'Troca'>('Admissão');
  const [trocaItems, setTrocaItems] = useState<{
    camisa: { checked: boolean; tipo: string; tamanho: string; qtd: number };
    calca: { checked: boolean; tipo: string; tamanho: string; qtd: number };
    bota: { checked: boolean; tipo: string; tamanho: string; qtd: number };
    capuz: { checked: boolean; qtd: number };
    oculos: { checked: boolean; qtd: number };
    abafador: { checked: boolean; qtd: number };
    capaceteAmarelo: { checked: boolean; qtd: number };
    capaceteVerde: { checked: boolean; qtd: number };
    jugular: { checked: boolean; qtd: number };
    facialVGard: { checked: boolean; qtd: number };
    facial3M: { checked: boolean; qtd: number };
  }>({
    camisa: { checked: false, tipo: 'Brim Cinza', tamanho: '3', qtd: 1 },
    calca: { checked: false, tipo: 'Jeans', tamanho: '40', qtd: 1 },
    bota: { checked: false, tipo: 'Anti Torção', tamanho: '40', qtd: 1 },
    capuz: { checked: false, qtd: 1 },
    oculos: { checked: false, qtd: 1 },
    abafador: { checked: false, qtd: 1 },
    capaceteAmarelo: { checked: false, qtd: 1 },
    capaceteVerde: { checked: false, qtd: 1 },
    jugular: { checked: false, qtd: 1 },
    facialVGard: { checked: false, qtd: 1 },
    facial3M: { checked: false, qtd: 1 },
  });
  
  // Size & Type selection
  const [tipoCamisa, setTipoCamisa] = useState('Brim Cinza');
  const [tamanhoCamisa, setTamanhoCamisa] = useState('3');
  const [tipoCalca, setTipoCalca] = useState('Jeans');
  const [tamanhoCalca, setTamanhoCalca] = useState('40');
  const [tipoBota, setTipoBota] = useState('Anti Torção');
  const [tamanhoBota, setTamanhoBota] = useState('40');

  // Batch states
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [selectedSeparacaoIds, setSelectedSeparacaoIds] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [activeModalGroupKey, setActiveModalGroupKey] = useState<string | null>(null);
  const [isReemittingBatch, setIsReemittingBatch] = useState(false);
  const [selectedAguardandoRmIds, setSelectedAguardandoRmIds] = useState<string[]>([]);
  const [inputNumeroRm, setInputNumeroRm] = useState('');
  
  // Pending RM batches / groups
  const [pendingRmLotes, setPendingRmLotes] = useState<string[][]>(() => {
    try {
      const saved = localStorage.getItem('sgi_lotes_pendentes_rm');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // State to hold the text inputs for each batch's RM number
  const [batchRmInputs, setBatchRmInputs] = useState<Record<string, string>>({});
  const [almoxarifadoViewMode, setAlmoxarifadoViewMode] = useState<'rm_group' | 'kanban'>('kanban');

  // RH Lote Excel Flow states
  const [rhFlowMode, setRhFlowMode] = useState<'menu' | 'manual_admissao' | 'manual_troca' | 'lote_excel'>('menu');
  const [loteAdmissao, setLoteAdmissao] = useState<LoteAdmissaoColaborador[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dataAgendamentoLote, setDataAgendamentoLote] = useState('');
  const [isViewingBatchFromExcel, setIsViewingBatchFromExcel] = useState(false);

  // Duplicate CPF Modal state and helper for batch/admission lock
  const [duplicateModal, setDuplicateModal] = useState<{
    isOpen: boolean;
    message: string;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirmDuplicateAction = (message: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      try {
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          const result = window.confirm(message);
          return resolve(result);
        }
      } catch {
        // Fallback to React modal if window.confirm is not available or blocked
      }
      setDuplicateModal({
        isOpen: true,
        message,
        resolve
      });
    });
  };

  const handleResolveDuplicateModal = (proceed: boolean) => {
    if (duplicateModal?.resolve) {
      duplicateModal.resolve(proceed);
    }
    setDuplicateModal(null);
  };

  const firstSelectedRecordForBatch = admissions.find(i => selectedBatchIds.includes(i.id));

  const selectedRecordsForModal = useMemo(() => {
    return isViewingBatchFromExcel ? mapLoteToAdmissions(loteAdmissao, dataAgendamentoLote) : admissions.filter(rec => selectedBatchIds.includes(rec.id));
  }, [isViewingBatchFromExcel, loteAdmissao, dataAgendamentoLote, selectedBatchIds, admissions]);

  const modalGroups = useMemo(() => {
    return selectedRecordsForModal.reduce((acc, record) => {
      const key = `${record.obra}_${record.data_agendamento}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(record);
      return acc;
    }, {} as Record<string, AdmissionRecord[]>);
  }, [selectedRecordsForModal]);

  const modalGroupKeys = useMemo(() => {
    return Object.keys(modalGroups);
  }, [modalGroups]);

  useEffect(() => {
    if (showBatchModal && modalGroupKeys.length > 0) {
      if (!activeModalGroupKey || !modalGroupKeys.includes(activeModalGroupKey)) {
        setActiveModalGroupKey(modalGroupKeys[0]);
      }
    } else {
      setActiveModalGroupKey(null);
    }
  }, [showBatchModal, modalGroupKeys, activeModalGroupKey]);

  const handleExcelUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);
        
        if (!jsonData || jsonData.length === 0) {
          showToast('Nenhum dado encontrado no arquivo Excel.', 'error');
          return;
        }

        const mappedList: LoteAdmissaoColaborador[] = jsonData.map((row: any, idx: number) => {
          const upperRow: Record<string, any> = {};
          Object.keys(row).forEach(k => {
            upperRow[k.trim().toUpperCase()] = row[k];
          });

          const nome = upperRow['NOME'] || upperRow['NOME COMPLETO'] || upperRow['COLABORADOR'] || upperRow['FUNCIONÁRIO'] || upperRow['FUNCIONARIO'] || '';
          const cpf = upperRow['CPF'] || upperRow['DOCUMENTO'] || '';
          const obra = upperRow['OBRA'] || upperRow['FRENTE'] || upperRow['FRENTE DE TRABALHO'] || upperRow['LOCAL'] || '';
          const cargo = upperRow['FUNÇÃO'] || upperRow['FUNCAO'] || upperRow['CARGO'] || '';

          return {
            id: `lote_${Date.now()}_${idx}`,
            nome: String(nome).trim().toUpperCase(),
            cpf: String(cpf).trim(),
            obra: String(obra).trim(),
            cargo: String(cargo).trim().toUpperCase(),
            status: 'pendente' as const,
            tamanho_camisa: '3',
            tamanho_calca: '40',
            tamanho_bota: '40',
            tipo_camisa: 'Brim Cinza',
            tipo_calca: 'Jeans',
            tipo_bota: 'Anti Torção'
          };
        }).filter(colab => colab.nome !== '');

        if (mappedList.length === 0) {
          showToast('Nenhum colaborador válido com campo de Nome encontrado no Excel.', 'error');
          return;
        }

        setLoteAdmissao(mappedList);
        setSelectedIndex(0);
        
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setDataAgendamentoLote(tomorrow.toISOString().split('T')[0]);

        showToast(`${mappedList.length} colaboradores carregados com sucesso do Excel!`);
      } catch (err) {
        console.error("Erro ao processar arquivo Excel:", err);
        showToast('Falha ao processar arquivo Excel. Verifique a formatação.', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const selectedColab = loteAdmissao[selectedIndex] || null;

  const [loteCamisaSize, setLoteCamisaSize] = useState('3');
  const [loteCalcaSize, setLoteCalcaSize] = useState('40');
  const [loteBotaSize, setLoteBotaSize] = useState('40');
  const [loteCamisaType, setLoteCamisaType] = useState('Brim Cinza');
  const [loteCalcaType, setLoteCalcaType] = useState('Jeans');
  const [loteBotaType, setLoteBotaType] = useState('Anti Torção');

  useEffect(() => {
    if (selectedColab) {
      setLoteCamisaSize(selectedColab.tamanho_camisa || '3');
      setLoteCalcaSize(selectedColab.tamanho_calca || '40');
      setLoteBotaSize(selectedColab.tamanho_bota || '40');
      setLoteCamisaType(selectedColab.tipo_camisa || 'Brim Cinza');
      setLoteCalcaType(selectedColab.tipo_calca || 'Jeans');
      setLoteBotaType(selectedColab.tipo_bota || 'Anti Torção');
    }
  }, [selectedIndex, loteAdmissao]);

  const handleSaveAndNext = () => {
    if (!selectedColab) return;

    const updatedLote = loteAdmissao.map((colab, idx) => {
      if (idx === selectedIndex) {
        return {
          ...colab,
          tamanho_camisa: loteCamisaSize,
          tamanho_calca: loteCalcaSize,
          tamanho_bota: loteBotaSize,
          tipo_camisa: loteCamisaType,
          tipo_calca: loteCalcaType,
          tipo_bota: loteBotaType,
          status: 'concluido' as const
        };
      }
      return colab;
    });

    setLoteAdmissao(updatedLote);
    showToast(`Dados de ${selectedColab.nome} salvos!`);

    const nextPendenteIdx = updatedLote.findIndex((colab, idx) => idx > selectedIndex && colab.status === 'pendente');
    if (nextPendenteIdx !== -1) {
      setSelectedIndex(nextPendenteIdx);
    } else {
      const firstPendenteIdx = updatedLote.findIndex(colab => colab.status === 'pendente');
      if (firstPendenteIdx !== -1) {
        setSelectedIndex(firstPendenteIdx);
      } else {
        showToast('Todos os colaboradores do lote foram configurados! Pronto para gravar no sistema.');
      }
    }
  };

  const handleConcluirLote = async () => {
    const allCompleted = loteAdmissao.every(colab => colab.status === 'concluido');
    if (!allCompleted) {
      showToast('Apenas é possível concluir se todos os colaboradores do lote tiverem fardamentos definidos.', 'error');
      return;
    }

    const obrasUnicas = new Set(loteAdmissao.map(colab => (colab.obra || '').trim()));
    if (obrasUnicas.size > 1) {
      alert("OPERAÇÃO BLOQUEADA: Você selecionou colaboradores de obras diferentes. A regra de negócio exige que um lote/RM contenha apenas colaboradores do mesmo centro de custo.");
      return;
    }

    try {
      setIsViewingBatchFromExcel(true);
      setShowBatchModal(true);
    } catch (err) {
      console.error("Erro ao redirecionar lote:", err);
      showToast('Falha ao abrir visualização de RM.', 'error');
    }
  };

  // Scheduling Modal states
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedulingRmNumber, setSchedulingRmNumber] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // Ressalvas Modal states
  const [showRessalvasModal, setShowRessalvasModal] = useState(false);
  const [ressalvaRmNumber, setRessalvaRmNumber] = useState<string | null>(null);
  const [ressalvaType, setRessalvaType] = useState<'partial' | 'desistente' | 'outros'>('partial');
  const [selectedFardadosIds, setSelectedFardadosIds] = useState<string[]>([]);
  const [otherRessalvaText, setOtherRessalvaText] = useState('');

  // History Pagination & Search states
  const [historyPage, setHistoryPage] = useState(1);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Reagendamento / Reschedule states
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [showReagendarModal, setShowReagendarModal] = useState(false);
  const [reagendarDate, setReagendarDate] = useState('');
  const [reagendarTime, setReagendarTime] = useState('');
  const [reagendarIds, setReagendarIds] = useState<string[]>([]);

  // Kit generation state
  const [kitGerado, setKitGerado] = useState<string[]>([]);
  const [kitCompilado, setKitCompilado] = useState(false);

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');

  // Edit Mode state
  const [editingRecord, setEditingRecord] = useState<AdmissionRecord | null>(null);

  // Interactive separation modal
  const [selectedAdmissionForKit, setSelectedAdmissionForKit] = useState<AdmissionRecord | null>(null);
  const [checkedKitItems, setCheckedKitItems] = useState<Record<string, boolean>>({});

  // Notification Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Custom Confirmation Modal state for sandboxed iframe compatibility
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info' | 'success';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Helper function to format CPF
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    if (value.length > 14) {
      value = value.slice(0, 14);
    }
    setCpf(value);
  };

  // Active retroactive date check (passive validation)
  const isRetroactiveDate = useMemo(() => {
    if (!dataAgendamento) return false;
    const parts = dataAgendamento.split('-');
    if (parts.length !== 3) return false;
    
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const day = parseInt(parts[2], 10);
    
    const selected = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return selected.getTime() < today.getTime();
  }, [dataAgendamento]);

  // EPI kit generation logic (Required specifications)
  const kitGeradoEmTempoReal = useMemo(() => {
    return compileKit(
      cargo,
      tipoCamisa,
      tamanhoCamisa,
      tipoCalca,
      tamanhoCalca,
      tipoBota,
      tamanhoBota
    );
  }, [cargo, tipoCamisa, tamanhoCamisa, tipoCalca, tamanhoCalca, tipoBota, tamanhoBota]);

  // Load admissions from database or fallback localStorage
  const loadAdmissions = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      let todosOsDados: any[] = [];
      let inicio = 0;
      const pageSize = 1000;
      let temMais = true;
      let pageCount = 0;
      const maxPages = 15;

      while (temMais && pageCount < maxPages) {
        const { data: loteData, error: loteError } = await supabase
          .from('admissoes_fardamento')
          .select('*')
          .order('created_at', { ascending: false })
          .range(inicio, inicio + pageSize - 1);

        if (loteError) {
          throw loteError;
        }

        if (loteData && loteData.length > 0) {
          todosOsDados = [...todosOsDados, ...loteData];
          pageCount++;
          if (loteData.length < pageSize) {
            temMais = false;
          } else {
            inicio += pageSize;
          }
        } else {
          temMais = false;
        }
      }

      const data = todosOsDados;

      if (data) {
        // Parse database items if needed
        const parsed: AdmissionRecord[] = data.map((item: any) => {
          // Parse date and time
          const dateStr = item.data_agendamento || '';
          const hasTime = dateStr.includes(' ') || dateStr.includes('T');
          const datePart = hasTime ? dateStr.replace('T', ' ').split(' ')[0] : dateStr;
          const timePart = hasTime ? dateStr.replace('T', ' ').split(' ')[1] : '';

          let specs: any = {};
          if (item.especificacoes) {
            try {
              specs = typeof item.especificacoes === 'string' ? JSON.parse(item.especificacoes) : item.especificacoes;
            } catch (e) {
              console.error(e);
            }
          }

          let dbHora = item.hora_agendamento || specs.hora_fardamento || timePart || '';
          
          // Formatting fallback for time extraction to standard HH:mm
          if (dbHora) {
            try {
              if (dbHora.includes('T') || (dbHora.includes('-') && dbHora.includes(':'))) {
                const dateObj = new Date(dbHora);
                if (!isNaN(dateObj.getTime())) {
                  const hours = String(dateObj.getHours()).padStart(2, '0');
                  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                  dbHora = `${hours}:${minutes}`;
                }
              } else if (dbHora.includes(':')) {
                const parts = dbHora.split(':');
                if (parts.length >= 2) {
                  dbHora = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
                }
              }
            } catch (e) {
              console.error("Erro ao formatar hora_agendamento:", e);
            }
          }

          const hora_fardamento = dbHora;

          const especificacoesObj = {
            cor_tecido: item.tipo_camisa || specs.cor_tecido || '',
            arco_eletrico: item.tipo_camisa === 'Anti Chama' ? 'Sim' : (specs.arco_eletrico || 'Não'),
            tipo_calca: item.tipo_calca || specs.tipo_calca || '',
            tipo_bota: item.tipo_bota || specs.tipo_bota || '',
            email_tecnico: item.email_tecnico || specs.email_tecnico || '',
            hora_fardamento: hora_fardamento
          };

          let tamanhosObj = { camisa: '', calca: '', bota: '' };
          if (item.tamanhos) {
            try {
              tamanhosObj = typeof item.tamanhos === 'string' ? JSON.parse(item.tamanhos) : item.tamanhos;
            } catch (e) {
              console.error(e);
            }
          } else {
            tamanhosObj = {
              camisa: item.tamanho_camisa || '',
              calca: item.tamanho_calca || '',
              bota: item.tamanho_bota || ''
            };
          }

          return {
            id: String(item.id),
            nome: item.nome,
            cpf: item.cpf,
            cargo: item.cargo,
            obra: item.obra,
            data_agendamento: datePart,
            hora_agendamento: hora_fardamento,
            tamanhos: tamanhosObj,
            especificacoes: especificacoesObj,
            kit_gerado: (() => {
              if (!item.kit_gerado) return [];
              if (Array.isArray(item.kit_gerado)) return item.kit_gerado;
              if (typeof item.kit_gerado !== 'string') return item.kit_gerado;
              try {
                const parsedKit = JSON.parse(item.kit_gerado);
                return Array.isArray(parsedKit) ? parsedKit : [item.kit_gerado];
              } catch (e) {
                return item.kit_gerado.split('\n').filter(Boolean);
              }
            })(),
            status: (item.status === 'Aguardando RM' && !item.lote_id) ? 'Aguardando Lote' : (item.status === 'Aguardando RM' ? 'Aguardando Número RM' : item.status),
            status_lote: (item.status === 'Aguardando Lote' || (item.status === 'Aguardando RM' && !item.lote_id)) ? 'Aguardando Lote' : null,
            numero_rm: item.numero_rm,
            lote_id: item.lote_id || null,
            created_at: item.created_at,
            tipo_requisicao: item.tipo_requisicao || 'Admissão',
            dt_solicitacao_rh: item.dt_solicitacao_rh,
            dt_rm_atribuida: item.dt_rm_atribuida,
            dt_rm_aprovada: item.dt_rm_aprovada,
            dt_separado: item.dt_separado,
            dt_fardado: item.dt_fardado,
            dt_reagendamento: item.dt_reagendamento,
            motivo_ressalva: item.motivo_ressalva,
            historico_eventos: (() => {
              if (!item.historico_eventos) return [];
              if (Array.isArray(item.historico_eventos)) return item.historico_eventos;
              try {
                return typeof item.historico_eventos === 'string' ? JSON.parse(item.historico_eventos) : item.historico_eventos;
              } catch (e) {
                return [];
              }
            })()
          };
        });
        setAdmissions(parsed);
        setUsingFallback(false);
        setDbError(null);
      }
    } catch (err: any) {
      console.error("Supabase table 'admissoes_fardamento' is missing or inaccessible.", err);
      setUsingFallback(false);
      setDbError(err?.message || "Erro desconhecido ao conectar com o Supabase");
      setAdmissions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAdmissions();
  }, []);

  useEffect(() => {
    if (rhSubTab === 'lotes_enviados') {
      loadAdmissions(true);
    }
  }, [rhSubTab]);

  useEffect(() => {
    localStorage.setItem('sgi_lotes_pendentes_rm', JSON.stringify(pendingRmLotes));
  }, [pendingRmLotes]);

  // Save changes back to our persistence engine
  const saveAdmissionsToPersistence = async (newList: AdmissionRecord[]) => {
    setAdmissions(newList);
    if (usingFallback) {
      localStorage.setItem('sgi_admissoes_fardamento', JSON.stringify(newList));
    } else {
      // Just loaded in state, database calls will handle their individual updates
    }
  };

  const compileTrocaKit = (): string[] => {
    const list: string[] = [];
    if (trocaItems.camisa.checked) {
      const code = getCamisaCode(trocaItems.camisa.tipo, trocaItems.camisa.tamanho);
      const desc = trocaItems.camisa.tipo.toUpperCase().includes("BRIM") ? trocaItems.camisa.tipo.toUpperCase() : `BRIM ${trocaItems.camisa.tipo.toUpperCase()}`;
      list.push(`${trocaItems.camisa.qtd} UN - Cód ${code} - CAMISA ${desc} TAM ${trocaItems.camisa.tamanho}`);
    }
    if (trocaItems.calca.checked) {
      const code = getCalcaCode(trocaItems.calca.tipo, trocaItems.calca.tamanho);
      const desc = trocaItems.calca.tipo.toUpperCase().includes("BRIM") ? trocaItems.calca.tipo.toUpperCase() : trocaItems.calca.tipo.toUpperCase();
      list.push(`${trocaItems.calca.qtd} UN - Cód ${code} - CALCA ${desc} TAM ${trocaItems.calca.tamanho}`);
    }
    if (trocaItems.bota.checked) {
      const code = getBotaCode(trocaItems.bota.tipo, trocaItems.bota.tamanho);
      list.push(`${trocaItems.bota.qtd} UN - Cód ${code} - BOTA ${trocaItems.bota.tipo.toUpperCase()} TAM ${trocaItems.bota.tamanho}`);
    }
    if (trocaItems.capuz.checked) {
      list.push(`${trocaItems.capuz.qtd} UN - Cód 12779 - CAPUZ COM PROTECAO QUIMICA`);
    }
    if (trocaItems.oculos.checked) {
      list.push(`${trocaItems.oculos.qtd} UN - Cód 7328 - OCULOS AMPLA VISAO`);
    }
    if (trocaItems.abafador.checked) {
      list.push(`${trocaItems.abafador.qtd} UN - Cód 14288 - PROTETOR AUDITIVO CONCHA`);
    }
    if (trocaItems.capaceteAmarelo.checked) {
      list.push(`${trocaItems.capaceteAmarelo.qtd} UN - Cód 7253 - CAPACETE AMARELO`);
    }
    if (trocaItems.capaceteVerde.checked) {
      list.push(`${trocaItems.capaceteVerde.qtd} UN - Cód 7261 - CAPACETE VERDE`);
    }
    if (trocaItems.jugular.checked) {
      list.push(`${trocaItems.jugular.qtd} UN - Cód 7285 - JUGULAR`);
    }
    if (trocaItems.facialVGard.checked) {
      list.push(`${trocaItems.facialVGard.qtd} UN - Cód 14188 - PROTETOR FACIAL V-GARD`);
    }
    if (trocaItems.facial3M.checked) {
      list.push(`${trocaItems.facial3M.qtd} UN - Cód 7338 - PROTETOR FACIAL 3M V2C`);
    }
    return list;
  };

  const clearForm = () => {
    setNome('');
    setCpf('');
    setCargo('');
    // MANTENHA PREENCHIDOS os valores de data_agendamento e obra.
    setEmailTecnico('');
    setKitGerado([]);
    setKitCompilado(false);
    setTrocaItems({
      camisa: { checked: false, tipo: 'Brim Cinza', tamanho: '3', qtd: 1 },
      calca: { checked: false, tipo: 'Jeans', tamanho: '40', qtd: 1 },
      bota: { checked: false, tipo: 'Anti Torção', tamanho: '40', qtd: 1 },
      capuz: { checked: false, qtd: 1 },
      oculos: { checked: false, qtd: 1 },
      abafador: { checked: false, qtd: 1 },
      capaceteAmarelo: { checked: false, qtd: 1 },
      capaceteVerde: { checked: false, qtd: 1 },
      jugular: { checked: false, qtd: 1 },
      facialVGard: { checked: false, qtd: 1 },
      facial3M: { checked: false, qtd: 1 },
    });
  };

  // Create or Update Admission Submission
  const handleRegisterAdmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !cpf.trim() || !cargo.trim() || !dataAgendamento) {
      showToast('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    const finalKit = tipoRequisicao === 'Troca'
      ? compileTrocaKit()
      : compileKit(
          cargo,
          tipoCamisa,
          tamanhoCamisa,
          tipoCalca,
          tamanhoCalca,
          tipoBota,
          tamanhoBota
        );

    if (tipoRequisicao === 'Troca' && finalKit.length === 0) {
      showToast('Por favor, selecione pelo menos um item para a troca/reposição.', 'error');
      return;
    }

    const tamanhosObj = tipoRequisicao === 'Troca'
      ? {
          camisa: trocaItems.camisa.checked ? trocaItems.camisa.tamanho : '',
          calca: trocaItems.calca.checked ? trocaItems.calca.tamanho : '',
          bota: trocaItems.bota.checked ? trocaItems.bota.tamanho : ''
        }
      : {
          camisa: tamanhoCamisa,
          calca: tamanhoCalca,
          bota: tamanhoBota
        };

    const especificacoesObj = tipoRequisicao === 'Troca'
      ? {
          cor_tecido: trocaItems.camisa.checked ? trocaItems.camisa.tipo : '',
          arco_eletrico: trocaItems.camisa.checked && trocaItems.camisa.tipo === 'Anti Chama' ? 'Sim' : 'Não',
          tipo_calca: trocaItems.calca.checked ? trocaItems.calca.tipo : '',
          tipo_bota: trocaItems.bota.checked ? trocaItems.bota.tipo : '',
          email_tecnico: emailTecnico.trim()
        }
      : {
          cor_tecido: tipoCamisa,
          arco_eletrico: tipoCamisa === 'Anti Chama' ? 'Sim' : 'Não',
          tipo_calca: tipoCalca,
          tipo_bota: tipoBota,
          email_tecnico: emailTecnico.trim()
        };

    const textoCompletoDoKitComCodigos = finalKit.join('\n');

    if (editingRecord) {
      // Edit Mode
      try {
        if (!usingFallback) {
          const payload = { 
            nome: nome.trim().toUpperCase(), 
            cpf: cpf.trim(), 
            cargo: cargo.trim().toUpperCase(), 
            obra: obra, 
            data_agendamento: dataAgendamento,
            email_tecnico: emailTecnico.trim() || null,
            tipo_camisa: tipoRequisicao === 'Troca' ? (trocaItems.camisa.checked ? trocaItems.camisa.tipo : null) : tipoCamisa,
            tamanho_camisa: tipoRequisicao === 'Troca' ? (trocaItems.camisa.checked ? trocaItems.camisa.tamanho : null) : tamanhoCamisa,
            tipo_calca: tipoRequisicao === 'Troca' ? (trocaItems.calca.checked ? trocaItems.calca.tipo : null) : tipoCalca,
            tamanho_calca: tipoRequisicao === 'Troca' ? (trocaItems.calca.checked ? trocaItems.calca.tamanho : null) : tamanhoCalca,
            tipo_bota: tipoRequisicao === 'Troca' ? (trocaItems.bota.checked ? trocaItems.bota.tipo : null) : tipoBota,
            tamanho_bota: tipoRequisicao === 'Troca' ? (trocaItems.bota.checked ? trocaItems.bota.tamanho : null) : tamanhoBota,
            kit_gerado: textoCompletoDoKitComCodigos, 
            tipo_requisicao: tipoRequisicao
          };

          const { error } = await supabase
            .from('admissoes_fardamento')
            .update(payload)
            .eq('id', editingRecord.id);

          if (error) {
            console.error("Erro completo do Supabase:", error);
            alert("Erro ao salvar: " + (error.message || error.details || JSON.stringify(error)));
            return;
          }
        }

        const updatedList = admissions.map(item => {
          if (item.id === editingRecord.id) {
            return {
              ...item,
              nome: nome.trim().toUpperCase(),
              cpf: cpf.trim(),
              cargo: cargo.trim().toUpperCase(),
              obra: obra,
              data_agendamento: dataAgendamento,
              tamanhos: tamanhosObj,
              especificacoes: especificacoesObj,
              kit_gerado: finalKit,
              tipo_requisicao: tipoRequisicao
            };
          }
          return item;
        });

        await saveAdmissionsToPersistence(updatedList);
        showToast(`Admissão de ${nome.trim().toUpperCase()} atualizada com sucesso!`);
        setEditingRecord(null);

        // Clear inputs, keep data_agendamento and obra
        clearForm();
      } catch (err: any) {
        console.error("DB Update error:", err);
        if (usingFallback) {
          const updatedList = admissions.map(item => {
            if (item.id === editingRecord.id) {
              return {
                ...item,
                nome: nome.trim().toUpperCase(),
                cpf: cpf.trim(),
                cargo: cargo.trim().toUpperCase(),
                obra: obra,
                data_agendamento: dataAgendamento,
                tamanhos: tamanhosObj,
                especificacoes: especificacoesObj,
                kit_gerado: finalKit,
                tipo_requisicao: tipoRequisicao
              };
            }
            return item;
          });
          localStorage.setItem('sgi_admissoes_fardamento', JSON.stringify(updatedList));
          setAdmissions(updatedList);
          showToast(`Alteração salva localmente (Modo Contingência)`, 'info');
          setEditingRecord(null);

          clearForm();
        } else {
          alert("Erro ao tentar atualizar: " + (err.message || JSON.stringify(err)));
        }
      }
    } else {
      // Create Mode
      // Validação de duplicidade por CPF no banco de dados (ignorada se tipo_requisicao === 'Troca')
      if (tipoRequisicao !== 'Troca') {
        const rawCpf = cpf.trim();
        const cleanCpfDigits = rawCpf.replace(/\D/g, '');

        let existingRecord: any = null;

        if (!usingFallback) {
          try {
            const { data: dbMatches, error: queryErr } = await supabase
              .from('admissoes_fardamento')
              .select('*')
              .or(`cpf.eq.${rawCpf},cpf.eq.${cleanCpfDigits}`);

            if (!queryErr && dbMatches && dbMatches.length > 0) {
              existingRecord = dbMatches[0];
            }
          } catch (err) {
            console.warn("Aviso na busca por duplicidade no Supabase:", err);
          }
        }

        if (!existingRecord) {
          existingRecord = admissions.find(a => {
            const aCpfDigits = (a.cpf || '').replace(/\D/g, '');
            return (a.cpf && a.cpf === rawCpf) || (cleanCpfDigits && aCpfDigits === cleanCpfDigits);
          });
        }

        if (existingRecord) {
          const faseEncontrada = String(existingRecord.status || existingRecord.fase || 'INICIADO').toUpperCase();
          const rawDate = existingRecord.created_at || existingRecord.updated_at || existingRecord.dt_solicitacao_rh || existingRecord.data_agendamento;
          const dataFormatada = formatDateDDMMYYYY(rawDate);
          const finalCpf = getFinalCpf(rawCpf);

          const confirmMsg = `O NÚMERO DE CPF COM FINAL ${finalCpf} JÁ TEVE O PROCESSO INICIADO OU CONCLUIDO ${faseEncontrada} NO DIA ${dataFormatada}. DESEJA CONTINUAR ASSIM MESMO?`;

          const userWantsToContinue = await confirmDuplicateAction(confirmMsg);
          if (!userWantsToContinue) {
            return;
          }
        }
      }

      const userName = session?.nome || session?.email?.split('@')[0] || 'Usuário';
      const initialEvents = [
        {
          data: new Date().toISOString(),
          etapa: 'Solicitação Criada',
          detalhes: `Solicitação criada pelo RH (${tipoRequisicao}) por ${userName}`
        }
      ];

      const newRecord: AdmissionRecord = {
        id: String(Date.now()),
        nome: nome.trim().toUpperCase(),
        cpf: cpf.trim(),
        cargo: cargo.trim().toUpperCase(),
        obra: obra,
        data_agendamento: dataAgendamento,
        tamanhos: tamanhosObj,
        especificacoes: especificacoesObj,
        kit_gerado: finalKit,
        status: 'Aguardando Lote',
        status_lote: 'Aguardando Lote',
        created_at: new Date().toISOString(),
        tipo_requisicao: tipoRequisicao,
        dt_solicitacao_rh: new Date().toISOString(),
        lote_id: null,
        historico_eventos: initialEvents
      };

      try {
        let finalRecord = { ...newRecord };
        if (!usingFallback) {
          const payload = { 
            nome: newRecord.nome, 
            cpf: newRecord.cpf, 
            cargo: newRecord.cargo, 
            obra: newRecord.obra, 
            data_agendamento: newRecord.data_agendamento,
            email_tecnico: emailTecnico.trim() || null,
            tipo_camisa: tipoRequisicao === 'Troca' ? (trocaItems.camisa.checked ? trocaItems.camisa.tipo : null) : tipoCamisa,
            tamanho_camisa: tipoRequisicao === 'Troca' ? (trocaItems.camisa.checked ? trocaItems.camisa.tamanho : null) : tamanhoCamisa,
            tipo_calca: tipoRequisicao === 'Troca' ? (trocaItems.calca.checked ? trocaItems.calca.tipo : null) : tipoCalca,
            tamanho_calca: tipoRequisicao === 'Troca' ? (trocaItems.calca.checked ? trocaItems.calca.tamanho : null) : tamanhoCalca,
            tipo_bota: tipoRequisicao === 'Troca' ? (trocaItems.bota.checked ? trocaItems.bota.tipo : null) : tipoBota,
            tamanho_bota: tipoRequisicao === 'Troca' ? (trocaItems.bota.checked ? trocaItems.bota.tamanho : null) : tamanhoBota,
            kit_gerado: textoCompletoDoKitComCodigos, 
            status: 'Aguardando Lote',
            tipo_requisicao: tipoRequisicao,
            dt_solicitacao_rh: newRecord.dt_solicitacao_rh,
            historico_eventos: JSON.stringify(initialEvents)
          };

          const { data: insertedData, error } = await supabase
            .from('admissoes_fardamento')
            .insert([payload])
            .select('id');

          if (error) {
            console.error("Erro completo do Supabase:", error);
            alert("Erro ao salvar: " + (error.message || error.details || JSON.stringify(error)));
            return;
          }

          if (insertedData && insertedData[0]) {
            finalRecord.id = String(insertedData[0].id);
          }
        }
        
        const updatedList = [finalRecord, ...admissions];
        await saveAdmissionsToPersistence(updatedList);
        showToast(`Admissão de ${finalRecord.nome} cadastrada e enviada para a fila de espera!`, 'success');
        
        clearForm();
      } catch (err: any) {
        console.error("DB Insert error:", err);
        if (usingFallback) {
          const updatedList = [newRecord, ...admissions];
          localStorage.setItem('sgi_admissoes_fardamento', JSON.stringify(updatedList));
          setAdmissions(updatedList);
          showToast(`Cadastro salvo localmente (Modo Contingência)`, 'info');

          clearForm();
        } else {
          alert("Erro ao tentar cadastrar: " + (err.message || JSON.stringify(err)));
        }
      }
    }
  };

  // Start Editing a Collaborator
  const handleStartEdit = (record: AdmissionRecord) => {
    setEditingRecord(record);
    setNome(record.nome);
    setCpf(record.cpf);
    setDataAgendamento(record.data_agendamento || '');
    setCargo(record.cargo);
    setObra(record.obra);
    setEmailTecnico(record.especificacoes?.email_tecnico || '');
    
    const reqType = (record.tipo_requisicao as 'Admissão' | 'Troca') || 'Admissão';
    setTipoRequisicao(reqType);
    setRhFlowMode(reqType === 'Troca' ? 'manual_troca' : 'manual_admissao');

    setTipoCamisa(record.especificacoes?.cor_tecido || 'Brim Cinza');
    setTamanhoCamisa(record.tamanhos.camisa || '3');
    setTipoCalca(record.especificacoes?.tipo_calca || 'Jeans');
    setTamanhoCalca(record.tamanhos.calca || '40');
    setTipoBota(record.especificacoes?.tipo_bota || 'Anti Torção');
    setTamanhoBota(record.tamanhos.bota || '40');
    
    if (record.kit_gerado) {
      const kitArr = typeof record.kit_gerado === 'string' 
        ? (record.kit_gerado as string).split('\n') 
        : record.kit_gerado;
      setKitGerado(kitArr);
      setKitCompilado(true);

      if (reqType === 'Troca') {
        const newTrocaItems = {
          camisa: { checked: false, tipo: 'Brim Cinza', tamanho: '3', qtd: 1 },
          calca: { checked: false, tipo: 'Jeans', tamanho: '40', qtd: 1 },
          bota: { checked: false, tipo: 'Anti Torção', tamanho: '40', qtd: 1 },
          capuz: { checked: false, qtd: 1 },
          oculos: { checked: false, qtd: 1 },
          abafador: { checked: false, qtd: 1 },
          capaceteAmarelo: { checked: false, qtd: 1 },
          capaceteVerde: { checked: false, qtd: 1 },
          jugular: { checked: false, qtd: 1 },
          facialVGard: { checked: false, qtd: 1 },
          facial3M: { checked: false, qtd: 1 },
        };

        kitArr.forEach(item => {
          const line = item.toUpperCase();
          const qtdMatch = line.match(/^(\d+)\s*UN/);
          const qtd = qtdMatch ? parseInt(qtdMatch[1], 10) : 1;

          if (line.includes('CAMISA')) {
            newTrocaItems.camisa.checked = true;
            newTrocaItems.camisa.qtd = qtd;
            if (line.includes('ANTI CHAMA')) {
              newTrocaItems.camisa.tipo = 'Anti Chama';
            } else if (line.includes('AZUL MARINHO')) {
              newTrocaItems.camisa.tipo = 'Brim Azul Marinho';
            } else {
              newTrocaItems.camisa.tipo = 'Brim Cinza';
            }
            const tamMatch = line.match(/TAM\s+(\S+)/);
            if (tamMatch) newTrocaItems.camisa.tamanho = tamMatch[1];
          } else if (line.includes('CALCA') || line.includes('CALÇA')) {
            newTrocaItems.calca.checked = true;
            newTrocaItems.calca.qtd = qtd;
            if (line.includes('ANTI CHAMA')) {
              newTrocaItems.calca.tipo = 'Anti Chama';
            } else if (line.includes('BRIM CINZA')) {
              newTrocaItems.calca.tipo = 'Brim Cinza';
            } else {
              newTrocaItems.calca.tipo = 'Jeans';
            }
            const tamMatch = line.match(/TAM\s+(\S+)/);
            if (tamMatch) newTrocaItems.calca.tamanho = tamMatch[1];
          } else if (line.includes('BOTA')) {
            newTrocaItems.bota.checked = true;
            newTrocaItems.bota.qtd = qtd;
            if (line.includes('ELETRICISTA')) {
              newTrocaItems.bota.tipo = 'Eletricista';
            } else {
              newTrocaItems.bota.tipo = 'Anti Torção';
            }
            const tamMatch = line.match(/TAM\s+(\S+)/);
            if (tamMatch) newTrocaItems.bota.tamanho = tamMatch[1];
          } else if (line.includes('CAPUZ')) {
            newTrocaItems.capuz.checked = true;
            newTrocaItems.capuz.qtd = qtd;
          } else if (line.includes('OCULOS') || line.includes('ÓCULOS')) {
            newTrocaItems.oculos.checked = true;
            newTrocaItems.oculos.qtd = qtd;
          } else if (line.includes('CONCHA') || line.includes('AUDITIVO')) {
            newTrocaItems.abafador.checked = true;
            newTrocaItems.abafador.qtd = qtd;
          } else if (line.includes('AMARELO')) {
            newTrocaItems.capaceteAmarelo.checked = true;
            newTrocaItems.capaceteAmarelo.qtd = qtd;
          } else if (line.includes('VERDE')) {
            newTrocaItems.capaceteVerde.checked = true;
            newTrocaItems.capaceteVerde.qtd = qtd;
          } else if (line.includes('JUGULAR')) {
            newTrocaItems.jugular.checked = true;
            newTrocaItems.jugular.qtd = qtd;
          } else if (line.includes('V-GARD')) {
            newTrocaItems.facialVGard.checked = true;
            newTrocaItems.facialVGard.qtd = qtd;
          } else if (line.includes('3M')) {
            newTrocaItems.facial3M.checked = true;
            newTrocaItems.facial3M.qtd = qtd;
          }
        });
        setTrocaItems(newTrocaItems);
      }
    } else {
      setKitGerado([]);
      setKitCompilado(false);
    }

    // Scroll smoothly to form
    const formElement = document.getElementById('new-admission-form-header');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Delete a Collaborator
  const handleDeleteAdmission = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Admissão',
      message: `Tem certeza que deseja excluir permanentemente a admissão de ${name}?`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      type: 'danger',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          setRefreshing(true);
          if (!usingFallback) {
            const { error } = await supabase
              .from('admissoes_fardamento')
              .delete()
              .eq('id', id);

            if (error) {
              console.error("Erro ao excluir no banco:", error);
              showToast(`Erro ao excluir admissão de ${name}. Tente novamente.`, 'error');
              return; // Aborta se o banco falhar
            }
          }

          const updatedList = admissions.filter(item => item.id !== id);
          await saveAdmissionsToPersistence(updatedList);
          showToast(`Admissão de ${name} excluída com sucesso!`);
          
          if (editingRecord?.id === id) {
            setEditingRecord(null);
            setNome('');
            setCpf('');
            setCargo('');
            setObra('');
            setDataAgendamento('');
            setEmailTecnico('');
            setKitGerado([]);
            setKitCompilado(false);
          }
        } catch (err) {
          console.error("Error deleting admission:", err);
          if (usingFallback) {
            const updatedList = admissions.filter(item => item.id !== id);
            localStorage.setItem('sgi_admissoes_fardamento', JSON.stringify(updatedList));
            setAdmissions(updatedList);
            showToast('Registro excluído localmente.', 'info');
            
            if (editingRecord?.id === id) {
              setEditingRecord(null);
              setNome('');
              setCpf('');
              setCargo('');
              setObra('');
              setDataAgendamento('');
              setEmailTecnico('');
              setKitGerado([]);
              setKitCompilado(false);
            }
          } else {
            showToast("Erro ao tentar excluir. Tente novamente.", 'error');
          }
        } finally {
          setRefreshing(false);
        }
      }
    });
  };

  // Copy stylized table to clipboard using the modern Clipboard API and transition to 'Aguardando Número RM'
  const copiarTabela = async () => {
    const tabelaElement = document.getElementById('tabela-rm-export');
    if (!tabelaElement) {
      showToast('Tabela de exportação não encontrada.', 'error');
      return;
    }
    try {
      const html = tabelaElement.outerHTML;
      const blobHtml = new Blob([html], { type: "text/html" });
      const blobText = new Blob([tabelaElement.innerText], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({ 
          "text/html": blobHtml, 
          "text/plain": blobText 
        })
      ]);
      
      // Update selected records to status 'Aguardando Número RM' with smart partitioning
      if (selectedBatchIds.length > 0 && !isReemittingBatch) {
        const selectedRecords = admissions.filter(item => selectedBatchIds.includes(item.id));
        const obrasUnicas = new Set(selectedRecords.map(colab => (colab.obra || '').trim()));
        if (obrasUnicas.size > 1) {
          alert("OPERAÇÃO BLOQUEADA: Você selecionou colaboradores de obras diferentes. A regra de negócio exige que um lote/RM contenha apenas colaboradores do mesmo centro de custo.");
          return;
        }

        setRefreshing(true);
        const userName = session?.nome || session?.email?.split('@')[0] || 'Usuário';
        
        // Group by obra and data_agendamento using reduce
        const groups = selectedRecords.reduce((acc, record) => {
          const key = `${record.obra}_${record.data_agendamento}`;
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(record);
          return acc;
        }, {} as Record<string, AdmissionRecord[]>);

        const groupKeys = Object.keys(groups);
        const nowMs = Date.now();

        if (!usingFallback) {
          for (let index = 0; index < groupKeys.length; index++) {
            const key = groupKeys[index];
            const groupRecords = groups[key];
            const groupIds = groupRecords.map(r => r.id);
            const newLoteId = `LOTE-${nowMs}-${index}`;
            const referenceRecord = groupRecords[0];
            const updatedEvents = appendEventToRecord(referenceRecord, 'Aguardando Número RM', `Solicitação enviada para lote ${newLoteId} por ${userName}`);

            const { error } = await supabase
              .from('admissoes_fardamento')
              .update({ 
                status: 'Aguardando RM',
                lote_id: newLoteId,
                historico_eventos: JSON.stringify(updatedEvents)
              })
              .in('id', groupIds);

            if (error) {
              console.error("Erro ao atualizar lote no Supabase:", error);
              throw error;
            }
          }
        }

        const updatedList = admissions.map(item => {
          if (selectedBatchIds.includes(item.id)) {
            const key = `${item.obra}_${item.data_agendamento}`;
            const groupIndex = groupKeys.indexOf(key);
            const newLoteId = `LOTE-${nowMs}-${groupIndex}`;
            const updatedEvents = appendEventToRecord(item, 'Aguardando Número RM', `Solicitação enviada para lote ${newLoteId} por ${userName}`);
            return { 
              ...item, 
              status: 'Aguardando Número RM' as any, 
              lote_id: newLoteId, 
              historico_eventos: updatedEvents 
            };
          }
          return item;
        });

        await saveAdmissionsToPersistence(updatedList);

        // Store each group as a separate pending batch in state & localStorage
        const generatedBatches: string[][] = [];
        groupKeys.forEach((key, index) => {
          const groupRecords = groups[key];
          const groupIds = groupRecords.map(r => r.id);
          generatedBatches.push(groupIds);
        });

        setPendingRmLotes(prev => {
          const updated = [...prev, ...generatedBatches];
          localStorage.setItem('sgi_lotes_pendentes_rm', JSON.stringify(updated));
          return updated;
        });

        setSelectedBatchIds([]);
        setShowBatchModal(false);
        setRhSubTab('lotes_enviados');
        showToast(`✅ Sucesso! Os colaboradores selecionados foram divididos automaticamente em ${groupKeys.length} lotes distintos com base em suas Obras e Datas.`);
      } else {
        showToast('Tabela copiada para a área de transferência.');
      }
    } catch (err: any) {
      console.error("Erro ao processar / copiar lote:", err);
      showToast(`Falha na gravação do lote: ${err?.message || err || 'Erro desconhecido'}`, 'error');
    } finally {
      setRefreshing(false);
    }
  };

  // Mark all selected items in batch as Aguardando Número RM
  const handleBatchMarkRequestRM = async () => {
    if (!isViewingBatchFromExcel && selectedBatchIds.length === 0) return;
    try {
      setRefreshing(true);
      const userName = session?.nome || session?.email?.split('@')[0] || 'Usuário';
      const newLoteId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'lote_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
      const nowStr = new Date().toISOString();

      if (isViewingBatchFromExcel) {
        // 3. Blindagem de Operadora (Sanitization)
        if (!loteAdmissao || loteAdmissao.length === 0) {
          showToast('O lote de fardamento está vazio. Por favor, adicione colaboradores.', 'error');
          setRefreshing(false);
          return;
        }

        const validLoteColabs: LoteAdmissaoColaborador[] = [];

        for (let i = 0; i < loteAdmissao.length; i++) {
          const colab = loteAdmissao[i];
          const lineNumber = i + 1;
          const identifier = colab.nome ? `Colaborador "${colab.nome}"` : `Linha ${lineNumber}`;

          if (!colab.nome || !colab.nome.trim()) {
            showToast(`Erro na linha ${lineNumber}: O nome do colaborador é obrigatório e está em branco.`, 'error');
            setRefreshing(false);
            return;
          }
          if (!colab.cpf || !colab.cpf.trim()) {
            showToast(`Erro na linha ${lineNumber} (${identifier}): O CPF é obrigatório e está em branco.`, 'error');
            setRefreshing(false);
            return;
          }
          if (!colab.cargo || !colab.cargo.trim()) {
            showToast(`Erro na linha ${lineNumber} (${identifier}): O cargo é obrigatório e está em branco.`, 'error');
            setRefreshing(false);
            return;
          }
          if (!colab.obra || !colab.obra.trim()) {
            showToast(`Erro na linha ${lineNumber} (${identifier}): A obra é obrigatória e está em branco.`, 'error');
            setRefreshing(false);
            return;
          }
          if (!colab.tamanho_camisa || !colab.tamanho_camisa.trim()) {
            showToast(`Erro na linha ${lineNumber} (${identifier}): O tamanho de camisa é obrigatório e não foi definido.`, 'error');
            setRefreshing(false);
            return;
          }
          if (!colab.tamanho_calca || !colab.tamanho_calca.trim()) {
            showToast(`Erro na linha ${lineNumber} (${identifier}): O tamanho de calça é obrigatório e não foi definido.`, 'error');
            setRefreshing(false);
            return;
          }
          if (!colab.tamanho_bota || !colab.tamanho_bota.trim()) {
            showToast(`Erro na linha ${lineNumber} (${identifier}): O tamanho de bota é obrigatório e não foi definido.`, 'error');
            setRefreshing(false);
            return;
          }

          // 1. Validação Prévia no Banco de Dados (Ignora se for "Troca")
          const colabTipo = (colab as any).tipo_requisicao || 'Admissão';
          if (colabTipo !== 'Troca') {
            const rawCpf = colab.cpf.trim();
            const cleanCpfDigits = rawCpf.replace(/\D/g, '');

            let existingRecord: any = null;

            if (!usingFallback) {
              try {
                const { data: dbMatches, error: queryErr } = await supabase
                  .from('admissoes_fardamento')
                  .select('*')
                  .or(`cpf.eq.${rawCpf},cpf.eq.${cleanCpfDigits}`);

                if (!queryErr && dbMatches && dbMatches.length > 0) {
                  existingRecord = dbMatches[0];
                }
              } catch (err) {
                console.warn("Aviso na busca por duplicidade no Supabase:", err);
              }
            }

            // Fallback para estado local
            if (!existingRecord) {
              existingRecord = admissions.find(a => {
                const aCpfDigits = (a.cpf || '').replace(/\D/g, '');
                return (a.cpf && a.cpf === rawCpf) || (cleanCpfDigits && aCpfDigits === cleanCpfDigits);
              });
            }

            if (existingRecord) {
              // 2. Formatação dos Dados para o Alerta
              const faseEncontrada = String(existingRecord.status || existingRecord.fase || 'INICIADO').toUpperCase();
              const rawDate = existingRecord.created_at || existingRecord.updated_at || existingRecord.dt_solicitacao_rh || existingRecord.data_agendamento;
              const dataFormatada = formatDateDDMMYYYY(rawDate);
              const finalCpf = getFinalCpf(rawCpf);

              // 3. Interrupção e Modal de Confirmação no formato exato solicitado
              const confirmMsg = `O NÚMERO DE CPF COM FINAL ${finalCpf} JÁ TEVE O PROCESSO INICIADO OU CONCLUIDO ${faseEncontrada} NO DIA ${dataFormatada}. DESEJA CONTINUAR ASSIM MESMO?`;

              // 4. Lógica de Decisão (Proceed/Cancel)
              const userWantsToContinue = await confirmDuplicateAction(confirmMsg);
              if (!userWantsToContinue) {
                showToast(`Colaborador ${colab.nome} (CPF final ${finalCpf}) não inserido por duplicidade.`, 'info');
                continue; // Ignora esse colaborador específico
              }
            }
          }

          validLoteColabs.push(colab);
        }

        if (validLoteColabs.length === 0) {
          showToast('Nenhum colaborador mantido no lote após a verificação de duplicidade.', 'info');
          setRefreshing(false);
          return;
        }

        // Excel Lote Mode: we INSERT these new records into DB (or save in fallback)
        const batchPayloads = validLoteColabs.map(colab => {
          const finalKit = compileKit(
            colab.cargo,
            colab.tipo_camisa || 'Brim Cinza',
            colab.tamanho_camisa || '3',
            colab.tipo_calca || 'Jeans',
            colab.tamanho_calca || '40',
            colab.tipo_bota || 'Anti Torção',
            colab.tamanho_bota || '40'
          );

          const initialEvents = [
            {
              data: nowStr,
              etapa: 'Solicitação Criada',
              detalhes: `Solicitação criada em lote via Excel por ${userName}`
            },
            {
              data: nowStr,
              etapa: 'Aguardando Número RM',
              detalhes: `Lote solicitado ao SGI por ${userName}`
            }
          ];

          return {
            nome: colab.nome.trim().toUpperCase(),
            cpf: colab.cpf.trim(),
            cargo: colab.cargo.trim().toUpperCase(),
            obra: colab.obra.trim(),
            data_agendamento: dataAgendamentoLote || new Date().toISOString().split('T')[0],
            email_tecnico: null,
            tipo_camisa: colab.tipo_camisa || 'Brim Cinza',
            tamanho_camisa: colab.tamanho_camisa || '3',
            tipo_calca: colab.tipo_calca || 'Jeans',
            tamanho_calca: colab.tamanho_calca || '40',
            tipo_bota: colab.tipo_bota || 'Anti Torção',
            tamanho_bota: colab.tamanho_bota || '40',
            kit_gerado: finalKit.join('\n'),
            status: 'Aguardando Número RM',
            tipo_requisicao: 'Admissão',
            dt_solicitacao_rh: nowStr,
            lote_id: newLoteId,
            historico_eventos: JSON.stringify(initialEvents)
          };
        });

        let insertedData: any[] | null = null;
        if (!usingFallback) {
          const { data, error } = await supabase
            .from('admissoes_fardamento')
            .insert(batchPayloads)
            .select('id');

          if (error) {
            console.error("Erro ao cadastrar lote via Excel no Supabase:", error);
            throw error;
          }
          insertedData = data;
        }

        const formattedRecords: AdmissionRecord[] = batchPayloads.map((payload, idx) => {
          const dbId = insertedData && insertedData[idx] ? String(insertedData[idx].id) : `real_${Date.now()}_${idx}`;
          return {
            id: dbId,
            nome: payload.nome,
            cpf: payload.cpf,
            cargo: payload.cargo,
            obra: payload.obra,
            data_agendamento: payload.data_agendamento,
            tamanhos: {
              camisa: payload.tamanho_camisa,
              calca: payload.tamanho_calca,
              bota: payload.tamanho_bota
            },
            especificacoes: {
              cor_tecido: payload.tipo_camisa,
              arco_eletrico: payload.tipo_camisa === 'Anti Chama' ? 'Sim' : 'Não',
              tipo_calca: payload.tipo_calca,
              tipo_bota: payload.tipo_bota,
              email_tecnico: ''
            },
            kit_gerado: payload.kit_gerado.split('\n'),
            status: 'Aguardando Número RM',
            created_at: nowStr,
            tipo_requisicao: 'Admissão',
            dt_solicitacao_rh: nowStr,
            lote_id: newLoteId,
            historico_eventos: typeof payload.historico_eventos === 'string' ? JSON.parse(payload.historico_eventos) : payload.historico_eventos
          };
        });

        const updatedList = [...formattedRecords, ...admissions];
        await saveAdmissionsToPersistence(updatedList);

        showToast(`${validLoteColabs.length} colaboradores cadastrados com status "Aguardando Número RM"!`);
        setLoteAdmissao([]);
        setSelectedIndex(0);
        setRhFlowMode('menu');
        setIsViewingBatchFromExcel(false);
        setShowBatchModal(false);
      } else {
        // Manual Batch Mode with smart partitioning
        const selectedRecords = admissions.filter(item => selectedBatchIds.includes(item.id));
        
        // Group by obra and data_agendamento using reduce
        const groups = selectedRecords.reduce((acc, record) => {
          const key = `${record.obra}_${record.data_agendamento}`;
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(record);
          return acc;
        }, {} as Record<string, AdmissionRecord[]>);

        const groupKeys = Object.keys(groups);
        const nowMs = Date.now();

        if (!usingFallback) {
          for (let index = 0; index < groupKeys.length; index++) {
            const key = groupKeys[index];
            const groupRecords = groups[key];
            const groupIds = groupRecords.map(r => r.id);
            const newLoteId = `LOTE-${nowMs}-${index}`;
            const referenceRecord = groupRecords[0];
            const updatedEvents = appendEventToRecord(referenceRecord, 'Aguardando Número RM', `Lote solicitado ao SGI por ${userName}`);

            const { error } = await supabase
              .from('admissoes_fardamento')
              .update({ 
                status: 'Aguardando RM',
                lote_id: newLoteId,
                historico_eventos: JSON.stringify(updatedEvents)
              })
              .in('id', groupIds);

            if (error) {
              console.error("Erro ao atualizar lote no Supabase (Manual):", error);
              throw error;
            }
          }
        }

        const updatedList = admissions.map(item => {
          if (selectedBatchIds.includes(item.id)) {
            const key = `${item.obra}_${item.data_agendamento}`;
            const groupIndex = groupKeys.indexOf(key);
            const newLoteId = `LOTE-${nowMs}-${groupIndex}`;
            const updatedEvents = appendEventToRecord(item, 'Aguardando Número RM', `Lote solicitado ao SGI por ${userName}`);
            return { 
              ...item, 
              status: 'Aguardando Número RM' as const, 
              lote_id: newLoteId, 
              historico_eventos: updatedEvents 
            };
          }
          return item;
        });
        await saveAdmissionsToPersistence(updatedList);

        // Store each group as a separate pending batch in state & localStorage
        const generatedBatches: string[][] = [];
        groupKeys.forEach((key, index) => {
          const groupRecords = groups[key];
          const groupIds = groupRecords.map(r => r.id);
          generatedBatches.push(groupIds);
        });

        setPendingRmLotes(prev => {
          const updated = [...prev, ...generatedBatches];
          localStorage.setItem('sgi_lotes_pendentes_rm', JSON.stringify(updated));
          return updated;
        });

        showToast(`✅ Sucesso! Os colaboradores selecionados foram divididos automaticamente em ${groupKeys.length} lotes distintos com base em suas Obras e Datas.`);
        setSelectedBatchIds([]);
        setShowBatchModal(false);
      }
    } catch (err: any) {
      console.error("Failed to batch update statuses:", err);
      if (usingFallback) {
        const userName = session?.nome || session?.email?.split('@')[0] || 'Usuário';
        const newLoteId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'lote_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
        const nowStr = new Date().toISOString();

        if (isViewingBatchFromExcel) {
          const batchPayloadsFallback = loteAdmissao.map(colab => {
            const finalKit = compileKit(
              colab.cargo,
              colab.tipo_camisa || 'Brim Cinza',
              colab.tamanho_camisa || '3',
              colab.tipo_calca || 'Jeans',
              colab.tamanho_calca || '40',
              colab.tipo_bota || 'Anti Torção',
              colab.tamanho_bota || '40'
            );

            const initialEvents = [
              {
                data: nowStr,
                etapa: 'Solicitação Criada',
                detalhes: `Solicitação criada em lote via Excel por ${userName}`
              },
              {
                data: nowStr,
                etapa: 'Aguardando Número RM',
                detalhes: `Lote solicitado ao SGI por ${userName}`
              }
            ];

            return {
              nome: colab.nome.trim().toUpperCase(),
              cpf: colab.cpf.trim(),
              cargo: colab.cargo.trim().toUpperCase(),
              obra: colab.obra.trim(),
              data_agendamento: dataAgendamentoLote || new Date().toISOString().split('T')[0],
              email_tecnico: null,
              tipo_camisa: colab.tipo_camisa || 'Brim Cinza',
              tamanho_camisa: colab.tamanho_camisa || '3',
              tipo_calca: colab.tipo_calca || 'Jeans',
              tamanho_calca: colab.tamanho_calca || '40',
              tipo_bota: colab.tipo_bota || 'Anti Torção',
              tamanho_bota: colab.tamanho_bota || '40',
              kit_gerado: finalKit.join('\n'),
              status: 'Aguardando Número RM',
              tipo_requisicao: 'Admissão',
              dt_solicitacao_rh: nowStr,
              lote_id: newLoteId,
              historico_eventos: initialEvents
            };
          });

          const formattedRecords: AdmissionRecord[] = batchPayloadsFallback.map((payload, idx) => ({
            id: String(Date.now() + idx),
            nome: payload.nome,
            cpf: payload.cpf,
            cargo: payload.cargo,
            obra: payload.obra,
            data_agendamento: payload.data_agendamento,
            tamanhos: {
              camisa: payload.tamanho_camisa,
              calca: payload.tamanho_calca,
              bota: payload.tamanho_bota
            },
            especificacoes: {
              cor_tecido: payload.tipo_camisa,
              arco_eletrico: payload.tipo_camisa === 'Anti Chama' ? 'Sim' : 'Não',
              tipo_calca: payload.tipo_calca,
              tipo_bota: payload.tipo_bota,
              email_tecnico: ''
            },
            kit_gerado: payload.kit_gerado.split('\n'),
            status: 'Aguardando Número RM',
            created_at: nowStr,
            tipo_requisicao: 'Admissão',
            dt_solicitacao_rh: nowStr,
            lote_id: newLoteId,
            historico_eventos: payload.historico_eventos
          }));

          const updatedList = [...formattedRecords, ...admissions];
          localStorage.setItem('sgi_admissoes_fardamento', JSON.stringify(updatedList));
          setAdmissions(updatedList);
          showToast('Lote de fardamentos gravado localmente com status "Aguardando Número RM"! (Contingência)', 'info');
          setLoteAdmissao([]);
          setSelectedIndex(0);
          setRhFlowMode('menu');
          setIsViewingBatchFromExcel(false);
          setShowBatchModal(false);
        } else {
          const selectedRecords = admissions.filter(item => selectedBatchIds.includes(item.id));
          const groups = selectedRecords.reduce((acc, record) => {
            const key = `${record.obra}_${record.data_agendamento}`;
            if (!acc[key]) {
              acc[key] = [];
            }
            acc[key].push(record);
            return acc;
          }, {} as Record<string, AdmissionRecord[]>);

          const groupKeys = Object.keys(groups);
          const nowMs = Date.now();

          const updatedList = admissions.map(item => {
            if (selectedBatchIds.includes(item.id)) {
              const key = `${item.obra}_${item.data_agendamento}`;
              const groupIndex = groupKeys.indexOf(key);
              const newLoteId = `LOTE-${nowMs}-${groupIndex}`;
              const updatedEvents = appendEventToRecord(item, 'Aguardando Número RM', `Lote solicitado ao SGI por ${userName}`);
              return { ...item, status: 'Aguardando Número RM' as const, lote_id: newLoteId, historico_eventos: updatedEvents };
            }
            return item;
          });

          localStorage.setItem('sgi_admissoes_fardamento', JSON.stringify(updatedList));
          setAdmissions(updatedList);

          const generatedBatches: string[][] = [];
          groupKeys.forEach((key, index) => {
            const groupRecords = groups[key];
            const groupIds = groupRecords.map(r => r.id);
            generatedBatches.push(groupIds);
          });

          setPendingRmLotes(prev => {
            const updated = [...prev, ...generatedBatches];
            localStorage.setItem('sgi_lotes_pendentes_rm', JSON.stringify(updated));
            return updated;
          });

          showToast(`✅ Sucesso! Os colaboradores selecionados foram divididos automaticamente em ${groupKeys.length} lotes distintos com base em suas Obras e Datas. (Modo de Contingência)`);
          setSelectedBatchIds([]);
          setShowBatchModal(false);
        }
      } else {
        showToast(`Falha ao gravar lote no Supabase: ${err?.message || err || 'Erro desconhecido'}`, 'error');
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Change Status Handler
  const handleUpdateStatus = async (id: string, newStatus: AdmissionRecord['status']) => {
    try {
      const nowStr = new Date().toISOString();
      const userName = session?.nome || session?.email?.split('@')[0] || 'Usuário';
      const recordToUpdate = admissions.find(i => i.id === id);
      if (!recordToUpdate) return;

      let etapaStr = newStatus;
      let detalhesStr = `Status alterado para ${newStatus} por ${userName}`;

      if (newStatus === 'Disponivel para Separar') {
        etapaStr = 'RM Aprovada';
        detalhesStr = `Aprovada por ${userName}`;
      } else if (newStatus === 'Aguardando Fardamento') {
        etapaStr = 'Material Separado';
        detalhesStr = `Separado por ${userName}`;
      } else if (newStatus === 'Concluído') {
        etapaStr = 'Fardamento Concluído';
        detalhesStr = `Entregue por ${userName}`;
      } else if (newStatus === 'Aguardando Reagendamento') {
        etapaStr = 'Fardamento Parcial / Ressalva';
        detalhesStr = `Reagendado por ${userName} - Motivo: Reagendamento`;
      }

      const updatedEvents = appendEventToRecord(recordToUpdate, etapaStr, detalhesStr);

      const fieldsToUpdate: any = { 
        status: newStatus,
        historico_eventos: updatedEvents
      };

      if (newStatus === 'Disponivel para Separar') {
        fieldsToUpdate.dt_rm_aprovada = nowStr;
      } else if (newStatus === 'Aguardando Fardamento') {
        fieldsToUpdate.dt_separado = nowStr;
      } else if (newStatus === 'Concluído') {
        fieldsToUpdate.dt_fardado = nowStr;
      } else if (newStatus === 'Aguardando Reagendamento') {
        fieldsToUpdate.dt_reagendamento = nowStr;
        fieldsToUpdate.motivo_ressalva = 'Reagendamento';
      }

      if (!usingFallback && /^\d+$/.test(id)) {
        const { error } = await supabase
          .from('admissoes_fardamento')
          .update({
            ...fieldsToUpdate,
            historico_eventos: JSON.stringify(updatedEvents)
          })
          .eq('id', id);

        if (error) throw error;
      }

      const updatedList = admissions.map(item => {
        if (item.id === id) {
          const extra: any = {};
          if (newStatus === 'Disponivel para Separar') extra.dt_rm_aprovada = nowStr;
          else if (newStatus === 'Aguardando Fardamento') extra.dt_separado = nowStr;
          else if (newStatus === 'Concluído') extra.dt_fardado = nowStr;
          else if (newStatus === 'Aguardando Reagendamento') {
            extra.dt_reagendamento = nowStr;
            extra.motivo_ressalva = 'Reagendamento';
          }
          return { ...item, status: newStatus, ...extra, historico_eventos: updatedEvents };
        }
        return item;
      });
      await saveAdmissionsToPersistence(updatedList);
      
      showToast(`Status de ${recordToUpdate.nome} alterado para "${newStatus}"!`);
    } catch (err) {
      console.error("Failed to update status in DB, applying locally:", err);
      setUsingFallback(true);
      const nowStrFallback = new Date().toISOString();
      const userName = session?.nome || session?.email?.split('@')[0] || 'Usuário';
      const recordToUpdate = admissions.find(i => i.id === id);
      if (recordToUpdate) {
        let etapaStr = newStatus;
        let detalhesStr = `Status alterado para ${newStatus} por ${userName}`;

        if (newStatus === 'Disponivel para Separar') {
          etapaStr = 'RM Aprovada';
          detalhesStr = `Aprovada por ${userName}`;
        } else if (newStatus === 'Aguardando Fardamento') {
          etapaStr = 'Material Separado';
          detalhesStr = `Separado por ${userName}`;
        } else if (newStatus === 'Concluído') {
          etapaStr = 'Fardamento Concluído';
          detalhesStr = `Entregue por ${userName}`;
        } else if (newStatus === 'Aguardando Reagendamento') {
          etapaStr = 'Fardamento Parcial / Ressalva';
          detalhesStr = `Reagendado por ${userName} - Motivo: Reagendamento`;
        }
        const updatedEvents = appendEventToRecord(recordToUpdate, etapaStr, detalhesStr);

        const updatedList = admissions.map(item => {
          if (item.id === id) {
            const extra: any = {};
            if (newStatus === 'Disponivel para Separar') extra.dt_rm_aprovada = nowStrFallback;
            else if (newStatus === 'Aguardando Fardamento') extra.dt_separado = nowStrFallback;
            else if (newStatus === 'Concluído') extra.dt_fardado = nowStrFallback;
            else if (newStatus === 'Aguardando Reagendamento') {
              extra.dt_reagendamento = nowStrFallback;
              extra.motivo_ressalva = 'Reagendamento';
            }
            return { ...item, status: newStatus, ...extra, historico_eventos: updatedEvents };
          }
          return item;
        });
        localStorage.setItem('sgi_admissoes_fardamento', JSON.stringify(updatedList));
        setAdmissions(updatedList);
        showToast(`Status atualizado localmente.`, 'info');
      }
    }
  };

  // Reprove RM (Column 1 Action)
  const handleReproveRM = (rmNumber: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Reprovar RM',
      message: `Deseja realmente reprovar a RM Nº ${rmNumber}? Ela será removida do painel.`,
      confirmText: 'Reprovar',
      cancelText: 'Cancelar',
      type: 'danger',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          setRefreshing(true);
          const userName = session?.nome || session?.email?.split('@')[0] || 'Usuário';

          if (!usingFallback) {
            const itemsToUpdate = admissions.filter(item => item.numero_rm === rmNumber);
            for (const item of itemsToUpdate) {
              const updatedEvents = appendEventToRecord(item, 'RM Reprovada', `Reprovada por ${userName}`);
              const { error } = await supabase
                .from('admissoes_fardamento')
                .update({ status: 'RM Reprovada', historico_eventos: JSON.stringify(updatedEvents) })
                .eq('id', item.id);

              if (error) throw error;
            }
          }

          const updatedList = admissions.map(item => {
            if (item.numero_rm === rmNumber) {
              const updatedEvents = appendEventToRecord(item, 'RM Reprovada', `Reprovada por ${userName}`);
              return { ...item, status: 'RM Reprovada' as const, historico_eventos: updatedEvents };
            }
            return item;
          });
          await saveAdmissionsToPersistence(updatedList);
          showToast(`RM Nº ${rmNumber} foi reprovada com sucesso!`);
        } catch (err) {
          console.error("Error reproving RM:", err);
          setUsingFallback(true);
          const userName = session?.nome || session?.email?.split('@')[0] || 'Usuário';
          const updatedList = admissions.map(item => {
            if (item.numero_rm === rmNumber) {
              const updatedEvents = appendEventToRecord(item, 'RM Reprovada', `Reprovada por ${userName}`);
              return { ...item, status: 'RM Reprovada' as const, historico_eventos: updatedEvents };
            }
            return item;
          });
          localStorage.setItem('sgi_admissoes_fardamento', JSON.stringify(updatedList));
          setAdmissions(updatedList);
          showToast("RM reprovada localmente.", "info");
        } finally {
          setRefreshing(false);
        }
      }
    });
  };

  // Approve RM (Column 1 Action)
  const handleApproveRM = async (rmNumber: string) => {
    try {
      setRefreshing(true);
      const nowStr = new Date().toISOString();
      const userName = session?.nome || session?.email?.split('@')[0] || 'Usuário';

      if (!usingFallback) {
        const itemsToUpdate = admissions.filter(item => item.numero_rm === rmNumber);
        for (const item of itemsToUpdate) {
          const updatedEvents = appendEventToRecord(item, 'RM Aprovada', `Aprovada por ${userName}`);
          const { error } = await supabase
            .from('admissoes_fardamento')
            .update({ 
              status: 'Disponivel para Separar',
              dt_rm_aprovada: nowStr,
              historico_eventos: JSON.stringify(updatedEvents)
            })
            .eq('id', item.id);

          if (error) throw error;
        }
      }

      const updatedList = admissions.map(item => {
        if (item.numero_rm === rmNumber) {
          const updatedEvents = appendEventToRecord(item, 'RM Aprovada', `Aprovada por ${userName}`);
          return { 
            ...item, 
            status: 'Disponivel para Separar' as const,
            dt_rm_aprovada: nowStr,
            historico_eventos: updatedEvents
          };
        }
        return item;
      });
      await saveAdmissionsToPersistence(updatedList);
      showToast(`RM Nº ${rmNumber} aprovada! Lote pronto para Separação.`);
    } catch (err) {
      console.error("Error approving RM:", err);
      setUsingFallback(true);
      const nowStrFallback = new Date().toISOString();
      const userName = session?.nome || session?.email?.split('@')[0] || 'Usuário';
      const updatedList = admissions.map(item => {
        if (item.numero_rm === rmNumber) {
          const updatedEvents = appendEventToRecord(item, 'RM Aprovada', `Aprovada por ${userName}`);
          return { 
            ...item, 
            status: 'Disponivel para Separar' as const,
            dt_rm_aprovada: nowStrFallback,
            historico_eventos: updatedEvents
          };
        }
        return item;
      });
      localStorage.setItem('sgi_admissoes_fardamento', JSON.stringify(updatedList));
      setAdmissions(updatedList);
      showToast("RM aprovada localmente.", "info");
    } finally {
      setRefreshing(false);
    }
  };

  // Print Separation Order (Column 2 Action)
  const handlePrintRM = (rmNumber: string, records: AdmissionRecord[]) => {
    // Formatting helper to print sizes correctly and handle falsy sizes
    const formatMainTableCell = (desc: string, size?: string | null) => {
      const cleanSize = size ? String(size).trim() : '';
      if (!cleanSize) {
        return `${desc} - Não Informado`;
      }
      return `${desc} - Tam ${cleanSize}`;
    };

    // Helper to safely extract kit lines for a record, with perfect fallback if kit_gerado is empty
    const getRecordKitLines = (r: AdmissionRecord): string[] => {
      const kitList = getKitList(r.kit_gerado);
      if (kitList && kitList.length > 0) {
        return kitList;
      }
      
      const isTroca = r.tipo_requisicao === 'Troca' || r.tipo_requisicao === 'Troca / Reposição';
      const list: string[] = [];

      const hasCamisa = !isTroca || (isTroca && r.tamanhos?.camisa);
      if (hasCamisa) {
        const desc = `CAMISA ${r.especificacoes?.cor_tecido?.toUpperCase() || 'BRIM CINZA'}`;
        const size = r.tamanhos?.camisa ? String(r.tamanhos.camisa).trim().toUpperCase() : '';
        list.push(`2 UN - CAMISA ${desc} TAM ${size}`);
      }

      const hasCalca = !isTroca || (isTroca && r.tamanhos?.calca);
      if (hasCalca) {
        const desc = `CALÇA ${r.especificacoes?.tipo_calca?.toUpperCase() || 'JEANS'}`;
        const size = r.tamanhos?.calca ? String(r.tamanhos.calca).trim().toUpperCase() : '';
        list.push(`2 UN - CALÇA ${desc} TAM ${size}`);
      }

      const hasBota = !isTroca || (isTroca && r.tamanhos?.bota);
      if (hasBota) {
        const desc = `BOTA ${r.especificacoes?.tipo_bota?.toUpperCase() || 'ANTI TORÇÃO'}`;
        const size = r.tamanhos?.bota ? String(r.tamanhos.bota).trim().toUpperCase() : '';
        list.push(`1 UN - BOTA ${desc} TAM ${size}`);
      }

      return list;
    };

    // Helper to parse a single kit line into item, size, and quantity
    const parseKitLine = (line: string) => {
      let qty = 1;
      const qtyMatch = line.match(/^(\d+)\s*UN/i);
      if (qtyMatch) {
        qty = parseInt(qtyMatch[1], 10);
      }

      let cleanLine = line.replace(/^\d+\s*UN\s*-?\s*/i, '').trim();
      cleanLine = cleanLine.replace(/^Cód\.?\s*\d+\s*-?\s*/i, '').trim();

      let size = '';
      const sizeMatch = cleanLine.match(/\bTAM(ANHO)?\s+(\S+)/i);
      if (sizeMatch) {
        size = sizeMatch[2].trim();
        cleanLine = cleanLine.replace(/\bTAM(ANHO)?\s+\S+/i, '').trim();
      }

      cleanLine = cleanLine.replace(/\s*-\s*$/, '').trim();

      return { item: cleanLine, size, qty };
    };

    // Algorithm to aggregate and sum up all EPIs (Consolidation)
    const getConsolidatedEpis = (recs: AdmissionRecord[]) => {
      const groups: { [key: string]: { item: string; tamanho: string; qtd: number } } = {};

      recs.forEach(r => {
        const kitLines = getRecordKitLines(r);
        kitLines.forEach(line => {
          const parsed = parseKitLine(line);
          const key = `${parsed.item.toLowerCase()}|${parsed.size.toLowerCase()}`;
          if (!groups[key]) {
            groups[key] = {
              item: parsed.item,
              tamanho: parsed.size,
              qtd: 0
            };
          }
          groups[key].qtd += parsed.qty;
        });
      });

      return Object.values(groups).sort((a, b) => {
        const itemCompare = a.item.localeCompare(b.item);
        if (itemCompare !== 0) return itemCompare;
        return a.tamanho.localeCompare(b.tamanho, undefined, { numeric: true });
      });
    };

    const consolidatedEpis = getConsolidatedEpis(records);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Por favor, autorize pop-ups para imprimir a Ordem de Separação.', 'error');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Ordem de Separação - RM Nº ${rmNumber}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 40px;
            color: #1e293b;
            background-color: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .header h1 {
            margin: 0;
            font-size: 20px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #0f172a;
          }
          .header p {
            margin: 6px 0 0 0;
            font-size: 12px;
            color: #475569;
          }
          .meta-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            font-size: 11px;
            background-color: #f8fafc;
            padding: 10px 14px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 10px;
            text-align: left;
            font-size: 11px;
          }
          th {
            background-color: #f1f5f9;
            font-weight: 800;
            text-transform: uppercase;
            color: #0f172a;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .footer-summary {
            margin-top: 40px;
            border-top: 3px solid #0f172a;
            padding-top: 24px;
          }
          .footer-summary h2 {
            margin: 0 0 16px 0;
            font-size: 15px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #0f172a;
            font-weight: 900;
          }
          .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
            background-color: #f8fafc;
            border: 2px solid #0f172a;
          }
          .summary-table th, .summary-table td {
            border: 1px solid #cbd5e1;
            padding: 12px 10px;
            font-size: 12px;
            text-align: left;
            color: #0f172a;
          }
          .summary-table th {
            background-color: #0f172a;
            color: #ffffff;
            font-weight: 800;
            text-transform: uppercase;
          }
          @media print {
            body {
              margin: 20px;
            }
            .no-print {
              display: none;
            }
            .summary-table th {
              background-color: #0f172a !important;
              color: #ffffff !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Ordem de Separação de Fardamento (RM)</h1>
          <p>Instruções de logística de vestuário e calçados (Admissões e Trocas)</p>
        </div>

        <div class="meta-info">
          <div><strong>RM DE REFERÊNCIA:</strong> Nº ${rmNumber}</div>
          <div><strong>DATA DE EMISSÃO:</strong> ${new Date().toLocaleDateString('pt-BR')}</div>
          <div><strong>TOTAL COLABORADORES:</strong> ${records.length}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Nome do Colaborador</th>
              <th>CPF</th>
              <th>Cargo / Função</th>
              <th style="text-align: center;">Tipo de Atendimento</th>
              <th>Camisa (Tipo / Tam)</th>
              <th>Calça (Tipo / Tam)</th>
              <th>Calçado (Tipo / Tam)</th>
            </tr>
          </thead>
          <tbody>
            ${records.map(r => {
              const isTroca = r.tipo_requisicao === 'Troca' || r.tipo_requisicao === 'Troca / Reposição';
              const displayType = isTroca ? 'Troca / Reposição' : 'Admissão';
              const typeBadge = isTroca
                ? `<span style="font-style: italic; font-weight: bold; color: #b91c1c; border: 1px solid #fecaca; background-color: #fef2f2; padding: 2px 6px; border-radius: 4px; display: inline-block;">${displayType}</span>`
                : `<span style="color: #475569;">${displayType}</span>`;

              return `
                <tr>
                  <td><strong>${r.nome}</strong></td>
                  <td>${r.cpf}</td>
                  <td>${r.cargo}</td>
                  <td style="text-align: center;">${typeBadge}</td>
                  <td>${formatMainTableCell(r.especificacoes?.cor_tecido || 'Brim Cinza', r.tamanhos?.camisa)}</td>
                  <td>${formatMainTableCell(r.especificacoes?.tipo_calca || 'Jeans', r.tamanhos?.calca)}</td>
                  <td>${formatMainTableCell(r.especificacoes?.tipo_bota || 'Anti Torção', r.tamanhos?.bota)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer-summary">
          <h2>📋 RESUMO DE SEPARAÇÃO (CONSOLIDADO)</h2>
          <table class="summary-table">
            <thead>
              <tr>
                <th style="width: 50px; text-align: center; border: 1px solid #0f172a;">[ OK ]</th>
                <th style="border: 1px solid #0f172a;">Item / Equipamento de Proteção Individual (EPI)</th>
                <th style="border: 1px solid #0f172a; text-align: center; width: 120px;">Tamanho</th>
                <th style="border: 1px solid #0f172a; text-align: center; width: 120px;">Quantidade</th>
              </tr>
            </thead>
            <tbody>
              ${consolidatedEpis.map((item, idx) => `
                <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f1f5f9'}; border-bottom: 1px solid #cbd5e1;">
                  <td style="text-align: center; width: 50px;">
                    <div style="width: 16px; height: 16px; border: 2px solid #0f172a; border-radius: 3px; margin: 0 auto; background-color: #ffffff;"></div>
                  </td>
                  <td><strong>${item.item}</strong></td>
                  <td style="text-align: center; font-weight: bold;">
                    ${item.tamanho ? `${item.tamanho}` : '<span style="color: #64748b; font-weight: normal; font-size: 11px;">ÚNICO</span>'}
                  </td>
                  <td style="text-align: center; font-weight: 900; background-color: #f1f5f9; border-left: 1px solid #cbd5e1; width: 120px;">
                    ${item.qtd} UN
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="margin-top: 16px; text-align: right; font-size: 11px; color: #475569; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
            Total de Itens Consolidados para Separação Física: ${consolidatedEpis.reduce((acc, curr) => acc + curr.qtd, 0)} UN
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Schedule delivery and complete separation (Column 2 Action B)
  const handleScheduleFardamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedulingRmNumber || !scheduleDate || !scheduleTime) {
      showToast('Por favor, informe a data e hora do fardamento.', 'error');
      return;
    }

    try {
      setRefreshing(true);
      const nowStr = new Date().toISOString();
      const userName = session?.nome || session?.email?.split('@')[0] || 'Almoxarife';
      
      const recordsToUpdate = admissions.filter(item => 
        item.numero_rm === schedulingRmNumber && 
        item.status !== 'Fardado' && 
        item.status !== 'Concluído' &&
        selectedSeparacaoIds.includes(item.id)
      );

      if (recordsToUpdate.length === 0) {
        showToast('Nenhum colaborador selecionado para agendamento.', 'error');
        setRefreshing(false);
        return;
      }
      
      if (!usingFallback) {
        for (const record of recordsToUpdate) {
          const updatedEvents = appendEventToRecord(record, 'Material Separado', `Separado por ${userName} e agendado para ${scheduleDate.split('-').reverse().join('/')} às ${scheduleTime}`);
          const { error } = await supabase
            .from('admissoes_fardamento')
            .update({
              status: 'Aguardando Fardamento',
              data_agendamento: scheduleDate,
              hora_agendamento: scheduleTime,
              dt_separado: nowStr,
              historico_eventos: JSON.stringify(updatedEvents)
            })
            .eq('id', record.id);

          if (error) throw error;
        }
      }

      const updatedList = admissions.map(item => {
        if (item.numero_rm === schedulingRmNumber && selectedSeparacaoIds.includes(item.id)) {
          if (item.status === 'Fardado' || item.status === 'Concluído') {
            return item; // Incorruptible safeguard
          }
          const specs = { 
            ...item.especificacoes, 
            hora_fardamento: scheduleTime 
          };
          const updatedEvents = appendEventToRecord(item, 'Material Separado', `Separado por ${userName} e agendado para ${scheduleDate.split('-').reverse().join('/')} às ${scheduleTime}`);
          return {
            ...item,
            status: 'Aguardando Fardamento' as any,
            data_agendamento: scheduleDate,
            hora_agendamento: scheduleTime,
            especificacoes: specs,
            dt_separado: nowStr,
            historico_eventos: updatedEvents
          };
        }
        return item;
      });

      // Clear scheduled ids from selection state
      const scheduledIds = recordsToUpdate.map(r => r.id);
      setSelectedSeparacaoIds(prev => prev.filter(id => !scheduledIds.includes(id)));

      await saveAdmissionsToPersistence(updatedList);
      showToast(`RM Nº ${schedulingRmNumber} agendada para ${scheduleDate.split('-').reverse().join('/')} às ${scheduleTime}!`);
      setShowScheduleModal(false);
      setSchedulingRmNumber(null);
    } catch (err) {
      console.error("Error scheduling RM:", err);
      setUsingFallback(true);
      const nowStrFallback = new Date().toISOString();
      const userName = session?.nome || session?.email?.split('@')[0] || 'Almoxarife';
      
      const recordsToUpdate = admissions.filter(item => 
        item.numero_rm === schedulingRmNumber && 
        item.status !== 'Fardado' && 
        item.status !== 'Concluído' &&
        selectedSeparacaoIds.includes(item.id)
      );

      const updatedList = admissions.map(item => {
        if (item.numero_rm === schedulingRmNumber && selectedSeparacaoIds.includes(item.id)) {
          if (item.status === 'Fardado' || item.status === 'Concluído') {
            return item; // Incorruptible safeguard
          }
          const specs = { 
            ...item.especificacoes, 
            hora_fardamento: scheduleTime 
          };
          const updatedEvents = appendEventToRecord(item, 'Material Separado', `Separado por ${userName} e agendado para ${scheduleDate.split('-').reverse().join('/')} às ${scheduleTime}`);
          return {
            ...item,
            status: 'Aguardando Fardamento' as any,
            data_agendamento: scheduleDate,
            hora_agendamento: scheduleTime,
            especificacoes: specs,
            dt_separado: nowStrFallback,
            historico_eventos: updatedEvents
          };
        }
        return item;
      });

      // Clear scheduled ids from selection state
      const scheduledIds = recordsToUpdate.map(r => r.id);
      setSelectedSeparacaoIds(prev => prev.filter(id => !scheduledIds.includes(id)));

      localStorage.setItem('sgi_admissoes_fardamento', JSON.stringify(updatedList));
      setAdmissions(updatedList);
      showToast("Agendado localmente.", "info");
      setShowScheduleModal(false);
      setSchedulingRmNumber(null);
    } finally {
      setRefreshing(false);
    }
  };

  // Complete fardamento for all employees in an RM (Column 3 Action A)
  const handleAllFardados = (rmNumber: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Finalizar Fardamento da RM',
      message: `Deseja realmente marcar todos os colaboradores da RM Nº ${rmNumber} como FARDADOS / CONCLUÍDOS?`,
      confirmText: 'Confirmar Todos',
      cancelText: 'Cancelar',
      type: 'success',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          setRefreshing(true);
          const nowStr = new Date().toISOString();
          const userName = session?.nome || session?.email?.split('@')[0] || 'Almoxarife';
          const recordsToUpdate = admissions.filter(item => item.numero_rm === rmNumber && item.status !== 'Fardado' && item.status !== 'Concluído');

          if (!usingFallback) {
            for (const record of recordsToUpdate) {
              const updatedEvents = appendEventToRecord(record, 'Fardamento Concluído', `Todos fardados por ${userName}`);
              const { error } = await supabase
                .from('admissoes_fardamento')
                .update({ 
                  status: 'Concluído',
                  dt_fardado: nowStr,
                  historico_eventos: JSON.stringify(updatedEvents)
                })
                .eq('id', record.id);
              if (error) throw error;
            }
          }

          const updatedList = admissions.map(item => {
            if (item.numero_rm === rmNumber) {
              if (item.status === 'Fardado' || item.status === 'Concluído') {
                return item; // Incorruptible safeguard
              }
              const updatedEvents = appendEventToRecord(item, 'Fardamento Concluído', `Todos fardados por ${userName}`);
              return {
                ...item,
                status: 'Concluído',
                dt_fardado: nowStr,
                historico_eventos: updatedEvents
              };
            }
            return item;
          });

          await saveAdmissionsToPersistence(updatedList);
          showToast(`RM Nº ${rmNumber} marcada como Concluída! Todos os fardamentos foram entregues.`);
        } catch (err) {
          console.error("Error finalizing fardamento:", err);
          setUsingFallback(true);
          const nowStrFallback = new Date().toISOString();
          const userName = session?.nome || session?.email?.split('@')[0] || 'Almoxarife';
          const updatedList = admissions.map(item => {
            if (item.numero_rm === rmNumber) {
              if (item.status === 'Fardado' || item.status === 'Concluído') {
                return item; // Incorruptible safeguard
              }
              const updatedEvents = appendEventToRecord(item, 'Fardamento Concluído', `Todos fardados por ${userName}`);
              return {
                ...item,
                status: 'Concluído',
                dt_fardado: nowStrFallback,
                historico_eventos: updatedEvents
              };
            }
            return item;
          });
          localStorage.setItem('sgi_admissoes_fardamento', JSON.stringify(updatedList));
          setAdmissions(updatedList);
          showToast("Fardamento concluído localmente.", "info");
        } finally {
          setRefreshing(false);
        }
      }
    });
  };

  // Open Ressalvas modal for an RM (Column 3 Action B)
  const handleOpenRessalvas = (rmNumber: string) => {
    setRessalvaRmNumber(rmNumber);
    setRessalvaType('partial');
    setSelectedFardadosIds([]);
    setOtherRessalvaText('');
    setShowRessalvasModal(true);
  };

  // Save exception handling / Ressalvas (Column 3 Action B save)
  const handleSaveRessalvas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ressalvaRmNumber) {
      showToast('Nenhum número de RM informado.', 'error');
      return;
    }

    const recordsToUpdate = admissions.filter(item => item.numero_rm === ressalvaRmNumber && item.status !== 'Fardado' && item.status !== 'Concluído');
    if (recordsToUpdate.length === 0) {
      showToast('Nenhum colaborador pendente encontrado para este lote.', 'error');
      return;
    }

    // Validation for personalized text
    if (ressalvaType === 'outros' && !otherRessalvaText.trim()) {
      showToast('Por favor, digite a descrição da ressalva.', 'error');
      return;
    }

    const nowStr = new Date().toISOString();
    const userName = session?.nome || session?.email?.split('@')[0] || 'Almoxarife';

    try {
      setRefreshing(true);

      if (!usingFallback) {
        for (const record of recordsToUpdate) {
          let statusToSet = 'Concluído';
          let payload: any = {};
          let etapa = 'Fardamento Concluído';
          let detalhes = `Entregue por ${userName}`;

          if (ressalvaType === 'partial') {
            if (selectedFardadosIds.includes(record.id)) {
              statusToSet = 'Concluído';
              payload = { status: 'Concluído', dt_fardado: nowStr };
              etapa = 'Fardamento Concluído';
              detalhes = `Entregue na entrega parcial por ${userName}`;
            } else {
              statusToSet = 'Aguardando Reagendamento';
              payload = { 
                status: 'Aguardando Reagendamento', 
                dt_reagendamento: nowStr, 
                motivo_ressalva: 'Fardamento Parcial' 
              };
              etapa = 'Fardamento Parcial / Ressalva';
              detalhes = `Motivo: Fardamento Parcial (Faltou algum item). Retornado para Kanban por ${userName}.`;
            }
          } else if (ressalvaType === 'desistente') {
            if (selectedFardadosIds.includes(record.id)) {
              statusToSet = 'Concluído com Ressalva - Desistente';
              payload = { 
                status: 'Concluído com Ressalva - Desistente', 
                dt_reagendamento: nowStr, 
                motivo_ressalva: 'Desistente' 
              };
              etapa = 'Fardamento Parcial / Ressalva';
              detalhes = `Motivo: Desistente. Registrado por ${userName}.`;
            } else {
              statusToSet = 'Concluído';
              payload = { status: 'Concluído', dt_fardado: nowStr };
              etapa = 'Fardamento Concluído';
              detalhes = `Entregue por ${userName}`;
            }
          } else if (ressalvaType === 'outros') {
            statusToSet = `Concluído com Ressalva - ${otherRessalvaText.trim().toUpperCase()}`;
            payload = { 
              status: statusToSet, 
              dt_reagendamento: nowStr, 
              motivo_ressalva: otherRessalvaText.trim().toUpperCase() 
            };
            etapa = 'Fardamento Parcial / Ressalva';
            detalhes = `Motivo: ${otherRessalvaText.trim().toUpperCase()}. Registrado por ${userName}.`;
          }

          const updatedEvents = appendEventToRecord(record, etapa, detalhes);
          payload.historico_eventos = JSON.stringify(updatedEvents);

          const { error } = await supabase
            .from('admissoes_fardamento')
            .update(payload)
            .eq('id', record.id);
          if (error) throw error;
        }
      }

      const updatedList = admissions.map(item => {
        if (item.numero_rm === ressalvaRmNumber) {
          if (item.status === 'Fardado' || item.status === 'Concluído') {
            return item; // Keep historical status untouched and incorruptible
          }
          let statusToSet = 'Concluído';
          let dt_fardado = item.dt_fardado;
          let dt_reagendamento = item.dt_reagendamento;
          let motivo_ressalva = item.motivo_ressalva;
          let etapa = 'Fardamento Concluído';
          let detalhes = `Entregue por ${userName}`;

          if (ressalvaType === 'partial') {
            if (selectedFardadosIds.includes(item.id)) {
              statusToSet = 'Concluído';
              dt_fardado = nowStr;
              etapa = 'Fardamento Concluído';
              detalhes = `Entregue na entrega parcial por ${userName}`;
            } else {
              statusToSet = 'Aguardando Reagendamento';
              dt_reagendamento = nowStr;
              motivo_ressalva = 'Fardamento Parcial';
              etapa = 'Fardamento Parcial / Ressalva';
              detalhes = `Motivo: Fardamento Parcial (Faltou algum item). Retornado para Kanban por ${userName}.`;
            }
          } else if (ressalvaType === 'desistente') {
            if (selectedFardadosIds.includes(item.id)) {
              statusToSet = 'Concluído com Ressalva - Desistente';
              dt_reagendamento = nowStr;
              motivo_ressalva = 'Desistente';
              etapa = 'Fardamento Parcial / Ressalva';
              detalhes = `Motivo: Desistente. Registrado por ${userName}.`;
            } else {
              statusToSet = 'Concluído';
              dt_fardado = nowStr;
              etapa = 'Fardamento Concluído';
              detalhes = `Entregue por ${userName}`;
            }
          } else if (ressalvaType === 'outros') {
            statusToSet = `Concluído com Ressalva - ${otherRessalvaText.trim().toUpperCase()}`;
            dt_reagendamento = nowStr;
            motivo_ressalva = otherRessalvaText.trim().toUpperCase();
            etapa = 'Fardamento Parcial / Ressalva';
            detalhes = `Motivo: ${otherRessalvaText.trim().toUpperCase()}. Registrado por ${userName}.`;
          }

          const updatedEvents = appendEventToRecord(item, etapa, detalhes);

          return {
            ...item,
            status: statusToSet,
            dt_fardado,
            dt_reagendamento,
            motivo_ressalva,
            historico_eventos: updatedEvents
          };
        }
        return item;
      });

      await saveAdmissionsToPersistence(updatedList);
      showToast(`Ressalvas para RM Nº ${ressalvaRmNumber} aplicadas com sucesso!`);
      setShowRessalvasModal(false);
      setRessalvaRmNumber(null);
      setSelectedFardadosIds([]);
      setOtherRessalvaText('');
    } catch (err) {
      console.error("Error saving ressalvas:", err);
      setUsingFallback(true);
      const updatedList = admissions.map(item => {
        if (item.numero_rm === ressalvaRmNumber) {
          if (item.status === 'Fardado' || item.status === 'Concluído') {
            return item; // Keep historical status untouched and incorruptible
          }
          let statusToSet = 'Concluído';
          let dt_fardado = item.dt_fardado;
          let dt_reagendamento = item.dt_reagendamento;
          let motivo_ressalva = item.motivo_ressalva;
          let etapa = 'Fardamento Concluído';
          let detalhes = `Entregue por ${userName}`;

          if (ressalvaType === 'partial') {
            if (selectedFardadosIds.includes(item.id)) {
              statusToSet = 'Concluído';
              dt_fardado = nowStr;
              etapa = 'Fardamento Concluído';
              detalhes = `Entregue na entrega parcial por ${userName}`;
            } else {
              statusToSet = 'Aguardando Reagendamento';
              dt_reagendamento = nowStr;
              motivo_ressalva = 'Fardamento Parcial';
              etapa = 'Fardamento Parcial / Ressalva';
              detalhes = `Motivo: Fardamento Parcial (Faltou algum item). Retornado para Kanban por ${userName}.`;
            }
          } else if (ressalvaType === 'desistente') {
            if (selectedFardadosIds.includes(item.id)) {
              statusToSet = 'Concluído com Ressalva - Desistente';
              dt_reagendamento = nowStr;
              motivo_ressalva = 'Desistente';
              etapa = 'Fardamento Parcial / Ressalva';
              detalhes = `Motivo: Desistente. Registrado por ${userName}.`;
            } else {
              statusToSet = 'Concluído';
              dt_fardado = nowStr;
              etapa = 'Fardamento Concluído';
              detalhes = `Entregue por ${userName}`;
            }
          } else if (ressalvaType === 'outros') {
            statusToSet = `Concluído com Ressalva - ${otherRessalvaText.trim().toUpperCase()}`;
            dt_reagendamento = nowStr;
            motivo_ressalva = otherRessalvaText.trim().toUpperCase();
            etapa = 'Fardamento Parcial / Ressalva';
            detalhes = `Motivo: ${otherRessalvaText.trim().toUpperCase()}. Registrado por ${userName}.`;
          }

          const updatedEvents = appendEventToRecord(item, etapa, detalhes);

          return {
            ...item,
            status: statusToSet,
            dt_fardado,
            dt_reagendamento,
            motivo_ressalva,
            historico_eventos: updatedEvents
          };
        }
        return item;
      });
      localStorage.setItem('sgi_admissoes_fardamento', JSON.stringify(updatedList));
      setAdmissions(updatedList);
      showToast("Ressalvas salvas localmente.", "info");
      setShowRessalvasModal(false);
      setRessalvaRmNumber(null);
      setSelectedFardadosIds([]);
      setOtherRessalvaText('');
    } finally {
      setRefreshing(false);
    }
  };

  // Reschedule records of status 'Aguardando Reagendamento' and send them back to Column 2 ('Disponivel para Separar')
  const handleSaveReagendamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reagendarIds.length === 0) {
      showToast('Nenhum colaborador selecionado para reagendamento.', 'error');
      return;
    }
    if (!reagendarDate) {
      showToast('Por favor, informe a data.', 'error');
      return;
    }
    if (!reagendarTime) {
      showToast('Por favor, informe o horário.', 'error');
      return;
    }

    try {
      setRefreshing(true);
      const userName = session?.nome || session?.email?.split('@')[0] || 'Almoxarife';
      // Filter out any Fardado or Concluido records from being updated
      const recordsToUpdate = admissions.filter(item => reagendarIds.includes(item.id) && item.status !== 'Fardado' && item.status !== 'Concluído');

      if (!usingFallback) {
        for (const record of recordsToUpdate) {
          const updatedEvents = appendEventToRecord(
            record, 
            'Solicitação Reagendada', 
            `Reagendado para ${reagendarDate.split('-').reverse().join('/')} às ${reagendarTime} por ${userName}`
          );
          const { error } = await supabase
            .from('admissoes_fardamento')
            .update({
              status: 'Disponivel para Separar',
              data_agendamento: reagendarDate,
              hora_agendamento: reagendarTime,
              historico_eventos: JSON.stringify(updatedEvents)
            })
            .eq('id', record.id);
          if (error) throw error;
        }
      }

      const updatedList = admissions.map(item => {
        if (reagendarIds.includes(item.id)) {
          if (item.status === 'Fardado' || item.status === 'Concluído') {
            return item; // Keep historical status untouched and incorruptible
          }
          const specs = {
            ...item.especificacoes,
            hora_fardamento: reagendarTime
          };
          const updatedEvents = appendEventToRecord(
            item, 
            'Solicitação Reagendada', 
            `Reagendado para ${reagendarDate.split('-').reverse().join('/')} às ${reagendarTime} por ${userName}`
          );
          return {
            ...item,
            status: 'Disponivel para Separar' as any,
            data_agendamento: reagendarDate,
            hora_agendamento: reagendarTime,
            especificacoes: specs,
            historico_eventos: updatedEvents
          };
        }
        return item;
      });

      await saveAdmissionsToPersistence(updatedList);
      showToast(`${recordsToUpdate.length} colaborador(es) reagendado(s) e enviado(s) para a área de separação!`);
      setShowReagendarModal(false);
      setReagendarIds([]);
      setSelectedHistoryIds(prev => prev.filter(id => !reagendarIds.includes(id)));
    } catch (err) {
      console.error("Error saving reagendamento:", err);
      setUsingFallback(true);
      const userName = session?.nome || session?.email?.split('@')[0] || 'Almoxarife';
      const updatedList = admissions.map(item => {
        if (reagendarIds.includes(item.id)) {
          if (item.status === 'Fardado' || item.status === 'Concluído') {
            return item; // Keep historical status untouched and incorruptible
          }
          const specs = {
            ...item.especificacoes,
            hora_fardamento: reagendarTime
          };
          const updatedEvents = appendEventToRecord(
            item, 
            'Solicitação Reagendada', 
            `Reagendado para ${reagendarDate.split('-').reverse().join('/')} às ${reagendarTime} por ${userName}`
          );
          return {
            ...item,
            status: 'Disponivel para Separar' as any,
            data_agendamento: reagendarDate,
            hora_agendamento: reagendarTime,
            especificacoes: specs,
            historico_eventos: updatedEvents
          };
        }
        return item;
      });
      localStorage.setItem('sgi_admissoes_fardamento', JSON.stringify(updatedList));
      setAdmissions(updatedList);
      showToast("Reagendamento efetuado localmente.", "info");
      setShowReagendarModal(false);
      setReagendarIds([]);
      setSelectedHistoryIds(prev => prev.filter(id => !reagendarIds.includes(id)));
    } finally {
      setRefreshing(false);
    }
  };

  // Mailto Dispatcher for requesting RM
  const handleRequestRM = (record: AdmissionRecord) => {
    const techEmail = 'suprimentos@cmpc.com.br';
    const subject = `SOLICITAÇÃO DE RM (ADMISSÃO) - ${record.nome} - ${record.obra.toUpperCase()}`;
    
    const kitLines = getKitList(record.kit_gerado);

    const bodyLines = [
      `DADOS DO COLABORADOR:`,
      `Nome: ${record.nome}`,
      `CPF: ${record.cpf}`,
      `Cargo: ${record.cargo}`,
      `Obra/Frente: ${record.obra}`,
      `Data de Agendamento: ${record.data_agendamento.split('-').reverse().join('/')}`,
      ``,
      `LISTA EXATA E DETALHADA DOS ITENS GERADOS (PRONTOS PARA COPIAR E COLAR NO ERP):`,
      `--------------------------------------------------`,
      ...kitLines.map(item => `${item}`),
      `--------------------------------------------------`,
      ``,
      `Por favor, proceda com a emissão da RM correspondente.`,
      ``,
      `Atenciosamente,`,
      `Departamento de Recursos Humanos`
    ];

    const mailtoUrl = `mailto:${techEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;
    
    // Trigger the email client
    window.location.href = mailtoUrl;

    // Transition status to 'Aguardando Número RM'
    handleUpdateStatus(record.id, 'Aguardando Número RM');
  };

  // Batch update records of status 'Aguardando Número RM' with an RM number and transition to 'Tratamento Almoxarifado'
  const handleVincularRMLote = async (loteId: string, idsDoLote: string[], numeroRmDigitado: string) => {
    if (idsDoLote.length === 0) {
      showToast('Nenhum colaborador no lote para vincular.', 'error');
      return;
    }
    if (!numeroRmDigitado.trim()) {
      showToast('Por favor, informe o número da RM.', 'error');
      return;
    }

    const colaboradoresSelecionados = admissions.filter(item => idsDoLote.includes(item.id));
    const obrasUnicas = new Set(colaboradoresSelecionados.map(colab => (colab.obra || '').trim()));
    if (obrasUnicas.size > 1) {
      alert("OPERAÇÃO BLOQUEADA: Você selecionou colaboradores de obras diferentes. A regra de negócio exige que um lote/RM contenha apenas colaboradores do mesmo centro de custo.");
      return;
    }

    try {
      setRefreshing(true);
      const rmValor = numeroRmDigitado.trim().toUpperCase();

      const nowStr = new Date().toISOString();

      if (!usingFallback) {
        const { error } = await supabase
          .from('admissoes_fardamento')
          .update({ 
             numero_rm: rmValor, 
             status: 'Tratamento Almoxarifado',
             dt_rm_atribuida: nowStr
          })
          .in('id', idsDoLote);

        if (error) throw error;
      }

      // Update local state
      const updatedList = admissions.map(item => {
        if (idsDoLote.includes(item.id)) {
          return { 
            ...item, 
            status: 'Tratamento Almoxarifado' as any,
            numero_rm: rmValor,
            dt_rm_atribuida: nowStr
          };
        }
        return item;
      });

      await saveAdmissionsToPersistence(updatedList);
      showToast(`Lote com ${idsDoLote.length} colaborador(es) vinculado(s) à RM Nº ${rmValor}!`);

      // Clean up the input state for that batch
      setBatchRmInputs(prev => {
        const next = { ...prev };
        delete next[loteId];
        return next;
      });
    } catch (err) {
      console.error("Erro ao vincular RM em lote:", err);
      setUsingFallback(true);
      const rmValor = numeroRmDigitado.trim().toUpperCase();
      const nowStrFallback = new Date().toISOString();
      const updatedList = admissions.map(item => {
        if (idsDoLote.includes(item.id)) {
          return { 
            ...item, 
            status: 'Tratamento Almoxarifado' as any,
            numero_rm: rmValor,
            dt_rm_atribuida: nowStrFallback
          };
        }
        return item;
      });
      localStorage.setItem('sgi_admissoes_fardamento', JSON.stringify(updatedList));
      setAdmissions(updatedList);
      showToast('Vinculação efetuada localmente no navegador.', 'info');

      // Clean up local input too on fallback success
      setBatchRmInputs(prev => {
        const next = { ...prev };
        delete next[loteId];
        return next;
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Return a batch (or unbatched group) back to 'Aguardando RM' (Edição de Tamanhos)
  const handleRetornarParaEdicaoLote = async (loteId: string, recordsDoLote: AdmissionRecord[]) => {
    try {
      setRefreshing(true);
      const userName = session?.nome || session?.email?.split('@')[0] || 'Usuário';
      const idsDoLote = recordsDoLote.map(r => r.id);

      if (!usingFallback) {
        for (const record of recordsDoLote) {
          const updatedEvents = appendEventToRecord(record, 'Retornado para Edição', `Retornado para edição de tamanhos por ${userName}`);
          const { error } = await supabase
            .from('admissoes_fardamento')
            .update({
              status: 'Aguardando RM',
              lote_id: null,
              historico_eventos: JSON.stringify(updatedEvents)
            })
            .eq('id', record.id);

          if (error) throw error;
        }
      }

      // Update local state
      const updatedList = admissions.map(item => {
        if (idsDoLote.includes(item.id)) {
          const updatedEvents = appendEventToRecord(item, 'Retornado para Edição', `Retornado para edição de tamanhos por ${userName}`);
          return {
            ...item,
            status: 'Aguardando RM' as any,
            lote_id: null,
            historico_eventos: updatedEvents
          };
        }
        return item;
      });

      await saveAdmissionsToPersistence(updatedList);
      showToast(`${recordsDoLote.length} colaborador(es) retornado(s) para edição de tamanhos com sucesso!`);
    } catch (err) {
      console.error("Erro ao retornar lote para edição:", err);
      setUsingFallback(true);
      const userName = session?.nome || session?.email?.split('@')[0] || 'Usuário';
      const idsDoLote = recordsDoLote.map(r => r.id);

      const updatedList = admissions.map(item => {
        if (idsDoLote.includes(item.id)) {
          const updatedEvents = appendEventToRecord(item, 'Retornado para Edição', `Retornado para edição de tamanhos por ${userName}`);
          return {
            ...item,
            status: 'Aguardando RM' as any,
            lote_id: null,
            historico_eventos: updatedEvents
          };
        }
        return item;
      });

      localStorage.setItem('sgi_admissoes_fardamento', JSON.stringify(updatedList));
      setAdmissions(updatedList);
      showToast('Retornado para edição localmente (Contingência).', 'info');
    } finally {
      setRefreshing(false);
    }
  };

  // Get all admissions currently waiting for RM number
  const waitingForRm = useMemo(() => {
    return admissions.filter(i => i.status === 'Aguardando Número RM' || i.status === 'RM Solicitada');
  }, [admissions]);

  // Group waitingForRm by lote_id using reduce
  const groupedWaitingForRm = useMemo(() => {
    return waitingForRm.reduce((acc, record) => {
      const hasLote = record.lote_id !== null && record.lote_id !== undefined;
      const loteId = hasLote ? record.lote_id : 'unbatched';
      if (!acc[loteId]) {
        acc[loteId] = [];
      }
      acc[loteId].push(record);
      return acc;
    }, {} as Record<string, AdmissionRecord[]>);
  }, [waitingForRm]);

  // Filter & Search Logic
  const filteredAdmissions = useMemo(() => {
    return admissions.filter(item => {
      const matchSearch = 
         item.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
         item.cpf.includes(searchQuery) ||
         item.cargo.toLowerCase().includes(searchQuery.toLowerCase()) ||
         item.obra.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchStatus = true;
      if (activeTab === 'rh') {
        if (rhSubTab === 'pendentes') {
          matchStatus = item.status === 'Aguardando RM' || item.status === 'Aguardando Lote';
        } else {
          matchStatus = item.status === 'Aguardando Número RM' || item.status === 'RM Solicitada';
        }
      } else {
        matchStatus = statusFilter === 'Todos' || item.status === statusFilter;
      }
      
      return matchSearch && matchStatus;
    });
  }, [admissions, searchQuery, statusFilter, activeTab, rhSubTab]);

  // Grouped by RM logic using .reduce() for the Warehouse view
  const groupedByRm = useMemo(() => {
    const tratamentoRecords = admissions.filter(item => item.status === 'Disponivel para Separar');
    
    // Filter by search query if applicable
    const searchedRecords = tratamentoRecords.filter(item => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        item.nome.toLowerCase().includes(query) ||
        item.cpf.includes(query) ||
        item.cargo.toLowerCase().includes(query) ||
        item.obra.toLowerCase().includes(query) ||
        (item.numero_rm && item.numero_rm.toLowerCase().includes(query))
      );
    });

    // Grouping using reduce
    return searchedRecords.reduce<Record<string, AdmissionRecord[]>>((groups, record) => {
      const rm = record.numero_rm || 'SEM RM DEFINIDA';
      if (!groups[rm]) {
        groups[rm] = [];
      }
      groups[rm].push(record);
      return groups;
    }, {});
  }, [admissions, searchQuery]);

  // Kanban Column 1: Triagem RM Selector
  const triagemRms = useMemo(() => {
    const records = admissions.filter(item => item.status === 'Tratamento Almoxarifado');
    const searched = records.filter(item => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        item.nome.toLowerCase().includes(query) ||
        item.cpf.includes(query) ||
        item.cargo.toLowerCase().includes(query) ||
        item.obra.toLowerCase().includes(query) ||
        (item.numero_rm && item.numero_rm.toLowerCase().includes(query))
      );
    });

    return searched.reduce<Record<string, AdmissionRecord[]>>((groups, record) => {
      const rm = record.numero_rm || 'SEM RM';
      if (!groups[rm]) {
        groups[rm] = [];
      }
      groups[rm].push(record);
      return groups;
    }, {});
  }, [admissions, searchQuery]);

  // Kanban Column 2: Separação RM Selector
  const separacaoRms = useMemo(() => {
    const records = admissions.filter(item => item.status === 'Disponivel para Separar');
    const searched = records.filter(item => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        item.nome.toLowerCase().includes(query) ||
        item.cpf.includes(query) ||
        item.cargo.toLowerCase().includes(query) ||
        item.obra.toLowerCase().includes(query) ||
        (item.numero_rm && item.numero_rm.toLowerCase().includes(query))
      );
    });

    return searched.reduce<Record<string, AdmissionRecord[]>>((groups, record) => {
      const rm = record.numero_rm || 'SEM RM';
      if (!groups[rm]) {
        groups[rm] = [];
      }
      groups[rm].push(record);
      return groups;
    }, {});
  }, [admissions, searchQuery]);

  // Kanban Column 3: Agendados / Entrega RM Selector
  const entregaRms = useMemo(() => {
    const records = admissions.filter(item => item.status === 'Aguardando Fardamento');
    const searched = records.filter(item => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        item.nome.toLowerCase().includes(query) ||
        item.cpf.includes(query) ||
        item.cargo.toLowerCase().includes(query) ||
        item.obra.toLowerCase().includes(query) ||
        (item.numero_rm && item.numero_rm.toLowerCase().includes(query))
      );
    });

    return searched.reduce<Record<string, AdmissionRecord[]>>((groups, record) => {
      const rm = record.numero_rm || 'SEM RM';
      if (!groups[rm]) {
        groups[rm] = [];
      }
      groups[rm].push(record);
      return groups;
    }, {});
  }, [admissions, searchQuery]);

  // Grouped status stats
  const stats = useMemo(() => {
    const counts = {
      total: admissions.length,
      aguardandoRM: admissions.filter(item => item.status === 'Aguardando RM' || item.status === 'Aguardando Lote').length,
      aguardandoNumeroRM: admissions.filter(item => item.status === 'Aguardando Número RM' || item.status === 'RM Solicitada').length,
      tratamentoAlmoxarifado: admissions.filter(item => item.status === 'Tratamento Almoxarifado').length,
      separacao: admissions.filter(item => item.status === 'Disponivel para Separar').length,
      rmSolicitada: admissions.filter(item => item.status === 'RM Solicitada').length,
      agendado: admissions.filter(item => item.status === 'Agendado' || item.status === 'Aguardando Fardamento').length,
      fardado: admissions.filter(item => 
        item.status === 'Fardado' || 
        item.status === 'Concluído' || 
        item.status === 'Aguardando Reagendamento' || 
        item.status.startsWith('Concluído com Ressalva')
      ).length,
      hoje: admissions.filter(item => {
        const todayStr = new Date().toISOString().split('T')[0];
        return item.data_agendamento === todayStr && 
          item.status !== 'Fardado' && 
          item.status !== 'Concluído' && 
          !item.status.startsWith('Concluído com Ressalva');
      }).length
    };
    return counts;
  }, [admissions]);

  // BI Dashboard selectors using useMemo for performance
  const biUniqueObras = useMemo(() => {
    const list = admissions.map(item => item.obra).filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [admissions]);

  const biFilteredAdmissions = useMemo(() => {
    return admissions.filter(item => {
      // 1. Period filter (data_agendamento or created_at)
      if (appliedFilters.startDate || appliedFilters.endDate) {
        const recordDateStr = item.data_agendamento || (item.created_at ? item.created_at.split('T')[0] : '');
        if (!recordDateStr) return false;
        
        if (appliedFilters.startDate && recordDateStr < appliedFilters.startDate) {
          return false;
        }
        if (appliedFilters.endDate && recordDateStr > appliedFilters.endDate) {
          return false;
        }
      }

      // 2. Obra filter
      if (appliedFilters.obra !== 'Todos') {
        if (item.obra !== appliedFilters.obra) {
          return false;
        }
      }

      // 3. RM filter (exact case-insensitive trimmed)
      if (appliedFilters.rm) {
        const itemRm = item.numero_rm ? item.numero_rm.trim() : '';
        const searchRm = appliedFilters.rm.trim();
        if (itemRm.toLowerCase() !== searchRm.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [admissions, appliedFilters]);

  const biFunnelMetrics = useMemo(() => {
    return {
      aguardandoRM: biFilteredAdmissions.filter(item => item.status === 'Aguardando RM' || item.status === 'Aguardando Lote' || item.status === 'Aguardando Número RM').length,
      aguardandoAprovacao: biFilteredAdmissions.filter(item => item.status === 'Tratamento Almoxarifado').length,
      aguardandoSeparacao: biFilteredAdmissions.filter(item => item.status === 'Disponivel para Separar').length,
      aguardandoEntrega: biFilteredAdmissions.filter(item => item.status === 'Aguardando Fardamento').length,
    };
  }, [biFilteredAdmissions]);

  const biRessalvasStats = useMemo(() => {
    const concluidos = biFilteredAdmissions.filter(item => item.status.includes('Concluído'));
    const totalConcluidos = concluidos.length;
    const totalRessalvas = concluidos.filter(item => item.status.includes('Ressalva')).length;
    const totalPerfeitas = totalConcluidos - totalRessalvas;
    const percentageRessalvas = totalConcluidos > 0 ? (totalRessalvas / totalConcluidos) * 100 : 0;
    const percentagePerfeitas = totalConcluidos > 0 ? 100 - percentageRessalvas : 100;

    const chartData = [
      { name: 'Entregas Perfeitas', value: totalPerfeitas, percentage: percentagePerfeitas },
      { name: 'Entregas com Ressalva', value: totalRessalvas, percentage: percentageRessalvas }
    ];

    return {
      totalConcluidos,
      totalRessalvas,
      totalPerfeitas,
      percentageRessalvas: percentageRessalvas.toFixed(1),
      percentagePerfeitas: percentagePerfeitas.toFixed(1),
      chartData
    };
  }, [biFilteredAdmissions]);

  const biVolumeByObraData = useMemo(() => {
    const concluidos = biFilteredAdmissions.filter(item => item.status.includes('Concluído'));
    
    // Count per Obra
    const counts: Record<string, number> = {};
    concluidos.forEach(item => {
      const obraName = item.obra || 'Sem Obra';
      counts[obraName] = (counts[obraName] || 0) + 1;
    });

    // Convert to Array for Recharts
    return Object.entries(counts)
      .map(([name, fardamentos]) => ({ name, fardamentos }))
      .sort((a, b) => b.fardamentos - a.fardamentos);
  }, [biFilteredAdmissions]);

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Corporate styling colors
      const primaryColor = [15, 23, 42]; // Slate 900
      const accentColor = [79, 70, 229]; // Indigo 600
      const textColor = [51, 65, 85]; // Slate 700
      const lightBg = [248, 250, 252]; // Slate 50
      const borderLineColor = [226, 232, 240]; // Slate 200

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);

      let currentY = 15;

      // 1. BRANDING HEADER
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(margin, currentY, contentWidth, 22, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text("SGI - SISTEMA DE GESTÃO INTEGRADA", margin + 6, currentY + 8.5);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text("RELATÓRIO BI - PAINEL DE ACOMPANHAMENTO E LOGÍSTICA DE FARDAMENTOS", margin + 6, currentY + 15.5);

      const printDateStr = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.setFontSize(7.5);
      doc.text(`Emitido em: ${printDateStr}`, pageWidth - margin - 6, currentY + 12.5, { align: 'right' });

      currentY += 28;

      // 2. APPLIED FILTERS SUMMARY
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.setDrawColor(borderLineColor[0], borderLineColor[1], borderLineColor[2]);
      doc.roundedRect(margin, currentY, contentWidth, 24, 3, 3, 'FD');

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text("PARÂMETROS DE FILTRAGEM DO RELATÓRIO BI:", margin + 5, currentY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);

      const startD = appliedFilters.startDate ? appliedFilters.startDate.split('-').reverse().join('/') : 'Início';
      const endD = appliedFilters.endDate ? appliedFilters.endDate.split('-').reverse().join('/') : 'Fim';
      doc.text(`Período Selecionado:  ${startD}  até  ${endD}`, margin + 5, currentY + 13);
      doc.text(`Centro de Custo / Obra:  ${appliedFilters.obra.toUpperCase()}`, margin + 5, currentY + 19);
      doc.text(`Filtro por RM Específica:  ${appliedFilters.rm || 'NENHUMA (EXIBINDO TODOS)'}`, pageWidth / 2 + 10, currentY + 19);

      currentY += 30;

      // 3. OPERATIONAL FUNNEL KPIs
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text("1. FUNIL OPERACIONAL DE ATENDIMENTO (PIPELINE DE ADMISSÃO)", margin, currentY);

      currentY += 4;
      
      const colWidth = (contentWidth - 9) / 4;
      const kpiMetrics = [
        { title: 'Aguardando RM', value: biFunnelMetrics.aguardandoRM, color: [245, 158, 11] },
        { title: 'Triagem / Almo.', value: biFunnelMetrics.aguardandoAprovacao, color: [79, 70, 229] },
        { title: 'Na Separação', value: biFunnelMetrics.aguardandoSeparacao, color: [14, 165, 233] },
        { title: 'Fardamentos Prontos', value: biFunnelMetrics.aguardandoEntrega, color: [16, 185, 129] }
      ];

      kpiMetrics.forEach((kpi, idx) => {
        const colX = margin + idx * (colWidth + 3);
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.setDrawColor(borderLineColor[0], borderLineColor[1], borderLineColor[2]);
        doc.roundedRect(colX, currentY, colWidth, 22, 2.5, 2.5, 'FD');

        // Vertical indicator band
        doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
        doc.rect(colX, currentY, 2.5, 22, 'F');

        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(kpi.title.toUpperCase(), colX + 5, currentY + 7);

        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFontSize(15);
        doc.text(String(kpi.value), colX + 5, currentY + 16);
      });

      currentY += 28;

      // 4. DELIVERY QUALITY & RESSALVA INDEX
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text("2. ÍNDICE DE QUALIDADE SGI & CONTROLE DE OCORRÊNCIAS", margin, currentY);

      currentY += 4;

      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.setDrawColor(borderLineColor[0], borderLineColor[1], borderLineColor[2]);
      doc.roundedRect(margin, currentY, contentWidth, 34, 3, 3, 'FD');

      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      const statRows = [
        { label: 'TOTAL DE ENTREGAS FINALIZADAS (CONCLUÍDAS):', value: `${biRessalvasStats.totalConcluidos} fardamento(s)` },
        { label: 'ENTREGAS PERFEITAS (FINALIZADAS SEM OCORRÊNCIA DE RESSALVAS):', value: `${biRessalvasStats.totalPerfeitas} fardamento(s) (${biRessalvasStats.percentagePerfeitas}%)`, isSuccess: true },
        { label: 'ENTREGAS COM RESSALVA OU DESISTÊNCIAS REGISTRADAS:', value: `${biRessalvasStats.totalRessalvas} fardamento(s) (${biRessalvasStats.percentageRessalvas}%)`, isWarning: true }
      ];

      statRows.forEach((row, idx) => {
        const rowY = currentY + 7.5 + (idx * 9.5);
        doc.setFont('helvetica', 'bold');
        doc.text(row.label, margin + 5, rowY);

        if (row.isSuccess) {
          doc.setTextColor(16, 185, 129); // Emerald
        } else if (row.isWarning) {
          doc.setTextColor(217, 119, 6); // Amber
        } else {
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        }
        doc.setFont('helvetica', 'bold');
        doc.text(row.value, pageWidth - margin - 5, rowY, { align: 'right' });
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        
        if (idx < 2) {
          doc.setDrawColor(borderLineColor[0], borderLineColor[1], borderLineColor[2]);
          doc.line(margin + 4, rowY + 3, pageWidth - margin - 4, rowY + 3);
        }
      });

      currentY += 40;

      // 5. REGIONAL BREAKDOWN TABLE
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text("3. DISTRIBUIÇÃO LOGÍSTICA DE ENTREGAS CONCLUÍDAS POR CENTRO DE CUSTO / OBRA", margin, currentY);

      currentY += 5;

      // Table Header Row
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(margin, currentY, contentWidth, 8, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text("IDENTIFICAÇÃO DA OBRA / FRENTE DE TRABALHO", margin + 5, currentY + 5.5);
      doc.text("FARDAMENTOS CONCLUÍDOS", pageWidth - margin - 5, currentY + 5.5, { align: 'right' });

      currentY += 8;

      if (biVolumeByObraData.length === 0) {
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.rect(margin, currentY, contentWidth, 12, 'F');
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text("Nenhum fardamento concluído localizado com os filtros selecionados.", pageWidth / 2, currentY + 7.5, { align: 'center' });
        currentY += 12;
      } else {
        biVolumeByObraData.forEach((row, idx) => {
          if (currentY > 265) {
            doc.addPage();
            currentY = 15;
            
            // Repeat Header
            doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.rect(margin, currentY, contentWidth, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.text("IDENTIFICAÇÃO DA OBRA / FRENTE DE TRABALHO (CONTINUAÇÃO)", margin + 5, currentY + 5.5);
            doc.text("FARDAMENTOS CONCLUÍDOS", pageWidth - margin - 5, currentY + 5.5, { align: 'right' });
            currentY += 8;
          }

          // Row zebra styling
          if (idx % 2 === 0) {
            doc.setFillColor(255, 255, 255);
          } else {
            doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
          }
          doc.rect(margin, currentY, contentWidth, 8, 'F');

          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.text(row.name.toUpperCase(), margin + 5, currentY + 5.5);

          doc.setFont('helvetica', 'bold');
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.text(`${row.fardamentos} colaborador(es) fardado(s)`, pageWidth - margin - 5, currentY + 5.5, { align: 'right' });

          doc.setDrawColor(borderLineColor[0], borderLineColor[1], borderLineColor[2]);
          doc.line(margin, currentY + 8, pageWidth - margin, currentY + 8);

          currentY += 8;
        });
      }

      // Bottom footer signature stamp
      doc.setDrawColor(borderLineColor[0], borderLineColor[1], borderLineColor[2]);
      doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("SGI - Sistema de Gestão Integrada • Painel Administrativo de Recursos Humanos", margin, pageHeight - 11);
      doc.text("Relatório Confidencial de Uso Interno", pageWidth - margin, pageHeight - 11, { align: 'right' });

      doc.save(`sgi_bi_fardamento_${new Date().toISOString().split('T')[0]}.pdf`);
      showToast("Relatório PDF de BI gerado e baixado com sucesso!");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      showToast("Erro de compilação do relatório PDF. Contate o SGI.", "error");
    }
  };

  const handleExportExcel = (recordsToExport: AdmissionRecord[], fileNameSuffix = 'Geral') => {
    try {
      if (recordsToExport.length === 0) {
        showToast('Nenhum registro para exportar.', 'info');
        return;
      }

      const rows = recordsToExport.map(record => {
        const slaTotal = calculateLeadTime(record.dt_solicitacao_rh, record.dt_fardado) || 
                         (record.dt_solicitacao_rh ? calculateLeadTime(record.dt_solicitacao_rh, new Date().toISOString()) + ' (Em Aberto)' : 'N/A');

        const timelineString = Array.isArray(record.historico_eventos)
          ? [...record.historico_eventos]
              .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
              .map(e => `${formatDateTimeFull(e.data)}: ${e.etapa}${e.detalhes ? ` (${e.detalhes})` : ''}`)
              .join(' | ')
          : 'N/A';

        return {
          'ID': record.id || 'N/A',
          'Colaborador': record.nome || 'N/A',
          'Cargo': record.cargo || 'N/A',
          'CPF': record.cpf || 'N/A',
          'Obra / Frente': record.obra || 'N/A',
          'Tipo de Requisição': record.tipo_requisicao || 'Admissão',
          'Kit Gerado': record.kit_gerado || 'N/A',
          'RM Lote': record.numero_rm ? `RM Nº ${record.numero_rm}` : 'SEM RM',
          'Status / Ocorrência': record.status || 'N/A',
          'Data Agendamento': record.data_agendamento ? formatDateOnly(record.data_agendamento) : 'N/A',
          'Hora Agendamento': record.especificacoes?.hora_fardamento || record.hora_agendamento || 'N/A',
          'Data da Solicitação (RH)': record.dt_solicitacao_rh ? formatDateTimeFull(record.dt_solicitacao_rh) : 'N/A',
          'Data da RM Atribuída': record.dt_rm_atribuida ? formatDateTimeFull(record.dt_rm_atribuida) : 'N/A',
          'Data da RM Aprovada': record.dt_rm_aprovada ? formatDateTimeFull(record.dt_rm_aprovada) : 'N/A',
          'Data da Separação': record.dt_separado ? formatDateTimeFull(record.dt_separado) : 'N/A',
          'Data do Fardamento Entregue': record.dt_fardado ? formatDateTimeFull(record.dt_fardado) : 'N/A',
          'Data do Reagendamento': record.dt_reagendamento ? formatDateTimeFull(record.dt_reagendamento) : 'N/A',
          'Motivo da Ressalva / Cancelamento': record.motivo_ressalva || 'N/A',
          'SLA Total (Lead Time)': slaTotal,
          'Linha do Tempo Completa': timelineString
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Auditoria Fardamentos');

      // Autofit columns nicely
      const maxLens = Object.keys(rows[0] || {}).map(key => {
        let maxLen = key.length;
        rows.forEach(row => {
          const val = String((row as any)[key] || '');
          if (val.length > maxLen) maxLen = val.length;
        });
        return { wch: maxLen + 3 };
      });
      worksheet['!cols'] = maxLens;

      XLSX.writeFile(workbook, `relatorio_auditoria_fardamentos_${fileNameSuffix.toLowerCase()}_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast('Relatório de auditoria em Excel exportado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      showToast('Erro ao exportar relatório em Excel.', 'error');
    }
  };

  // Historical Records Memo Selectors
  const historicoRecords = useMemo(() => {
    return admissions.filter(item => 
      item.status === 'Concluído' || 
      item.status === 'Aguardando Reagendamento' || 
      item.status.startsWith('Concluído com Ressalva')
    );
  }, [admissions]);

  const filteredHistoricoRecords = useMemo(() => {
    if (!historySearchQuery) return historicoRecords;
    const query = historySearchQuery.toLowerCase();
    return historicoRecords.filter(item => 
      item.nome.toLowerCase().includes(query) ||
      item.cpf.includes(query) ||
      item.obra.toLowerCase().includes(query) ||
      (item.numero_rm && item.numero_rm.toLowerCase().includes(query))
    );
  }, [historicoRecords, historySearchQuery]);

  const historyPageSize = 10;
  const historyTotalPages = Math.ceil(filteredHistoricoRecords.length / historyPageSize) || 1;
  const paginatedHistoryRecords = useMemo(() => {
    const startIndex = (historyPage - 1) * historyPageSize;
    return filteredHistoricoRecords.slice(startIndex, startIndex + historyPageSize);
  }, [filteredHistoricoRecords, historyPage]);

  // Reset page when search query changes
  useEffect(() => {
    setHistoryPage(1);
  }, [historySearchQuery]);

  // Open physical kit checklist
  const handleOpenKitChecklist = (record: AdmissionRecord) => {
    setSelectedAdmissionForKit(record);
    const initialChecked: Record<string, boolean> = {};
    // Mark clothing items
    initialChecked['camisa'] = false;
    initialChecked['calca'] = false;
    initialChecked['bota'] = false;
    // Mark generated EPIs
    getKitList(record.kit_gerado).forEach((epi, idx) => {
      initialChecked[`epi-${idx}`] = false;
    });
    setCheckedKitItems(initialChecked);
  };

  const handleToggleCheckItem = (key: string) => {
    setCheckedKitItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isKitFullyChecked = useMemo(() => {
    if (!selectedAdmissionForKit) return false;
    return Object.values(checkedKitItems).every(v => v === true);
  }, [checkedKitItems, selectedAdmissionForKit]);

  // Check if date is Today (Local date compare)
  const isDateToday = (dateStr: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    return dateStr === todayStr;
  };

  // Function to format date nicely
  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" id="fardamento-module-root">
      {/* Toast Alert Box */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-6 right-6 z-[100] px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              toast.type === 'error' 
                ? 'bg-red-950 border-red-500/30 text-red-200' 
                : toast.type === 'info'
                ? 'bg-indigo-950 border-indigo-500/30 text-indigo-200'
                : 'bg-emerald-950 border-emerald-500/30 text-emerald-200'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            ) : toast.type === 'info' ? (
              <Info className="w-5 h-5 text-indigo-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <span className="text-xs font-semibold uppercase tracking-wider">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToHub}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-xl transition duration-150 text-slate-400 cursor-pointer"
              title="Voltar ao SGI Hub"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-cmpc-purple" />
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Almoxarifado & Gestão de Pessoas</span>
              </div>
              <h1 className="text-xl font-black uppercase tracking-tight text-white font-sans mt-0.5">
                Central de Admissões & Fardamentos
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Supabase Status Pill */}
            <div className={`px-3.5 py-1.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 border ${
              usingFallback 
                ? 'bg-amber-950/40 border-amber-800/50 text-amber-400' 
                : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${usingFallback ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              {usingFallback ? 'CONTINGÊNCIA (LOCAL)' : 'NUVEM SGI SUPABASE'}
            </div>

            <button
              onClick={() => {
                setRefreshing(true);
                loadAdmissions(true);
              }}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition duration-150 cursor-pointer"
              title="Recarregar dados"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-grow flex flex-col gap-6">
        
        {/* Statistics Widgets */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Admitidos</span>
            <span className="text-2xl font-black text-white mt-1">{stats.total}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AGUARDANDO Nº RM</span>
            <span className="text-2xl font-black text-amber-550 mt-1">{stats.aguardandoNumeroRM}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Agendado</span>
            <span className="text-2xl font-black text-violet-400 mt-1">{stats.agendado}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fardado / Pronto</span>
            <span className="text-2xl font-black text-emerald-400 mt-1">{stats.fardado}</span>
          </div>
          <div className="bg-rose-950/30 border border-rose-900/50 rounded-2xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
            <div className="absolute right-2 top-2 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Entregas Hoje</span>
            <span className="text-2xl font-black text-rose-500 mt-1">{stats.hoje}</span>
          </div>
        </div>

        {/* Modular Navigation Tabs */}
        <div className="bg-slate-900 p-1.5 rounded-2xl border border-slate-800 flex flex-col md:flex-row w-full gap-1">
          <button
            onClick={() => setActiveTab('rh')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'rh'
                ? 'bg-indigo-650 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Área do RH (Cadastro e Solicitações)
          </button>
          <button
            onClick={() => setActiveTab('almoxarifado')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'almoxarifado'
                ? 'bg-indigo-650 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Package className="w-4 h-4" />
            Área do Almoxarifado (Painel Operacional)
          </button>
          <button
            onClick={() => setActiveTab('historico')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'historico'
                ? 'bg-indigo-650 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            Histórico de Fardamentos
          </button>
          <button
            onClick={() => setActiveTab('bi')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'bi'
                ? 'bg-indigo-650 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            BI de Indicadores (Dashboard)
          </button>
        </div>

        {/* Tab View Render */}
        <div className="flex-grow">
          {dbError ? (
            <div className="py-16 px-6 text-center bg-slate-900 border border-rose-950/40 rounded-3xl max-w-2xl mx-auto shadow-2xl">
              <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
              <h3 className="text-white font-black uppercase tracking-wider text-sm mb-2">Erro de Conexão com o Banco de Dados</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-relaxed mb-6">
                Não foi possível conectar à tabela real <code className="text-rose-400">admissoes_fardamento</code> do Supabase:
                <span className="text-white font-mono block mt-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[10px] break-all">{dbError}</span>
              </p>
              <button
                onClick={() => {
                  setDbError(null);
                  loadAdmissions();
                }}
                className="px-5 py-3 bg-indigo-650 hover:bg-indigo-550 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar Sincronizar Novamente
              </button>
            </div>
          ) : loading ? (
            <div className="py-24 text-center">
              <RefreshCw className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Sincronizando dados de admissão...</p>
            </div>
          ) : (
            <div className="space-y-6">

              {/* TAB 1: AREA DO RH */}
              {activeTab === 'rh' && (
                <div className="space-y-6">
                  
                  {/* RH SUB-TABS (Navegação por Abas do RH) */}
                  <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex w-full max-w-lg mx-auto shadow-lg">
                    <button
                      onClick={() => setRhSubTab('pendentes')}
                      className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        rhSubTab === 'pendentes'
                          ? 'bg-indigo-650 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/40'
                      }`}
                    >
                      <UserPlus className="w-4 h-4" />
                      Pendentes (Gerar Lote)
                    </button>
                    <button
                      onClick={() => setRhSubTab('lotes_enviados')}
                      className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        rhSubTab === 'lotes_enviados'
                          ? 'bg-indigo-650 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/40'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      Lotes Enviados (Informar RM)
                    </button>
                  </div>

                  {rhSubTab === 'pendentes' ? (
                    <RhPendentesFlow
                      admissions={admissions}
                      filteredAdmissions={filteredAdmissions}
                      searchQuery={searchQuery}
                      setSearchQuery={setSearchQuery}
                      handleRegisterAdmission={handleRegisterAdmission}
                      handleCpfChange={handleCpfChange}
                      handleRequestRM={handleRequestRM}
                      handleUpdateStatus={handleUpdateStatus}
                      handleOpenKitChecklist={handleOpenKitChecklist}
                      handleStartEdit={handleStartEdit}
                      handleDeleteAdmission={handleDeleteAdmission}
                      selectedBatchIds={selectedBatchIds}
                      setSelectedBatchIds={setSelectedBatchIds}
                      setShowBatchModal={setShowBatchModal}
                      editingRecord={editingRecord}
                      setEditingRecord={setEditingRecord}
                      nome={nome}
                      setNome={setNome}
                      cpf={cpf}
                      setCpf={setCpf}
                      dataAgendamento={dataAgendamento}
                      setDataAgendamento={setDataAgendamento}
                      cargo={cargo}
                      setCargo={setCargo}
                      obra={obra}
                      setObra={setObra}
                      tipoCamisa={tipoCamisa}
                      setTipoCamisa={setTipoCamisa}
                      tamanhoCamisa={tamanhoCamisa}
                      setTamanhoCamisa={setTamanhoCamisa}
                      tipoCalca={tipoCalca}
                      setTipoCalca={setTipoCalca}
                      tamanhoCalca={tamanhoCalca}
                      setTamanhoCalca={setTamanhoCalca}
                      tipoBota={tipoBota}
                      setTipoBota={setTipoBota}
                      tamanhoBota={tamanhoBota}
                      setTamanhoBota={setTamanhoBota}
                      kitGerado={kitGerado}
                      setKitGerado={setKitGerado}
                      kitCompilado={kitCompilado}
                      setKitCompilado={setKitCompilado}
                      trocaItems={trocaItems}
                      setTrocaItems={setTrocaItems}
                      tipoRequisicao={tipoRequisicao}
                      setTipoRequisicao={setTipoRequisicao}
                      isRetroactiveDate={isRetroactiveDate}
                      compileKit={compileKit}
                      showToast={showToast}
                      session={session}
                      usingFallback={usingFallback}
                      setUsingFallback={setUsingFallback}
                      saveAdmissionsToPersistence={saveAdmissionsToPersistence}
                      setAdmissions={setAdmissions}
                      rhFlowMode={rhFlowMode}
                      setRhFlowMode={setRhFlowMode}
                      loteAdmissao={loteAdmissao}
                      setLoteAdmissao={setLoteAdmissao}
                      selectedIndex={selectedIndex}
                      setSelectedIndex={setSelectedIndex}
                      dataAgendamentoLote={dataAgendamentoLote}
                      setDataAgendamentoLote={setDataAgendamentoLote}
                      handleExcelUpload={handleExcelUpload}
                      handleSaveAndNext={handleSaveAndNext}
                      handleConcluirLote={handleConcluirLote}
                      formatDateBR={formatDateBR}
                      isDateToday={isDateToday}
                      emailTecnico={emailTecnico}
                      setEmailTecnico={setEmailTecnico}
                    />
                  ) : false ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        
                        {/* Left Form Panel */}
                        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                          <div>
                            <div id="new-admission-form-header" className="flex items-center gap-2 mb-4 border-b border-slate-850 pb-3">
                              <UserPlus className="w-5 h-5 text-indigo-400" />
                              <h2 className="text-sm font-black uppercase text-white tracking-wider">
                                {editingRecord ? 'Editar Cadastro de Admissão' : 'Novo Cadastro de Admissão'}
                              </h2>
                            </div>

                            <form onSubmit={handleRegisterAdmission} className="space-y-4">
                              {/* Tipo de Requisicao Selector */}
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tipo de Requisição *</label>
                                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                                  <button
                                    type="button"
                                    onClick={() => setTipoRequisicao('Admissão')}
                                    className={`py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer text-center ${
                                      tipoRequisicao === 'Admissão'
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                                    }`}
                                  >
                                    Admissão (Kit Completo)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setTipoRequisicao('Troca')}
                                    className={`py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer text-center ${
                                      tipoRequisicao === 'Troca'
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                                    }`}
                                  >
                                    Troca / Reposição
                                  </button>
                                </div>
                              </div>

                              {/* Basic Info */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nome Completo do Colaborador *</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="EX: ANDRÉ RAMALHO SOUZA"
                                  value={nome}
                                  onChange={(e) => setNome(e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CPF *</label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="000.000.000-00"
                                    value={cpf}
                                    onChange={handleCpfChange}
                                    maxLength={14}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data Agendamento *</label>
                                  <input
                                    type="date"
                                    required
                                    value={dataAgendamento}
                                    onChange={(e) => setDataAgendamento(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono"
                                  />
                                  {isRetroactiveDate && (
                                    <p className="text-rose-500 text-[10px] font-semibold mt-1">
                                      ⚠️ Aviso: Você está selecionando uma data retroativa.
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cargo *</label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="EX: ELETRICISTA / TST"
                                    value={cargo}
                                    onChange={(e) => setCargo(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                  />
                                </div>
                                <div className="space-y-1 w-full">
                                  <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Obra / Frente de Trabalho *</label>
                                    {tipoRequisicao === 'Troca' && (
                                      <span className="text-yellow-500 text-[10px] font-bold flex items-center gap-1">
                                        🔒 Read-Only
                                      </span>
                                    )}
                                  </div>
                                  
                                  {tipoRequisicao === 'Troca' ? (
                                    <input
                                      type="text"
                                      readOnly
                                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-400 cursor-not-allowed font-medium uppercase"
                                      value={obra}
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      required
                                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white uppercase placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-medium"
                                      placeholder="Ex: ALU MO 21-22 SLZ 06-26"
                                      value={obra}
                                      onChange={(e) => setObra(e.target.value.toUpperCase())}
                                    />
                                  )}
                                </div>
                              </div>

                              {tipoRequisicao === 'Admissão' ? (
                                <div className="border-t border-slate-850 pt-4 mt-4 space-y-4">
                                  <span className="text-[11px] font-black uppercase text-indigo-400 tracking-wider block">Fardamento e Tamanhos (Catálogo CMPC)</span>
                                  
                                  {/* Camisa */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Camisa</label>
                                      <select
                                        value={tipoCamisa}
                                        onChange={(e) => setTipoCamisa(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none cursor-pointer"
                                      >
                                        <option value="Brim Cinza">Brim Cinza (Proteção Química)</option>
                                        <option value="Brim Azul Marinho">Brim Azul Marinho</option>
                                        <option value="Anti Chama">Anti Chama</option>
                                      </select>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tamanho da Camisa</label>
                                      <select
                                        value={tamanhoCamisa}
                                        onChange={(e) => setTamanhoCamisa(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none cursor-pointer font-mono"
                                      >
                                        {['2', '3', '4', '5', '6', '7', '8', '9'].map(sz => (
                                          <option key={sz} value={sz}>{sz}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  {/* Calça */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Calça</label>
                                      <select
                                        value={tipoCalca}
                                        onChange={(e) => setTipoCalca(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none cursor-pointer"
                                      >
                                        <option value="Jeans">Jeans</option>
                                        <option value="Brim Cinza">Brim Cinza</option>
                                        <option value="Anti Chama">Anti Chama</option>
                                      </select>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tamanho da Calça</label>
                                      <select
                                        value={tamanhoCalca}
                                        onChange={(e) => setTamanhoCalca(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none cursor-pointer font-mono"
                                      >
                                        {['36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '60'].map(sz => (
                                          <option key={sz} value={sz}>{sz}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  {/* Bota */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Bota</label>
                                      <select
                                        value={tipoBota}
                                        onChange={(e) => setTipoBota(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none cursor-pointer"
                                      >
                                        <option value="Anti Torção">Anti Torção</option>
                                        <option value="Eletricista">Eletricista</option>
                                      </select>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tamanho da Bota</label>
                                      <select
                                        value={tamanhoBota}
                                        onChange={(e) => setTamanhoBota(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none cursor-pointer font-mono"
                                      >
                                        {Array.from({ length: 13 }, (_, i) => String(35 + i)).map(sz => (
                                          <option key={sz} value={sz}>{sz}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="border-t border-slate-850 pt-4 mt-4 space-y-3 max-h-[380px] overflow-y-auto pr-1">
                                  <span className="text-[11px] font-black uppercase text-indigo-400 tracking-wider block">Itens para Troca/Reposição</span>
                                  
                                  {/* Camisa */}
                                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                                      <input
                                        type="checkbox"
                                        checked={trocaItems.camisa.checked}
                                        onChange={(e) => setTrocaItems({
                                          ...trocaItems,
                                          camisa: { ...trocaItems.camisa, checked: e.target.checked }
                                        })}
                                        className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-indigo-500"
                                      />
                                      <span>Camisa Brim</span>
                                    </label>
                                    {trocaItems.camisa.checked && (
                                      <div className="grid grid-cols-3 gap-2 pt-1">
                                        <div>
                                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Tipo</label>
                                          <select
                                            value={trocaItems.camisa.tipo}
                                            onChange={(e) => setTrocaItems({
                                              ...trocaItems,
                                              camisa: { ...trocaItems.camisa, tipo: e.target.value }
                                            })}
                                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[11px] text-slate-100 focus:ring-1 focus:ring-indigo-500"
                                          >
                                            <option value="Brim Cinza">Cinza</option>
                                            <option value="Brim Azul Marinho">Azul Marinho</option>
                                            <option value="Anti Chama">Anti Chama</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Tamanho</label>
                                          <select
                                            value={trocaItems.camisa.tamanho}
                                            onChange={(e) => setTrocaItems({
                                              ...trocaItems,
                                              camisa: { ...trocaItems.camisa, tamanho: e.target.value }
                                            })}
                                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[11px] text-slate-100 font-mono focus:ring-1 focus:ring-indigo-500"
                                          >
                                            {['2', '3', '4', '5', '6', '7', '8', '9'].map(sz => (
                                              <option key={sz} value={sz}>{sz}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Qtd</label>
                                          <input
                                            type="number"
                                            min={1}
                                            max={10}
                                            value={trocaItems.camisa.qtd}
                                            onChange={(e) => setTrocaItems({
                                              ...trocaItems,
                                              camisa: { ...trocaItems.camisa, qtd: Math.max(1, parseInt(e.target.value, 10) || 1) }
                                            })}
                                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-100 focus:ring-1 focus:ring-indigo-500"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Calça */}
                                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                                      <input
                                        type="checkbox"
                                        checked={trocaItems.calca.checked}
                                        onChange={(e) => setTrocaItems({
                                          ...trocaItems,
                                          calca: { ...trocaItems.calca, checked: e.target.checked }
                                        })}
                                        className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-indigo-500"
                                      />
                                      <span>Calça</span>
                                    </label>
                                    {trocaItems.calca.checked && (
                                      <div className="grid grid-cols-3 gap-2 pt-1">
                                        <div>
                                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Tipo</label>
                                          <select
                                            value={trocaItems.calca.tipo}
                                            onChange={(e) => setTrocaItems({
                                              ...trocaItems,
                                              calca: { ...trocaItems.calca, tipo: e.target.value }
                                            })}
                                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[11px] text-slate-100 focus:ring-1 focus:ring-indigo-500"
                                          >
                                            <option value="Jeans">Jeans</option>
                                            <option value="Brim Cinza">Cinza</option>
                                            <option value="Anti Chama">Anti Chama</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Tamanho</label>
                                          <select
                                            value={trocaItems.calca.tamanho}
                                            onChange={(e) => setTrocaItems({
                                              ...trocaItems,
                                              calca: { ...trocaItems.calca, tamanho: e.target.value }
                                            })}
                                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[11px] text-slate-100 font-mono focus:ring-1 focus:ring-indigo-500"
                                          >
                                            {['36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '60'].map(sz => (
                                              <option key={sz} value={sz}>{sz}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Qtd</label>
                                          <input
                                            type="number"
                                            min={1}
                                            max={10}
                                            value={trocaItems.calca.qtd}
                                            onChange={(e) => setTrocaItems({
                                              ...trocaItems,
                                              calca: { ...trocaItems.calca, qtd: Math.max(1, parseInt(e.target.value, 10) || 1) }
                                            })}
                                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-100 focus:ring-1 focus:ring-indigo-500"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Bota */}
                                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                                      <input
                                        type="checkbox"
                                        checked={trocaItems.bota.checked}
                                        onChange={(e) => setTrocaItems({
                                          ...trocaItems,
                                          bota: { ...trocaItems.bota, checked: e.target.checked }
                                        })}
                                        className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-indigo-500"
                                      />
                                      <span>Bota de Segurança</span>
                                    </label>
                                    {trocaItems.bota.checked && (
                                      <div className="grid grid-cols-3 gap-2 pt-1">
                                        <div>
                                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Tipo</label>
                                          <select
                                            value={trocaItems.bota.tipo}
                                            onChange={(e) => setTrocaItems({
                                              ...trocaItems,
                                              bota: { ...trocaItems.bota, tipo: e.target.value }
                                            })}
                                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[11px] text-slate-100 focus:ring-1 focus:ring-indigo-500"
                                          >
                                            <option value="Anti Torção">Anti Torção</option>
                                            <option value="Eletricista">Eletricista</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Tamanho</label>
                                          <select
                                            value={trocaItems.bota.tamanho}
                                            onChange={(e) => setTrocaItems({
                                              ...trocaItems,
                                              bota: { ...trocaItems.bota, tamanho: e.target.value }
                                            })}
                                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[11px] text-slate-100 font-mono focus:ring-1 focus:ring-indigo-500"
                                          >
                                            {Array.from({ length: 13 }, (_, i) => String(35 + i)).map(sz => (
                                              <option key={sz} value={sz}>{sz}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Qtd</label>
                                          <input
                                            type="number"
                                            min={1}
                                            max={10}
                                            value={trocaItems.bota.qtd}
                                            onChange={(e) => setTrocaItems({
                                              ...trocaItems,
                                              bota: { ...trocaItems.bota, qtd: Math.max(1, parseInt(e.target.value, 10) || 1) }
                                            })}
                                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-100 focus:ring-1 focus:ring-indigo-500"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Outros EPCs / EPIs */}
                                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-3">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-850 pb-1">Outros EPIs & Acessórios</span>
                                    
                                    {[
                                      { key: 'capuz', label: 'Capuz com Proteção Química (Cód 12779)' },
                                      { key: 'oculos', label: 'Óculos Ampla Visão (Cód 7328)' },
                                      { key: 'abafador', label: 'Protetor Auditivo Concha (Cód 14288)' },
                                      { key: 'capaceteAmarelo', label: 'Capacete Amarelo (Cód 7253)' },
                                      { key: 'capaceteVerde', label: 'Capacete Verde (Cód 7261)' },
                                      { key: 'jugular', label: 'Jugular (Cód 7285)' },
                                      { key: 'facialVGard', label: 'Protetor Facial V-Gard (Cód 14188)' },
                                      { key: 'facial3M', label: 'Protetor Facial 3M V2C (Cód 7338)' },
                                    ].map(({ key, label }) => {
                                      const item = trocaItems[key as keyof typeof trocaItems] as { checked: boolean; qtd: number };
                                      return (
                                        <div key={key} className="flex items-center justify-between gap-2">
                                          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-slate-100 select-none">
                                            <input
                                              type="checkbox"
                                              checked={item.checked}
                                              onChange={(e) => setTrocaItems({
                                                ...trocaItems,
                                                [key]: { ...item, checked: e.target.checked }
                                              })}
                                              className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span>{label}</span>
                                          </label>
                                          {item.checked && (
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-[9px] text-slate-500 uppercase">Qtd:</span>
                                              <input
                                                type="number"
                                                min={1}
                                                max={10}
                                                value={item.qtd}
                                                onChange={(e) => setTrocaItems({
                                                  ...trocaItems,
                                                  [key]: { ...item, qtd: Math.max(1, parseInt(e.target.value, 10) || 1) }
                                                })}
                                                className="w-12 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-center text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Action buttons and live generated kit preview */}
                              <div className="space-y-4 mt-4">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!cargo.trim()) {
                                      showToast('Por favor, informe o cargo antes de gerar o kit.', 'error');
                                      return;
                                    }
                                    const compiled = compileKit(
                                      cargo,
                                      tipoCamisa,
                                      tamanhoCamisa,
                                      tipoCalca,
                                      tamanhoCalca,
                                      tipoBota,
                                      tamanhoBota
                                    );
                                    setKitGerado(compiled);
                                    setKitCompilado(true);
                                    showToast('Kit gerado com sucesso! Pronto para solicitação de RM.');
                                  }}
                                  className="w-full py-2.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-400 hover:text-white border border-indigo-900/40 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <Sparkles className="w-4 h-4" />
                                  Gerar Kit SGI (Compilar ERP)
                                </button>

                                {kitCompilado && kitGerado.length > 0 ? (
                                  <div className="bg-indigo-950/40 border border-indigo-900/50 rounded-2xl p-4 animate-fade-in">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                                      KIT COMPILADO COM SUCESSO (CÓDIGOS ERP)
                                    </span>
                                    <div className="space-y-1 font-mono text-[10px] text-slate-300">
                                      {kitGerado.map((epi, idx) => (
                                        <div key={idx} className="flex items-start gap-2 py-0.5 border-b border-indigo-950/20 last:border-0">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                                          <span>{epi}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-slate-950/60 border border-slate-850 rounded-2xl p-4 text-center py-6 text-slate-550 text-[11px] font-medium leading-relaxed">
                                    <AlertTriangle className="w-5 h-5 text-amber-500/80 mx-auto mb-2" />
                                    Preencha o cargo e selecione os tamanhos, então clique em <strong className="text-indigo-400 font-bold uppercase">"Gerar Kit SGI"</strong> para compilar os códigos do catálogo real.
                                  </div>
                                )}
                              </div>

                              <div className="flex gap-3 mt-6">
                                {editingRecord && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingRecord(null);
                                      setNome('');
                                      setCpf('');
                                      setCargo('');
                                      setObra('');
                                      setDataAgendamento('');
                                      setEmailTecnico('');
                                      setKitGerado([]);
                                      setKitCompilado(false);
                                      showToast('Edição cancelada.');
                                    }}
                                    className="flex-grow py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer text-center"
                                  >
                                    Cancelar
                                  </button>
                                )}
                                <button
                                  type="submit"
                                  className="flex-[2] py-3 bg-indigo-650 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <UserPlus className="w-4 h-4" />
                                  {editingRecord ? 'Salvar Alterações' : 'Cadastrar e Emitir Admissão'}
                                </button>
                              </div>
                            </form>
                          </div>
                        </div>

                        {/* Right List Panel */}
                        <div className="lg:col-span-7 flex flex-col gap-4">
                          {/* Filters bar */}
                          <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-center gap-4">
                            <div className="relative w-full md:flex-1">
                              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                              <input
                                type="text"
                                placeholder="Buscar colaborador por nome, CPF, cargo, obra..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* List Grid */}
                          <div className="space-y-4 max-h-[640px] overflow-y-auto scrollbar-none pr-1">
                            {admissions.filter(i => i.status === 'Aguardando RM').length === 0 ? (
                              <div className="bg-slate-900 border border-slate-800 p-16 rounded-3xl text-center text-slate-500 text-xs shadow-xl">
                                <Users className="w-10 h-10 text-slate-700 mx-auto mb-3 animate-pulse" />
                                <span className="uppercase font-bold tracking-wider">Nenhuma admissão pendente para gerar lote.</span>
                              </div>
                            ) : filteredAdmissions.length === 0 ? (
                              <div className="bg-slate-900 border border-slate-800 p-16 rounded-3xl text-center text-slate-500 text-xs shadow-xl">
                                <Users className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                                <span className="uppercase font-bold tracking-wider">Nenhum registro de admissão encontrado</span>
                              </div>
                            ) : (
                              filteredAdmissions.map((record) => {
                                const today = isDateToday(record.data_agendamento);
                                const isChecked = selectedBatchIds.includes(record.id);
                                return (
                                  <div 
                                    key={record.id}
                                    className={`bg-slate-900 border rounded-3xl p-5 shadow-lg flex flex-col justify-between transition-colors ${
                                      isChecked
                                        ? 'border-indigo-500 bg-indigo-950/10'
                                        : today && record.status !== 'Fardado'
                                          ? 'border-rose-500/40 bg-rose-950/5' 
                                          : 'border-slate-800 hover:border-slate-750'
                                    }`}
                                  >
                                    <div className="flex gap-4 items-start">
                                      <div className="pt-1 shrink-0">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {
                                            if (isChecked) {
                                              setSelectedBatchIds(selectedBatchIds.filter(id => id !== record.id));
                                            } else {
                                              setSelectedBatchIds([...selectedBatchIds, record.id]);
                                            }
                                          }}
                                          className="w-5 h-5 rounded border-slate-800 bg-slate-950 text-indigo-650 focus:ring-indigo-500 cursor-pointer"
                                          title="Selecionar para Lote"
                                        />
                                      </div>

                                      <div className="flex-1 space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                          <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="text-sm font-black text-white">{record.nome}</span>
                                              {today && record.status !== 'Fardado' && (
                                                <span className="bg-rose-950 text-rose-400 border border-rose-800 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider animate-pulse">
                                                  FARDAMENTO HOJE
                                                </span>
                                              )}
                                            </div>
                                            
                                            <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-3 gap-y-1 font-mono">
                                              <span className="flex items-center gap-1">CPF: <strong className="text-slate-200"><CpfMaskedView cpf={record.cpf} alvoNome={record.nome} /></strong></span>
                                              <span>CARGO: <strong className="text-slate-200">{record.cargo}</strong></span>
                                              <span>OBRA: <strong className="text-slate-200">{record.obra}</strong></span>
                                              {record.numero_rm && (
                                                <span className="text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900/30 px-1.5 py-0.5 rounded">RM Nº: {record.numero_rm}</span>
                                              )}
                                            </div>
                                          </div>

                                          <div className="shrink-0 flex items-center">
                                            <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                                              record.status === 'Fardado'
                                                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/40'
                                                : record.status === 'Agendado'
                                                ? 'bg-violet-950/80 text-violet-400 border-violet-800/40'
                                                : (record.status === 'RM Solicitada' || record.status === 'Aguardando Número RM')
                                                ? 'bg-blue-950/80 text-blue-400 border-blue-800/40'
                                                : 'bg-amber-950/80 text-amber-400 border-amber-800/40'
                                            }`}>
                                              {record.status}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="pt-4 border-t border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                          <div className="text-[10px] text-slate-450 font-mono">
                                            Agendamento: <strong className="text-slate-300">{formatDateBR(record.data_agendamento)}</strong>
                                          </div>

                                          <div className="flex items-center gap-2 flex-wrap">
                                            {/* Mailto / Solicitar Abertura de RM Trigger */}
                                            {record.status === 'Aguardando RM' && (
                                              <button
                                                onClick={() => handleRequestRM(record)}
                                                className="px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                                              >
                                                <Mail className="w-3.5 h-3.5" />
                                                Solicitar Abertura de RM
                                              </button>
                                            )}

                                            {(record.status === 'RM Solicitada' || record.status === 'Aguardando Número RM') && (
                                              <button
                                                onClick={() => handleUpdateStatus(record.id, 'Agendado')}
                                                className="px-3.5 py-1.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-400 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border border-indigo-800/40"
                                              >
                                                <Check className="w-3.5 h-3.5" />
                                                Aprovar RM (Marcar Agendado)
                                              </button>
                                            )}

                                            <button
                                              onClick={() => handleOpenKitChecklist(record)}
                                              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                                            >
                                              <FileText className="w-3.5 h-3.5" />
                                              Ver Ficha / Kit
                                            </button>

                                            <button
                                              onClick={() => handleStartEdit(record)}
                                              className="p-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 rounded-xl transition duration-150 cursor-pointer"
                                              title="Editar"
                                            >
                                              <Pencil className="w-3.5 h-3.5" />
                                            </button>

                                            <button
                                              onClick={() => handleDeleteAdmission(record.id, record.nome)}
                                              className="p-2 bg-slate-800 hover:bg-rose-950 text-rose-500 hover:text-rose-400 rounded-xl transition duration-150 cursor-pointer"
                                              title="Excluir"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                      </div>

                      {/* Gestão de Envios em Lote */}
                      {admissions.filter(i => i.status === 'Aguardando RM').length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 animate-fade-in">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <Layers className="w-5 h-5 text-indigo-400" />
                                <h3 className="text-sm font-black uppercase text-white tracking-wider">Gestão de Envios em Lote (RM Pendente)</h3>
                              </div>
                              <p className="text-[11px] text-slate-450 mt-0.5 uppercase">
                                Selecione um ou mais colaboradores em espera para compilar a tabela de RMs para envio ao Almoxarifado.
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={selectedBatchIds.length === 0}
                              onClick={() => {
                                const colaboradoresSelecionados = admissions.filter(rec => selectedBatchIds.includes(rec.id));
                                if (colaboradoresSelecionados.length === 0) {
                                  alert("Selecione pelo menos um colaborador para gerar o lote.");
                                  return;
                                }
                                const obrasUnicas = new Set(colaboradoresSelecionados.map(colab => (colab.obra || '').trim()));
                                if (obrasUnicas.size > 1) {
                                  alert("OPERAÇÃO BLOQUEADA: Você selecionou colaboradores de obras diferentes. A regra de negócio exige que um lote/RM contenha apenas colaboradores do mesmo centro de custo.");
                                  return;
                                }
                                setShowBatchModal(true);
                              }}
                              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                                selectedBatchIds.length > 0
                                  ? 'bg-indigo-650 hover:bg-indigo-550 text-white shadow-lg cursor-pointer'
                                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                              }`}
                            >
                              <FileText className="w-4 h-4" />
                              Gerar Tabela para Emissão de RM ({selectedBatchIds.length})
                            </button>
                          </div>

                          {/* Seleção Global para Requisitar via Email */}
                          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/50 border border-slate-850/50 rounded-2xl p-4">
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={
                                  (() => {
                                    const pending = admissions.filter(i => i.status === 'Aguardando RM');
                                    if (pending.length === 0) return false;
                                    return pending.every(i => selectedBatchIds.includes(i.id));
                                  })()
                                }
                                onChange={(e) => {
                                  const pending = admissions.filter(i => i.status === 'Aguardando RM');
                                  if (e.target.checked) {
                                    setSelectedBatchIds(pending.map(i => i.id));
                                    showToast(`Selecionados todos os ${pending.length} colaboradores pendentes.`);
                                  } else {
                                    setSelectedBatchIds([]);
                                  }
                                }}
                                className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-indigo-650 focus:ring-indigo-500 cursor-pointer"
                              />
                              <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                                Selecionar todos os colaboradores pendentes (divisão automática por obra/data)
                              </span>
                            </label>

                            {selectedBatchIds.length > 0 && (
                              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-950/50 border border-indigo-900/30 px-3 py-1 rounded-full animate-fade-in">
                                {selectedBatchIds.length} selecionado(s) para compilação
                              </span>
                            )}
                          </div>

                          <div className="overflow-x-auto scrollbar-none">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  <th className="py-3 px-4 w-12 text-center">
                                    <input
                                      type="checkbox"
                                      checked={
                                        (() => {
                                          const pending = admissions.filter(i => i.status === 'Aguardando RM');
                                          if (pending.length === 0) return false;
                                          return pending.every(i => selectedBatchIds.includes(i.id));
                                        })()
                                      }
                                      onChange={(e) => {
                                        const pending = admissions.filter(i => i.status === 'Aguardando RM');
                                        if (e.target.checked) {
                                          setSelectedBatchIds(pending.map(i => i.id));
                                          showToast(`Selecionados todos os ${pending.length} colaboradores.`);
                                        } else {
                                          setSelectedBatchIds([]);
                                        }
                                      }}
                                      className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                      title="Selecionar/Desfazer todos"
                                    />
                                  </th>
                                  <th className="py-3 px-4">Funcionário</th>
                                  <th className="py-3 px-4">CPF</th>
                                  <th className="py-3 px-4">Função (Cargo)</th>
                                  <th className="py-3 px-4">Frente / Centro Custo</th>
                                  <th className="py-3 px-4 font-mono">Agendamento</th>
                                  <th className="py-3 px-4">Destinatário Técnico</th>
                                  <th className="py-3 px-4 text-right">Ações</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-850">
                                {admissions.filter(i => i.status === 'Aguardando RM').map((record) => {
                                  const isChecked = selectedBatchIds.includes(record.id);
                                  return (
                                    <tr 
                                      key={record.id} 
                                      className={`transition-colors ${
                                        isChecked 
                                          ? 'bg-indigo-950/20 hover:bg-indigo-950/30' 
                                          : 'hover:bg-slate-950/40'
                                      }`}
                                    >
                                      <td className="py-3 px-4 text-center">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {
                                            if (isChecked) {
                                              setSelectedBatchIds(selectedBatchIds.filter(id => id !== record.id));
                                            } else {
                                              setSelectedBatchIds([...selectedBatchIds, record.id]);
                                            }
                                          }}
                                          className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-650 focus:ring-indigo-500 cursor-pointer"
                                        />
                                      </td>
                                      <td className="py-3 px-4 font-bold text-white">{record.nome}</td>
                                      <td className="py-3 px-4 font-mono"><CpfMaskedView cpf={record.cpf} alvoNome={record.nome} /></td>
                                      <td className="py-3 px-4">{record.cargo}</td>
                                      <td className="py-3 px-4">{record.obra}</td>
                                      <td className="py-3 px-4 font-mono">{formatDateBR(record.data_agendamento)}</td>
                                      <td className="py-3 px-4 text-slate-400 font-mono">
                                        {record.especificacoes?.email_tecnico || '-'}
                                      </td>
                                      <td className="py-3 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                          <button
                                            onClick={() => handleStartEdit(record)}
                                            className="p-1.5 bg-slate-850 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 rounded-lg transition duration-150 cursor-pointer"
                                            title="Editar"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteAdmission(record.id, record.nome)}
                                            className="p-1.5 bg-slate-850 hover:bg-rose-950/50 text-rose-500 hover:text-rose-400 rounded-lg transition duration-150 cursor-pointer"
                                            title="Excluir"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
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
                    </div>
                  ) : (
                    /* Tab 2: Lotes Enviados (Informar RM) */
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
                      <div>
                        <div className="flex items-center gap-2">
                          <Layers className="w-5 h-5 text-indigo-400" />
                          <h3 className="text-sm font-black uppercase text-white tracking-wider">Vincular Número de RM aos Lotes Enviados</h3>
                        </div>
                        <p className="text-[11px] text-slate-450 mt-0.5 uppercase">
                          Gerencie e vincule o número da RM gerada pelo sistema de compras para cada lote de funcionários enviado ao Almoxarifado.
                        </p>
                      </div>

                      {Object.keys(groupedWaitingForRm).length === 0 ? (
                        <div className="bg-slate-950 border border-slate-850 p-16 rounded-3xl text-center text-slate-500 text-xs shadow-xl">
                          <Users className="w-10 h-10 text-slate-700 mx-auto mb-3 animate-pulse" />
                          <span className="uppercase font-bold tracking-wider">Nenhum lote ou avulso aguardando número de RM no momento.</span>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {Object.entries(groupedWaitingForRm).map(([loteId, records]) => {
                            const isUnbatched = loteId === 'unbatched';
                            const currentRmInput = batchRmInputs[loteId] || '';
                            
                            // Let's get the lote generation date automatically from events or dt_solicitacao_rh
                            let formattedDate = '';
                            if (!isUnbatched) {
                              const foundEvent = records.flatMap(r => r.historico_eventos || [])
                                .find(e => e.etapa === 'Aguardando Número RM' || e.etapa === 'RM Solicitada');
                              if (foundEvent && foundEvent.data) {
                                formattedDate = formatDateBR(foundEvent.data.split('T')[0]);
                              } else {
                                const fallbackDate = records[0]?.dt_solicitacao_rh || records[0]?.created_at;
                                if (fallbackDate) {
                                  formattedDate = formatDateBR(fallbackDate.split('T')[0]);
                                } else {
                                  formattedDate = formatDateBR(new Date().toISOString().split('T')[0]);
                                }
                              }
                            }

                            return (
                              <div 
                                key={loteId} 
                                className={`bg-slate-950 border rounded-2xl p-5 shadow-lg space-y-4 hover:border-indigo-900/50 transition-all animate-fade-in ${
                                  isUnbatched ? 'border-dashed border-slate-800' : 'border-slate-850'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-900 pb-3 gap-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{isUnbatched ? '⚙️' : '📧'}</span>
                                    <div>
                                      <h4 className="text-xs font-black text-white uppercase">
                                        {isUnbatched ? 'Funcionários Avulsos' : `LOTE GERADO EM: ${formattedDate}`}
                                      </h4>
                                      <p className="text-[9px] text-slate-500 font-mono">
                                        {records.length} {records.length === 1 ? 'COLABORADOR' : 'COLABORADORES'} NESTE GRUPO
                                        {!isUnbatched && <span className="text-slate-600 block sm:inline sm:ml-2">ID: {loteId}</span>}
                                      </p>
                                    </div>
                                  </div>
                                  <span className={`text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                                    isUnbatched 
                                      ? 'bg-amber-950/40 text-amber-500 border border-amber-900/30' 
                                      : 'bg-indigo-950/60 text-indigo-450 border border-indigo-900/30'
                                  }`}>
                                    {isUnbatched ? 'Fora de Lote' : 'Lote Registrado'}
                                  </span>
                                </div>

                                {/* Employees List */}
                                <div className="divide-y divide-slate-900/60">
                                  {records.map((record) => (
                                    <div key={record.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                      <div>
                                        <span className="font-bold text-slate-200">{record.nome}</span>
                                        <div className="text-[9px] text-slate-450 font-mono mt-0.5 uppercase">
                                          <div className="flex items-center gap-1 flex-wrap">
                                            <span>CPF:</span> <CpfMaskedView cpf={record.cpf} alvoNome={record.nome} /> <span>• CARGO: {record.cargo} • CC: {record.obra}</span>
                                          </div>
                                        </div>
                                      </div>
                                      <span className="text-[9px] text-indigo-400 font-mono font-bold bg-indigo-950/30 border border-indigo-950/20 px-2 py-0.5 rounded-lg shrink-0">
                                        Prev: {formatDateBR(record.data_agendamento)}
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                {/* RM Input & Action Bar */}
                                <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-900/80 flex flex-col lg:flex-row items-stretch lg:items-center gap-3 justify-between">
                                  <div className="shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleRetornarParaEdicaoLote(loteId, records)}
                                      className="w-full lg:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                                      title="Retornar este lote para a edição de fardamentos/tamanhos"
                                    >
                                      ⬅️ Voltar para Edição de Tamanhos
                                    </button>
                                  </div>

                                  <div className="flex-grow max-w-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedBatchIds(records.map(r => r.id));
                                        setIsReemittingBatch(true);
                                        setShowBatchModal(true);
                                      }}
                                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 text-indigo-400 hover:text-indigo-300 border border-slate-800 hover:border-indigo-900/50 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shrink-0"
                                      title="Visualizar a tabela HTML deste lote para reenvio de e-mail"
                                    >
                                      <FileText className="w-4 h-4" />
                                      📋 Ver Tabela HTML
                                    </button>
                                    <input
                                      type="text"
                                      placeholder={isUnbatched ? "Digite o Número da RM gerada para estes avulsos" : "Digite o Número da RM gerada para este lote"}
                                      value={currentRmInput}
                                      onChange={(e) => setBatchRmInputs(prev => ({ ...prev, [loteId]: e.target.value }))}
                                      className="flex-grow text-center sm:text-left px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono font-bold"
                                    />
                                    <button
                                      type="button"
                                      disabled={!currentRmInput.trim()}
                                      onClick={() => handleVincularRMLote(loteId, records.map(r => r.id), currentRmInput)}
                                      className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shrink-0 ${
                                        currentRmInput.trim()
                                          ? 'bg-emerald-650 hover:bg-emerald-550 text-white shadow-lg cursor-pointer'
                                          : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-850'
                                      }`}
                                    >
                                      <Check className="w-4 h-4" />
                                      Confirmar e Enviar para o Almoxarifado
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}

              {/* TAB 2: AREA DO ALMOXARIFADO */}
              {activeTab === 'almoxarifado' && (
                <div className="space-y-6">
                  
                  {/* Dashboard Header Bar */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-indigo-400" />
                        <h2 className="text-sm font-black uppercase tracking-wider text-white">Triagem & Separação de Fardamentos</h2>
                      </div>
                      <p className="text-[11px] text-slate-400 max-w-xl">
                        Acompanhe admissões ativas por status de liberação de fardamento. Separe fisicamente os kits gerados e finalize o fardamento do colaborador.
                      </p>
                    </div>

                    <div className="relative w-full md:w-80 shrink-0">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Pesquisar por colaborador, cargo..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {userPerfil === 'RH' && (
                    <div className="bg-indigo-950/40 border border-indigo-900/50 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
                      <span className="text-xl">👁️</span>
                      <div>
                        <p className="text-xs font-black uppercase text-white tracking-wider">Modo de Espectador (Leitura RH)</p>
                        <p className="text-[10px] text-indigo-400 font-bold uppercase mt-0.5">As colunas e status das RMs na esteira de produção estão disponíveis em tempo real. As ações de alteração e aprovação são exclusivas do Almoxarifado.</p>
                      </div>
                    </div>
                  )}

                  {/* View Mode Toggle */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-3xl gap-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAlmoxarifadoViewMode('rm_group')}
                        className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                          almoxarifadoViewMode === 'rm_group'
                            ? 'bg-indigo-650 text-white shadow-lg shadow-indigo-600/10'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        <Layers className="w-4 h-4" />
                        Agrupamento por RM ({Object.keys(groupedByRm).length})
                      </button>
                      <button
                        onClick={() => setAlmoxarifadoViewMode('kanban')}
                        className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                          almoxarifadoViewMode === 'kanban'
                            ? 'bg-indigo-650 text-white shadow-lg shadow-indigo-600/10'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        <Columns className="w-4 h-4" />
                        Quadro de Triagem (Kanban)
                      </button>
                    </div>

                    <span className="text-[9px] text-slate-450 uppercase font-black tracking-widest hidden sm:inline mr-2">
                      Filtro de busca: <strong className="text-indigo-400">{searchQuery ? `"${searchQuery}"` : 'ATIVO'}</strong>
                    </span>
                  </div>

                  {almoxarifadoViewMode === 'rm_group' ? (
                    /* RM Grouped View */
                    <div className="space-y-6">
                      {Object.keys(groupedByRm).length === 0 ? (
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500 font-medium space-y-2">
                          <Package className="w-10 h-10 text-slate-750 mx-auto animate-pulse" />
                          <p className="text-xs font-black uppercase tracking-wider text-slate-300">Nenhuma RM sob tratamento do Almoxarifado</p>
                          <p className="text-[10px] text-slate-450 normal-case">
                            Colaboradores na etapa "Tratamento Almoxarifado" com número de RM vinculado aparecerão aqui.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {Object.entries(groupedByRm).map(([rmNumber, records]) => (
                            <div 
                              key={rmNumber} 
                              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 hover:border-indigo-950 transition-all flex flex-col justify-between"
                            >
                              <div>
                                {/* Header Card Group */}
                                <div className="flex items-center justify-between border-b border-slate-850 pb-4 mb-4">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">📦</span>
                                      <h3 className="text-sm font-black uppercase tracking-wider text-white">RM Nº {rmNumber}</h3>
                                    </div>
                                    <p className="text-[9px] text-slate-450 font-mono">
                                      LOTE DE SEPARAÇÃO • {records.length} {records.length === 1 ? 'COLABORADOR' : 'COLABORADORES'}
                                    </p>
                                  </div>

                                  <span className="bg-emerald-950/60 text-emerald-450 border border-emerald-900/30 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                                    Apto para Separação
                                  </span>
                                </div>

                                {/* Collaborators within this group */}
                                <div className="space-y-3 max-h-[360px] overflow-y-auto scrollbar-none pr-1">
                                  {records.map(record => (
                                    <div 
                                      key={record.id} 
                                      className="bg-slate-950 p-4 rounded-2xl border border-slate-850 hover:border-slate-800 transition-colors space-y-3"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <h4 className="text-xs font-black text-white">{record.nome}</h4>
                                            <button 
                                              onClick={() => setTimelineColaborador(record)}
                                              title="Ver Timeline"
                                              className="p-1 hover:bg-slate-800 rounded-md text-slate-500 hover:text-indigo-400 transition-colors"
                                            >
                                              <History className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                          <p className="text-[9px] text-slate-450 mt-0.5 font-mono uppercase">{record.cargo} • CC: {record.obra}</p>
                                          <div className="text-[9px] text-indigo-400 font-mono uppercase mt-0.5 flex items-center gap-1">
                                            <span>CPF:</span> <CpfMaskedView cpf={record.cpf} alvoNome={record.nome} />
                                          </div>
                                        </div>

                                        <button
                                          disabled={userPerfil === 'RH'}
                                          onClick={() => handleOpenKitChecklist(record)}
                                          className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shrink-0 ${
                                            userPerfil === 'RH'
                                              ? 'bg-slate-850 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
                                              : 'bg-indigo-650 hover:bg-indigo-550 text-white cursor-pointer'
                                          }`}
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                          Separar Kit
                                        </button>
                                      </div>

                                      {/* Specifications details */}
                                      <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-900 text-[9px] text-slate-400 font-mono space-y-1 leading-relaxed">
                                        <div><strong className="text-slate-300">TAMANHOS:</strong> CALÇA {record.tamanhos.calca} | CAMISA {record.tamanhos.camisa} | BOTA {record.tamanhos.bota}</div>
                                        <div><strong className="text-slate-300">MATERIAIS:</strong> {record.especificacoes.tipo_calca} | {record.especificacoes.cor_tecido} | {record.especificacoes.tipo_bota}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Quadro de Triagem (Kanban) */
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                      
                      {/* Coluna 1: TRIAGEM (Aprovação) */}
                      <div className="bg-slate-900/60 rounded-3xl border border-slate-800 p-5 flex flex-col min-h-[550px] space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-850 pb-3 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">⚖️</span>
                            <span className="text-xs font-black text-white uppercase tracking-wider">Triagem (Aprovação Manual)</span>
                          </div>
                          <span className="bg-amber-950/60 text-amber-400 border border-amber-900/40 text-[10px] font-mono font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                            {Object.keys(triagemRms).length} RMs
                          </span>
                        </div>

                        <div className="space-y-4 overflow-y-auto scrollbar-none pr-1 max-h-[600px]">
                          {Object.keys(triagemRms).length === 0 ? (
                            <div className="bg-slate-950 rounded-2xl border border-slate-900 p-12 text-center text-slate-500 space-y-3">
                              <Package className="w-8 h-8 text-slate-800 mx-auto animate-pulse" />
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nenhum lote de RM pendente de triagem</p>
                              <p className="text-[9px] text-slate-500 normal-case">
                                Os lotes que receberem número de RM na área do RH aparecerão nesta coluna para aprovação do Almoxarifado.
                              </p>
                            </div>
                          ) : (
                            Object.entries(triagemRms).map(([rmNumber, records]) => {
                              const obraSet = new Set(records.map(r => r.obra));
                              const obrasText = Array.from(obraSet).join(' • ');

                              return (
                                <div 
                                  key={rmNumber} 
                                  className="bg-slate-950 p-4 rounded-2xl border border-slate-850 hover:border-slate-800 transition-all space-y-4 shadow-md flex flex-col justify-between"
                                >
                                  <div className="space-y-3">
                                    <div className="flex justify-between items-start">
                                      <div className="space-y-1">
                                        <h4 className="text-xs font-black text-white uppercase flex items-center gap-1.5">
                                          <span>📦</span> RM Nº {rmNumber}
                                        </h4>
                                        <p className="text-[9px] text-slate-400 font-mono font-bold uppercase">
                                          {records.length} {records.length === 1 ? 'Colaborador' : 'Colaboradores'}
                                        </p>
                                      </div>
                                      <span className="text-[8px] font-mono bg-amber-950/40 text-amber-500 px-2.5 py-1 rounded-lg border border-amber-900/30 font-black uppercase tracking-wider max-w-[150px] truncate" title={obrasText}>
                                        {obrasText}
                                      </span>
                                    </div>

                                    {/* Collaborators list inside card */}
                                    <div className="bg-slate-900/40 border border-slate-900/50 rounded-xl p-3 space-y-2 max-h-[160px] overflow-y-auto scrollbar-none">
                                      {records.map(r => (
                                        <div key={r.id} className="text-[10px] border-b border-slate-900/30 last:border-0 pb-1.5 last:pb-0">
                                          <div className="flex items-center justify-between gap-1">
                                            <p className="text-slate-200 font-bold uppercase truncate">{r.nome}</p>
                                            <button 
                                              onClick={() => setTimelineColaborador(r)}
                                              title="Ver Timeline"
                                              className="p-1 hover:bg-slate-800 rounded-md text-slate-500 hover:text-indigo-400 transition-colors"
                                            >
                                              <History className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                          <p className="text-slate-400 font-mono mt-0.5 text-[8px] uppercase">{r.cargo}</p>
                                          <div className="text-[9px] text-indigo-400 font-mono uppercase mt-0.5 flex items-center gap-1">
                                            <span>CPF:</span> <CpfMaskedView cpf={r.cpf} alvoNome={r.nome} />
                                          </div>
                                          <p className="text-slate-500 font-mono text-[8px] mt-0.5">
                                            CALÇA {r.tamanhos.calca} | CAMISA {r.tamanhos.camisa} | BOTA {r.tamanhos.bota}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex gap-2.5 border-t border-slate-900 pt-3">
                                    <button
                                      disabled={userPerfil === 'RH'}
                                      onClick={() => handleReproveRM(rmNumber)}
                                      className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                        userPerfil === 'RH'
                                          ? 'bg-slate-850 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
                                          : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-900/30 cursor-pointer'
                                      }`}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      Reprovar RM
                                    </button>
                                    <button
                                      disabled={userPerfil === 'RH'}
                                      onClick={() => handleApproveRM(rmNumber)}
                                      className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                        userPerfil === 'RH'
                                          ? 'bg-slate-850 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
                                          : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                                      }`}
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      Aprovar RM
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Coluna 2: SEPARAÇÃO */}
                      <div className="bg-slate-900/60 rounded-3xl border border-slate-800 p-5 flex flex-col min-h-[550px] space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-850 pb-3 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">⚙️</span>
                            <span className="text-xs font-black text-white uppercase tracking-wider">Separação (Disponível para Logística)</span>
                          </div>
                          <span className="bg-indigo-950/60 text-indigo-450 border border-indigo-900/40 text-[10px] font-mono font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                            {Object.keys(separacaoRms).length} RMs
                          </span>
                        </div>

                        <div className="space-y-4 overflow-y-auto scrollbar-none pr-1 max-h-[600px]">
                          {Object.keys(separacaoRms).length === 0 ? (
                            <div className="bg-slate-950 rounded-2xl border border-slate-900 p-12 text-center text-slate-500 space-y-3">
                              <Layers className="w-8 h-8 text-slate-800 mx-auto" />
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nenhum lote em fase de separação</p>
                              <p className="text-[9px] text-slate-500 normal-case">
                                Aprove os lotes na primeira coluna para movê-los para cá. Daqui, o almoxarife pode imprimir ordens de separação consolidadas e agendar a entrega física.
                              </p>
                            </div>
                          ) : (
                            Object.entries(separacaoRms).map(([rmNumber, records]) => {
                              const obraSet = new Set(records.map(r => r.obra));
                              const obrasText = Array.from(obraSet).join(' • ');
                              const selectedInThisRm = records.filter(r => selectedSeparacaoIds.includes(r.id));
                              const hasSelectedInRm = selectedInThisRm.length > 0;
                              const allSelectedInRm = records.every(r => selectedSeparacaoIds.includes(r.id));

                              return (
                                <div 
                                  key={rmNumber} 
                                  className="bg-slate-950 p-4 rounded-2xl border border-slate-850 hover:border-slate-800 transition-all space-y-4 shadow-md flex flex-col justify-between"
                                >
                                  <div className="space-y-3">
                                    <div className="flex justify-between items-start">
                                      <div className="space-y-1">
                                        <h4 className="text-xs font-black text-white uppercase flex items-center gap-1.5">
                                          <span>📦</span> RM Nº {rmNumber}
                                        </h4>
                                        <p className="text-[9px] text-slate-450 font-mono font-bold uppercase">
                                          {records.length} {records.length === 1 ? 'Colaborador' : 'Colaboradores'}
                                        </p>
                                      </div>
                                      <span className="text-[8px] font-mono bg-indigo-950/40 text-indigo-400 px-2.5 py-1 rounded-lg border border-indigo-900/30 font-black uppercase tracking-wider max-w-[150px] truncate" title={obrasText}>
                                        {obrasText}
                                      </span>
                                    </div>

                                    {/* Master Checkbox Row */}
                                    <div className="flex justify-between items-center bg-slate-900/40 p-2 rounded-xl border border-slate-900/60">
                                      <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                          type="checkbox"
                                          checked={allSelectedInRm}
                                          onChange={(e) => {
                                            const recordIds = records.map(r => r.id);
                                            if (e.target.checked) {
                                              setSelectedSeparacaoIds(prev => [
                                                ...prev,
                                                ...recordIds.filter(id => !prev.includes(id))
                                              ]);
                                            } else {
                                              setSelectedSeparacaoIds(prev => prev.filter(id => !recordIds.includes(id)));
                                            }
                                          }}
                                          className="w-3.5 h-3.5 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                        />
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-450">Selecionar Todos</span>
                                      </label>
                                      <span className="text-[8px] font-mono text-indigo-400 font-bold bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-900/20">
                                        {selectedInThisRm.length} de {records.length}
                                      </span>
                                    </div>

                                    {/* Collaborators list inside card */}
                                    <div className="bg-slate-900/40 border border-slate-900/50 rounded-xl p-3 space-y-2 max-h-[160px] overflow-y-auto scrollbar-none">
                                      {records.map(r => {
                                        const isChecked = selectedSeparacaoIds.includes(r.id);
                                        return (
                                          <div key={r.id} className="text-[10px] border-b border-slate-900/30 last:border-0 pb-1.5 last:pb-0 flex items-start gap-2.5">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={(e) => {
                                                if (e.target.checked) {
                                                  setSelectedSeparacaoIds(prev => [...prev, r.id]);
                                                } else {
                                                  setSelectedSeparacaoIds(prev => prev.filter(id => id !== r.id));
                                                }
                                              }}
                                              className="w-3.5 h-3.5 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer mt-0.5"
                                            />
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center justify-between gap-1">
                                                <p className="text-slate-200 font-bold uppercase truncate">{r.nome}</p>
                                                <button 
                                                  onClick={() => setTimelineColaborador(r)}
                                                  title="Ver Timeline"
                                                  className="p-1 hover:bg-slate-800 rounded-md text-slate-500 hover:text-indigo-400 transition-colors"
                                                >
                                                  <History className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                              <p className="text-slate-455 font-mono mt-0.5 text-[8px] uppercase">{r.cargo}</p>
                                              <div className="text-[9px] text-indigo-400 font-mono uppercase mt-0.5 flex items-center gap-1">
                                                <span>CPF:</span> <CpfMaskedView cpf={r.cpf} alvoNome={r.nome} />
                                              </div>
                                              <p className="text-slate-500 font-mono text-[8px] mt-0.5">
                                                CALÇA {r.tamanhos.calca} | CAMISA {r.tamanhos.camisa} | BOTA {r.tamanhos.bota}
                                              </p>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div className="flex gap-2.5 border-t border-slate-900 pt-3">
                                    <button
                                      disabled={userPerfil === 'RH'}
                                      onClick={() => {
                                        const recordsToPrint = selectedInThisRm.length > 0 ? selectedInThisRm : records;
                                        handlePrintRM(rmNumber, recordsToPrint);
                                      }}
                                      className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border border-slate-800 ${
                                        userPerfil === 'RH'
                                          ? 'bg-slate-850 text-slate-500 cursor-not-allowed opacity-60'
                                          : 'bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer'
                                      }`}
                                      title={selectedInThisRm.length > 0 ? "Imprimir apenas os selecionados" : "Imprimir todos"}
                                    >
                                      <Printer className="w-3.5 h-3.5" />
                                      Ordem de Separação
                                    </button>
                                    <button
                                      disabled={userPerfil === 'RH' || !hasSelectedInRm}
                                      onClick={() => {
                                        if (!hasSelectedInRm) {
                                          showToast('Selecione pelo menos um funcionário para prosseguir', 'error');
                                          return;
                                        }
                                        setSchedulingRmNumber(rmNumber);
                                        setScheduleDate('');
                                        setScheduleTime('');
                                        setShowScheduleModal(true);
                                      }}
                                      className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                        userPerfil === 'RH' || !hasSelectedInRm
                                          ? 'bg-slate-850 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
                                          : 'bg-indigo-650 hover:bg-indigo-550 text-white cursor-pointer'
                                      }`}
                                      title={!hasSelectedInRm ? 'Selecione pelo menos um funcionário para prosseguir' : 'Separar e agendar fardamento para selecionados'}
                                    >
                                      <Calendar className="w-3.5 h-3.5" />
                                      Separado & Agendar
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Coluna 3: AGENDADOS / ENTREGA */}
                      <div className="bg-slate-900/60 rounded-3xl border border-slate-800 p-5 flex flex-col min-h-[550px] space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-850 pb-3 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">📅</span>
                            <span className="text-xs font-black text-white uppercase tracking-wider">Agendados / Entrega Física</span>
                          </div>
                          <span className="bg-indigo-950/60 text-indigo-450 border border-indigo-900/40 text-[10px] font-mono font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                            {Object.keys(entregaRms).length} RMs
                          </span>
                        </div>

                        <div className="space-y-4 overflow-y-auto scrollbar-none pr-1 max-h-[600px]">
                          {Object.keys(entregaRms).length === 0 ? (
                            <div className="bg-slate-950 rounded-2xl border border-slate-900 p-12 text-center text-slate-500 space-y-3">
                              <Calendar className="w-8 h-8 text-slate-800 mx-auto" />
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nenhum lote agendado para fardamento</p>
                              <p className="text-[9px] text-slate-500 normal-case">
                                Os lotes agendados na segunda coluna aparecerão aqui. Realize a entrega física e finalize com ou sem ressalvas.
                              </p>
                            </div>
                          ) : (
                            Object.entries(entregaRms).map(([rmNumber, records]) => {
                              const obraSet = new Set(records.map(r => r.obra));
                              const obrasText = Array.from(obraSet).join(' • ');

                              return (
                                <div 
                                  key={rmNumber} 
                                  className="bg-slate-950 p-4 rounded-2xl border border-slate-850 hover:border-slate-800 transition-all space-y-4 shadow-md flex flex-col justify-between"
                                >
                                  <div className="space-y-3">
                                    <div className="flex justify-between items-start">
                                      <div className="space-y-1">
                                        <h4 className="text-xs font-black text-white uppercase flex items-center gap-1.5">
                                          <span>📦</span> RM Nº {rmNumber}
                                        </h4>
                                        <p className="text-[9px] text-slate-450 font-mono font-bold uppercase">
                                          {records.length} {records.length === 1 ? 'Colaborador' : 'Colaboradores'}
                                        </p>
                                      </div>
                                      <span className="text-[8px] font-mono bg-indigo-950/40 text-indigo-450 px-2.5 py-1 rounded-lg border border-indigo-900/30 font-black uppercase tracking-wider max-w-[120px] truncate" title={obrasText}>
                                        {obrasText}
                                      </span>
                                    </div>

                                    {/* Agendado Para - highlighted */}
                                    {records[0].data_agendamento && (
                                      <div className="bg-indigo-950/40 border border-indigo-900/30 rounded-xl p-2.5 text-center">
                                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider block font-sans">Entrega Agendada</span>
                                        <span className="text-xs font-black text-indigo-300 font-mono mt-0.5 block uppercase">
                                          📅 {records[0].data_agendamento.split('-').reverse().join('/')} ÀS ⏰ {records[0].hora_agendamento || "Hora não definida"}
                                        </span>
                                      </div>
                                    )}

                                    {/* Collaborators list inside card */}
                                    <div className="bg-slate-900/40 border border-slate-900/50 rounded-xl p-3 space-y-2 max-h-[160px] overflow-y-auto scrollbar-none">
                                      {records.map(r => (
                                        <div key={r.id} className="text-[10px] border-b border-slate-900/30 last:border-0 pb-1.5 last:pb-0">
                                          <div className="flex items-center justify-between gap-1">
                                            <p className="text-slate-200 font-bold uppercase truncate">{r.nome}</p>
                                            <button 
                                              onClick={() => setTimelineColaborador(r)}
                                              title="Ver Timeline"
                                              className="p-1 hover:bg-slate-800 rounded-md text-slate-500 hover:text-indigo-400 transition-colors"
                                            >
                                              <History className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                          <p className="text-slate-450 font-mono mt-0.5 text-[8px] uppercase">{r.cargo}</p>
                                          <div className="text-[9px] text-indigo-400 font-mono uppercase mt-0.5 flex items-center gap-1">
                                            <span>CPF:</span> <CpfMaskedView cpf={r.cpf} alvoNome={r.nome} />
                                          </div>
                                          <p className="text-slate-500 font-mono text-[8px] mt-0.5">
                                            CALÇA {r.tamanhos.calca} | CAMISA {r.tamanhos.camisa} | BOTA {r.tamanhos.bota}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex gap-2.5 border-t border-slate-900 pt-3">
                                    <button
                                      disabled={userPerfil === 'RH'}
                                      onClick={() => handleOpenRessalvas(rmNumber)}
                                      className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border border-slate-800 ${
                                        userPerfil === 'RH'
                                          ? 'bg-slate-850 text-slate-500 cursor-not-allowed opacity-60'
                                          : 'bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer'
                                      }`}
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                      Ressalvas
                                    </button>
                                    <button
                                      disabled={userPerfil === 'RH'}
                                      onClick={() => handleAllFardados(rmNumber)}
                                      className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                        userPerfil === 'RH'
                                          ? 'bg-slate-850 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
                                          : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                                      }`}
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Todos Fardados
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              )}

              {/* TAB 3: AREA DO HISTÓRICO */}
              {activeTab === 'historico' && (() => {
                const visibleReagendamentos = paginatedHistoryRecords.filter(r => r.status === 'Aguardando Reagendamento');
                const allVisibleChecked = visibleReagendamentos.length > 0 && visibleReagendamentos.every(r => selectedHistoryIds.includes(r.id));
                
                return (
                  <div className="space-y-6">
                    {/* Dashboard Header Bar */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Clock className="w-5 h-5 text-indigo-400" />
                          <h2 className="text-sm font-black uppercase tracking-wider text-white">Histórico de Fardamentos (Arquivo Morto)</h2>
                        </div>
                        <p className="text-[11px] text-slate-400 max-w-xl">
                          Consulte registros arquivados, fardamentos concluídos, entregas com ressalvas e pendências de reagendamento.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
                        <div className="relative w-full md:w-80">
                          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Pesquisar por colaborador, RM, obra..."
                            value={historySearchQuery}
                            onChange={(e) => setHistorySearchQuery(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={() => handleExportExcel(filteredHistoricoRecords, 'Historico')}
                          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-white border border-slate-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow"
                          title="Exportar registros filtrados para Excel"
                        >
                          <FileText className="w-4 h-4" />
                          Exportar Excel (SLA)
                        </button>
                      </div>
                    </div>

                    {/* Statistics Widgets inside History */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Entregas Concluídas</span>
                          <span className="text-xl font-black text-emerald-400 block mt-1">
                            {historicoRecords.filter(r => r.status === 'Concluído').length} Colaboradores
                          </span>
                        </div>
                        <CheckCircle2 className="w-8 h-8 text-emerald-500/20" />
                      </div>
                      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Com Ressalvas</span>
                          <span className="text-xl font-black text-amber-500 block mt-1">
                            {historicoRecords.filter(r => r.status.includes('Ressalva')).length} Colaboradores
                          </span>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-amber-500/20" />
                      </div>
                      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reagendamento Pendente</span>
                          <span className="text-xl font-black text-rose-400 block mt-1">
                            {historicoRecords.filter(r => r.status === 'Aguardando Reagendamento').length} Colaboradores
                          </span>
                        </div>
                        <RefreshCw className="w-8 h-8 text-rose-500/20" />
                      </div>
                    </div>

                    {/* Batch Action Bar */}
                    {selectedHistoryIds.length > 0 && (
                      <div className="bg-amber-950/45 border border-amber-900/40 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">📅</span>
                          <div>
                            <p className="text-xs font-black uppercase text-white tracking-wider">Reagendamento em Lote Ativo</p>
                            <p className="text-[10px] text-amber-400 font-bold uppercase mt-0.5">{selectedHistoryIds.length} colaborador(es) selecionado(s)</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedHistoryIds([])}
                            className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border border-slate-800"
                          >
                            Cancelar Seleção
                          </button>
                          <button
                            onClick={() => {
                              setReagendarIds(selectedHistoryIds);
                              setReagendarDate('');
                              setReagendarTime('');
                              setShowReagendarModal(true);
                            }}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/10"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            Reagendar Selecionados
                          </button>
                        </div>
                      </div>
                    )}

                    {/* History Data Table */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-[10px] uppercase font-black tracking-wider">
                              <th className="py-4 px-6 w-12 text-center">
                                <input
                                  type="checkbox"
                                  checked={allVisibleChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      const visibleIds = visibleReagendamentos.map(r => r.id);
                                      setSelectedHistoryIds(prev => Array.from(new Set([...prev, ...visibleIds])));
                                    } else {
                                      const visibleIds = visibleReagendamentos.map(r => r.id);
                                      setSelectedHistoryIds(prev => prev.filter(id => !visibleIds.includes(id)));
                                    }
                                  }}
                                  disabled={visibleReagendamentos.length === 0}
                                  className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                                />
                              </th>
                              <th className="py-4 px-6">Colaborador</th>
                              <th className="py-4 px-6">CPF</th>
                              <th className="py-4 px-6">Obra / Frente</th>
                              <th className="py-4 px-6">RM Lote</th>
                              <th className="py-4 px-6">Data Agendamento</th>
                              <th className="py-4 px-6">Hora</th>
                              <th className="py-4 px-6">Status / Ocorrência</th>
                              <th className="py-4 px-6 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/40">
                            {paginatedHistoryRecords.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="py-12 text-center text-slate-500 text-xs">
                                  <Package className="w-8 h-8 mx-auto text-slate-700 mb-2" />
                                  NENHUM REGISTRO ENCONTRADO NO HISTÓRICO
                                </td>
                              </tr>
                            ) : (
                              paginatedHistoryRecords.map(record => {
                                const isConcluidoExclusivo = record.status === 'Concluído';
                                const isReagendamento = record.status === 'Aguardando Reagendamento';
                                const isDesistente = record.status === 'Concluído com Ressalva - Desistente';
                                const isCustomRessalva = record.status.startsWith('Concluído com Ressalva') && !isDesistente;
                                const isChecked = selectedHistoryIds.includes(record.id);
                                const sortedEvents = Array.isArray(record.historico_eventos)
                                  ? [...record.historico_eventos].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
                                  : [];

                                let statusBadgeStyle = "bg-emerald-950/60 text-emerald-400 border-emerald-900/30";
                                if (isReagendamento) statusBadgeStyle = "bg-rose-950/60 text-rose-400 border-rose-900/30";
                                else if (isDesistente) statusBadgeStyle = "bg-amber-950/60 text-amber-400 border-amber-900/30";
                                else if (isCustomRessalva) statusBadgeStyle = "bg-sky-950/60 text-sky-400 border-sky-900/30";

                                return (
                                  <React.Fragment key={record.id}>
                                    <tr className={`hover:bg-slate-900/30 transition-colors text-xs text-slate-200 cursor-pointer ${expandedHistoryRowId === record.id ? 'bg-slate-850/40' : ''}`} onClick={() => setExpandedHistoryRowId(expandedHistoryRowId === record.id ? null : record.id)}>
                                      <td className="py-4 px-6 w-12 text-center" onClick={(e) => e.stopPropagation()}>
                                        {isReagendamento ? (
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {
                                              if (isChecked) {
                                                setSelectedHistoryIds(prev => prev.filter(id => id !== record.id));
                                              } else {
                                                setSelectedHistoryIds(prev => [...prev, record.id]);
                                              }
                                            }}
                                            className="w-4 h-4 rounded border-slate-850 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                          />
                                        ) : (
                                          <span className="text-slate-700 font-mono text-[10px]">-</span>
                                        )}
                                      </td>
                                      <td className="py-4 px-6 font-semibold uppercase">
                                        <div className="flex flex-col">
                                          <span>{record.nome}</span>
                                          <span className="text-[10px] text-slate-500 font-normal uppercase mt-0.5">{record.cargo}</span>
                                        </div>
                                      </td>
                                      <td className="py-4 px-6 font-mono text-slate-400"><CpfMaskedView cpf={record.cpf} alvoNome={record.nome} /></td>
                                      <td className="py-4 px-6 font-mono uppercase text-slate-300">{record.obra}</td>
                                      <td className="py-4 px-6 font-mono font-bold text-indigo-400">
                                        {record.numero_rm ? `RM Nº ${record.numero_rm}` : 'SEM RM'}
                                      </td>
                                      <td className="py-4 px-6 font-mono text-slate-400">
                                        {record.data_agendamento ? record.data_agendamento.split('-').reverse().join('/') : 'N/A'}
                                      </td>
                                      <td className="py-4 px-6 font-mono text-slate-400">
                                        {record.especificacoes?.hora_fardamento || 'N/A'}
                                      </td>
                                      <td className="py-4 px-6">
                                        <span className={`inline-block px-2.5 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-wider ${statusBadgeStyle}`}>
                                          {record.status}
                                        </span>
                                      </td>
                                      <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-2">
                                          {isReagendamento && (
                                            <button
                                              onClick={() => {
                                                setReagendarIds([record.id]);
                                                setReagendarDate('');
                                                setReagendarTime('');
                                                setShowReagendarModal(true);
                                              }}
                                              className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-550 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer shadow shadow-indigo-600/10"
                                            >
                                              <Calendar className="w-3.5 h-3.5" />
                                              Reagendar
                                            </button>
                                          )}
                                          <button
                                            onClick={() => setExpandedHistoryRowId(expandedHistoryRowId === record.id ? null : record.id)}
                                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[10px]"
                                            title="Ver Linha do Tempo / Lead Time"
                                          >
                                            <span className="font-bold uppercase text-[9px]">Timeline</span>
                                            {expandedHistoryRowId === record.id ? (
                                              <ChevronUp className="w-4 h-4 text-indigo-450" />
                                            ) : (
                                              <ChevronDown className="w-4 h-4" />
                                            )}
                                          </button>
                                        </div>
                                      </td>
                                    </tr>

                                    {expandedHistoryRowId === record.id && (
                                      <tr className="bg-slate-950/40">
                                        <td colSpan={9} className="py-6 px-8 border-b border-slate-850">
                                          <div className="max-w-4xl mx-auto space-y-4">
                                            {/* Header with Lead Time Info */}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-850 pb-3">
                                              <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-indigo-400" />
                                                <h4 className="text-xs font-black uppercase text-slate-200 tracking-wider">
                                                  Linha do Tempo de Atendimento (SLA / Lead Time)
                                                </h4>
                                              </div>
                                              
                                              {/* Lead Time Badge */}
                                              {record.dt_solicitacao_rh && record.dt_fardado && (
                                                <div className="flex items-center gap-2 self-start sm:self-auto">
                                                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">SLA Total:</span>
                                                  <span className="px-2.5 py-1 bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 rounded-lg text-[10px] font-black uppercase">
                                                    ⏱️ {calculateLeadTime(record.dt_solicitacao_rh, record.dt_fardado)}
                                                  </span>
                                                </div>
                                              )}
                                              {record.dt_solicitacao_rh && !record.dt_fardado && (
                                                <div className="flex items-center gap-2 self-start sm:self-auto">
                                                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Tempo Decorrido (Em Aberto):</span>
                                                  <span className="px-2.5 py-1 bg-amber-500/15 border border-amber-500/25 text-amber-400 rounded-lg text-[10px] font-black uppercase">
                                                    ⏱️ {calculateLeadTime(record.dt_solicitacao_rh, new Date().toISOString())}
                                                  </span>
                                                </div>
                                              )}
                                            </div>

                                            {/* Vertical Timeline Stepper */}
                                            <div className="relative pl-6 border-l border-slate-800 space-y-5 py-2">
                                              {sortedEvents.length > 0 ? (
                                                sortedEvents.map((evt: any, idx: number) => {
                                                  let dotColor = "bg-indigo-500 shadow-indigo-500/40";
                                                  const etapaUpper = (evt.etapa || '').toUpperCase();
                                                  if (etapaUpper.includes('APROVADA') || etapaUpper.includes('SEPARADO') || etapaUpper.includes('CONCLUÍDO') || etapaUpper.includes('FARDADO')) {
                                                    dotColor = "bg-emerald-500 shadow-emerald-500/40";
                                                  } else if (etapaUpper.includes('RESSALVA') || etapaUpper.includes('REPROVADA') || etapaUpper.includes('REAGENDADA') || etapaUpper.includes('PARCIAL')) {
                                                    dotColor = "bg-amber-500 shadow-amber-500/40";
                                                  }

                                                  return (
                                                    <div key={idx} className="relative">
                                                      <div className={`absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full border border-slate-900 shadow ${dotColor}`} />
                                                      <div className="space-y-0.5">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                          <span className="text-slate-200 font-bold text-[11px] uppercase tracking-wider">{evt.etapa}</span>
                                                          <span className="text-[10px] text-slate-500 font-mono">({formatTimestamp(evt.data)})</span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 uppercase leading-relaxed">
                                                          {evt.detalhes}
                                                        </p>
                                                      </div>
                                                    </div>
                                                  );
                                                })
                                              ) : (
                                                <>
                                              {record.dt_solicitacao_rh && (
                                                <div className="relative">
                                                  <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-slate-900 shadow shadow-indigo-500/40" />
                                                  <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-slate-300 font-bold text-[11px] uppercase">Solicitação Criada pelo RH</span>
                                                      <span className="text-[10px] text-slate-500 font-mono">({formatTimestamp(record.dt_solicitacao_rh)})</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 uppercase">
                                                      Colaborador cadastrado no sistema pelo RH e aguardando fardamento.
                                                    </p>
                                                  </div>
                                                </div>
                                              )}

                                              {/* 2. RM Atribuída */}
                                              {record.dt_rm_atribuida && (
                                                <div className="relative">
                                                  <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-slate-900 shadow shadow-indigo-500/40" />
                                                  <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-slate-300 font-bold text-[11px] uppercase">RM {record.numero_rm ? `Nº ${record.numero_rm}` : ''} Atribuída</span>
                                                      <span className="text-[10px] text-slate-500 font-mono">({formatTimestamp(record.dt_rm_atribuida)})</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 uppercase">
                                                      RM vinculada ao colaborador. {record.dt_solicitacao_rh && `Lead Time da solicitação até atribuição: ${calculateLeadTime(record.dt_solicitacao_rh, record.dt_rm_atribuida)}.`}
                                                    </p>
                                                  </div>
                                                </div>
                                              )}

                                              {/* 3. RM Aprovada */}
                                              {record.dt_rm_aprovada && (
                                                <div className="relative">
                                                  <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-900 shadow shadow-emerald-500/40" />
                                                  <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-emerald-400 font-bold text-[11px] uppercase">RM Aprovada na Triagem (Disponível para Separar)</span>
                                                      <span className="text-[10px] text-slate-500 font-mono">({formatTimestamp(record.dt_rm_aprovada)})</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 uppercase">
                                                      Aprovado pelo almoxarifado, liberando os itens para separação física no estoque.
                                                    </p>
                                                  </div>
                                                </div>
                                              )}

                                              {/* 4. Separado / Disponível */}
                                              {record.dt_separado && (
                                                <div className="relative">
                                                  <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-900 shadow shadow-emerald-500/40" />
                                                  <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-emerald-400 font-bold text-[11px] uppercase">Separado e Agendado para Fardamento</span>
                                                      <span className="text-[10px] text-slate-500 font-mono">({formatTimestamp(record.dt_separado)})</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 uppercase">
                                                      Fardamento separado no almoxarifado e agendado para entrega física{record.data_agendamento ? ` em ${record.data_agendamento.split('-').reverse().join('/')}` : ''}{record.hora_agendamento ? ` às ${record.hora_agendamento}` : ''}.
                                                    </p>
                                                  </div>
                                                </div>
                                              )}

                                              {/* 5. Reagendamentos / Ressalvas (Historico Intermediario) */}
                                              {record.dt_reagendamento && (
                                                <div className="relative">
                                                  <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500 border border-slate-900 shadow shadow-amber-500/40" />
                                                  <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-amber-400 font-bold text-[11px] uppercase">Ressalva / Reagendamento Ativado</span>
                                                      <span className="text-[10px] text-slate-500 font-mono">({formatTimestamp(record.dt_reagendamento)})</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-300 font-bold uppercase mt-1 p-2 bg-slate-950 rounded border border-slate-850 inline-block">
                                                      Motivo: {record.motivo_ressalva || 'NÃO ESPECIFICADO'}
                                                    </div>
                                                  </div>
                                                </div>
                                              )}

                                              {/* 6. Fardamento Concluído */}
                                              {record.dt_fardado && (
                                                <div className="relative">
                                                  <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-slate-900 shadow shadow-indigo-500/40" />
                                                  <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-indigo-400 font-bold text-[11px] uppercase">Fardamento Concluído (Entregue)</span>
                                                      <span className="text-[10px] text-slate-500 font-mono">({formatTimestamp(record.dt_fardado)})</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 uppercase">
                                                      Atendimento de fardamento finalizado e entregue com sucesso ao colaborador.
                                                    </p>
                                                  </div>
                                                </div>
                                              )}
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Footer */}
                      {filteredHistoricoRecords.length > historyPageSize && (
                        <div className="bg-slate-950/40 border-t border-slate-800 px-6 py-4 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-mono">
                            Página {historyPage} de {historyTotalPages} ({filteredHistoricoRecords.length} registros)
                          </span>

                          <div className="flex gap-2">
                            <button
                              onClick={() => setHistoryPage(prev => Math.max(prev - 1, 1))}
                              disabled={historyPage === 1}
                              className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-colors flex items-center gap-1 cursor-pointer ${
                                historyPage === 1
                                  ? 'bg-slate-900 border-slate-850 text-slate-600 cursor-not-allowed'
                                  : 'bg-slate-850 border-slate-800 text-slate-300 hover:text-white'
                              }`}
                            >
                              Anterior
                            </button>
                            <button
                              onClick={() => setHistoryPage(prev => Math.min(prev + 1, historyTotalPages))}
                              disabled={historyPage === historyTotalPages}
                              className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-colors flex items-center gap-1 cursor-pointer ${
                                historyPage === historyTotalPages
                                  ? 'bg-slate-900 border-slate-850 text-slate-600 cursor-not-allowed'
                                  : 'bg-slate-850 border-slate-800 text-slate-300 hover:text-white'
                              }`}
                            >
                              Próxima
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* TAB 4: BI DASHBOARD */}
              {activeTab === 'bi' && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Filters Bar */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-indigo-400" />
                        <h2 className="text-sm font-black uppercase tracking-wider text-white">Filtros Globais de Análise</h2>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="hidden sm:inline text-[10px] text-indigo-400 font-mono font-bold uppercase">
                          BI de Fardamento SGI
                        </span>
                        <button
                          onClick={handleExportPDF}
                          className="px-4 py-2 bg-indigo-650 hover:bg-indigo-550 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/10 border border-indigo-550"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Exportar Relatório PDF
                        </button>
                        <button
                          onClick={() => handleExportExcel(biFilteredAdmissions, 'BI')}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700 hover:text-white"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Exportar Excel (SLA)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Period: Start Date */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Data de Início
                        </label>
                        <input
                          type="date"
                          value={filterStartDate}
                          onChange={(e) => setFilterStartDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>

                      {/* Period: End Date */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Data Fim
                        </label>
                        <input
                          type="date"
                          value={filterEndDate}
                          onChange={(e) => setFilterEndDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>

                      {/* Obra Filter */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Obra / Centro de Custo
                        </label>
                        <select
                          value={filterObra}
                          onChange={(e) => setFilterObra(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer uppercase"
                        >
                          <option value="Todos">Todas as Obras (Todos)</option>
                          {biUniqueObras.map(o => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </div>

                      {/* RM Filter */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Número da RM Exata
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: 10200"
                          value={filterRm}
                          onChange={(e) => setFilterRm(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors uppercase placeholder-slate-600"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        onClick={() => {
                          setFilterStartDate('');
                          setFilterEndDate('');
                          setFilterObra('Todos');
                          setFilterRm('');
                          setAppliedFilters({
                            startDate: '',
                            endDate: '',
                            obra: 'Todos',
                            rm: ''
                          });
                          showToast('Filtros limpos com sucesso.');
                        }}
                        className="px-4 py-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Limpar Filtros
                      </button>
                      <button
                        onClick={() => {
                          setAppliedFilters({
                            startDate: filterStartDate,
                            endDate: filterEndDate,
                            obra: filterObra,
                            rm: filterRm
                          });
                          showToast('Filtros aplicados ao painel!');
                        }}
                        className="px-5 py-2 bg-indigo-650 hover:bg-indigo-550 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-indigo-600/15"
                      >
                        Aplicar Filtros
                      </button>
                    </div>
                  </div>

                  {/* Operational Funnel Metrics (4 KPI Cards) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Funnel 1 */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
                      <div className="absolute right-4 top-4 bg-amber-500/10 p-2 rounded-xl border border-amber-500/15">
                        <Clock className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">1. Aguardando RM</span>
                        <span className="text-3xl font-black text-amber-500 block mt-2">{biFunnelMetrics.aguardandoRM}</span>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-4 uppercase font-mono font-bold">
                        Fase de Cadastro do RH
                      </p>
                    </div>

                    {/* Funnel 2 */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
                      <div className="absolute right-4 top-4 bg-indigo-500/10 p-2 rounded-xl border border-indigo-500/15">
                        <Layers className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">2. Triagem (Aprovação)</span>
                        <span className="text-3xl font-black text-indigo-400 block mt-2">{biFunnelMetrics.aguardandoAprovacao}</span>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-4 uppercase font-mono font-bold">
                        Tratamento Almoxarifado
                      </p>
                    </div>

                    {/* Funnel 3 */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
                      <div className="absolute right-4 top-4 bg-sky-500/10 p-2 rounded-xl border border-sky-500/15">
                        <Package className="w-5 h-5 text-sky-400" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">3. Aguardando Separação</span>
                        <span className="text-3xl font-black text-sky-400 block mt-2">{biFunnelMetrics.aguardandoSeparacao}</span>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-4 uppercase font-mono font-bold">
                        Disponível para Separar
                      </p>
                    </div>

                    {/* Funnel 4 */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
                      <div className="absolute right-4 top-4 bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/15">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">4. Aguardando Entrega</span>
                        <span className="text-3xl font-black text-emerald-400 block mt-2">{biFunnelMetrics.aguardandoEntrega}</span>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-4 uppercase font-mono font-bold">
                        Lote Separado & Agendado
                      </p>
                    </div>
                  </div>

                  {/* Analytical Charts Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Ressalvas Index & Pie Chart */}
                    <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                      <div className="border-b border-slate-850 pb-4 mb-4">
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" />
                          Índice de Qualidade das Entregas
                        </span>
                        <h3 className="text-sm font-black text-white mt-1 leading-tight uppercase">Entregas Perfeitas vs Ressalvas</h3>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase">
                          Mapeamento percentual de ocorrências registradas no encerramento de fardamento
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-850 text-center">
                        <div className="border-r border-slate-850">
                          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider block">Entregas Perfeitas</span>
                          <span className="text-2xl font-black text-white block mt-1">{biRessalvasStats.percentagePerfeitas}%</span>
                          <span className="text-[8px] text-slate-500 font-mono uppercase block mt-1">({biRessalvasStats.totalPerfeitas} fardamentos)</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-black text-amber-500 uppercase tracking-wider block">Taxa de Ressalvas</span>
                          <span className="text-2xl font-black text-amber-500 block mt-1">{biRessalvasStats.percentageRessalvas}%</span>
                          <span className="text-[8px] text-slate-500 font-mono uppercase block mt-1">({biRessalvasStats.totalRessalvas} fardamentos)</span>
                        </div>
                      </div>

                      {/* Donut Chart Container */}
                      <div className="h-64 mt-4 flex items-center justify-center relative">
                        {biRessalvasStats.totalConcluidos === 0 ? (
                          <div className="text-center text-slate-500 text-xs">
                            <Info className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                            NENHUM REGISTRO CONCLUÍDO PARA ESTA SELEÇÃO
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={biRessalvasStats.chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={85}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                <Cell fill="#10b981" /> {/* Emerald */}
                                <Cell fill="#f59e0b" /> {/* Amber */}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '12px', fontSize: '11px', textTransform: 'uppercase' }}
                                itemStyle={{ color: '#f1f5f9' }}
                              />
                              <Legend 
                                verticalAlign="bottom" 
                                height={36} 
                                iconType="circle"
                                formatter={(value) => <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{value}</span>}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                        {biRessalvasStats.totalConcluidos > 0 && (
                          <div className="absolute flex flex-col items-center justify-center">
                            <span className="text-[10px] font-black uppercase text-slate-405">Total</span>
                            <span className="text-xl font-black text-white leading-none mt-1">{biRessalvasStats.totalConcluidos}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Bar Chart volume by site */}
                    <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                      <div className="border-b border-slate-850 pb-4 mb-4">
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-1">
                          <BarChart3 className="w-3.5 h-3.5" />
                          Logística por Regional
                        </span>
                        <h3 className="text-sm font-black text-white mt-1 leading-tight uppercase">Volume de Fardamentos Concluídos por Obra</h3>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase">
                          Quantidade total de vestuário e calçados entregues por frente de trabalho (concluídos)
                        </p>
                      </div>

                      {/* Bar Chart Container */}
                      <div className="h-[340px] mt-2">
                        {biVolumeByObraData.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs">
                            <Info className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                            NENHUM REGISTRO CONCLUÍDO ENCONTRADO
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={biVolumeByObraData}
                              margin={{ top: 20, right: 10, left: -20, bottom: 25 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                              <XAxis 
                                dataKey="name" 
                                stroke="#94a3b8" 
                                fontSize={9}
                                tickLine={false}
                                angle={-15}
                                textAnchor="end"
                                interval={0}
                                tickFormatter={(value) => value.length > 20 ? `${value.substring(0, 18)}...` : value}
                              />
                              <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} allowDecimals={false} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '12px', fontSize: '11px', textTransform: 'uppercase' }}
                                labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                                itemStyle={{ color: '#f1f5f9' }}
                                formatter={(value) => [`${value} fardamentos`, 'Total Entregue']}
                              />
                              <Bar dataKey="fardamentos" fill="#6366f1" radius={[8, 8, 0, 0]}>
                                {biVolumeByObraData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#6366f1' : '#4f46e5'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </main>

      {/* Kit Checklist / Separação Modal */}
      <AnimatePresence>
        {selectedAdmissionForKit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Modal Overlay backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAdmissionForKit(null)}
              className="absolute inset-0 bg-slate-950 cursor-pointer"
            />

            {/* Modal Content container */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-xl shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto scrollbar-none"
            >
              {/* Close Button */}
              <button 
                onClick={() => setSelectedAdmissionForKit(null)}
                className="absolute right-4 top-4 text-slate-400 hover:text-white bg-slate-850 p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="border-b border-slate-800 pb-4 mb-5 pr-8">
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Separação Física & Check-List</span>
                <h3 className="text-base font-black text-white mt-1 leading-tight uppercase">{selectedAdmissionForKit.nome}</h3>
                <p className="text-[10px] text-slate-450 mt-1 font-mono uppercase">{selectedAdmissionForKit.cargo} • OBRA: {selectedAdmissionForKit.obra}</p>
              </div>

              {/* Checklist details block */}
              <div className="space-y-4">
                
                {/* 1. Vestuário e Calçados Checklist */}
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">1. FARDAMENTO / SELEÇÃO DE TAMANHOS</span>
                  
                  <div className="space-y-2">
                    {/* Camisa */}
                    <div 
                      onClick={() => handleToggleCheckItem('camisa')}
                      className="bg-slate-950 p-3 rounded-xl border border-slate-850 hover:border-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {checkedKitItems['camisa'] ? (
                          <CheckSquare className="w-5 h-5 text-indigo-400 shrink-0" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-600 shrink-0" />
                        )}
                        <div>
                          <p className="text-xs font-bold text-white uppercase">Camisa Gola Polo de Trabalho</p>
                          <p className="text-[9px] text-slate-400 font-mono uppercase mt-0.5">
                            TAMANHO: <strong className="text-indigo-400">{selectedAdmissionForKit.tamanhos.camisa}</strong> | COR: {selectedAdmissionForKit.especificacoes.cor_tecido} | ARCO ELÉTRICO: {selectedAdmissionForKit.especificacoes.arco_eletrico}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Calça */}
                    <div 
                      onClick={() => handleToggleCheckItem('calca')}
                      className="bg-slate-950 p-3 rounded-xl border border-slate-850 hover:border-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {checkedKitItems['calca'] ? (
                          <CheckSquare className="w-5 h-5 text-indigo-400 shrink-0" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-600 shrink-0" />
                        )}
                        <div>
                          <p className="text-xs font-bold text-white uppercase">Calça de Segurança de Brim</p>
                          <p className="text-[9px] text-slate-400 font-mono uppercase mt-0.5">
                            TAMANHO: <strong className="text-indigo-400">{selectedAdmissionForKit.tamanhos.calca}</strong> | MODELO: {selectedAdmissionForKit.especificacoes.tipo_calca}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bota */}
                    <div 
                      onClick={() => handleToggleCheckItem('bota')}
                      className="bg-slate-950 p-3 rounded-xl border border-slate-850 hover:border-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {checkedKitItems['bota'] ? (
                          <CheckSquare className="w-5 h-5 text-indigo-400 shrink-0" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-600 shrink-0" />
                        )}
                        <div>
                          <p className="text-xs font-bold text-white uppercase">Calçado / Bota de Trabalho</p>
                          <p className="text-[9px] text-slate-400 font-mono uppercase mt-0.5">
                            TAMANHO: <strong className="text-indigo-400">{selectedAdmissionForKit.tamanhos.bota}</strong> | MODELO: {selectedAdmissionForKit.especificacoes.tipo_bota}
                          </p>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* 2. EPIs Checklist */}
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">2. KIT DE EPIS REQUERIDO</span>
                  
                  <div className="space-y-2">
                    {getKitList(selectedAdmissionForKit.kit_gerado).map((epi, idx) => {
                      const key = `epi-${idx}`;
                      return (
                        <div 
                          key={idx}
                          onClick={() => handleToggleCheckItem(key)}
                          className="bg-slate-950 p-3 rounded-xl border border-slate-850 hover:border-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {checkedKitItems[key] ? (
                              <CheckSquare className="w-5 h-5 text-indigo-400 shrink-0" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-600 shrink-0" />
                            )}
                            <div>
                              <p className="text-xs font-bold text-white uppercase">{epi}</p>
                              <p className="text-[9px] text-emerald-450 font-mono mt-0.5">EPI CERTIFICADO CA REGULAR</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Footer and final trigger actions */}
              <div className="mt-8 pt-4 border-t border-slate-800 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedAdmissionForKit(null)}
                  className="flex-1 py-3 border border-slate-850 hover:border-slate-700 bg-slate-950 text-slate-400 hover:text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
                >
                  Fechar Visualização
                </button>

                {selectedAdmissionForKit.status !== 'Fardado' && (
                  <button
                    type="button"
                    disabled={!isKitFullyChecked}
                    onClick={() => {
                      handleUpdateStatus(selectedAdmissionForKit.id, 'Fardado');
                      setSelectedAdmissionForKit(null);
                    }}
                    className={`flex-1 py-3 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      isKitFullyChecked 
                        ? 'bg-emerald-650 hover:bg-emerald-550 shadow-lg shadow-emerald-700/10' 
                        : 'bg-slate-800 text-slate-550 border border-slate-850 cursor-not-allowed opacity-40'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {isKitFullyChecked ? 'Finalizar e Registrar Fardamento' : 'Marque todos os itens para Concluir'}
                  </button>
                )}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Scheduling Modal */}
      <AnimatePresence>
        {showScheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowScheduleModal(false);
                setSchedulingRmNumber(null);
              }}
              className="absolute inset-0 bg-slate-950 cursor-pointer"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative z-10"
            >
              <button 
                onClick={() => {
                  setShowScheduleModal(false);
                  setSchedulingRmNumber(null);
                }}
                className="absolute right-4 top-4 text-slate-400 hover:text-white bg-slate-850 p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="border-b border-slate-800 pb-4 mb-5">
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Logística de Entrega</span>
                <h3 className="text-base font-black text-white mt-1 leading-tight uppercase font-sans tracking-tight">Agendar Fardamento</h3>
                <p className="text-[10px] text-slate-400 mt-1 uppercase">
                  Agende a data e hora para a entrega do fardamento da RM Nº {schedulingRmNumber}. Todos os colaboradores deste lote passarão para "Aguardando Fardamento".
                </p>
              </div>

              <form onSubmit={handleScheduleFardamento} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    Data do Fardamento (Obrigatório)
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    Hora do Fardamento (Obrigatório)
                  </label>
                  <input
                    type="time"
                    required
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors"
                  />
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowScheduleModal(false);
                      setSchedulingRmNumber(null);
                    }}
                    className="flex-1 py-3 border border-slate-850 hover:border-slate-700 bg-slate-950 text-slate-400 hover:text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-indigo-650 hover:bg-indigo-550 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/10"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirmar Agendamento
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reagendar Modal */}
      <AnimatePresence>
        {showReagendarModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowReagendarModal(false);
                setReagendarIds([]);
              }}
              className="absolute inset-0 bg-slate-950 cursor-pointer"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative z-10"
            >
              <button 
                onClick={() => {
                  setShowReagendarModal(false);
                  setReagendarIds([]);
                }}
                className="absolute right-4 top-4 text-slate-400 hover:text-white bg-slate-850 p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="border-b border-slate-800 pb-4 mb-5">
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reagendamento de Fardamento
                </span>
                <h3 className="text-base font-black text-white mt-1 leading-tight uppercase font-sans tracking-tight">Definir Nova Data</h3>
                <p className="text-[10px] text-slate-400 mt-1 uppercase">
                  Reagende a data e hora para a entrega. {reagendarIds.length === 1 ? 'Este colaborador' : `${reagendarIds.length} colaboradores`} irá(ão) direto para a "Separação" no Almoxarifado.
                </p>
              </div>

              <form onSubmit={handleSaveReagendamento} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    Nova Data do Fardamento (Obrigatório)
                  </label>
                  <input
                    type="date"
                    required
                    value={reagendarDate}
                    onChange={(e) => setReagendarDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    Novo Horário do Fardamento (Obrigatório)
                  </label>
                  <input
                    type="time"
                    required
                    value={reagendarTime}
                    onChange={(e) => setReagendarTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors"
                  />
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReagendarModal(false);
                      setReagendarIds([]);
                    }}
                    className="flex-1 py-3 border border-slate-850 hover:border-slate-700 bg-slate-950 text-slate-400 hover:text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-indigo-650 hover:bg-indigo-550 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/10"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirmar Reagendamento
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ressalvas / Ocorrências Modal */}
      <AnimatePresence>
        {showRessalvasModal && ressalvaRmNumber && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowRessalvasModal(false);
                setRessalvaRmNumber(null);
              }}
              className="absolute inset-0 bg-slate-950 cursor-pointer"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-xl shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto scrollbar-none"
            >
              {/* Close Button */}
              <button 
                onClick={() => {
                  setShowRessalvasModal(false);
                  setRessalvaRmNumber(null);
                }}
                className="absolute right-4 top-4 text-slate-400 hover:text-white bg-slate-850 p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="border-b border-slate-800 pb-4 mb-5 pr-8">
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Lançamento de Ressalvas / Ocorrências
                </span>
                <h3 className="text-base font-black text-white mt-1 leading-tight uppercase font-sans tracking-tight">RM Nº {ressalvaRmNumber}</h3>
                <p className="text-[10px] text-slate-450 mt-1 uppercase">
                  Selecione o tipo de ocorrência que ocorreu durante a entrega física deste lote.
                </p>
              </div>

              <form onSubmit={handleSaveRessalvas} className="space-y-5">
                {/* Ocorrência Type Selector */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Tipo de Ocorrência
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setRessalvaType('partial');
                        setSelectedFardadosIds([]);
                      }}
                      className={`px-3 py-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center text-center gap-1 cursor-pointer ${
                        ressalvaType === 'partial'
                          ? 'bg-amber-950/40 text-amber-400 border-amber-900/60'
                          : 'bg-slate-950/40 text-slate-450 border-slate-850 hover:border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      <span>🔄</span>
                      <span>Entrega Parcial</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRessalvaType('desistente');
                        setSelectedFardadosIds([]);
                      }}
                      className={`px-3 py-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center text-center gap-1 cursor-pointer ${
                        ressalvaType === 'desistente'
                          ? 'bg-amber-950/40 text-amber-400 border-amber-900/60'
                          : 'bg-slate-950/40 text-slate-450 border-slate-850 hover:border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      <span>❌</span>
                      <span>Desistente</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRessalvaType('outros');
                        setSelectedFardadosIds([]);
                      }}
                      className={`px-3 py-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center text-center gap-1 cursor-pointer ${
                        ressalvaType === 'outros'
                          ? 'bg-amber-950/40 text-amber-400 border-amber-900/60'
                          : 'bg-slate-950/40 text-slate-450 border-slate-850 hover:border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      <span>📝</span>
                      <span>Outros Motivos</span>
                    </button>
                  </div>
                </div>

                {/* Sub-UI based on type */}
                {ressalvaType === 'partial' && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Quem recebeu o fardamento hoje? (Marcar como Concluído)
                    </label>
                    <p className="text-[9px] text-slate-500 normal-case mb-2">
                      Os colaboradores que ficarem desmarcados voltarão para "Aguardando Reagendamento".
                    </p>
                    <div className="bg-slate-950 rounded-2xl border border-slate-850 p-3.5 space-y-2 max-h-[220px] overflow-y-auto scrollbar-none">
                      {admissions
                        .filter(item => item.numero_rm === ressalvaRmNumber && item.status !== 'Fardado' && item.status !== 'Concluído')
                        .map(record => {
                          const isChecked = selectedFardadosIds.includes(record.id);
                          return (
                            <div
                              key={record.id}
                              onClick={() => {
                                if (isChecked) {
                                  setSelectedFardadosIds(prev => prev.filter(id => id !== record.id));
                                } else {
                                  setSelectedFardadosIds(prev => [...prev, record.id]);
                                }
                              }}
                              className="flex items-center justify-between p-2.5 rounded-xl border border-slate-900 bg-slate-900/20 hover:border-slate-800 transition-colors cursor-pointer"
                            >
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-slate-200">{record.nome}</span>
                                <span className="text-[8px] font-mono text-slate-450 uppercase mt-0.5">{record.cargo}</span>
                              </div>
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-600 shrink-0" />
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {ressalvaType === 'desistente' && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Quem foi o colaborador desistente? (Marcar como Desistente)
                    </label>
                    <p className="text-[9px] text-slate-500 normal-case mb-2">
                      Os desmarcados serão concluídos normalmente. Os marcados serão sinalizados como desistentes.
                    </p>
                    <div className="bg-slate-950 rounded-2xl border border-slate-850 p-3.5 space-y-2 max-h-[220px] overflow-y-auto scrollbar-none">
                      {admissions
                        .filter(item => item.numero_rm === ressalvaRmNumber && item.status !== 'Fardado' && item.status !== 'Concluído')
                        .map(record => {
                          const isChecked = selectedFardadosIds.includes(record.id);
                          return (
                            <div
                              key={record.id}
                              onClick={() => {
                                if (isChecked) {
                                  setSelectedFardadosIds(prev => prev.filter(id => id !== record.id));
                                } else {
                                  setSelectedFardadosIds(prev => [...prev, record.id]);
                                }
                              }}
                              className="flex items-center justify-between p-2.5 rounded-xl border border-slate-900 bg-slate-900/20 hover:border-slate-800 transition-colors cursor-pointer"
                            >
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-slate-200">{record.nome}</span>
                                <span className="text-[8px] font-mono text-slate-450 uppercase mt-0.5">{record.cargo}</span>
                              </div>
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-amber-500 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-600 shrink-0" />
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {ressalvaType === 'outros' && (
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Descrição da Ocorrência (Ex: FALTALOTE, ERROTAMANHO, etc)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="DIRETA, SEM ESPAÇOS, EX: CALCAMENOR, BOTAAVARIADA"
                      value={otherRessalvaText}
                      onChange={(e) => setOtherRessalvaText(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-4 py-3 text-xs uppercase font-mono text-white focus:outline-none transition-colors"
                    />
                  </div>
                )}

                <div className="mt-6 pt-4 border-t border-slate-800 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRessalvasModal(false);
                      setRessalvaRmNumber(null);
                    }}
                    className="flex-1 py-3 border border-slate-850 hover:border-slate-700 bg-slate-950 text-slate-400 hover:text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-600/10"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Salvar Ocorrência
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Batch Export HTML Table Modal */}
      <AnimatePresence>
        {showBatchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowBatchModal(false);
                if (isViewingBatchFromExcel) {
                  setIsViewingBatchFromExcel(false);
                }
                if (isReemittingBatch) {
                  setIsReemittingBatch(false);
                  setSelectedBatchIds([]);
                }
              }}
              className="absolute inset-0 bg-slate-950 cursor-pointer"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-6xl shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => {
                  setShowBatchModal(false);
                  if (isViewingBatchFromExcel) {
                    setIsViewingBatchFromExcel(false);
                  }
                  if (isReemittingBatch) {
                    setIsReemittingBatch(false);
                    setSelectedBatchIds([]);
                  }
                }}
                className="absolute right-4 top-4 text-slate-400 hover:text-white bg-slate-850 p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="border-b border-slate-800 pb-4 mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Emissão de RM em Lote</span>
                  <h3 className="text-base font-black text-white mt-1 leading-tight uppercase font-sans tracking-tight">Tabela de Solicitação Rich-Text</h3>
                  <p className="text-[10px] text-slate-450 mt-1 uppercase">
                    Visualize a tabela abaixo. Ela foi projetada com estilos inline para que, ao ser copiada, mantenha a formatação correta no seu e-mail corporativo.
                  </p>
                </div>
                {isViewingBatchFromExcel && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowBatchModal(false);
                      setIsViewingBatchFromExcel(false);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors shadow-lg shrink-0 self-start md:self-auto"
                  >
                    ⬅️ Voltar para Edição de Tamanhos
                  </button>
                )}
              </div>

              {/* Tabs for each separate batch group */}
              {modalGroupKeys.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-5 p-1 bg-slate-950/60 rounded-2xl border border-slate-850 w-fit">
                  {modalGroupKeys.map((key) => {
                    const groupRecords = modalGroups[key];
                    const record = groupRecords[0];
                    const isActive = key === activeModalGroupKey;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveModalGroupKey(key)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                          isActive
                            ? 'bg-indigo-650 text-white shadow-lg shadow-indigo-650/10'
                            : 'text-slate-400 hover:text-white hover:bg-slate-850'
                        }`}
                      >
                        {record.obra} ({formatDateBR(record.data_agendamento)}) - {groupRecords.length} Colab.
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Styled export-ready table container */}
              <div className="overflow-x-auto bg-white border border-slate-800 rounded-2xl p-4 max-h-[450px] overflow-y-auto">
                <table 
                  id="tabela-rm-export" 
                  style={{
                    borderCollapse: 'collapse',
                    width: '100%',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontSize: '11px',
                    textAlign: 'left',
                    color: '#000000',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Data Entrega</th>
                      <th style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Nome Funcionário</th>
                      <th style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>CPF</th>
                      <th style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Contrato</th>
                      <th style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Função</th>
                      <th style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Obra/Centro de Custo</th>
                      <th style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Quant.</th>
                      <th style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Calça (Tamanho + Cód ERP)</th>
                      <th style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Quant.</th>
                      <th style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Camisa (Tamanho + Cód ERP)</th>
                      <th style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Quant.</th>
                      <th style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Bota (Tamanho + Cód ERP)</th>
                      <th style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Capacete Amarelo/Verde<br/>(Cód 7253 / 7261)</th>
                      <th style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Jugular<br/>(Cód 7285 / Incluso)</th>
                      <th style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Carneira Plástica<br/>(Inclusa)</th>
                      <th style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Abafador Ruído<br/>(Cód 14288)</th>
                      <th style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Óculos Ampla Visão<br/>(Cód 7338)</th>
                      <th style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Protetor Facial<br/>(Cód 14188)</th>
                      <th style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Capuz Balaclava<br/>(Cód 12779)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((activeModalGroupKey && modalGroups[activeModalGroupKey]) || selectedRecordsForModal)
                      .map((record, index) => {
                        const calcaCode = getCalcaCode(record.especificacoes?.tipo_calca || 'Jeans', record.tamanhos.calca);
                        const camisaCode = getCamisaCode(record.especificacoes?.cor_tecido || 'Brim Cinza', record.tamanhos.camisa);
                        const botaCode = getBotaCode(record.especificacoes?.tipo_bota || 'Anti Torção', record.tamanhos.bota);

                        const isTroca = record.tipo_requisicao === 'Troca';
                        const kitTextLower = Array.isArray(record.kit_gerado)
                          ? record.kit_gerado.join('\n').toLowerCase()
                          : String(record.kit_gerado || '').toLowerCase();

                        // Helper to safely get EPI / Clothing quantities for Troca or default for Admissão
                        const getEpiQty = (keywords: string[]): string => {
                          if (!isTroca) return '1 UND';
                          const foundKeyword = keywords.find(kw => kitTextLower.includes(kw));
                          if (!foundKeyword) return '-';
                          
                          const lines = Array.isArray(record.kit_gerado)
                            ? record.kit_gerado
                            : String(record.kit_gerado || '').split('\n');
                          
                          for (const line of lines) {
                            const lowerLine = line.toLowerCase();
                            const matchKw = keywords.find(kw => lowerLine.includes(kw));
                            if (matchKw) {
                              const match = lowerLine.match(/^\s*(\d+)\s*(un|und|unidade|unidades|unidade\(s\))\b/i);
                              if (match) {
                                return `${match[1]} UND`;
                              }
                              const matchLeading = lowerLine.match(/^\s*(\d+)/);
                              if (matchLeading) {
                                return `${matchLeading[1]} UND`;
                              }
                            }
                          }
                          return '1 UND';
                        };

                        // Calça values
                        const calcaSize = record.tamanhos?.calca ? String(record.tamanhos.calca).trim() : '';
                        const isCalcaSelected = isTroca ? !!calcaSize : true;
                        const calcaQty = isCalcaSelected
                          ? (isTroca ? getEpiQty(['calca', 'calça']) : '2 UND')
                          : '-';
                        const calcaDisplay = isCalcaSelected && calcaSize
                          ? `${calcaSize} (Cód ${calcaCode})`
                          : '-';

                        // Camisa values
                        const camisaSize = record.tamanhos?.camisa ? String(record.tamanhos.camisa).trim() : '';
                        const isCamisaSelected = isTroca ? !!camisaSize : true;
                        const camisaQty = isCamisaSelected
                          ? (isTroca ? getEpiQty(['camisa']) : '2 UND')
                          : '-';
                        const camisaDisplay = isCamisaSelected && camisaSize
                          ? `${camisaSize} (Cód ${camisaCode})`
                          : '-';

                        // Bota values
                        const botaSize = record.tamanhos?.bota ? String(record.tamanhos.bota).trim() : '';
                        const isBotaSelected = isTroca ? !!botaSize : true;
                        const botaQty = isBotaSelected
                          ? (isTroca ? getEpiQty(['bota']) : '1 UND')
                          : '-';
                        const botaDisplay = isBotaSelected && botaSize
                          ? `${botaSize} (Cód ${botaCode})`
                          : '-';

                        // EPI values
                        const capaceteQty = getEpiQty(['capacete']);
                        const jugularQty = getEpiQty(['jugular']);
                        const carneiraQty = getEpiQty(['carneira']);
                        const abafadorQty = getEpiQty(['abafador', 'ruido', 'ruído']);
                        const oculosAmplaVisaoQty = isTroca ? getEpiQty(['oculos', 'óculos', '7338', '7328']) : '1 UND';
                        const protetorFacialQty = isTroca ? getEpiQty(['facial', 'v-gard', '14188', 'viseira', '3m']) : '1 UND';
                        const capuzQty = isTroca ? getEpiQty(['capuz', 'balaclava']) : '2 UND';

                        return (
                          <tr key={record.id} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                            <td style={{ padding: '10px 8px', border: '1px solid #cbd5e1', color: '#334155', fontWeight: '500' }}>{formatDateBR(record.data_agendamento)}</td>
                            <td style={{ padding: '10px 8px', border: '1px solid #cbd5e1', color: '#0f172a', fontWeight: 'bold' }}>{record.nome}</td>
                            <td style={{ padding: '10px 8px', border: '1px solid #cbd5e1', color: '#334155', fontFamily: 'monospace' }}>{formatCpf(record.cpf)}</td>
                            <td style={{ padding: '10px 8px', border: '1px solid #cbd5e1', color: '#334155' }}>CMPC PR-2026</td>
                            <td style={{ padding: '10px 8px', border: '1px solid #cbd5e1', color: '#334155' }}>{record.cargo}</td>
                            <td style={{ padding: '10px 8px', border: '1px solid #cbd5e1', color: '#334155' }}>{record.obra}</td>
                            
                            {/* Calça */}
                            <td style={{ padding: '10px 8px', border: '1px solid #cbd5e1', color: '#334155', textAlign: 'center' }}>{calcaQty}</td>
                            <td style={{ padding: '10px 8px', border: '1px solid #cbd5e1', color: '#0f172a', fontWeight: '600', textAlign: calcaDisplay === '-' ? 'center' : 'left' }}>
                              {calcaDisplay}
                            </td>
                            
                            {/* Camisa */}
                            <td style={{ padding: '10px 8px', border: '1px solid #cbd5e1', color: '#334155', textAlign: 'center' }}>{camisaQty}</td>
                            <td style={{ padding: '10px 8px', border: '1px solid #cbd5e1', color: '#0f172a', fontWeight: '600', textAlign: camisaDisplay === '-' ? 'center' : 'left' }}>
                              {camisaDisplay}
                            </td>
                            
                            {/* Bota */}
                            <td style={{ padding: '10px 8px', border: '1px solid #cbd5e1', color: '#334155', textAlign: 'center' }}>{botaQty}</td>
                            <td style={{ padding: '10px 8px', border: '1px solid #cbd5e1', color: '#334155', textAlign: botaDisplay === '-' ? 'center' : 'left' }}>
                              {botaDisplay}
                            </td>
                            
                            {/* EPIs */}
                            <td style={{ padding: '10px 8px', border: '1px solid #cbd5e1', color: '#334155', textAlign: 'center' }}>{capaceteQty}</td>
                            <td style={{ padding: '10px 8px', border: '1px solid #cbd5e1', color: '#334155', textAlign: 'center' }}>{jugularQty}</td>
                            <td style={{ padding: '10px 8px', border: '1px solid #cbd5e1', color: '#334155', textAlign: 'center' }}>{carneiraQty}</td>
                            <td style={{ padding: '10px 8px', border: '1px solid #cbd5e1', color: '#334155', textAlign: 'center' }}>{abafadorQty}</td>
                            <td style={{ padding: '10px 8px', border: '1px solid #cbd5e1', color: '#334155', textAlign: 'center' }}>{oculosAmplaVisaoQty}</td>
                            <td style={{ padding: '10px 8px', border: '1px solid #cbd5e1', color: '#334155', textAlign: 'center' }}>{protetorFacialQty}</td>
                            <td style={{ padding: '10px 8px', border: '1px solid #cbd5e1', color: '#334155', textAlign: 'center' }}>{capuzQty}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="mt-8 pt-4 border-t border-slate-800 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowBatchModal(false);
                    if (isViewingBatchFromExcel) {
                      setIsViewingBatchFromExcel(false);
                    }
                    if (isReemittingBatch) {
                      setIsReemittingBatch(false);
                      setSelectedBatchIds([]);
                    }
                  }}
                  className="flex-1 py-3 border border-slate-850 hover:border-slate-700 bg-slate-950 text-slate-400 hover:text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
                >
                  Fechar Janela
                </button>

                <button
                  type="button"
                  disabled={refreshing}
                  onClick={copiarTabela}
                  className={`flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${refreshing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <Mail className="w-4 h-4" />
                  {refreshing ? 'Processando...' : 'Copiar Tabela (HTML)'}
                </button>

                {!isReemittingBatch && (
                  <button
                    type="button"
                    disabled={refreshing}
                    onClick={handleBatchMarkRequestRM}
                    className={`flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10 ${refreshing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {refreshing ? 'Gerando Lote...' : 'Marcar como "RM Solicitada"'}
                  </button>
                )}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-6"
            >
              <div className="text-center space-y-3">
                <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${
                  confirmModal.type === 'danger' 
                    ? 'bg-rose-950/50 border border-rose-800 text-rose-500' 
                    : confirmModal.type === 'success'
                      ? 'bg-emerald-950/50 border border-emerald-800 text-emerald-500'
                      : 'bg-indigo-950/50 border border-indigo-800 text-indigo-400'
                }`}>
                  {confirmModal.type === 'danger' ? '⚠️' : confirmModal.type === 'success' ? '✅' : 'ℹ️'}
                </div>
                <h3 className="text-lg font-black uppercase text-white tracking-wider">{confirmModal.title}</h3>
                <p className="text-xs text-slate-300 font-medium leading-relaxed">{confirmModal.message}</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-3 border border-slate-800 hover:border-slate-700 bg-slate-950 text-slate-400 hover:text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
                >
                  {confirmModal.cancelText || 'Cancelar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    confirmModal.onConfirm();
                  }}
                  className={`flex-1 py-3 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg ${
                    confirmModal.type === 'danger'
                      ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/10'
                      : confirmModal.type === 'success'
                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/10'
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/10'
                  }`}
                >
                  {confirmModal.confirmText || 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Duplicate CPF Confirmation Modal */}
      <AnimatePresence>
        {duplicateModal && duplicateModal.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-5 relative"
            >
              <div className="flex items-start gap-3 border-b border-slate-800 pb-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white tracking-tight uppercase font-mono">
                    Aviso de Duplicidade de CPF
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-medium">
                    Central de Fardamentos - Validação de Segurança
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 text-xs font-semibold text-amber-200 leading-relaxed uppercase tracking-wider font-mono">
                {duplicateModal.message}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleResolveDuplicateModal(false)}
                  className="flex-1 py-3.5 px-4 rounded-xl border border-slate-700 bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  Cancelar / Não
                </button>
                <button
                  type="button"
                  onClick={() => handleResolveDuplicateModal(true)}
                  className="flex-1 py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 cursor-pointer text-center"
                >
                  Continuar / Sim
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Timeline Modal */}
      <AnimatePresence>
        {timelineColaborador && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full relative flex flex-col max-h-[85vh]"
            >
              <button 
                onClick={() => setTimelineColaborador(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-850 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-black uppercase text-white tracking-wider">Timeline da Requisição</h3>
                </div>
                <div className="text-[10px] text-slate-400 font-mono uppercase flex items-center gap-1 flex-wrap">
                  <span>{timelineColaborador.nome} • CPF</span>
                  <CpfMaskedView cpf={timelineColaborador.cpf} alvoNome={timelineColaborador.nome} />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-none pr-2">
                <div className="relative border-l border-slate-800 ml-3 space-y-6 pb-4">
                  {/* Etapa 1: Emissão/Solicitação */}
                  <div className="relative pl-6">
                    <div className="absolute w-3 h-3 bg-indigo-500 rounded-full -left-[6.5px] top-1 ring-4 ring-slate-900" />
                    <h4 className="text-[10px] font-black uppercase text-slate-200">Emissão / Solicitação (RH)</h4>
                    <p className="text-[9px] font-mono text-indigo-400 mt-0.5">
                      {timelineColaborador.dt_solicitacao_rh ? formatDateTimeFull(timelineColaborador.dt_solicitacao_rh) : (timelineColaborador.created_at ? formatDateTimeFull(timelineColaborador.created_at) : 'Data indisponível')}
                    </p>
                  </div>

                  {/* Etapa 2: Triagem Concluída */}
                  {isDataValida(timelineColaborador.dt_rm_aprovada) && (
                    <div className="relative pl-6">
                      <div className="absolute w-3 h-3 bg-emerald-500 rounded-full -left-[6.5px] top-1 ring-4 ring-slate-900" />
                      <h4 className="text-[10px] font-black uppercase text-slate-200">Triagem Concluída</h4>
                      <p className="text-[9px] font-mono text-emerald-400 mt-0.5">
                        {formatDateTimeFull(timelineColaborador.dt_rm_aprovada)}
                      </p>
                    </div>
                  )}

                  {/* Etapa 3: Separação Finalizada */}
                  {isDataValida(timelineColaborador.dt_separado) && (
                    <div className="relative pl-6">
                      <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[6.5px] top-1 ring-4 ring-slate-900" />
                      <h4 className="text-[10px] font-black uppercase text-slate-200">Separação Finalizada</h4>
                      <p className="text-[9px] font-mono text-blue-400 mt-0.5">
                        {formatDateTimeFull(timelineColaborador.dt_separado)}
                      </p>
                    </div>
                  )}

                  {/* Etapa 4: Agendamento */}
                  {isDataValida(timelineColaborador.data_agendamento) && (
                    <div className="relative pl-6">
                      <div className="absolute w-3 h-3 bg-amber-500 rounded-full -left-[6.5px] top-1 ring-4 ring-slate-900" />
                      <h4 className="text-[10px] font-black uppercase text-slate-200">Entrega Agendada</h4>
                      <p className="text-[9px] font-mono text-amber-400 mt-0.5">
                        {formatDateOnly(timelineColaborador.data_agendamento)} {timelineColaborador.hora_agendamento ? `ÀS ${timelineColaborador.hora_agendamento}` : ''}
                      </p>
                    </div>
                  )}

                  {/* Etapa 5: Entrega Física */}
                  {isDataValida(timelineColaborador.dt_fardado) && (
                    <div className="relative pl-6">
                      <div className="absolute w-3 h-3 bg-purple-500 rounded-full -left-[6.5px] top-1 ring-4 ring-slate-900" />
                      <h4 className="text-[10px] font-black uppercase text-slate-200">Fardamento Entregue</h4>
                      <p className="text-[9px] font-mono text-purple-400 mt-0.5">
                        {formatDateTimeFull(timelineColaborador.dt_fardado)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Embedded footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-[10px] text-slate-450 uppercase font-bold tracking-widest flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>CMPC Industrial • Área de Atendimento Integrada 2026</span>
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-yellow-600 via-yellow-200 to-yellow-600 bg-[length:200%_auto] animate-shimmer bg-clip-text text-transparent font-semibold tracking-normal normal-case text-xs">
              desenvolvido com muita dedicação por André Ramalho
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
