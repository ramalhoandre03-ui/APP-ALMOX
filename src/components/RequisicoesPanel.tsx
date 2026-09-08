import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tv, 
  Users, 
  Sliders, 
  Search, 
  RefreshCw, 
  ArrowLeft, 
  CheckCircle, 
  Clock, 
  X, 
  AlertCircle, 
  Edit3, 
  Trash2, 
  Plus, 
  HelpCircle,
  FileText,
  Volume2,
  Bell,
  User,
  XCircle,
  CheckCircle2,
  Printer,
  History,
  LogOut,
  Lock,
  Mail,
  FileSpreadsheet,
  Download,
  Calendar,
  Trophy,
  Package,
  Hash,
  MessageSquare,
  MoreVertical,
  Undo2,
  AlertTriangle,
  Baby,
  Send,
  GitFork,
  Copy,
  ChevronRight,
  Zap,
  Building2,
  FilterX
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { StatusRobo } from './StatusRobo';
import NetworkStatusIndicator from './NetworkStatusIndicator';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend
} from 'recharts';

// ============================================================================
// CONTADOR DE TEMPO DE TRATAMENTO EM TEMPO REAL (TRIAGEM)
// ============================================================================
interface TreatmentTimerProps {
  dataInicio?: string;
}

function TreatmentTimer({ dataInicio }: TreatmentTimerProps) {
  const [elapsed, setElapsed] = useState<string>('00h 00m 00s');

  useEffect(() => {
    if (!dataInicio || !String(dataInicio).trim()) {
      setElapsed('00h 00m 00s');
      return;
    }

    const calculateElapsed = () => {
      const start = new Date(dataInicio).getTime();
      const now = Date.now();
      const diffMs = now - start;

      if (diffMs < 0 || isNaN(start)) {
        setElapsed('00h 00m 00s');
        return;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const pad = (num: number) => String(num).padStart(2, '0');
      setElapsed(`${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`);
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);

    return () => clearInterval(interval);
  }, [dataInicio]);

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-mono text-xs font-bold shadow-xs">
      <Clock className="w-4 h-4 text-amber-600 animate-spin" style={{ animationDuration: '6s' }} />
      <span>{dataInicio ? 'Em tratamento há:' : 'Tempo em fila:'} <span className="text-amber-800 font-extrabold">{elapsed}</span></span>
    </div>
  );
}

// ============================================================================
// COMPATIBILIDADE DE TIPOS COM O SGI / DASHBOARD GERENCIAL
// ============================================================================
export interface Requisition {
  _raw?: any;
  id: string; 
  rmNumber: string;
  rm_number?: string;
  material: string;
  quantidade: number;
  unidade: string;
  setor: string;
  solicitante: string;
  dataSolicitacao: string; // DD/MM/AAAA
  status: string;
  
  // Opcionais do SGI
  dataNecessidade?: string;
  motivo?: string;
  centroCusto?: string;
  projeto?: string;
  classeFinanceira?: string;
  proximosAprov?: string;
  createdTimestamp: string;

  // Tratamentos de Diligenciamento
  categoria?: 'Estoque' | 'Pré-Cotação' | 'Pré-Cotação Técnica' | 'CC99' | string;
  parecerDiligenciador?: string;
  urgencia?: 'Baixa' | 'Média' | 'Alta' | string;
  observacao?: string;

  // Compatibilidade com DashboardGerencial
  concluidoTimestamp?: string | number;
  reaproveitamento?: number;
  tipoRM?: string;

  // NOVOS CAMPOS WORKFLOW
  tratado_por?: string;
  acao_recomendada?: string;
  status_interno?: string;
  data_inicio_tratamento?: string;
  data_conclusao_tratamento?: string;
  aprovador_destino?: string;
  agente_tratamento?: string;
  motivo_espera?: string;
  override_manual?: boolean;
  data_override?: string;
  usuario_override?: string;
  numero_rtd?: string;
  item_status?: string;
  quantidade_atendida?: number;
  qtd_atendida?: number | string;
  qtd_em_compra?: number | string;

  // Rastreabilidade Mãe e Filha (Desmembramento de RMs)
  rm_mae_id?: string | number | null;
  rm_filha_id?: string | number | null;
  orientacao_combo?: string;
  orientacao_aprovacao?: string;
  observacao_combo?: string;

  // Bypass de Triagem
  decisao_direta?: boolean;
  orientacao_approvo?: string;
}

export interface GroupedRequisition {
  _raw?: any;
  id?: string;
  rmNumber: string;
  rm_number?: string;
  solicitante: string;
  setor: string;
  dataSolicitacao: string;
  dataNecessidade: string;
  dataEmissao?: string;
  status: string;
  motivo: string;
  categoria: string;
  tipoRM: string;
  urgencia: string;
  parecerDiligenciador: string;
  proximosAprov: string;
  tratado_por?: string;
  acao_recomendada?: string;
  status_interno?: string;
  data_inicio_tratamento?: string;
  data_conclusao_tratamento?: string;
  aprovador_destino?: string;
  createdTimestamp?: string;
  centroCusto?: string;
  classeFinanceira?: string;
  agente_tratamento?: string;
  motivo_espera?: string;
  override_manual?: boolean;
  data_override?: string;
  usuario_override?: string;
  numero_rtd?: string;
  qtd_atendida?: number | string;
  qtd_em_compra?: number | string;

  // Rastreabilidade Mãe e Filha (Desmembramento de RMs)
  rm_mae_id?: string | number | null;
  rm_filha_id?: string | number | null;
  orientacao_combo?: string;
  orientacao_aprovacao?: string;
  observacao_combo?: string;

  // Bypass de Triagem
  decisao_direta?: boolean;
  orientacao_approvo?: string;

  itens: Array<{
    id: string;
    material: string;
    quantidade: number;
    unidade: string;
    item_status?: string;
    quantidade_atendida?: number;
    qtd_atendida?: number;
    qtdAtendida?: number;
    qtd_compra?: number;
    qtd_em_compra?: number;
    qtdCompra?: number;
    numero_rtd?: string;
    rtd?: string;
  }>;
}

const getParsedDate = (dateStr: string | undefined): Date | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  
  // Also try DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d2 = new Date(year, month, day);
    if (!isNaN(d2.getTime())) return d2;
  }
  return null;
};

const parseDataNecessidade = (dateStr: string | undefined): Date | null => {
  if (!dateStr) return null;
  const cleanStr = dateStr.trim();
  if (!cleanStr) return null;

  // 1. Try standard JS parsing (e.g., '2026-06-17')
  const d = new Date(cleanStr);
  if (!isNaN(d.getTime())) return d;

  // 2. Try DD/MM/YYYY or DD-MM-YYYY
  const slashParts = cleanStr.split(/[\/\-]/);
  if (slashParts.length === 3) {
    const day = parseInt(slashParts[0], 10);
    const month = parseInt(slashParts[1], 10) - 1;
    let year = parseInt(slashParts[2], 10);
    if (year < 100) year += 2000; // e.g., 26 -> 2026
    const d2 = new Date(year, month, day);
    if (!isNaN(d2.getTime())) return d2;
  }

  // 3. Try format: "17 jun 26", "17 de jun de 2026", "17 de junho de 2026", "17 jun. 26", etc.
  // Tokenize by space, comma, period, or "de"
  const tokens = cleanStr
    .toLowerCase()
    .replace(/\bde\b/g, ' ')
    .replace(/[\.,]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 3) {
    const day = parseInt(tokens[0], 10);
    const monthStr = tokens[1];
    let year = parseInt(tokens[2], 10);
    if (year < 100) year += 2000;

    const monthsMap: Record<string, number> = {
      jan: 0, janeiro: 0,
      fev: 1, fevereiro: 1,
      mar: 2, março: 2, marco: 2,
      abr: 3, abril: 3,
      mai: 4, maio: 4,
      jun: 5, junho: 5,
      jul: 6, julho: 6,
      ago: 7, agosto: 7,
      set: 8, setembro: 8,
      out: 9, outubro: 9,
      nov: 10, novembro: 10,
      dez: 11, dezembro: 11
    };

    let month = -1;
    for (const [key, val] of Object.entries(monthsMap)) {
      if (monthStr === key || monthStr.startsWith(key)) {
        month = val;
        break;
      }
    }

    if (!isNaN(day) && month !== -1 && !isNaN(year)) {
      const d3 = new Date(year, month, day);
      if (!isNaN(d3.getTime())) return d3;
    }
  }

  return null;
};

const calcularStatusPrazo = (dataNecessidade: string | undefined): { texto: string; cor: string } => {
  if (!dataNecessidade) {
    return { texto: 'SEM PRAZO', cor: 'bg-slate-100 text-slate-600 border border-slate-200' };
  }

  const parsedDate = parseDataNecessidade(dataNecessidade);
  if (!parsedDate) {
    return { texto: 'SEM PRAZO', cor: 'bg-slate-100 text-slate-600 border border-slate-200' };
  }

  // Zera as horas de ambas as datas para evitar fuso horário ou frações de dias
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const necessidade = new Date(parsedDate.getTime());
  necessidade.setHours(0, 0, 0, 0);

  // Diferença real em dias corridos
  const diffTime = necessidade.getTime() - hoje.getTime();
  const diasRestantes = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diasRestantes >= 15) {
    return { texto: 'PRAZO SEGURO', cor: 'bg-green-100 text-green-800' };
  } else if (diasRestantes >= 10 && diasRestantes <= 14) {
    return { texto: 'DENTRO DO PRAZO', cor: 'bg-blue-100 text-blue-800' };
  } else if (diasRestantes >= 5 && diasRestantes <= 9) {
    return { texto: 'PRAZO EMERGENTE', cor: 'bg-yellow-100 text-yellow-800' };
  } else if (diasRestantes >= 1 && diasRestantes <= 4) {
    return { texto: 'SEM PRAZO', cor: 'bg-orange-100 text-orange-800' };
  } else if (diasRestantes === 0) {
    return { texto: 'NECESSÁRIO ATENDIMENTO HOJE', cor: 'bg-red-100 text-red-800 font-bold' };
  } else {
    return { texto: 'PRAZO VENCIDO', cor: 'bg-gray-800 text-white font-bold' };
  }
};

const formatDateBR = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

import WarehouseLoader from './WarehouseLoader';

interface RequisicoesPanelProps {
  onBackToHub: () => void;
  isTVMode?: boolean;
  [key: string]: any;
}

export default function RequisicoesPanel({ onBackToHub, isTVMode = false }: RequisicoesPanelProps) {
  const { session: authSession } = useAuth();
  const userRole = (authSession?.perfil as string) || '';
  // Estado de Visualização principal: principal (Almoxarifado), triagem (Triagem), direcionamento (Direcionamento), maternidade (Maternidade), aprovadores (Aprovadores), historico (Histórico), tv (Modo TV)
  const [activeView, setActiveView] = useState<'principal' | 'triagem' | 'direcionamento' | 'maternidade' | 'aprovadores' | 'historico' | 'tv'>(isTVMode ? 'tv' : 'principal');
  
  // Estados de dados conectados ao Supabase via REST API
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para o Ranking Real de Atendimentos do Mês
  const [rankingAtendimentos, setRankingAtendimentos] = useState<{ name: string; quantidade: number }[]>([]);
  
  // Filtros rápidos e busca
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filtroCC, setFiltroCC] = useState('TODOS');
  const [filtroAlmoxarife, setFiltroAlmoxarife] = useState('Todos');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [historicoSearchQuery, setHistoricoSearchQuery] = useState('');
  const [historicoStartDate, setHistoricoStartDate] = useState('');
  const [historicoEndDate, setHistoricoEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 10;
  const [historicoTotalCount, setHistoricoTotalCount] = useState(0);
  const [historicoItems, setHistoricoItems] = useState<GroupedRequisition[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('Todas'); // Todas, Estoque, Pré-Cotação, Pré-Cotação Técnica, CC99
  const [tvSearchQuery, setTvSearchQuery] = useState('');
  
  // Estado e Ref para o Autocomplete da Super Busca Global
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tickle / Force Reset de Atividade para Modo TV a cada 5 minutos (300.000 ms)
  useEffect(() => {
    if (activeView !== 'tv' && !isTVMode) return;

    const timer = setInterval(() => {
      const event = new MouseEvent('mousemove', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: window.innerWidth / 2,
        clientY: window.innerHeight / 2
      });
      document.body.dispatchEvent(event);
      console.log("Atividade forçada para Modo TV (mousemove)");
    }, 300000);

    return () => {
      clearInterval(timer);
    };
  }, [activeView, isTVMode]);
  
  // Notificações internas (Toasts)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Controle de designação/tratamento de RMs
  const [assigningRm, setAssigningRm] = useState<string | null>(null);
  const [selectedColaborador, setSelectedColaborador] = useState<string>('');
  
  // Modal de Tratamento de RM (Ação Recomendada, Aprovador de Destino e Justificativa)
  const [isTreatmentModalOpen, setIsTreatmentModalOpen] = useState(false);
  const [treatingRm, setTreatingRm] = useState<GroupedRequisition | null>(null);
  const [treatmentAction, setTreatmentAction] = useState<'reaproveitamento' | 'compra' | null>(null);
  const [treatmentApprover, setTreatmentApprover] = useState<string>('');
  const [treatmentJustification, setTreatmentJustification] = useState<string>('');
  const [localJustifications, setLocalJustifications] = useState<Record<string, string>>({});

  // Modal de Decisão Direta (Bypass de Triagem)
  const [isBypassModalOpen, setIsBypassModalOpen] = useState(false);
  const [bypassRm, setBypassRm] = useState<GroupedRequisition | null>(null);
  const [bypassApprover, setBypassApprover] = useState<string>('');
  const [bypassDecision, setBypassDecision] = useState<'Aprovar' | 'Reprovar'>('Aprovar');
  const [bypassJustification, setBypassJustification] = useState<string>('');

  // Estados adicionais para o novo modal "Definir Status da RM"
  const [itemStatuses, setItemStatuses] = useState<Record<string, 'COMPRA' | 'ATENDIDO'>>({});
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [rtdNumber, setRtdNumber] = useState<string>('');
  const [rmFilhaNumber, setRmFilhaNumber] = useState<string>('');
  const [orientacaoComboState, setOrientacaoComboState] = useState<Record<string, string>>({});

  // Estados para tratamento individual de RMs Filhas (relação 1:N)
  const [daughterRms, setDaughterRms] = useState<Array<{
    id: string | number;
    rmNumber: string;
    rm_mae_id: string | number;
    status?: string;
    status_interno?: string;
    status_tratamento?: string;
    itens: Array<{
      id: string | number;
      material: string;
      quantidade: number;
      unidade: string;
      status?: string;
    }>;
  }>>([]);
  const [daughterDecisions, setDaughterDecisions] = useState<Record<string, 'Aprovar' | 'Reprovar'>>({});
  const [loadingDaughterRms, setLoadingDaughterRms] = useState<boolean>(false);

  // Estados para Maternidade (Aguardando Desmembramento)
  const [maternidadeInputs, setMaternidadeInputs] = useState<Record<string, string>>({});
  const [maternidadeLoading, setMaternidadeLoading] = useState<Record<string, boolean>>({});
  const [resgatandoParciais, setResgatandoParciais] = useState(false);
  const [assistenteFilhaRm, setAssistenteFilhaRm] = useState<GroupedRequisition | null>(null);

  // Modal de Drill-Down dos Cards de Status
  const [statusModal, setStatusModal] = useState<string | null>(null);

  // Estado para Motivo da Espera e Override Dropdown
  const [editingMotivoRm, setEditingMotivoRm] = useState<GroupedRequisition | null>(null);
  const [motivoText, setMotivoText] = useState<string>('');
  const [activeDropdownRm, setActiveDropdownRm] = useState<string | null>(null);
  
  // Modal de Revisão de Recomendação Operacional ao Transferir Aprovador
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferringRm, setTransferringRm] = useState<GroupedRequisition | null>(null);
  const [printingRm, setPrintingRm] = useState<GroupedRequisition | null>(null);
  const [pendingNewApprover, setPendingNewApprover] = useState<string>('');
  const [pendingNewRecommendation, setPendingNewRecommendation] = useState<string>('');

  // Modal de Confirmação Customizado de Aprovação / Reprovação (Aprovvo)
  const [approvalConfirmModal, setApprovalConfirmModal] = useState<{
    isOpen: boolean;
    req: GroupedRequisition;
    decision: 'Aprovado' | 'Reprovado';
    isCombo: boolean;
    linkedRmNumber: string | null;
  } | null>(null);

  // Modal de Correção Manual de Itens Pendentes / Não Identificados (Catraca Audit)
  const [isFixingModalOpen, setIsFixingModalOpen] = useState(false);
  const [fixingRm, setFixingRm] = useState<GroupedRequisition | null>(null);
  const [fixingItemsData, setFixingItemsData] = useState<Record<string, {
    codigoNm: string;
    descricao: string;
    unidade: string;
    quantidade: number;
  }>>({});
  const [savingFixes, setSavingFixes] = useState(false);

  // Estados do Modal de Re-Sincronização / Forçar Atualização do Aprovo
  const [showResyncModal, setShowResyncModal] = useState(false);
  const [resyncInputRms, setResyncInputRms] = useState('11665, 11699, 11574');
  const [isResyncing, setIsResyncing] = useState(false);
  const [resyncLogs, setResyncLogs] = useState<string[]>([]);

  // Conjunto de chaves associadas a nomes de pessoas / aprovadores / compradores / papéis
  const PERSON_FIELDS = new Set([
    'solicitante', 'comprador', 'comprador_responsavel', 'responsavel',
    'proximosAprov', 'proximos_aprov', 'proximo_aprovador', 'aprovador',
    'nome_aprovador', 'ultimo_aprovador', 'nome_comprador', 'usuario',
    'usuario_nome', 'autor', 'aprovadores', 'historico_aprovadores',
    'aprovacao', 'status_aprovacao', 'workflow', 'passos', 'ocorrencias',
    'historico', 'comprador_nome'
  ]);

  // Função para validar se uma string é um nome de pessoa/aprovador ao invés de um item de material
  const isPersonName = (val: string): boolean => {
    if (!val || typeof val !== 'string') return false;
    const clean = val.trim();
    if (clean.length < 3) return false;

    // Se possui código numérico longo (4+ dígitos), ex: "160749 - MANGUEIRA", é produto físico!
    if (/\b\d{4,}\b/.test(clean)) return false;

    const lower = clean.toLowerCase();

    // Nomes de aprovadores e compradores conhecidos no sistema
    const knownPeople = [
      'fabio sergio', 'fábio sérgio', 'andré ramalho', 'andre ramalho',
      'maicon silva', 'maicon cunha', 'thays silva', 'eduardo junior',
      'colaborador cmpc', 'solicitante sgi', 'alex sandro', 'aline leal',
      'erecias dias', 'gonçalo filho', 'ivanildo rabelo', 'jorge luis',
      'jose paulo', 'jose santana', 'renan keven', 'wilderley'
    ];

    if (knownPeople.some(p => lower.includes(p))) return true;

    // Termos típicos de materiais e produtos físicos
    const materialKeywords = [
      'mangueira', 'parafuso', 'valvula', 'válvula', 'filtro', 'oleo', 'óleo',
      'tinta', 'cabo', 'tubo', 'flange', 'porca', 'arruela', 'rolamento', 'correia',
      'motor', 'bomba', 'chave', 'fardamento', 'capacete', 'luva', 'bota', 'oculos',
      'óculos', 'disco', 'eletrodo', 'solenoide', 'solenóide', 'sensor', 'conector',
      'manometro', 'manômetro', 'gaxeta', 'junta', 'abracadeira', 'abracedeira',
      'retentor', 'fita', 'serviço', 'servico', 'item', 'peca', 'peça', 'chapa',
      'viga', 'perfil', 'graxa', 'solvente', 'fluido', 'flutuador', 'engrenagem'
    ];

    if (materialKeywords.some(m => lower.includes(m))) return false;

    // Se é formado estritamente por 2 a 5 palavras Capitalizadas sem números
    if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s\.\-']+$/.test(clean) && !/\d/.test(clean)) {
      const words = clean.split(/\s+/);
      if (words.length >= 2 && words.length <= 5) {
        const looksLikeName = words.every(w => {
          const wLow = w.toLowerCase();
          return ['de', 'da', 'do', 'dos', 'das', 'e', 's.'].includes(wLow) || (w[0] && w[0] === w[0].toUpperCase());
        });
        if (looksLikeName) return true;
      }
    }

    return false;
  };

  // Função de formatação amigável de Tipo de RM
  const formatarTipo = (tipo?: string, categoria?: string): string => {
    const t = (tipo || '').toLowerCase().trim();
    if (t === 'pre_cotacao' || t === 'pré-cotação' || ((t.includes('cotacao') || t.includes('cotação')) && !t.includes('tecnica') && !t.includes('técnica'))) {
      return 'PRÉ-COTAÇÃO';
    }
    if (t === 'pre_cotacao_tecnica' || t === 'pré-cotação técnica' || ((t.includes('cotacao') || t.includes('cotação')) && (t.includes('tecnica') || t.includes('técnica')))) {
      return 'PRÉ-COTAÇÃO TÉCNICA';
    }
    if (t === 'estoque') return 'ESTOQUE';
    if (t === 'cc99') return 'CC99';
    if (tipo && tipo !== 'RM Normal' && tipo.trim() !== '') return tipo.toUpperCase();

    if (categoria) {
      const c = categoria.toLowerCase().trim();
      if ((c.includes('cotacao') || c.includes('cotação')) && (c.includes('tecnica') || c.includes('técnica'))) return 'PRÉ-COTAÇÃO TÉCNICA';
      if (c.includes('cotacao') || c.includes('cotação')) return 'PRÉ-COTAÇÃO';
      if (c.includes('cc99')) return 'CC99';
      if (c.includes('estoque')) return 'ESTOQUE';
      return categoria.toUpperCase();
    }
    return 'ESTOQUE';
  };

  // Helper para formatar Timestamp exato de Conclusão/Finalização da RM
  const getFormattedFinalizationTimestamp = (req: GroupedRequisition): string => {
    const raw = req._raw || {};
    const endStr = req.data_conclusao_tratamento || raw.data_conclusao_tratamento || raw.data_finalizacao || raw.updated_at || req.createdTimestamp;
    if (!endStr) return 'Não informado';
    
    const dateObj = new Date(endStr);
    if (isNaN(dateObj.getTime())) {
      return String(endStr);
    }
    return dateObj.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Interceptação e Extração Profunda dos Itens do Payload Bruto do Aprovo
  const extractEmbeddedItems = (row: any): any[] => {
    console.log('PAYLOAD BRUTO DO APROVO:', JSON.stringify(row, null, 2));

    if (!row) return [];

    let parsedRow = row;

    if (typeof row._raw === 'string' && row._raw.trim().startsWith('{')) {
      try { parsedRow = { ...parsedRow, ...JSON.parse(row._raw) }; } catch (e) {}
    }
    if (typeof row.payload === 'string' && row.payload.trim().startsWith('{')) {
      try { parsedRow = { ...parsedRow, ...JSON.parse(row.payload) }; } catch (e) {}
    }
    if (typeof row.dados_json === 'string' && row.dados_json.trim().startsWith('{')) {
      try { parsedRow = { ...parsedRow, ...JSON.parse(row.dados_json) }; } catch (e) {}
    }

    if (typeof row.material === 'string' && row.material.trim().startsWith('[')) {
      try {
        const arr = JSON.parse(row.material);
        if (Array.isArray(arr) && arr.length > 0) return arr;
      } catch (e) {}
    }

    // LISTA ESTRITA DE ARRAYS EXCLUSIVAMENTE DE PRODUTOS FÍSICOS
    // EXCLUI EXPRESSAMENTE: ocorrencias, aprovadores, historico, workflow, passos, tramitacao, aprovacoes, logs
    const candidateArrays = [
      parsedRow.itens,
      parsedRow.items,
      parsedRow.materiais,
      parsedRow.linhasRequisicao,
      parsedRow.linhas_requisicao,
      parsedRow.itensRequisicao,
      parsedRow.itens_requisicao,
      parsedRow.lista_itens,
      parsedRow.item_lista,
      parsedRow.produtos,
      parsedRow.products,
      parsedRow.linhas,
      parsedRow.lines,
      parsedRow.detalhes,
      parsedRow.details,
      parsedRow.payload?.itens,
      parsedRow.payload?.items,
      parsedRow.payload?.materiais,
      parsedRow.payload?.linhasRequisicao,
      parsedRow.payload?.produtos,
      parsedRow.dados_json?.itens,
      parsedRow.dados_json?.items,
      parsedRow.dados_json?.materiais,
      row.itens,
      row.items,
      row.materiais,
      row.lista_itens,
    ];

    for (const arr of candidateArrays) {
      if (Array.isArray(arr) && arr.length > 0) {
        const first = arr[0];
        if (first && typeof first === 'object') {
          // Descarta arrays que pertencem a histórico de aprovação ou ocorrências
          const isApproverOrOccurrence = 
            ('nome_aprovador' in first || 'aprovador' in first || 'status_aprovacao' in first || 'workflow' in first || 'comprador_responsavel' in first || 'passo' in first) &&
            !('material' in first || 'descricao' in first || 'descricao_material' in first || 'codigo' in first || 'codigo_material' in first || 'qtd' in first || 'quantidade' in first);
          
          if (isApproverOrOccurrence) {
            console.warn('[APROVO EXTRACT] Ignorando array de histórico de aprovação/ocorrência:', arr);
            continue;
          }
        }
        return arr;
      } else if (typeof arr === 'string' && arr.trim().startsWith('[')) {
        try {
          const parsedArr = JSON.parse(arr);
          if (Array.isArray(parsedArr) && parsedArr.length > 0) return parsedArr;
        } catch (e) {}
      }
    }

    return [parsedRow];
  };

  const extractItemInfo = (rawItemOrRow: any): { material: string; quantidade: number; unidade: string } => {
    if (!rawItemOrRow) {
      console.error('[ERRO DE MAPEAMENTO APROVO] Payload ou item é nulo:', rawItemOrRow);
      return { material: '', quantidade: 1, unidade: 'UN' };
    }

    let target = rawItemOrRow;

    if (typeof target._raw === 'string' && target._raw.trim().startsWith('{')) {
      try { target = { ...target, ...JSON.parse(target._raw) }; } catch (e) {}
    }
    if (typeof target.payload === 'string' && target.payload.trim().startsWith('{')) {
      try { target = { ...target, ...JSON.parse(target.payload) }; } catch (e) {}
    }
    if (typeof target.dados_json === 'string' && target.dados_json.trim().startsWith('{')) {
      try { target = { ...target, ...JSON.parse(target.dados_json) }; } catch (e) {}
    }

    // 1. Extração do Código do Material
    const PRODUCT_CODE_KEYS = [
      'codigo', 'codigo_material', 'codigo_item', 'cod_material', 'cod',
      'nm', 'codigo_nm', 'codMaterial', 'item_codigo', 'Código',
      'Código Material', 'Cod. Material', 'code', 'itemCode',
      'product_code', 'id_material', 'codigo_produto'
    ];

    let rawCode = '';
    for (const k of PRODUCT_CODE_KEYS) {
      if (target[k] !== undefined && target[k] !== null && String(target[k]).trim()) {
        const candidate = String(target[k]).trim();
        if (!isPersonName(candidate)) {
          rawCode = candidate;
          break;
        }
      }
    }

    // 2. Extração da Descrição / Nome do Material
    const PRODUCT_DESC_KEYS = [
      'material', 'descricao', 'descricao_material', 'descricao_item',
      'nome_material', 'material_descricao', 'item_descricao',
      'texto_material', 'denominacao', 'Descrição', 'Descrição Material',
      'Nome do Material', 'product', 'produto', 'description', 'spec',
      'especificacao', 'linha_descricao', 'item_nome'
    ];

    let rawDesc = '';
    for (const k of PRODUCT_DESC_KEYS) {
      if (target[k] !== undefined && target[k] !== null && String(target[k]).trim()) {
        const candidate = String(target[k]).trim();
        if (!isPersonName(candidate)) {
          rawDesc = candidate;
          break;
        }
      }
    }

    if (!rawDesc && target.item && typeof target.item === 'string' && !isPersonName(target.item)) {
      rawDesc = target.item.trim();
    }
    if (!rawDesc && target.nome && typeof target.nome === 'string' && !isPersonName(target.nome)) {
      rawDesc = target.nome.trim();
    }

    const codeClean = String(rawCode || '').trim();
    let descClean = String(rawDesc || '').trim();

    const isGenericDesc =
      !descClean ||
      descClean.toLowerCase() === 'sem descrição' ||
      descClean.toLowerCase() === 'sem descricao' ||
      descClean.toLowerCase().includes('item não identificado') ||
      descClean.toLowerCase().includes('nao identificado') ||
      isPersonName(descClean);

    if (isGenericDesc) {
      descClean = '';
      for (const key of Object.keys(target)) {
        if (PERSON_FIELDS.has(key)) continue;
        if (['id', 'status', 'created_at', 'createdTimestamp', 'rmNumber', 'rm_number', 'setor', 'categoria', 'tipoRM', 'urgencia', 'dataSolicitacao', 'dataNecessidade', 'motivo', 'centroCusto', 'projeto'].includes(key)) continue;

        const val = target[key];
        if (typeof val === 'string' && val.trim().length > 2) {
          const valClean = val.trim();
          if (!isPersonName(valClean) && !valClean.toLowerCase().includes('item não identificado') && valClean !== 'sem descrição' && !valClean.startsWith('RM-') && !valClean.includes('T00:00')) {
            descClean = valClean;
            break;
          }
        }
      }
    }

    let finalMaterial = '';
    if (codeClean && descClean) {
      if (descClean.toLowerCase().startsWith(codeClean.toLowerCase()) || descClean.toLowerCase().includes(codeClean.toLowerCase())) {
        finalMaterial = descClean;
      } else {
        finalMaterial = `${codeClean} - ${descClean}`;
      }
    } else if (descClean) {
      finalMaterial = descClean;
    } else if (codeClean) {
      finalMaterial = codeClean;
    }

    if (isPersonName(finalMaterial)) {
      console.warn('[ERRO DE MAPEAMENTO APROVO] Descartado nome de pessoa capturado indevidamente:', finalMaterial);
      finalMaterial = '';
    }

    // 3. Extração da Quantidade e Unidade
    const rawQtd =
      target.quantidade ??
      target.qtd ??
      target.qtd_solicitada ??
      target.quantidade_solicitada ??
      target.qtd_pedida ??
      target.quantity ??
      target.qtd_item ??
      target.quantidade_item ??
      target.Quantidade ??
      target.qty ??
      target.amount ??
      1;

    const rawUnidade =
      target.unidade ??
      target.und ??
      target.unidade_medida ??
      target.um ??
      target.unit ??
      target.unidade_item ??
      target.Unidade ??
      target.uom ??
      target.medida ??
      'UN';

    let finalQtd = 1;
    let extractedUnitFromQtd = '';

    if (typeof rawQtd === 'number') {
      finalQtd = isNaN(rawQtd) || rawQtd <= 0 ? 1 : rawQtd;
    } else if (typeof rawQtd === 'string') {
      const cleanedStr = rawQtd.trim();
      const match = cleanedStr.match(/^([\d.,]+)\s*([A-Za-z]+)?$/);
      if (match) {
        const numVal = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
        if (!isNaN(numVal) && numVal > 0) finalQtd = numVal;
        if (match[2]) extractedUnitFromQtd = match[2].trim().toUpperCase();
      } else {
        const parsedNum = parseFloat(cleanedStr.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(parsedNum) && parsedNum > 0) finalQtd = parsedNum;
      }
    }

    let finalUnidade = String(rawUnidade || '').trim().toUpperCase();
    if (isPersonName(finalUnidade)) finalUnidade = 'UN';

    if (!finalUnidade || finalUnidade === 'UN') {
      if (extractedUnitFromQtd && !isPersonName(extractedUnitFromQtd)) {
        finalUnidade = extractedUnitFromQtd;
      } else {
        finalUnidade = 'UN';
      }
    }

    return {
      material: finalMaterial,
      quantidade: finalQtd,
      unidade: finalUnidade
    };
  };

  const isTextoNaoIdentificado = (mat: string) => {
    if (!mat) return true;
    const text = String(mat || '').trim().toLowerCase();
    if (!text) return true;
    return (
      text.includes('item não identificado') ||
      text.includes('item nao identificado') ||
      text.includes('não identificado') ||
      text.includes('nao identificado') ||
      text === 'sem descrição' ||
      text === 'sem descricao'
    );
  };

  const isItemNaoIdentificado = (it: { material?: string; quantidade?: number; unidade?: string }) => {
    if (!it) return true;
    if (isTextoNaoIdentificado(it.material || '')) return true;
    if (it.quantidade !== undefined && (it.quantidade === null || isNaN(Number(it.quantidade)) || Number(it.quantidade) <= 0)) {
      return true;
    }
    return false;
  };

  const handleUpdateFixingItem = (itemId: string, field: 'codigoNm' | 'descricao' | 'unidade' | 'quantidade', val: any) => {
    setFixingItemsData(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId] || { codigoNm: '', descricao: '', unidade: 'UN', quantidade: 1 },
        [field]: val
      }
    }));
  };

  const hasItensPendentesOuNaoIdentificados = (req: GroupedRequisition) => {
    if (!req || !req.itens || req.itens.length === 0) return true;
    return req.itens.some(isItemNaoIdentificado);
  };

  const handleForceResyncAprovo = async (customRms?: string[]) => {
    setIsResyncing(true);
    setResyncLogs([]);
    const addLog = (msg: string) => {
      console.log(`[RE-SYNC] ${msg}`);
      setResyncLogs(prev => [...prev, msg]);
    };

    try {
      addLog('Iniciando re-sincronização de produtos do Aprovo com o Supabase...');

      const { data: allRows, error } = await supabase
        .from('requisicoes')
        .select('*');

      if (error) {
        addLog(`Erro ao buscar requisições no Supabase: ${error.message}`);
        showToast('Erro ao buscar requisições no Supabase', 'error');
        setIsResyncing(false);
        return;
      }

      const rowsList = allRows || [];
      addLog(`Total de registros no banco: ${rowsList.length}`);

      const targetNumbers = customRms && customRms.length > 0 
        ? customRms.map(r => r.trim().replace(/^RM-/i, ''))
        : resyncInputRms.split(',').map(s => s.trim().replace(/^RM-/i, '')).filter(Boolean);

      let rowsToProcess = rowsList;
      if (targetNumbers.length > 0) {
        rowsToProcess = rowsList.filter(r => {
          const num = String(r.rmNumber || r.rm_number || r.id || '').replace(/^RM-/i, '');
          return targetNumbers.includes(num);
        });
      }

      if (rowsToProcess.length === 0) {
        addLog('Nenhuma RM encontrada para os números informados.');
        showToast('Nenhuma RM encontrada para re-sincronizar.', 'error');
        setIsResyncing(false);
        return;
      }

      addLog(`Re-processando e limpando dados de ${rowsToProcess.length} RMs...`);
      let fixedCount = 0;

      for (const row of rowsToProcess) {
        const rmNum = String(row.rmNumber || row.rm_number || row.id || 'RM-SGI');
        
        console.log(`PAYLOAD BRUTO DO APROVO (RE-SYNC RM ${rmNum}):`, JSON.stringify(row, null, 2));

        let embedded = extractEmbeddedItems(row);
        let firstItem = embedded[0] || row;
        let itemInfo = extractItemInfo(firstItem);

        // Se o material for nome de pessoa ou estiver vazio, busca via endpoint de consulta ao vivo do robô
        if (!itemInfo.material || isPersonName(itemInfo.material)) {
          addLog(`🔄 Consultando robô do Aprovo ao vivo para a RM ${rmNum}...`);
          try {
            const res = await fetch(`/api/consultar-rm-aprovo?rm=${rmNum}`);
            if (res.ok) {
              const liveData = await res.json();
              addLog(`Payload ao vivo obtido para RM ${rmNum}. Mapeando produtos...`);
              const liveEmbedded = extractEmbeddedItems(liveData);
              const liveInfo = extractItemInfo(liveEmbedded[0] || liveData);
              if (liveInfo.material && !isPersonName(liveInfo.material)) {
                itemInfo = liveInfo;
                row._raw = JSON.stringify(liveData);
              }
            }
          } catch (apiErr: any) {
            addLog(`⚠️ Não foi possível re-buscar do robô: ${apiErr.message}`);
          }
        }

        addLog(`RM ${rmNum} -> Produto Extraído: "${itemInfo.material || 'Nenhum'}" | Qtd: ${itemInfo.quantidade} ${itemInfo.unidade}`);

        if (itemInfo.material && !isTextoNaoIdentificado(itemInfo.material) && !isPersonName(itemInfo.material)) {
          const { error: updateErr } = await supabase
            .from('requisicoes')
            .update({
              material: itemInfo.material,
              quantidade: itemInfo.quantidade,
              unidade: itemInfo.unidade,
              _raw: typeof row._raw === 'string' ? row._raw : JSON.stringify(row._raw || {})
            })
            .eq('id', row.id);

          if (updateErr) {
            addLog(`❌ Erro ao atualizar RM ${rmNum}: ${updateErr.message}`);
          } else {
            addLog(`✅ RM ${rmNum} atualizada com SUCESSO! Substituído nome de pessoa pelo produto real.`);
            fixedCount++;
          }
        } else {
          addLog(`⚠️ RM ${rmNum} não possui descrição física válida.`);
        }
      }

      addLog(`Concluído! ${fixedCount} de ${rowsToProcess.length} RMs limpas e salvas com produtos reais.`);
      showToast(`Re-sincronização concluída! ${fixedCount} RMs corrigidas.`, 'success');
      await fetchRMs();
    } catch (err: any) {
      console.error("Erro no Re-sync:", err);
      addLog(`Erro crítico: ${err.message}`);
      showToast("Falha na re-sincronização.", "error");
    } finally {
      setIsResyncing(false);
    }
  };

  const handleAbrirModalCorrecao = (req: GroupedRequisition) => {
    const unidentifiedItems = req.itens.filter(isItemNaoIdentificado);
    const initialData: Record<string, { codigoNm: string; descricao: string; unidade: string; quantidade: number }> = {};

    unidentifiedItems.forEach(it => {
      let mat = String(it.material || '').trim();
      let initialNm = '';
      let initialDesc = '';

      if (
        mat.toLowerCase().includes('não identificado') ||
        mat.toLowerCase().includes('nao identificado') ||
        mat.toLowerCase() === 'sem descrição' ||
        mat.toLowerCase() === 'sem descricao'
      ) {
        initialDesc = '';
      } else {
        const match = mat.match(/^(\d+|\bNM-\d+\b)\s*[-:]\s*(.+)$/i);
        if (match) {
          initialNm = match[1];
          initialDesc = match[2];
        } else {
          initialDesc = mat;
        }
      }

      initialData[it.id] = {
        codigoNm: initialNm,
        descricao: initialDesc,
        unidade: it.unidade && it.unidade !== 'UN' ? it.unidade : 'UN',
        quantidade: it.quantidade && it.quantidade > 0 ? it.quantidade : 1
      };
    });

    setFixingItemsData(initialData);
    setFixingRm(req);
    setIsFixingModalOpen(true);
  };

  const handleSalvarCorrecoesItens = async () => {
    if (!fixingRm) return;

    const unidentifiedItems = fixingRm.itens.filter(isItemNaoIdentificado);
    if (unidentifiedItems.length === 0) {
      setIsFixingModalOpen(false);
      return;
    }

    // Validação estrita dos campos obrigatórios
    for (const it of unidentifiedItems) {
      const data = fixingItemsData[it.id];
      if (!data) {
        showToast('Preencha todos os campos obrigatórios para os itens pendentes.', 'error');
        return;
      }
      if (!data.codigoNm || !data.codigoNm.trim()) {
        showToast('O Código (NM) é obrigatório para todos os itens.', 'error');
        return;
      }
      if (!data.descricao || !data.descricao.trim() || isTextoNaoIdentificado(data.descricao)) {
        showToast('A Descrição do item é obrigatória e não pode ser "Não identificado".', 'error');
        return;
      }
      if (!data.unidade || !data.unidade.trim()) {
        showToast('A Unidade de Medida é obrigatória.', 'error');
        return;
      }
      if (!data.quantidade || Number(data.quantidade) <= 0) {
        showToast('A Quantidade deve ser maior que zero.', 'error');
        return;
      }
    }

    try {
      setSavingFixes(true);

      const updatePromises = unidentifiedItems.map(async (it) => {
        const data = fixingItemsData[it.id];
        const nmClean = (data.codigoNm || '').trim();
        const descClean = (data.descricao || '').trim().toUpperCase();
        const novoMaterial = nmClean ? `${nmClean} - ${descClean}` : descClean;
        const novaQtd = Number(data.quantidade) || 1;
        const novaUnidade = (data.unidade || 'UN').trim().toUpperCase();

        const updatePayload: any = {
          material: novoMaterial,
          quantidade: novaQtd,
          unidade: novaUnidade,
          item_status: 'IDENTIFICADO',
          status_item: 'IDENTIFICADO',
          codigo_nm: nmClean,
          codigo: nmClean,
          codigo_item: nmClean
        };

        const { error: errReq } = await supabase
          .from('requisicoes')
          .update(updatePayload)
          .eq('id', it.id);

        if (errReq) {
          console.warn('Aviso no update de requisicoes:', errReq.message);
        }

        try {
          await supabase
            .from('itens_rm')
            .update({
              material: novoMaterial,
              quantidade: novaQtd,
              unidade: novaUnidade
            })
            .eq('id', it.id);
        } catch (e) {
          // Tabela filha opcional
        }
      });

      await Promise.all(updatePromises);

      // Mutação Local (Optimistic Update) no estado reativo de RMs/requisições
      setRequisitions(prev => prev.map(item => {
        const data = fixingItemsData[item.id];
        if (data && unidentifiedItems.some(it => it.id === item.id)) {
          const nmClean = data.codigoNm.trim();
          const descClean = data.descricao.trim().toUpperCase();
          const novoMaterial = `${nmClean} - ${descClean}`;
          const novaQtd = Number(data.quantidade);
          const novaUnidade = data.unidade.trim().toUpperCase();

          return {
            ...item,
            material: novoMaterial,
            quantidade: novaQtd,
            unidade: novaUnidade,
            _raw: {
              ...(item._raw || {}),
              material: novoMaterial,
              quantidade: novaQtd,
              unidade: novaUnidade,
              codigo_nm: nmClean
            }
          };
        }
        return item;
      }));

      showToast(`Itens da RM #${fixingRm.rmNumber} corrigidos com sucesso! RM liberada para atendimento.`, 'success');

      setIsFixingModalOpen(false);
      setFixingRm(null);
      setFixingItemsData({});

      // Callback / Re-fetch no Supabase para sincronização definitiva
      await fetchRMs();
    } catch (err: any) {
      console.error('Erro ao salvar correções:', err);
      showToast(`Erro ao salvar correções: ${err.message || err}`, 'error');
    } finally {
      setSavingFixes(false);
    }
  };
  
  // Estado para rastrear RMs selecionadas por aprovador na tela de Aprovadores
  const [selectedRms, setSelectedRms] = useState<{[key: string]: string[]}>({
    'André': [],
    'Maicon': [],
    'Fábio': []
  });

  // Estados de autenticação e proteção de rotas reais com o Supabase Auth
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showEmailConfirmModal, setShowEmailConfirmModal] = useState<boolean>(false);
  const [registeredEmail, setRegisteredEmail] = useState<string>('');

  // Sincronização de Sessão Supabase Auth & Hash do Modo TV público
  useEffect(() => {
    // 1. Monitoramento do hash de rota e parâmetros
    const handleHashAndParams = () => {
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);
      if (hash === '#tv' || hash === '#/tv' || params.get('view') === 'tv') {
        setActiveView('tv');
      }
    };
    handleHashAndParams();
    window.addEventListener('hashchange', handleHashAndParams);

    // 2. Monitoramento de sessão ativa no Supabase Auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      setIsAuthChecking(false);
    }).catch((err) => {
      console.error("Erro ao obter sessão:", err);
      setIsAuthChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session);
      setIsAuthChecking(false);
    });

    return () => {
      window.removeEventListener('hashchange', handleHashAndParams);
      subscription.unsubscribe();
    };
  }, []);

  // Proteção de Roteamento Interno (Prevenção de URL Hack / Segurança) para Almoxarife Central
  useEffect(() => {
    if (userRole === 'Almoxarife Central') {
      if (activeView !== 'triagem' && activeView !== 'tv') {
        setActiveView('triagem');
      }
    }
  }, [userRole, activeView]);

  const COLABORADORES = [
    'ALEX SANDRO',
    'ALINE LEAL',
    'ANDRE RAMALHO',
    'EDUARDO JUNIOR',
    'ERECIAS DIAS',
    'FABIO OLIVEIRA',
    'FABIO SERGIO',
    'GONÇALO FILHO',
    'IVANILDO RABELO',
    'JORGE LUIS',
    'JOSE PAULO',
    'JOSE SANTANA',
    'RENAN KEVEN',
    'THAYS LISBOA',
    'WILDERLEY'
  ];
  
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --------------------------------------------------------------------------
  // BUSCA DE RMS E SINCRONIZAÇÃO EM TEMPO REAL
  // --------------------------------------------------------------------------
  const fetchRMs = async () => {
    try {
      let todosOsDados: any[] = [];
      let inicio = 0;
      const pageSize = 1000;
      let temMais = true;
      let pageCount = 0;
      const maxPages = 15;

      while (temMais && pageCount < maxPages) {
        let res = await supabase
          .from('requisicoes')
          .select('*')
          .order('createdTimestamp', { ascending: false })
          .range(inicio, inicio + pageSize - 1);

        if (res.error) {
          res = await supabase
            .from('requisicoes')
            .select('*')
            .range(inicio, inicio + pageSize - 1);
        }

        const data = res.data;
        const error = res.error;

        if (error) {
          console.error("Erro no fetch de requisicoes:", error);
          break;
        }

        if (data && data.length > 0) {
          todosOsDados = [...todosOsDados, ...data];
          pageCount++;
          if (data.length < pageSize) {
            temMais = false;
          } else {
            inicio += pageSize;
          }
        } else {
          temMais = false;
        }
      }

      console.log("RMs recebidas do Supabase (total paginado):", todosOsDados.length);
      
      const parsed: Requisition[] = (todosOsDados || []).flatMap((row: any) => {
        // Normaliza tipoRM e categoria para estarem sempre em sintonia
        let rawTipo = String(row.tipoRM ?? row.tipo_rm ?? '').trim();
        let rawCategoria = String(row.categoria ?? '').trim();

        if (!rawTipo && rawCategoria) {
          const lowerCat = rawCategoria.toLowerCase();
          if (lowerCat.includes('tecnica') || lowerCat.includes('técnica')) {
            rawTipo = 'pre_cotacao_tecnica';
          } else if (lowerCat.includes('cotacao') || lowerCat.includes('cotação')) {
            rawTipo = 'pre_cotacao';
          } else if (lowerCat.includes('cc99')) {
            rawTipo = 'cc99';
          } else if (lowerCat.includes('estoque')) {
            rawTipo = 'estoque';
          } else {
            rawTipo = 'RM Normal';
          }
        } else if (!rawTipo) {
          rawTipo = 'RM Normal';
        }

        // Alinha a categoria com base no tipoRM para garantir a relação perfeita
        const tipoLower = rawTipo.toLowerCase();
        if (tipoLower === 'pre_cotacao') {
          rawCategoria = 'Pré-Cotação';
        } else if (tipoLower === 'pre_cotacao_tecnica') {
          rawCategoria = 'Pré-Cotação Técnica';
        } else if (tipoLower === 'cc99') {
          rawCategoria = 'CC99';
        } else if (tipoLower === 'estoque') {
          rawCategoria = 'Estoque';
        } else if (tipoLower === 'rm normal') {
          rawCategoria = 'Estoque';
        } else if (!rawCategoria) {
          rawCategoria = 'Estoque';
        }

        const itemsToProcess = extractEmbeddedItems(row);

        return itemsToProcess.map((itemObj: any, idx: number) => {
          const itemInfo = extractItemInfo(itemObj);
          const rawRowMat = String(row.material ?? '').trim();
          const safeRowMat = isPersonName(rawRowMat) ? '' : rawRowMat;

          return {
            _raw: row,
            id: itemsToProcess.length > 1 ? `${String(row.id || '')}_item_${idx}` : String(row.id || ''),
            rmNumber: String(row.rmNumber ?? row.rm_number ?? 'RM-SGI'),
            material: itemInfo.material || safeRowMat,
            quantidade: itemInfo.quantidade,
            unidade: itemInfo.unidade,
          setor: String(row.setor ?? 'Geral'),
          solicitante: String(row.solicitante ?? 'Solicitante SGI'),
          dataSolicitacao: String(row.dataSolicitacao ?? row.data_solicitacao ?? new Date().toLocaleDateString('pt-BR')),
          status: String(row.status ?? 'Pendente'),
          dataNecessidade: String(row.dataNecessidade ?? row.data_necessidade ?? ''),
          motivo: String(row.motivo ?? ''),
          centroCusto: String(row.centroCusto ?? row.centro_custo ?? ''),
          projeto: String(row.projeto ?? ''),
          classeFinanceira: String(row.classeFinanceira ?? row.classe_financeira ?? ''),
          proximosAprov: String(row.proximosAprov ?? row.proximos_aprov ?? ''),
          createdTimestamp: String(row.createdTimestamp ?? row.created_at ?? new Date().toISOString()),
          categoria: rawCategoria,
          parecerDiligenciador: (() => {
            const raw = String(row.parecerDiligenciador ?? row.parecer_diligenciador ?? '');
            if (raw.trim().startsWith('{')) {
              try {
                const parsedJson = JSON.parse(raw);
                return parsedJson.parecer || '';
              } catch (e) {
                return raw;
              }
            }
            return raw;
          })(),
          urgencia: String(row.urgencia ?? 'Média'),
          observacao: String(row.observacao ?? ''),
          concluidoTimestamp: row.concluidoTimestamp ?? null,
          reaproveitamento: Number(row.reaproveitamento ?? 0),
          tipoRM: rawTipo,
          // NOVOS CAMPOS WORKFLOW
          tratado_por: String(row.tratado_por ?? ''),
          acao_recomendada: String(row.acao_recomendada ?? ''),
          status_interno: (() => {
            const rawStatusInterno = String(row.status_interno ?? '').trim();
            const rawStatus = String(row.status ?? '').trim();
            const rawFase = String(row.fase ?? '').trim();
            const statusLower = rawStatus.toLowerCase();
            const internoLower = rawStatusInterno.toLowerCase();
            const faseLower = rawFase.toLowerCase();

            if (statusLower === 'maternidade' || internoLower === 'maternidade') {
              return 'Maternidade';
            }
            if (internoLower === 'finalizado' || statusLower === 'finalizado' || statusLower === 'concluída' || statusLower === 'concluida') {
              return 'Finalizado';
            }
            // Se for RM Filha (possui rm_mae_id), pula a triagem e vai direto para Aguardando Aprovador
            if (row.rm_mae_id || row.rmMaeId) {
              return 'Aguardando Aprovador';
            }
            if (
              internoLower === 'triagem' ||
              internoLower === 'em triagem' ||
              internoLower === 'em tratamento' ||
              internoLower.includes('tratamento') ||
              statusLower === 'triagem' ||
              statusLower === 'em triagem' ||
              statusLower === 'em tratamento' ||
              statusLower.includes('tratamento') ||
              faseLower === 'triagem' ||
              faseLower === 'em triagem' ||
              faseLower.includes('tratamento')
            ) {
              return 'Em Tratamento';
            }
            if (rawStatusInterno === 'Em Tratamento' || rawStatusInterno === 'Aguardando Aprovador' || rawStatusInterno === 'Aguardando Tratamento' || rawStatusInterno === 'Maternidade') {
              return rawStatusInterno;
            }
            // Se for 'Ativo' ou vazio, inferir o status do workflow
            const tratadoPor = String(row.tratado_por ?? '').trim();
            const dataConclusao = row.data_conclusao_tratamento ? String(row.data_conclusao_tratamento).trim() : '';
            const dataInicio = row.data_inicio_tratamento ? String(row.data_inicio_tratamento).trim() : '';
            
            if (dataConclusao || String(row.acao_recomendada ?? '').trim()) {
              return 'Aguardando Aprovador';
            } else if (dataInicio || tratadoPor) {
              return 'Em Tratamento';
            } else {
              return 'Aguardando Tratamento';
            }
          })(),
          data_inicio_tratamento: row.data_inicio_tratamento ? String(row.data_inicio_tratamento) : '',
          data_conclusao_tratamento: row.data_conclusao_tratamento ? String(row.data_conclusao_tratamento) : '',
          aprovador_destino: String(row.aprovador_destino ?? ''),
          agente_tratamento: String(row.agente_tratamento ?? row.tratado_por ?? ''),
          motivo_espera: String(row.motivo_espera ?? ''),
          override_manual: !!row.override_manual,
          data_override: row.data_override ? String(row.data_override) : '',
          usuario_override: row.usuario_override ? String(row.usuario_override) : '',
          numero_rtd: (() => {
            if (row.numero_rtd !== undefined && row.numero_rtd !== null && String(row.numero_rtd).trim() !== '') {
              return String(row.numero_rtd);
            }
            const raw = String(row.parecerDiligenciador ?? row.parecer_diligenciador ?? '');
            if (raw.trim().startsWith('{')) {
              try {
                const parsedJson = JSON.parse(raw);
                return parsedJson.numero_rtd || '';
              } catch (e) {}
            }
            return '';
          })(),
          item_status: (() => {
            if (row.item_status !== undefined && row.item_status !== null && String(row.item_status).trim() !== '') {
              return String(row.item_status);
            }
            const raw = String(row.parecerDiligenciador ?? row.parecer_diligenciador ?? '');
            if (raw.trim().startsWith('{')) {
              try {
                const parsedJson = JSON.parse(raw);
                return parsedJson.item_status || '';
              } catch (e) {}
            }
            return '';
          })(),
          quantidade_atendida: (() => {
            if (row.quantidade_atendida !== undefined && row.quantidade_atendida !== null) {
              return Number(row.quantidade_atendida);
            }
            const raw = String(row.parecerDiligenciador ?? row.parecer_diligenciador ?? '');
            if (raw.trim().startsWith('{')) {
              try {
                const parsedJson = JSON.parse(raw);
                return parsedJson.quantidade_atendida ?? 0;
              } catch (e) {}
            }
            return 0;
          })(),
          // Rastreabilidade Mãe e Filha (Desmembramento)
          rm_mae_id: row.rm_mae_id ?? row.rmMaeId ?? null,
          rm_filha_id: row.rm_filha_id ?? row.rmFilhaId ?? null,
          orientacao_combo: String(row.orientacao_combo ?? row.orientacao_aprovacao ?? row.observacao_combo ?? row.orientacao_aprovvo ?? ''),
          orientacao_aprovacao: String(row.orientacao_combo ?? row.orientacao_aprovacao ?? row.observacao_combo ?? row.orientacao_aprovvo ?? ''),
          observacao_combo: String(row.observacao_combo ?? row.orientacao_combo ?? row.orientacao_aprovacao ?? row.orientacao_aprovvo ?? '')
        };
      });
    });

      const formatarStatusRM = (rm: Requisition) => {
        const statusOriginal = rm.status || '';
        const isPendente = statusOriginal.toLowerCase().includes('pendente');
        const acao = (rm.acao_recomendada || '').toLowerCase();

        let novoStatus = statusOriginal;

        // 1. REGRA UNIVERSAL DE STATUS (Approvo)
        if (!isPendente && acao) {
          if (acao.includes('aprovar') || acao.includes('atender') || acao.includes('comprar')) {
            novoStatus = 'Aprovado';
          } else if (acao.includes('reprovar') || acao.includes('cancelar')) {
            novoStatus = 'Reprovado/Cancelado';
          }
        }
        
        let novoStatusInterno = rm.status_interno;

        // 2. REGRA DE FAXINA AUTOMÁTICA (Envio para o Histórico)
        // Verifica se a RM já desceu para a mesa de um aprovador final
        const isNaMesaAprovador = rm.aprovador_destino && 
                                 ['andré', 'andre', 'maicon', 'fábio', 'fabio']
                                 .some(nome => rm.aprovador_destino!.toLowerCase().includes(nome));

        // Se não está mais pendente no Approvo E está na mesa de um aprovador, manda para o histórico
        if (!isPendente && isNaMesaAprovador) {
          // Altera o status_interno para forçar a saída da coluna ativa
          novoStatusInterno = 'Finalizado'; 
        }

        return { 
          ...rm, 
          status: novoStatus,
          status_interno: novoStatusInterno
        };
      };

      const rmsCorrigidas = parsed.map(formatarStatusRM);

      setRequisitions(rmsCorrigidas);
    } catch (e: any) {
      console.error(`Falha de leitura Supabase via REST SDK: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRMs(); // Busca inicial

    // Configuração do Listener em Tempo Real (Supabase Channel) para requisicoes e itens_rm
    const channel = supabase
      .channel('requisicoes_and_itens_realtime_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requisicoes'
        },
        () => {
          console.log('Realtime Change: requisicoes table updated. Reloading...');
          fetchRMs();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'itens_rm'
        },
        () => {
          console.log('Realtime Change: itens_rm table updated. Reloading...');
          fetchRMs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeView]);

  // Efeito para carregar RMs Filhas vinculadas à RM Mãe quando o modal de tratamento é aberto (Relação 1:N)
  useEffect(() => {
    if (!treatingRm || !isTreatmentModalOpen) {
      setDaughterRms([]);
      setDaughterDecisions({});
      return;
    }

    const fetchDaughterRmsForMother = async () => {
      setLoadingDaughterRms(true);
      try {
        const motherNum = String(treatingRm.rmNumber || treatingRm.id).trim();
        const motherId = String(treatingRm.id || '').trim();
        const rawFilhaId = (treatingRm.rm_filha_id || '').toString().trim();

        // Identifica RMs filhas locais no estado
        const localDaughters = requisitions.filter(item => {
          const itemMaeId = String(item.rm_mae_id || '').trim();
          const itemRmNum = String(item.rmNumber || item.id || '').trim();
          if (itemRmNum === motherNum || itemRmNum === motherId) return false;
          if (itemMaeId && (itemMaeId === motherNum || itemMaeId === motherId)) return true;
          if (rawFilhaId && rawFilhaId.split(',').map(s => s.trim()).includes(itemRmNum)) return true;
          return false;
        });

        // Monta busca no Supabase
        const orClauses: string[] = [];
        if (motherNum) orClauses.push(`rm_mae_id.eq.${motherNum}`);
        if (motherId) orClauses.push(`rm_mae_id.eq.${motherId}`);
        if (rawFilhaId) {
          rawFilhaId.split(',').forEach(idStr => {
            const clean = idStr.trim();
            if (clean) {
              orClauses.push(`rm_number.eq.${clean}`);
              orClauses.push(`rmNumber.eq.${clean}`);
              orClauses.push(`id.eq.${clean}`);
            }
          });
        }

        let remoteRows: any[] = [];
        if (orClauses.length > 0) {
          const { data, error } = await supabase
            .from('requisicoes')
            .select('*')
            .or(orClauses.join(','));
          if (!error && data) {
            remoteRows = data;
          }
        }

        const combinedDaughterMap: Record<string, any> = {};

        remoteRows.forEach(row => {
          const dRmNum = String(row.rm_number || row.rmNumber || row.id || '').trim();
          if (dRmNum && dRmNum !== motherNum && dRmNum !== motherId) {
            if (!combinedDaughterMap[dRmNum]) {
              combinedDaughterMap[dRmNum] = {
                id: row.id,
                rmNumber: dRmNum,
                rm_mae_id: row.rm_mae_id || motherNum,
                status: row.status,
                status_interno: row.status_interno,
                status_tratamento: row.status_tratamento || row.orientacao_aprovacao || row.acao_recomendada || 'Aprovar',
                itens: []
              };
            }
            combinedDaughterMap[dRmNum].itens.push({
              id: row.id,
              material: row.material,
              quantidade: row.quantidade,
              unidade: row.unidade,
              status: row.status
            });
          }
        });

        localDaughters.forEach(dReq => {
          const dRmNum = String(dReq.rmNumber || dReq.id).trim();
          if (dRmNum && dRmNum !== motherNum && dRmNum !== motherId) {
            if (!combinedDaughterMap[dRmNum]) {
              combinedDaughterMap[dRmNum] = {
                id: dReq.id,
                rmNumber: dRmNum,
                rm_mae_id: dReq.rm_mae_id || motherNum,
                status: dReq.status,
                status_interno: dReq.status_interno,
                status_tratamento: dReq.acao_recomendada || 'Aprovar',
                itens: (dReq as any).itens || []
              };
            }
          }
        });

        const list = Object.values(combinedDaughterMap);
        setDaughterRms(list);

        const initialDecisions: Record<string, 'Aprovar' | 'Reprovar'> = {};
        list.forEach(d => {
          const existingStatus = String(d.status_tratamento || d.status || '').toUpperCase();
          initialDecisions[d.rmNumber] = existingStatus.includes('REPROV') ? 'Reprovar' : 'Aprovar';
        });
        setDaughterDecisions(initialDecisions);
      } catch (err) {
        console.error("Erro ao carregar RMs Filhas para tratamento:", err);
      } finally {
        setLoadingDaughterRms(false);
      }
    };

    fetchDaughterRmsForMother();
  }, [treatingRm, isTreatmentModalOpen]);

  // --------------------------------------------------------------------------
  // AGRUPAMENTO GLOBAL DE TODAS AS RMs (PARA ESTATÍSTICAS REAIS E FILTRAGEM)
  // --------------------------------------------------------------------------
  const groupedAllRequisitions = useMemo(() => {
    const groups: { [key: string]: GroupedRequisition } = {};
    for (const item of requisitions) {
      const rmNum = item.rmNumber || 'RM-SGI';
      if (!groups[rmNum]) {
        groups[rmNum] = {
          _raw: item._raw || item,
          rmNumber: rmNum,
          solicitante: item.solicitante || 'Solicitante SGI',
          setor: item.setor || 'Geral',
          dataSolicitacao: item.dataSolicitacao || '',
          dataNecessidade: item.dataNecessidade || 'Não informada',
          status: item.status || 'Pendente',
          motivo: item.motivo || '',
          categoria: item.categoria || 'Estoque',
          tipoRM: item.tipoRM || 'RM Normal',
          urgencia: item.urgencia || 'Média',
          parecerDiligenciador: localJustifications[rmNum] || item.parecerDiligenciador || '',
          proximosAprov: item.proximosAprov || '',
          tratado_por: item.tratado_por || '',
          acao_recomendada: item.acao_recomendada || '',
          status_interno: item.status_interno || 'Aguardando Tratamento',
          data_inicio_tratamento: item.data_inicio_tratamento || '',
          data_conclusao_tratamento: item.data_conclusao_tratamento || '',
          aprovador_destino: item.aprovador_destino || '',
          createdTimestamp: item.createdTimestamp || '',
          centroCusto: item.centroCusto || '',
          classeFinanceira: item.classeFinanceira || item._raw?.classe_financeira || item._raw?.classeFinanceira || '',
          agente_tratamento: item.agente_tratamento || item.tratado_por || '',
          motivo_espera: item.motivo_espera || '',
          override_manual: item.override_manual,
          data_override: item.data_override || '',
          usuario_override: item.usuario_override || '',
          numero_rtd: item.numero_rtd || '',
          rm_mae_id: item.rm_mae_id ?? null,
          rm_filha_id: item.rm_filha_id ?? null,
          orientacao_combo: item.orientacao_combo || item.orientacao_aprovacao || item.observacao_combo || '',
          orientacao_aprovacao: item.orientacao_combo || item.orientacao_aprovacao || item.observacao_combo || '',
          observacao_combo: item.observacao_combo || item.orientacao_combo || item.orientacao_aprovacao || '',
          decisao_direta: Boolean(
            item.decisao_direta || 
            item._raw?.decisao_direta || 
            (item.acao_recomendada && String(item.acao_recomendada).toLowerCase().includes('decisão direta')) ||
            (item.parecerDiligenciador && String(item.parecerDiligenciador).toLowerCase().includes('decisão direta'))
          ),
          orientacao_approvo: item.orientacao_approvo || item.orientacao_aprovacao || item.orientacao_combo || '',
          itens: []
        };
      }
      if (item.decisao_direta) {
        groups[rmNum].decisao_direta = true;
      }
      if (item.rm_mae_id && !groups[rmNum].rm_mae_id) {
        groups[rmNum].rm_mae_id = item.rm_mae_id;
      }
      if (item.rm_filha_id && !groups[rmNum].rm_filha_id) {
        groups[rmNum].rm_filha_id = item.rm_filha_id;
      }
      if (item.numero_rtd && !groups[rmNum].numero_rtd) {
        groups[rmNum].numero_rtd = item.numero_rtd;
      }
      if (item.orientacao_combo && !groups[rmNum].orientacao_combo) {
        groups[rmNum].orientacao_combo = item.orientacao_combo;
      }
      if (item.orientacao_aprovacao && !groups[rmNum].orientacao_aprovacao) {
        groups[rmNum].orientacao_aprovacao = item.orientacao_aprovacao;
      }
      if (item.observacao_combo && !groups[rmNum].observacao_combo) {
        groups[rmNum].observacao_combo = item.observacao_combo;
      }
      groups[rmNum].itens.push({
        id: item.id,
        material: item.material || '',
        quantidade: item.quantidade ?? 1,
        unidade: item.unidade || 'UN',
        item_status: item.item_status || '',
        quantidade_atendida: item.quantidade_atendida ?? 0
      });
    }
    return Object.values(groups);
  }, [requisitions, localJustifications]);

  // --------------------------------------------------------------------------
  // EXTRAÇÃO DINÂMICA DE CENTROS DE CUSTO / SETORES ÚNICOS
  // --------------------------------------------------------------------------
  const centrosDeCustoUnicos = useMemo(() => {
    if (!groupedAllRequisitions) return [];
    const ccs = groupedAllRequisitions
      .map((rm: any) => rm.centroCusto || rm.setor || rm._raw?.centro_custo || rm._raw?.setor || '')
      .filter((cc: string) => typeof cc === 'string' && cc.trim() !== '');
    
    return Array.from(new Set(ccs)).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [groupedAllRequisitions]);

  // --------------------------------------------------------------------------
  // FILTRAGEM GLOBAL DE CENTRO DE CUSTO E DATAS (APLICADO EM CASCATA)
  // --------------------------------------------------------------------------
  const filteredGroupedAllRequisitions = useMemo(() => {
    return groupedAllRequisitions.filter(item => {
      // 1. Filtro Global por Centro de Custo / Setor
      if (filtroCC !== 'TODOS') {
        const ccDaRM = (item.centroCusto || item.setor || item._raw?.centro_custo || item._raw?.setor || '').trim();
        if (ccDaRM !== filtroCC) {
          return false;
        }
      }

      // 2. Filtro Global de Período de Datas
      if (filterStartDate || filterEndDate) {
        const reqDate = getParsedDate(item.createdTimestamp) || getParsedDate(item.dataSolicitacao);
        if (reqDate) {
          if (filterStartDate) {
            const startLimit = new Date(filterStartDate + 'T00:00:00');
            if (reqDate < startLimit) return false;
          }
          if (filterEndDate) {
            const endLimit = new Date(filterEndDate + 'T23:59:59.999');
            if (reqDate > endLimit) return false;
          }
        } else {
          return false;
        }
      }
      return true;
    });
  }, [groupedAllRequisitions, filtroCC, filterStartDate, filterEndDate]);

  // --------------------------------------------------------------------------
  // AGRUPAMENTO E FILTRAGEM DE RMs (LAYOUT CARDS)
  // --------------------------------------------------------------------------
  const groupedRequisitions = useMemo(() => {
    const mapeamentoFiltros = {
      'Estoque': 'estoque',
      'Pré-Cotação': 'pre_cotacao',
      'Pré-Cotação Técnica': 'pre_cotacao_tecnica',
      'CC99': 'cc99'
    };

    return filteredGroupedAllRequisitions.filter(rm => {
      // 1. Filtro da Barra de Pesquisa
      const query = searchQuery.toLowerCase().trim();
      const matchBusca = query === '' || 
        String(rm.rmNumber || '').toLowerCase().includes(query) || 
        String(rm.solicitante || '').toLowerCase().includes(query) || 
        String(rm.setor || '').toLowerCase().includes(query) || 
        rm.itens.some(item => String(item.material || '').toLowerCase().includes(query));

      // 2. Filtro dos Botões de Tipo/Categoria
      let matchTipo = true;
      if (selectedType !== 'Todas') {
        const tipoEsperado = (mapeamentoFiltros[selectedType as keyof typeof mapeamentoFiltros] || '').toLowerCase();
        const tipoRMSalvo = (rm.tipoRM || '').toLowerCase();
        const categoriaSalva = (rm.categoria || '').toLowerCase();
        
        // Compara ignorando diferenças de caixa (maiúscula/minúscula)
        matchTipo = tipoRMSalvo === tipoEsperado || categoriaSalva === tipoEsperado;
      }

      return matchBusca && matchTipo;
    });
  }, [filteredGroupedAllRequisitions, searchQuery, selectedType]);

  // --------------------------------------------------------------------------
  // FILTRAGEM DE RMs PARA O MODO TV
  // --------------------------------------------------------------------------
  const tvFilteredRequisitions = useMemo(() => {
    return filteredGroupedAllRequisitions.filter(rm => {
      // Exibe apenas as RMs ativas/pendentes na TV (ignora finalizadas)
      if (rm.status_interno === 'Finalizado') {
        return false;
      }
      
      // Filtra pelo número da RM digitado na busca da TV
      if (tvSearchQuery.trim() !== '') {
        const query = tvSearchQuery.toLowerCase().trim();
        return String(rm.rmNumber || '').toLowerCase().includes(query);
      }
      return true;
    });
  }, [filteredGroupedAllRequisitions, tvSearchQuery]);

  // --------------------------------------------------------------------------
  // FILTRAGEM DOS APROVADORES (APENAS STATUS INTERNO === AGUARDANDO APROVADOR)
  // --------------------------------------------------------------------------
  const aprovadoresRequisitions = useMemo(() => {
    return filteredGroupedAllRequisitions.filter(item => {
      // 1. Se a RM já foi tratada/concluída no ERP (Aprovada ou Reprovada), remove da tela
      const statusERP = (item.status || '').toUpperCase();
      if (statusERP === 'APROVADA' || statusERP === 'REPROVADA' || statusERP === 'CONCLUÍDA') {
        return false;
      }

      // 2. Exclui RMs que possuem rm_mae_id preenchido (RM Filha)
      // A RM Filha nunca deve aparecer como card independente (é exibida dentro do card da Mãe)
      if (item.rm_mae_id && String(item.rm_mae_id).trim() !== '') {
        return false;
      }

      // 3. Exibe apenas aquelas aguardando aprovador no fluxo interno
      if (item.status_interno !== 'Aguardando Aprovador') {
        return false;
      }
      // Respeita busca rápida se houver
      if (searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        const rmNum = String(item.rmNumber || '').toLowerCase();
        const sol = String(item.solicitante || '').toLowerCase();
        const set = String(item.setor || '').toLowerCase();
        
        const match = rmNum.includes(query) || sol.includes(query) || set.includes(query);
        if (!match) return false;
      }
      return true;
    });
  }, [filteredGroupedAllRequisitions, searchQuery]);

  // --------------------------------------------------------------------------
  // FILTRAGEM DE MATERNIDADE (AGUARDANDO DESMEMBRAMENTO)
  // --------------------------------------------------------------------------
  const maternidadeRequisitions = useMemo(() => {
    return filteredGroupedAllRequisitions.filter(item => {
      const statusERP = (item.status || '').toUpperCase();
      if (statusERP === 'APROVADA' || statusERP === 'REPROVADA' || statusERP === 'CONCLUÍDA') {
        return false;
      }
      return item.status_interno === 'Maternidade' || statusERP === 'MATERNIDADE';
    });
  }, [filteredGroupedAllRequisitions]);

  // Abas de navegação da Sidebar fixa lateral
  const abas = useMemo(() => [
    ...(userRole !== 'Almoxarife Central' ? [{ id: 'principal', label: 'Almoxarifado', icone: <Sliders className="w-4 h-4" /> }] : []),
    { id: 'triagem', label: 'Triagem', icone: <Clock className="w-4 h-4" /> },
    ...(userRole !== 'Almoxarife Central' ? [
      { id: 'direcionamento', label: 'Direcionamento', icone: <GitFork className="w-4 h-4" /> },
      { 
        id: 'maternidade', 
        label: 'Maternidade', 
        icone: <Baby className="w-4 h-4" />,
        badge: maternidadeRequisitions.length > 0 ? maternidadeRequisitions.length : undefined
      },
      { id: 'aprovadores', label: 'Aprovadores', icone: <Users className="w-4 h-4" /> },
      { id: 'historico', label: 'Histórico', icone: <History className="w-4 h-4" /> },
    ] : []),
    { id: 'tv', label: 'Modo TV', icone: <Tv className="w-4 h-4" /> },
  ], [userRole, maternidadeRequisitions.length]);

  // --------------------------------------------------------------------------
  // FILTRAGEM DE ALMOXARIFADO (PRINCIPAL) - CAIXA DE ENTRADA & ÓRFÃOS SEM DONO
  // --------------------------------------------------------------------------
  const principalRequisitions = useMemo(() => {
    return groupedRequisitions.filter((rm: any) => {
      // 1. Regra de exclusão: NUNCA trazer RMs que possuam rm_mae_id preenchido (RM Filha)
      if (rm.rm_mae_id && String(rm.rm_mae_id).trim() !== '') {
        return false;
      }

      // 2. Se a RM já foi concluída/reprovada/aprovada no ERP ou finalizada no fluxo interno
      const statusERP = String(rm.status || '').toUpperCase();
      if (statusERP === 'APROVADA' || statusERP === 'REPROVADA' || statusERP === 'CONCLUÍDA') {
        return false;
      }

      const statusLimpo = String(rm.status || rm.fase || '').trim().toLowerCase();
      const statusInternoLimpo = String(rm.status_interno || '').trim().toLowerCase();

      // Se estiver em fases subsequentes (Aguardando Aprovador, Maternidade, Finalizado), não entra na caixa de entrada
      if (
        statusInternoLimpo === 'finalizado' ||
        statusInternoLimpo === 'aguardando aprovador' ||
        statusInternoLimpo === 'maternidade'
      ) {
        return false;
      }

      // Regra 1: Mantém a regra original para RMs que chegam com status 'almoxarifado', 'novo', 'pendente' ou 'aguardando tratamento'
      const isStatusAlmoxarifado = 
        !rm.status_interno || 
        statusInternoLimpo === 'aguardando tratamento' || 
        statusInternoLimpo === 'almoxarifado' || 
        statusInternoLimpo === 'novo' || 
        statusInternoLimpo === 'pendente' ||
        statusLimpo === 'almoxarifado' ||
        statusLimpo === 'novo' ||
        statusLimpo === 'pendente';

      // Regra 2: Captura as RMs que estão em Triagem / Tratamento (status), mas ainda SEM DONO (aguardando assunção)
      const isStatusTriagem = 
        statusInternoLimpo === 'em tratamento' ||
        statusInternoLimpo === 'triagem' ||
        statusInternoLimpo === 'em triagem' ||
        statusInternoLimpo.includes('tratamento') ||
        statusLimpo === 'triagem' ||
        statusLimpo === 'em triagem' ||
        statusLimpo === 'em tratamento' ||
        statusLimpo.includes('tratamento');

      const rawTratadoPor = String(rm.tratado_por || rm.agente_tratamento || '').trim();
      const isSemDono = !rawTratadoPor || rawTratadoPor === 'AGUARDANDO ASSUNÇÃO' || rawTratadoPor.toUpperCase() === 'AGUARDANDO ASSUNÇÃO';

      return isStatusAlmoxarifado || (isStatusTriagem && isSemDono);
    });
  }, [groupedRequisitions]);

  // --------------------------------------------------------------------------
  // FILTRAGEM DE TRIAGEM (EM TRATAMENTO) - ÁREA DE TRABALHO ATIVA (EXIGIR DONO)
  // --------------------------------------------------------------------------
  const triagemRequisitions = useMemo(() => {
    return groupedRequisitions.filter((rm: any) => {
      // 1. Regra de exclusão: RM Filha ou decisão direta
      if (rm.rm_mae_id && String(rm.rm_mae_id).trim() !== '') {
        return false;
      }
      if (rm.decisao_direta === true) {
        return false;
      }

      // 2. Isola e limpa os status (evita quebra por null/undefined e espaços)
      const statusLimpo = String(rm.status || rm.fase || '').trim().toLowerCase();
      const statusInternoLimpo = String(rm.status_interno || '').trim().toLowerCase();

      // 3. Match flexível para englobar variações de nomenclatura de triagem/tratamento
      const isStatusTriagem = 
        statusInternoLimpo === 'em tratamento' ||
        statusInternoLimpo === 'triagem' ||
        statusInternoLimpo === 'em triagem' ||
        statusInternoLimpo.includes('tratamento') ||
        statusLimpo === 'triagem' ||
        statusLimpo === 'em triagem' ||
        statusLimpo === 'em tratamento' ||
        statusLimpo.includes('tratamento');

      // 4. Nova Regra: Verifica se a RM já tem um dono real assinalado (Exigir Dono)
      const rawTratadoPor = String(rm.tratado_por || rm.agente_tratamento || '').trim();
      const hasDono = !!rawTratadoPor && rawTratadoPor !== 'AGUARDANDO ASSUNÇÃO' && rawTratadoPor.toUpperCase() !== 'AGUARDANDO ASSUNÇÃO';

      if (!isStatusTriagem || !hasDono) {
        return false;
      }

      // 5. Filtro de Almoxarife (se selecionado específico no dropdown)
      if (filtroAlmoxarife !== 'Todos') {
        const responsavel = rawTratadoPor.toUpperCase();
        if (responsavel !== filtroAlmoxarife.trim().toUpperCase()) {
          return false;
        }
      }

      return true;
    });
  }, [groupedRequisitions, filtroAlmoxarife]);

  // --------------------------------------------------------------------------
  // FILTRAGEM DE HISTÓRICO (FINALIZADO) - APENAS RMs FINALIZADAS
  // --------------------------------------------------------------------------
  const historicoRequisitions = useMemo(() => {
    let baseList = historicoItems;
    if (baseList.length === 0) {
      baseList = filteredGroupedAllRequisitions.filter(item => item.status_interno === 'Finalizado');
    }

    return baseList.filter(item => {
      if (item.status_interno !== 'Finalizado' && baseList === filteredGroupedAllRequisitions) {
        return false;
      }

      // Filtro de Centro de Custo / Setor
      if (filtroCC !== 'TODOS') {
        const ccDaRM = (item.centroCusto || item.setor || item._raw?.centro_custo || item._raw?.setor || '').trim();
        if (ccDaRM !== filtroCC) return false;
      }

      // Filtro de Período de Datas
      if (historicoStartDate || historicoEndDate) {
        const reqDate = getParsedDate(item.data_conclusao_tratamento) || 
                        getParsedDate(item.createdTimestamp) || 
                        getParsedDate(item.dataSolicitacao);
        
        if (reqDate) {
          if (historicoStartDate) {
            const startLimit = new Date(historicoStartDate + 'T00:00:00');
            if (reqDate < startLimit) return false;
          }
          if (historicoEndDate) {
            const endLimit = new Date(historicoEndDate + 'T23:59:59.999');
            if (reqDate > endLimit) return false;
          }
        } else {
          return false;
        }
      }

      if (historicoSearchQuery) {
        const query = historicoSearchQuery.toLowerCase().trim();
        const rmNum = String(item.rmNumber || '').toLowerCase();
        const sol = String(item.solicitante || '').toLowerCase();
        return rmNum.includes(query) || sol.includes(query);
      }
      return true;
    });
  }, [historicoItems, filteredGroupedAllRequisitions, filtroCC, historicoSearchQuery, historicoStartDate, historicoEndDate]);

  // Cálculo do Tempo Médio de Atendimento e Estatísticas do Histórico
  const { tempoMedioAtendimentoFormatado, historicoStats } = useMemo(() => {
    let totalMs = 0;
    let countMs = 0;
    let totalAtendidoSum = 0;
    let totalCompraSum = 0;

    for (const req of historicoRequisitions) {
      const raw = req._raw || {};
      const startStr = req.data_inicio_tratamento || raw.data_inicio_tratamento || req.createdTimestamp || raw.created_at;
      const endStr = req.data_conclusao_tratamento || raw.data_conclusao_tratamento || raw.data_finalizacao || raw.updated_at;

      if (startStr && endStr) {
        const dStart = new Date(startStr);
        const dEnd = new Date(endStr);
        if (!isNaN(dStart.getTime()) && !isNaN(dEnd.getTime())) {
          const diff = dEnd.getTime() - dStart.getTime();
          if (diff > 0) {
            totalMs += diff;
            countMs++;
          }
        }
      }

      if (req.itens && req.itens.length > 0) {
        for (const item of req.itens as any[]) {
          totalAtendidoSum += Number(item.qtdAtendida ?? item.qtd_atendida ?? item.quantidade_atendida ?? 0) || 0;
          totalCompraSum += Number(item.qtdCompra ?? item.qtd_compra ?? item.quantidade_em_compra ?? item.qtd_em_compra ?? 0) || 0;
        }
      } else {
        totalAtendidoSum += Number(req.qtd_atendida ?? (req as any).quantidade_atendida ?? 0) || 0;
        totalCompraSum += Number(req.qtd_em_compra ?? (req as any).qtd_compra ?? 0) || 0;
      }
    }

    let formattedTime = 'N/A';
    if (countMs > 0 && totalMs > 0) {
      const avgMinutes = Math.round(totalMs / (countMs * 60 * 1000));
      if (avgMinutes < 60) {
        formattedTime = `${avgMinutes} min`;
      } else {
        const hours = Math.floor(avgMinutes / 60);
        const mins = avgMinutes % 60;
        if (hours < 24) {
          formattedTime = `${hours}h ${mins > 0 ? `${mins}min` : ''}`.trim();
        } else {
          const days = Math.floor(hours / 24);
          const remainingHours = hours % 24;
          formattedTime = `${days}d ${remainingHours}h ${mins > 0 ? `${mins}min` : ''}`.trim();
        }
      }
    }

    return {
      tempoMedioAtendimentoFormatado: formattedTime,
      historicoStats: {
        totalAtendido: totalAtendidoSum,
        totalCompra: totalCompraSum
      }
    };
  }, [historicoRequisitions]);

  // --------------------------------------------------------------------------
  // LÓGICA DE SUPER BUSCA GLOBAL COM AUTOCOMPLETE E REDIRECIONAMENTO DE ABA
  // --------------------------------------------------------------------------
  const getRMTargetTab = (rm: GroupedRequisition): { tab: 'principal' | 'triagem' | 'direcionamento' | 'maternidade' | 'aprovadores' | 'historico'; label: string } => {
    const statusInt = (rm.status_interno || '').toLowerCase().trim();
    const statusErp = (rm.status || '').toUpperCase().trim();

    if (
      statusInt === 'finalizado' || 
      statusInt === 'concluí' || 
      statusInt === 'concluido' || 
      statusErp === 'APROVADA' || 
      statusErp === 'REPROVADA' || 
      statusErp === 'CANCELADA' || 
      statusErp === 'CONCLUÍDA'
    ) {
      return { tab: 'historico', label: 'Histórico' };
    }

    if (statusInt === 'aguardando aprovador' || statusInt.includes('aprovador')) {
      const ap = rm.aprovador_destino || '';
      const label = ap ? `Aprovadores (${ap})` : 'Aprovadores';
      return { tab: 'aprovadores', label };
    }

    if (statusInt === 'maternidade' || statusErp === 'MATERNIDADE') {
      return { tab: 'maternidade', label: 'Maternidade' };
    }

    if (
      statusInt === 'em tratamento' || 
      statusInt.includes('tratamento') || 
      statusInt === 'triagem' || 
      statusInt === 'em triagem' || 
      statusErp === 'TRIAGEM' || 
      statusErp === 'EM TRIAGEM' ||
      statusErp === 'EM TRATAMENTO'
    ) {
      return { tab: 'triagem', label: 'Triagem' };
    }

    if (statusInt === 'aguardando direcionamento' || statusInt.includes('direcionamento')) {
      return { tab: 'direcionamento', label: 'Direcionamento' };
    }

    return { tab: 'principal', label: 'Almoxarifado' };
  };

  // Lista mestre unificada para Autocomplete da Super Busca
  const masterRMList = useMemo(() => {
    const map = new Map<string, GroupedRequisition>();
    for (const rm of groupedAllRequisitions) {
      if (rm.rmNumber) map.set(String(rm.rmNumber), rm);
    }
    for (const rm of historicoRequisitions) {
      if (rm.rmNumber && !map.has(String(rm.rmNumber))) {
        map.set(String(rm.rmNumber), rm);
      }
    }
    return Array.from(map.values());
  }, [groupedAllRequisitions, historicoRequisitions]);

  // Resultados filtrados para o Autocomplete (mínimo 3 caracteres)
  const autocompleteResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query.length < 3) return [];

    const filtered = masterRMList.filter(rm => {
      const num = String(rm.rmNumber || '').toLowerCase();
      const sol = String(rm.solicitante || '').toLowerCase();
      const matMatch = rm.itens ? rm.itens.some(i => String(i.material || '').toLowerCase().includes(query)) : false;
      return num.includes(query) || sol.includes(query) || matMatch;
    });

    return filtered.slice(0, 10);
  }, [masterRMList, searchQuery]);

  const handleSelectAutocompleteItem = (rm: GroupedRequisition) => {
    const target = getRMTargetTab(rm);
    setActiveView(target.tab);
    const rmNumStr = String(rm.rmNumber);
    setSearchQuery(rmNumStr);
    setHistoricoSearchQuery(rmNumStr);
    setTvSearchQuery(rmNumStr);
    setShowAutocomplete(false);
  };

  // --------------------------------------------------------------------------
  // BUSCA PAGINADA DE HISTÓRICO NO SUPABASE (RMs FINALIZADAS - 10 POR PÁGINA)
  // --------------------------------------------------------------------------
  const fetchHistorico = async () => {
    setLoadingHistorico(true);
    try {
      const from = currentPage * itemsPerPage;
      const to = from + itemsPerPage - 1;

      // Tenta a tabela 'tabela_historico_rms' no Supabase
      let { data, error, count } = await supabase
        .from('tabela_historico_rms')
        .select('*', { count: 'exact' })
        .order('data_finalizacao', { ascending: false })
        .range(from, to);

      // Se a tabela 'tabela_historico_rms' não existir ou der erro, faz fallback para 'requisicoes'
      if (error || !data) {
        let reqQuery = supabase
          .from('requisicoes')
          .select('*', { count: 'exact' })
          .or('status_interno.eq.Finalizado,status.eq.Finalizado,status.eq.FINALIZADO');

        if (historicoSearchQuery.trim()) {
          const q = `%${historicoSearchQuery.trim()}%`;
          reqQuery = reqQuery.or(`rmNumber.ilike.${q},solicitante.ilike.${q}`);
        }

        if (historicoStartDate) {
          reqQuery = reqQuery.gte('createdTimestamp', historicoStartDate);
        }

        if (historicoEndDate) {
          reqQuery = reqQuery.lte('createdTimestamp', historicoEndDate + 'T23:59:59.999');
        }

        reqQuery = reqQuery.order('createdTimestamp', { ascending: false }).range(from, to);

        const res = await reqQuery;
        data = res.data;
        count = res.count;
        error = res.error;
      }

      if (error) {
        console.error('Erro ao buscar histórico do Supabase:', error);
        setHistoricoItems([]);
        setHistoricoTotalCount(0);
      } else {
        setHistoricoTotalCount(count || 0);

        const parsedRows: Requisition[] = (data || []).flatMap((row: any) => {
          let rawTipo = String(row.tipoRM ?? row.tipo_rm ?? '').trim();
          let rawCategoria = String(row.categoria ?? '').trim();

          if (!rawTipo && rawCategoria) {
            const lowerCat = rawCategoria.toLowerCase();
            if (lowerCat.includes('tecnica') || lowerCat.includes('técnica')) {
              rawTipo = 'pre_cotacao_tecnica';
            } else if (lowerCat.includes('cotacao') || lowerCat.includes('cotação')) {
              rawTipo = 'pre_cotacao';
            } else if (lowerCat.includes('cc99')) {
              rawTipo = 'cc99';
            } else if (lowerCat.includes('estoque')) {
              rawTipo = 'estoque';
            } else {
              rawTipo = 'RM Normal';
            }
          } else if (!rawTipo) {
            rawTipo = 'RM Normal';
          }

          const itemsToProcess = extractEmbeddedItems(row);

          return itemsToProcess.map((itemObj: any, idx: number) => {
            const itemInfo = extractItemInfo(itemObj);
            const rawRowMat = String(row.material ?? '').trim();
            const safeRowMat = isPersonName(rawRowMat) ? '' : rawRowMat;

            const itemQtdAtendida = (() => {
              if (itemObj.qtd_atendida !== undefined && itemObj.qtd_atendida !== null) return Number(itemObj.qtd_atendida);
              if (itemObj.qtdAtendida !== undefined && itemObj.qtdAtendida !== null) return Number(itemObj.qtdAtendida);
              if (itemObj.quantidade_atendida !== undefined && itemObj.quantidade_atendida !== null) return Number(itemObj.quantidade_atendida);
              if (row.qtd_atendida !== undefined && row.qtd_atendida !== null) return Number(row.qtd_atendida);
              if (row.quantidade_atendida !== undefined && row.quantidade_atendida !== null) return Number(row.quantidade_atendida);
              const raw = String(row.parecerDiligenciador ?? row.parecer_diligenciador ?? '');
              if (raw.trim().startsWith('{')) {
                try {
                  const parsedJson = JSON.parse(raw);
                  return Number(parsedJson.qtd_atendida ?? parsedJson.quantidade_atendida ?? 0);
                } catch (e) {}
              }
              return 0;
            })();

            const itemQtdCompra = (() => {
              if (itemObj.qtd_em_compra !== undefined && itemObj.qtd_em_compra !== null) return Number(itemObj.qtd_em_compra);
              if (itemObj.qtd_compra !== undefined && itemObj.qtd_compra !== null) return Number(itemObj.qtd_compra);
              if (itemObj.qtdCompra !== undefined && itemObj.qtdCompra !== null) return Number(itemObj.qtdCompra);
              if (itemObj.quantidade_em_compra !== undefined && itemObj.quantidade_em_compra !== null) return Number(itemObj.quantidade_em_compra);
              if (row.qtd_em_compra !== undefined && row.qtd_em_compra !== null) return Number(row.qtd_em_compra);
              if (row.qtd_compra !== undefined && row.qtd_compra !== null) return Number(row.qtd_compra);
              if (row.quantidade_em_compra !== undefined && row.quantidade_em_compra !== null) return Number(row.quantidade_em_compra);
              const raw = String(row.parecerDiligenciador ?? row.parecer_diligenciador ?? '');
              if (raw.trim().startsWith('{')) {
                try {
                  const parsedJson = JSON.parse(raw);
                  return Number(parsedJson.qtd_em_compra ?? parsedJson.qtd_compra ?? 0);
                } catch (e) {}
              }
              return 0;
            })();

            const itemNumeroRtd = (() => {
              if (itemObj.numero_rtd) return String(itemObj.numero_rtd);
              if (itemObj.rtd) return String(itemObj.rtd);
              if (itemObj.numeroRtd) return String(itemObj.numeroRtd);
              if (row.numero_rtd) return String(row.numero_rtd);
              if (row.rtd) return String(row.rtd);
              if (row.numeroRtd) return String(row.numeroRtd);
              const raw = String(row.parecerDiligenciador ?? row.parecer_diligenciador ?? '');
              if (raw.trim().startsWith('{')) {
                try {
                  const parsedJson = JSON.parse(raw);
                  return String(parsedJson.numero_rtd || parsedJson.rtd || parsedJson.numeroRtd || '');
                } catch (e) {}
              }
              return '';
            })();

            return {
              _raw: row,
              id: itemsToProcess.length > 1 ? `${String(row.id || '')}_item_${idx}` : String(row.id || ''),
              rmNumber: String(row.rmNumber ?? row.rm_number ?? 'RM-SGI'),
              material: itemInfo.material || safeRowMat,
              quantidade: itemInfo.quantidade,
              unidade: itemInfo.unidade,
              setor: String(row.setor ?? 'Geral'),
              solicitante: String(row.solicitante ?? 'Solicitante SGI'),
              dataSolicitacao: String(row.dataSolicitacao ?? row.data_solicitacao ?? new Date().toLocaleDateString('pt-BR')),
              status: String(row.status ?? 'Pendente'),
              dataNecessidade: String(row.dataNecessidade ?? row.data_necessidade ?? ''),
              motivo: String(row.motivo ?? ''),
              centroCusto: String(row.centroCusto ?? row.centro_custo ?? ''),
              createdTimestamp: String(row.createdTimestamp ?? row.created_at ?? new Date().toISOString()),
              categoria: rawCategoria || 'Estoque',
              tipoRM: rawTipo,
              urgencia: String(row.urgencia ?? 'Média'),
              tratado_por: String(row.tratado_por ?? ''),
              acao_recomendada: String(row.acao_recomendada ?? ''),
              status_interno: 'Finalizado',
              data_inicio_tratamento: row.data_inicio_tratamento ? String(row.data_inicio_tratamento) : '',
              data_conclusao_tratamento: row.data_conclusao_tratamento ? String(row.data_conclusao_tratamento) : '',
              numero_rtd: itemNumeroRtd,
              qtd_atendida: itemQtdAtendida,
              qtd_em_compra: itemQtdCompra,
              rm_mae_id: row.rm_mae_id ?? row.rmMaeId ?? null,
              rm_filha_id: row.rm_filha_id ?? row.rmFilhaId ?? null
            };
          });
        });

        const groups: Record<string, GroupedRequisition> = {};
        for (const item of parsedRows) {
          const rmNum = item.rmNumber || 'RM-SGI';
          if (!groups[rmNum]) {
            groups[rmNum] = {
              _raw: item._raw || item,
              rmNumber: rmNum,
              solicitante: item.solicitante || 'Solicitante SGI',
              setor: item.setor || 'Geral',
              dataSolicitacao: item.dataSolicitacao || '',
              dataNecessidade: item.dataNecessidade || 'Não informada',
              status: item.status || 'Pendente',
              motivo: item.motivo || '',
              categoria: item.categoria || 'Estoque',
              tipoRM: item.tipoRM || 'RM Normal',
              urgencia: item.urgencia || 'Média',
              parecerDiligenciador: item.parecerDiligenciador || '',
              proximosAprov: item.proximosAprov || '',
              tratado_por: item.tratado_por || '',
              acao_recomendada: item.acao_recomendada || '',
              status_interno: 'Finalizado',
              data_inicio_tratamento: item.data_inicio_tratamento || '',
              data_conclusao_tratamento: item.data_conclusao_tratamento || '',
              aprovador_destino: item.aprovador_destino || '',
              createdTimestamp: item.createdTimestamp || '',
              numero_rtd: item.numero_rtd || '',
              classeFinanceira: item.classeFinanceira || item._raw?.classe_financeira || item._raw?.classeFinanceira || '',
              qtd_atendida: item.qtd_atendida ?? 0,
              qtd_em_compra: item.qtd_em_compra ?? 0,
              rm_mae_id: item.rm_mae_id ?? null,
              rm_filha_id: item.rm_filha_id ?? null,
              itens: []
            };
          } else {
            if (item.rm_mae_id && !groups[rmNum].rm_mae_id) {
              groups[rmNum].rm_mae_id = item.rm_mae_id;
            }
            if (item.rm_filha_id && !groups[rmNum].rm_filha_id) {
              groups[rmNum].rm_filha_id = item.rm_filha_id;
            }
            if (item.numero_rtd && !groups[rmNum].numero_rtd) {
              groups[rmNum].numero_rtd = item.numero_rtd;
            }
            if (item.tipoRM && groups[rmNum].tipoRM === 'RM Normal') {
              groups[rmNum].tipoRM = item.tipoRM;
            }
            if (item.qtd_atendida) {
              groups[rmNum].qtd_atendida = (Number(groups[rmNum].qtd_atendida) || 0) + (Number(item.qtd_atendida) || 0);
            }
            if (item.qtd_em_compra) {
              groups[rmNum].qtd_em_compra = (Number(groups[rmNum].qtd_em_compra) || 0) + (Number(item.qtd_em_compra) || 0);
            }
          }

          groups[rmNum].itens.push({
            id: item.id,
            material: item.material || '',
            quantidade: item.quantidade ?? 1,
            unidade: item.unidade || 'UN',
            item_status: item.item_status || '',
            quantidade_atendida: Number(item.qtd_atendida) || 0,
            qtd_atendida: Number(item.qtd_atendida) || 0,
            qtdAtendida: Number(item.qtd_atendida) || 0,
            qtd_em_compra: Number(item.qtd_em_compra) || 0,
            qtdCompra: Number(item.qtd_em_compra) || 0,
            numero_rtd: item.numero_rtd || '',
            rtd: item.numero_rtd || ''
          });
        }

        setHistoricoItems(Object.values(groups));
      }
    } catch (err) {
      console.error('Erro em fetchHistorico:', err);
    } finally {
      setLoadingHistorico(false);
    }
  };

  useEffect(() => {
    if (activeView === 'historico') {
      fetchHistorico();
    }
  }, [activeView, currentPage, historicoSearchQuery, historicoStartDate, historicoEndDate]);

  useEffect(() => {
    setCurrentPage(0);
  }, [historicoSearchQuery, historicoStartDate, historicoEndDate]);

  // --------------------------------------------------------------------------
  // REQUISIÇÕES PATCH E WORKFLOW INTERNO
  // --------------------------------------------------------------------------
  const patchRequisition = async (itemIds: string[], updates: any) => {
    // Higienização contra undefined
    const sanitizedUpdates: Record<string, any> = {};
    if (updates && typeof updates === 'object') {
      Object.keys(updates).forEach(key => {
        sanitizedUpdates[key] = updates[key] === undefined ? null : updates[key];
      });
    }

    try {
      const { error } = await supabase
        .from('requisicoes')
        .update(sanitizedUpdates)
        .in('id', itemIds);

      if (error) {
        console.error("❌ ERRO NO UPDATE SUPABASE:", error);
        throw error;
      }
    } catch (err: any) {
      console.error("❌ ERRO AO ATUALIZAR REQUISIÇÕES:", err);
      throw new Error(`Erro ao atualizar requisições: ${err?.message || 'Falha na conexão com o banco de dados'}`);
    }
  };

  const handleConfirmarTratamento = async (req: GroupedRequisition, colaborador: string) => {
    if (!colaborador || !colaborador.trim()) {
      showToast("Por favor, selecione um colaborador.", "error");
      return;
    }

    try {
      setLoading(true);
      const itemIds = req.itens.map(it => it.id);
      const nowIso = new Date().toISOString();
      await patchRequisition(itemIds, {
        tratado_por: colaborador.trim(),
        status_interno: 'Em Tratamento',
        data_inicio_tratamento: nowIso
      });

      // Atualização otimista do estado local
      setRequisitions(prev => prev.map(item => {
        if (itemIds.includes(item.id)) {
          return {
            ...item,
            tratado_por: colaborador.trim(),
            status_interno: 'Em Tratamento',
            data_inicio_tratamento: nowIso
          };
        }
        return item;
      }));

      showToast(`Você assumiu o tratamento da RM ${req.rmNumber}!`, "success");
      setAssigningRm(null);
      setSelectedColaborador('');
      await fetchRMs();
    } catch (err: any) {
      showToast(`Erro ao assumir tratamento: ${err.message}`, "error");
      await fetchRMs();
    }
  };

  const handleDecision = async (req: GroupedRequisition, decision: 'reaproveitamento' | 'compra') => {
    const acao_recomendada = decision === 'reaproveitamento'
      ? 'Reprovar no Approvo (Reaproveitamento)'
      : 'Aprovar no Approvo (Atender/Comprar)';

    try {
      setLoading(true);
      const itemIds = req.itens.map(it => it.id);
      const nowIso = new Date().toISOString();
      await patchRequisition(itemIds, {
        acao_recomendada,
        status_interno: 'Aguardando Aprovador',
        data_conclusao_tratamento: nowIso
      });

      // Atualização otimista do estado local
      setRequisitions(prev => prev.map(item => {
        if (itemIds.includes(item.id)) {
          return {
            ...item,
            acao_recomendada,
            status_interno: 'Aguardando Aprovador',
            data_conclusao_tratamento: nowIso
          };
        }
        return item;
      }));

      showToast(`RM ${req.rmNumber} enviada para o Aprovador!`, "success");
      await fetchRMs();
    } catch (err: any) {
      showToast(`Erro ao salvar decisão: ${err.message}`, "error");
      await fetchRMs();
    }
  };

  const handleConfirmTreatmentModal = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!treatingRm) return;

    const exigeRtd = treatingRm.itens.some(it => itemStatuses[it.id] === 'ATENDIDO');
    if (exigeRtd && !rtdNumber.trim()) {
      showToast("O número da RTD é obrigatório para itens marcados como ATENDIDO.", "error");
      return;
    }

    // Regra da Maternidade (Atendimento Parcial ou RM Mista):
    // Condição A (Item Parcial): Algum item possui quantidade_atendida > 0 E quantidade_atendida < quantidade_solicitada
    const temItemParcial = treatingRm.itens.some(it => {
      const itemStatusVal = itemStatuses[it.id] || 'COMPRA';
      const qtyAtendidaVal = itemStatusVal === 'ATENDIDO' ? Number(itemQuantities[it.id] ?? 0) : 0;
      const qtySolicitada = Number(it.quantidade ?? 0);
      return qtyAtendidaVal > 0 && qtySolicitada > 0 && qtyAtendidaVal < qtySolicitada;
    });

    // Condição B (RM Mista): A RM possui pelo menos um item com atendimento (estoque/RTD) E pelo menos um item para Compra/Precotação
    const temItemAtendido = treatingRm.itens.some(it => {
      const itemStatusVal = itemStatuses[it.id] || 'COMPRA';
      const qtyAtendidaVal = itemStatusVal === 'ATENDIDO' ? Number(itemQuantities[it.id] ?? 0) : 0;
      return itemStatusVal === 'ATENDIDO' || qtyAtendidaVal > 0;
    });

    const temItemCompra = treatingRm.itens.some(it => {
      const itemStatusVal = (itemStatuses[it.id] || 'COMPRA') as string;
      return itemStatusVal === 'COMPRA' || itemStatusVal === 'PRECOTACAO';
    });

    const eRmMista = temItemAtendido && temItemCompra;

    const eAtendimentoParcial = temItemParcial || eRmMista;

    try {
      setLoading(true);
      const nowIso = new Date().toISOString();

      // Se é atendimento parcial, altera status para MATERNIDADE automaticamente
      // Caso contrário (atendimento total 100%), vai para 'PENDENTE APROVACAO' / 'Aguardando Aprovador'
      const targetStatus = eAtendimentoParcial ? 'MATERNIDADE' : 'PENDENTE APROVACAO';
      const targetStatusInterno = eAtendimentoParcial ? 'Maternidade' : 'Aguardando Aprovador';

      // Para cada item da RM, realizamos a atualização correspondente no banco
      const updatePromises = treatingRm.itens.map(async (it) => {
        const itemStatusVal = itemStatuses[it.id] || 'COMPRA';
        const qtyAtendidaVal = itemStatusVal === 'ATENDIDO' ? (itemQuantities[it.id] ?? 0) : 0;

        const jsonParecer = JSON.stringify({
          numero_rtd: rtdNumber.trim(),
          rm_filha_id: null,
          item_status: itemStatusVal,
          quantidade_atendida: qtyAtendidaVal,
          parecer: `Triagem concluída: ${itemStatusVal}${itemStatusVal === 'ATENDIDO' ? ` (Qtd Atendida: ${qtyAtendidaVal} | RTD: ${rtdNumber.trim()})` : ''}`
        });

        const { error } = await supabase
          .from('requisicoes')
          .update({
            status: targetStatus,
            status_interno: targetStatusInterno,
            parecerDiligenciador: jsonParecer,
            numero_rtd: rtdNumber.trim() || null,
            item_status: itemStatusVal,
            quantidade_atendida: Number(qtyAtendidaVal),
            data_conclusao_tratamento: nowIso
          })
          .eq('id', it.id);

        if (error) throw error;
      });

      await Promise.all(updatePromises);

      // Processa atualizações em lote (Batch Updates) para RMs Filhas (Relação 1:N)
      if (daughterRms.length > 0) {
        const motherNum = treatingRm.rmNumber || treatingRm.id;
        const daughterUpdatePromises = daughterRms.map(async (d) => {
          const decision = daughterDecisions[d.rmNumber] || 'Aprovar';
          const isApproved = decision === 'Aprovar';

          const daughterPayload: any = {
            status: isApproved ? 'PENDENTE' : 'Reprovado',
            status_interno: isApproved ? 'Aguardando Aprovador' : 'Finalizado',
            status_tratamento: decision,
            orientacao_aprovacao: decision,
            orientacao_combo: decision,
            acao_recomendada: isApproved ? 'Aprovar no Approvo (Atender/Comprar)' : 'Reprovar no Approvo',
            data_conclusao_tratamento: nowIso
          };

          const { error: errDaughter } = await supabase
            .from('requisicoes')
            .update(daughterPayload)
            .or(`rm_number.eq.${d.rmNumber},id.eq.${d.rmNumber},rm_mae_id.eq.${motherNum}`);

          if (errDaughter) {
            console.error(`Erro ao atualizar RM Filha #${d.rmNumber}:`, errDaughter);
          }
        });

        await Promise.all(daughterUpdatePromises);

        // Regra de Status da Mãe: Se todas as filhas foram tratadas, atualiza a RM Mãe para "Tratada"
        const motherItemIds = treatingRm.itens.map(it => it.id);
        await supabase
          .from('requisicoes')
          .update({
            status_tratamento: 'Tratada',
            status_interno: eAtendimentoParcial ? 'Maternidade' : 'Aguardando Aprovador',
            data_conclusao_tratamento: nowIso
          })
          .in('id', motherItemIds);
      }

      if (eAtendimentoParcial) {
        showToast(`RM #${treatingRm.rmNumber} interceptada e enviada para a Maternidade (Atendimento Parcial)!`, "success");
      } else {
        showToast(`RM #${treatingRm.rmNumber} triada com sucesso e liberada para os aprovadores!`, "success");
      }

      // Fecha o modal e limpa estado
      setIsTreatmentModalOpen(false);
      setTreatingRm(null);
      setItemStatuses({});
      setItemQuantities({});
      setRtdNumber('');
      setRmFilhaNumber('');
      setDaughterRms([]);
      setDaughterDecisions({});

      // Recarrega as RMs para atualizar as filas (remove o card da tela de Triagem)
      await fetchRMs();
    } catch (err: any) {
      console.error("Erro ao concluir triagem:", err);
      showToast(`Erro ao concluir triagem: ${err.message}`, "error");
      setLoading(false);
    }
  };

  const handlePartoMaternidade = async (req: GroupedRequisition) => {
    const cleanRmFilha = (maternidadeInputs[req.rmNumber] || '').trim();

    if (!cleanRmFilha) {
      showToast("O número da RM Filha (Compra) é obrigatório para realizar a vinculação e liberação.", "error");
      return;
    }

    try {
      setMaternidadeLoading(prev => ({ ...prev, [req.rmNumber]: true }));
      const nowIso = new Date().toISOString();
      const itemIds = req.itens.map(it => it.id);
      const motherNum = req.rmNumber || req.id;

      // 1. Atualiza a RM Mãe no Supabase: preenche rm_filha_id e altera status de MATERNIDADE para PENDENTE e status_interno para 'Aguardando Aprovador'
      const { error: errorMae } = await supabase
        .from('requisicoes')
        .update({
          rm_filha_id: cleanRmFilha,
          status: 'PENDENTE',
          status_interno: 'Aguardando Aprovador',
          data_conclusao_tratamento: nowIso
        })
        .in('id', itemIds);

      if (errorMae) throw errorMae;

      // 2. Tenta vincular e atualizar a RM Filha no Supabase herdando os metadados da RM Mãe
      try {
        const daughterPayload: any = {
          rm_mae_id: motherNum,
          status_interno: 'Aguardando Aprovador',
          status: 'PENDENTE',
          acao_recomendada: 'Aprovar no Approvo (Atender/Comprar)'
        };

        const motherTratadoPor = req.tratado_por || (req as any).diligenciador;
        if (motherTratadoPor) {
          daughterPayload.tratado_por = motherTratadoPor;
          daughterPayload.diligenciador = motherTratadoPor;
        }
        const motherRequisitante = req.solicitante || (req as any).requisitante;
        if (motherRequisitante) {
          daughterPayload.requisitante = motherRequisitante;
          daughterPayload.solicitante = motherRequisitante;
        }
        const motherSetor = req.setor || req.centroCusto;
        if (motherSetor) {
          daughterPayload.setor = motherSetor;
          daughterPayload.centro_custo = req.centroCusto || req.setor;
        }
        if (req.aprovador_destino) {
          daughterPayload.aprovador_destino = req.aprovador_destino;
        }

        await supabase
          .from('requisicoes')
          .update(daughterPayload)
          .or(`rmNumber.eq.${cleanRmFilha},id.eq.${cleanRmFilha}`);
      } catch (errFilha) {
        console.warn("Aviso ao vincular RM Filha na liberação da Maternidade:", errFilha);
      }

      // Limpa input do card
      setMaternidadeInputs(prev => ({ ...prev, [req.rmNumber]: '' }));

      // Recarrega do banco para atualizar as filas
      await fetchRMs();

      showToast(`RM Mãe #${req.rmNumber} vinculada à RM Filha #${cleanRmFilha} e liberada para a Fila Geral!`, "success");
    } catch (err: any) {
      console.error("Erro no parto da Maternidade:", err);
      showToast(`Erro ao liberar RM da Maternidade: ${err.message}`, "error");
    } finally {
      setMaternidadeLoading(prev => ({ ...prev, [req.rmNumber]: false }));
    }
  };

  const handleDevolverMaternidadeParaTriagem = async (req: GroupedRequisition) => {
    try {
      setMaternidadeLoading(prev => ({ ...prev, [req.rmNumber]: true }));

      const rmNum = String(req.rmNumber || req.id || '').trim();
      if (!rmNum) {
        throw new Error("Identificador da RM não encontrado.");
      }

      const rmWithPrefix = rmNum.startsWith('RM-') ? rmNum : `RM-${rmNum}`;
      const rmWithoutPrefix = rmNum.replace(/^RM-/i, '');
      const itemIds = req.itens && req.itens.length > 0 ? req.itens.map(it => it.id).filter(Boolean) : [req.id].filter(Boolean);

      const updatePayload: any = {
        status: 'PENDENTE',
        status_interno: 'Em Tratamento',
        quantidade_atendida: 0,
        item_status: null,
        rm_filha_id: null,
        orientacao_combo: null,
        orientacao_aprovacao: null,
        acao_recomendada: null,
        data_inicio_tratamento: null,
        data_conclusao_tratamento: null,
        parecerDiligenciador: null,
        aprovador_destino: null,
        motivo_espera: null,
        numero_rtd: null
      };

      // 1. Atualização por ID de cada item na tabela 'requisicoes'
      if (itemIds.length > 0) {
        const { error: err1 } = await supabase
          .from('requisicoes')
          .update(updatePayload)
          .in('id', itemIds);

        if (err1) {
          console.error("Erro no Supabase ao atualizar itens por ID:", err1);
          throw err1;
        }
      }

      // 2. Atualização agrupada por número da RM na tabela 'requisicoes'
      const { error: err2 } = await supabase
        .from('requisicoes')
        .update(updatePayload)
        .or(`rmNumber.eq.${rmNum},rmNumber.eq.${rmWithPrefix},rmNumber.eq.${rmWithoutPrefix},id.eq.${rmNum}`);

      if (err2) {
        console.error("Erro no Supabase ao atualizar por rmNumber:", err2);
        throw err2;
      }

      // 3. Se houver RM Filha atrelada, desvincula e reseta a filha também
      if (req.rm_filha_id) {
        const daughterNum = String(req.rm_filha_id).trim();
        const daughterWithPrefix = daughterNum.startsWith('RM-') ? daughterNum : `RM-${daughterNum}`;
        const daughterWithoutPrefix = daughterNum.replace(/^RM-/i, '');
        const { error: errDaughter } = await supabase
          .from('requisicoes')
          .update(updatePayload)
          .or(`rmNumber.eq.${daughterNum},rmNumber.eq.${daughterWithPrefix},rmNumber.eq.${daughterWithoutPrefix},id.eq.${daughterNum}`);

        if (errDaughter) {
          console.error("Erro no Supabase ao atualizar RM Filha:", errDaughter);
          throw errDaughter;
        }
      }

      // 4. Se houver RM Mãe atrelada, desvincula e reseta a mãe também
      if (req.rm_mae_id) {
        const motherNum = String(req.rm_mae_id).trim();
        const motherWithPrefix = motherNum.startsWith('RM-') ? motherNum : `RM-${motherNum}`;
        const motherWithoutPrefix = motherNum.replace(/^RM-/i, '');
        const { error: errMother } = await supabase
          .from('requisicoes')
          .update(updatePayload)
          .or(`rmNumber.eq.${motherNum},rmNumber.eq.${motherWithPrefix},rmNumber.eq.${motherWithoutPrefix},id.eq.${motherNum}`);

        if (errMother) {
          console.error("Erro no Supabase ao atualizar RM Mãe:", errMother);
          throw errMother;
        }
      }

      // 5. Se a tabela 'itens_rm' existir/estiver em uso, reseta também
      for (const id of itemIds) {
        try {
          await supabase
            .from('itens_rm')
            .update({ status: 'PENDENTE', qtd_atendida: 0, qtd_compra: 0 })
            .or(`rm_id.eq.${id},requisicao_id.eq.${id},id.eq.${id}`);
        } catch (_) {}
      }

      // 6. Atualização reativa imediata no estado local do React
      setRequisitions(prev => prev.map(item => {
        const itemRmNum = String(item.rmNumber || item.id).trim();
        const isMatch = itemRmNum === rmNum || 
                        itemRmNum === rmWithPrefix || 
                        itemRmNum === rmWithoutPrefix || 
                        itemIds.includes(item.id) ||
                        (req.rm_filha_id && itemRmNum === String(req.rm_filha_id).trim()) ||
                        (req.rm_mae_id && itemRmNum === String(req.rm_mae_id).trim());

        if (isMatch) {
          const preservedTratadoPor = item.tratado_por || req.tratado_por || item._raw?.tratado_por || '';
          const preservedAgente = item.agente_tratamento || req.agente_tratamento || item._raw?.agente_tratamento || '';
          return {
            ...item,
            status: 'PENDENTE',
            status_interno: 'Em Tratamento',
            rm_filha_id: null,
            rm_mae_id: null,
            tratado_por: preservedTratadoPor,
            agente_tratamento: preservedAgente,
            acao_recomendada: undefined,
            status_tratamento: undefined,
            data_inicio_tratamento: undefined,
            data_conclusao_tratamento: undefined,
            parecerDiligenciador: '',
            numero_rtd: '',
            item_status: '',
            quantidade_atendida: 0,
            _raw: {
              ...(item._raw || {}),
              status: 'PENDENTE',
              status_interno: 'Em Tratamento',
              rm_filha_id: null,
              rm_mae_id: null,
              tratado_por: preservedTratadoPor,
              agente_tratamento: preservedAgente,
              acao_recomendada: null,
              status_tratamento: null,
              parecerDiligenciador: null,
              parecer_diligenciador: null,
              item_status: null,
              quantidade_atendida: null,
              numero_rtd: null
            }
          };
        }
        return item;
      }));

      setMaternidadeInputs(prev => ({ ...prev, [req.rmNumber]: '' }));

      // SÓ DISPARA O TOAST DE SUCESSO E RE-FETCH SE NÃO HOUVER ERRO
      showToast(`RM #${req.rmNumber} devolvida para a Triagem com sucesso!`, "success");

      // Re-fetch para sincronizar totalmente com a base
      await fetchRMs();
    } catch (err: any) {
      console.error("Erro ao devolver RM da Maternidade para Triagem:", err);
      showToast(`Erro ao devolver RM para Triagem: ${err?.message || err?.details || 'Falha na operação no Supabase'}`, "error");
    } finally {
      setMaternidadeLoading(prev => ({ ...prev, [req.rmNumber]: false }));
    }
  };

  const handleResgatarRmsParciaisAntigas = async () => {
    if (resgatandoParciais) return;
    setResgatandoParciais(true);
    try {
      // 1. Atualiza lista local com dados mais recentes do Supabase
      await fetchRMs();

      // 2. Procura RMs elegíveis com atendimento parcial antigo
      const rmsParaMover: GroupedRequisition[] = [];

      for (const req of groupedAllRequisitions) {
        const statusERP = (req.status || '').toUpperCase();
        const statusInterno = (req.status_interno || '').toUpperCase();
        const parecerStr = (req.parecerDiligenciador || '').toUpperCase();

        // Desconsidera as que já estão em Maternidade ou concluídas / canceladas / finalizadas
        if (
          statusERP === 'MATERNIDADE' || 
          statusInterno === 'MATERNIDADE' ||
          statusERP.includes('CONCLU') || 
          statusERP.includes('CANCEL') || 
          statusERP === 'APROVADA' || 
          statusERP === 'REPROVADA' || 
          statusInterno === 'FINALIZADO'
        ) {
          continue;
        }

        // Condição A (Item Parcial): Algum item possui quantidade_atendida > 0 E quantidade_atendida < quantidade_solicitada
        const temItemParcial = req.itens.some(it => {
          const qtdAtendida = Number(it.quantidade_atendida || 0);
          const qtdSolicitada = Number(it.quantidade || 0);
          return qtdAtendida > 0 && qtdSolicitada > 0 && qtdAtendida < qtdSolicitada;
        });

        // Condição B (RM Mista):
        // A RM possui pelo menos um item com atendimento (estoque/RTD) E pelo menos um item direcionado para Compra/Precotação
        // ou se o status_geral da triagem/parecer for igual ou contiver 'MISTA'
        const temItemAtendido = req.itens.some(it => {
          const st = (it.item_status || '').toUpperCase();
          const qA = Number(it.quantidade_atendida || 0);
          return st === 'ATENDIDO' || qA > 0;
        });

        const temItemCompra = req.itens.some(it => {
          const st = (it.item_status || '').toUpperCase();
          const qA = Number(it.quantidade_atendida || 0);
          return st === 'COMPRA' || st === 'PRECOTACAO' || (st !== 'ATENDIDO' && qA === 0);
        });

        const statusGeralMisto = statusERP.includes('MIST') || statusInterno.includes('MIST') || parecerStr.includes('MIST');

        const eRmMista = (temItemAtendido && temItemCompra) || statusGeralMisto;

        if (temItemParcial || eRmMista) {
          rmsParaMover.push(req);
        }
      }

      if (rmsParaMover.length === 0) {
        showToast("Varredura concluída. Nenhuma RM antiga com atendimento parcial foi encontrada.", "success");
        return;
      }

      // 3. Atualização em Lote (Batch Update) no Supabase
      let resgatadasCount = 0;
      for (const req of rmsParaMover) {
        const itemIds = req.itens.map(it => it.id);
        const { error } = await supabase
          .from('requisicoes')
          .update({
            status: 'MATERNIDADE',
            status_interno: 'Maternidade'
          })
          .in('id', itemIds);

        if (!error) {
          resgatadasCount++;
        } else {
          console.error(`Erro ao mover RM #${req.rmNumber} para Maternidade:`, error);
        }
      }

      // 4. Refresh e Toast de Sucesso
      await fetchRMs();
      showToast(`Varredura concluída. ${resgatadasCount} ${resgatadasCount === 1 ? 'RM antiga foi movida' : 'RMs antigas foram movidas'} para a Maternidade com sucesso.`, "success");
    } catch (err: any) {
      console.error("Erro ao resgatar RMs parciais antigas:", err);
      showToast(`Erro na varredura retroativa: ${err.message}`, "error");
    } finally {
      setResgatandoParciais(false);
    }
  };

  const handleDevolverParaTriagem = async (req: GroupedRequisition) => {
    if (!confirm(`Deseja realmente devolver a RM ${req.rmNumber} para a Triagem? Isto limpará o número da RTD e redefinirá os status dos itens.`)) {
      return;
    }

    try {
      setLoading(true);
      const itemIds = req.itens.map(it => it.id);

      const updatePromises = [];

      // 1. Limpeza da Tabela Principal (requisicoes)
      // O payload enviado para .from('requisicoes').update({...}) NÃO PODE conter item_status ou quantidades.
      for (const id of itemIds) {
        const p1 = supabase
          .from('requisicoes')
          .update({
            status: 'PENDENTE',
            status_interno: 'Aguardando Tratamento',
            tratado_por: null,
            data_inicio_tratamento: null,
            data_conclusao_tratamento: null,
            parecerDiligenciador: null,
            aprovador_destino: null,
            motivo_espera: null
          })
          .eq('id', id);
        updatePromises.push(p1);

        // 2. Limpeza da Tabela Filha (itens_rm)
        // Tentamos atualizar usando 'rm_id', 'requisicao_id' ou 'id' para garantir compatibilidade com as chaves estrangeiras.
        const p_item1 = supabase
          .from('itens_rm')
          .update({
            status: 'PENDENTE',
            qtd_atendida: null,
            qtd_compra: null
          })
          .eq('rm_id', id);

        const p_item2 = supabase
          .from('itens_rm')
          .update({
            status: 'PENDENTE',
            qtd_atendida: null,
            qtd_compra: null
          })
          .eq('requisicao_id', id);

        const p_item3 = supabase
          .from('itens_rm')
          .update({
            status: 'PENDENTE',
            qtd_atendida: null,
            qtd_compra: null
          })
          .eq('id', id);

        updatePromises.push(p_item1, p_item2, p_item3);
      }

      // 3. Sincronia de UI (Promise.all)
      const results = await Promise.all(updatePromises);

      // Verificamos se houve erro crítico no update de 'requisicoes' (as primeiras itemIds.length chamadas)
      const mainError = results.find((res, index) => {
        return index < itemIds.length && res.error;
      });
      if (mainError && mainError.error) {
        throw mainError.error;
      }

      // Atualiza o estado local filtrando e removendo a RM devolvida na mesma hora
      setRequisitions(prev => prev.filter(item => !itemIds.includes(item.id)));
      setRtdNumber('');

      showToast(`RM ${req.rmNumber} devolvida para a Triagem com sucesso!`, "success");
      await fetchRMs();
    } catch (err: any) {
      console.error("Erro ao devolver RM para Triagem:", err);
      showToast(`Erro ao devolver RM para Triagem: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignApprover = async (req: GroupedRequisition, approver: string) => {
    const orientacaoSelecionada = (orientacaoComboState[req.rmNumber] || req.orientacao_aprovacao || req.orientacao_combo || req.observacao_combo || '').trim();

    if (!orientacaoSelecionada) {
      showToast("Atenção: Selecione a Orientação (Aprovar/Reprovar) antes de encaminhar!", "error");
      return;
    }

    if (!approver) return;

    try {
      setLoading(true);
      const itemIds = req.itens.map(it => it.id);
      const motherNum = req.rmNumber || req.id;
      const daughterNum = (req.rm_filha_id || '').toString().trim();
      const parentNum = (req.rm_mae_id || '').toString().trim();

      const patchData: any = {
        aprovador_destino: approver || null,
        orientacao_combo: orientacaoSelecionada,
        orientacao_aprovacao: orientacaoSelecionada
      };

      // Garantia de sanitização contra undefined
      Object.keys(patchData).forEach(key => {
        if (patchData[key] === undefined) {
          patchData[key] = null;
        }
      });

      // Passo A: Atualiza a RM atual
      await patchRequisition(itemIds, patchData);

      let isCombo = false;

      // Passo B (O Resgate da Filha): Se a RM atual possuir um rm_filha_id preenchido
      if (daughterNum) {
        isCombo = true;
        try {
          const daughterPayload: any = {
            aprovador_destino: approver || null,
            rm_mae_id: motherNum || null,
            status: 'PENDENTE',
            status_interno: 'Aguardando Aprovador',
            orientacao_combo: orientacaoSelecionada,
            orientacao_aprovacao: orientacaoSelecionada
          };

          Object.keys(daughterPayload).forEach(key => {
            if (daughterPayload[key] === undefined) {
              daughterPayload[key] = null;
            }
          });

          const { error: errUpdateFilha } = await supabase
            .from('requisicoes')
            .update(daughterPayload)
            .or(`rm_number.eq.${daughterNum},rmNumber.eq.${daughterNum},numero.eq.${daughterNum},numero_rm.eq.${daughterNum},codigo.eq.${daughterNum},rm.eq.${daughterNum}`);

          if (errUpdateFilha) {
            console.error("❌ ERRO AO RESGATAR RM FILHA NO SUPABASE:", errUpdateFilha);
          }
        } catch (errFilha) {
          console.error("❌ ERRO EXCEÇÃO AO RESGATAR RM FILHA:", errFilha);
        }
      }

      // Passo C (Roteamento Reverso): Se a RM atual for a Filha (possuir rm_mae_id)
      if (parentNum) {
        isCombo = true;
        try {
          const parentPayload: any = {
            aprovador_destino: approver || null,
            rm_filha_id: motherNum || null,
            orientacao_combo: orientacaoSelecionada,
            orientacao_aprovacao: orientacaoSelecionada
          };

          Object.keys(parentPayload).forEach(key => {
            if (parentPayload[key] === undefined) {
              parentPayload[key] = null;
            }
          });

          const { error: errUpdateMae } = await supabase
            .from('requisicoes')
            .update(parentPayload)
            .or(`rm_number.eq.${parentNum},rmNumber.eq.${parentNum},id.eq.${parentNum},numero.eq.${parentNum},numero_rm.eq.${parentNum},codigo.eq.${parentNum},rm.eq.${parentNum}`);

          if (errUpdateMae) {
            console.error("❌ ERRO AO ROTEAR RM MÃE NO SUPABASE:", errUpdateMae);
          }
        } catch (errMae) {
          console.error("❌ ERRO EXCEÇÃO AO ROTEAR RM MÃE:", errMae);
        }
      }

      await fetchRMs();

      if (isCombo) {
        showToast("Combo Mãe e Filha direcionado com sucesso para o aprovador!", "success");
      } else {
        showToast(`RM #${req.rmNumber} encaminhada para ${approver}`, "success");
      }
    } catch (err: any) {
      console.error("❌ ERRO DETALHADO AO ATRIBUIR APROVADOR NO SUPABASE:", err);
      showToast(`Erro ao atribuir aprovador: ${err.message || err}`, "error");
      await fetchRMs();
    } finally {
      setLoading(false);
    }
  };

  const handleStartTransferApprover = (req: GroupedRequisition, approver: string) => {
    if (!approver) return;
    setTransferringRm(req);
    setPendingNewApprover(approver);
    setPendingNewRecommendation(req.acao_recomendada || 'Aprovar no Approvo (Atender/Comprar)');
    setIsTransferModalOpen(true);
  };

  const handleConfirmTransferApprover = async () => {
    if (!transferringRm || !pendingNewApprover) return;
    try {
      setLoading(true);
      const req = transferringRm;
      const itemIds = req.itens.map(it => it.id);
      const motherNum = req.rmNumber || req.id;
      const daughterNum = (req.rm_filha_id || '').toString().trim();
      const parentNum = (req.rm_mae_id || '').toString().trim();

      // Passo A: Atualiza a RM atual
      await patchRequisition(itemIds, {
        aprovador_destino: pendingNewApprover,
        acao_recomendada: pendingNewRecommendation
      });

      let isCombo = false;

      // Passo B (O Resgate da Filha): Se for Mãe e possuir rm_filha_id
      if (daughterNum) {
        isCombo = true;
        try {
          await supabase
            .from('requisicoes')
            .update({
              aprovador_destino: pendingNewApprover,
              rm_mae_id: motherNum,
              status: 'PENDENTE',
              status_interno: 'Aguardando Aprovador'
            })
            .or(`rm_number.eq.${daughterNum},rmNumber.eq.${daughterNum},numero.eq.${daughterNum},numero_rm.eq.${daughterNum},codigo.eq.${daughterNum},rm.eq.${daughterNum}`);
        } catch (errFilha) {
          console.warn("Aviso ao resgatar RM Filha na transferência:", errFilha);
        }
      }

      // Passo C (Roteamento Reverso): Se for Filha e possuir rm_mae_id
      if (parentNum) {
        isCombo = true;
        try {
          await supabase
            .from('requisicoes')
            .update({
              aprovador_destino: pendingNewApprover,
              rm_filha_id: motherNum
            })
            .or(`rm_number.eq.${parentNum},rmNumber.eq.${parentNum},id.eq.${parentNum},numero.eq.${parentNum},numero_rm.eq.${parentNum},codigo.eq.${parentNum},rm.eq.${parentNum}`);
        } catch (errMae) {
          console.warn("Aviso ao transferir RM Mãe na transferência:", errMae);
        }
      }

      setIsTransferModalOpen(false);
      setTransferringRm(null);
      setPendingNewApprover('');
      setPendingNewRecommendation('');

      await fetchRMs();

      if (isCombo) {
        showToast("Combo Mãe e Filha direcionado com sucesso para o aprovador!", "success");
      } else {
        showToast(`RM #${req.rmNumber} transferida com sucesso para ${pendingNewApprover}!`, "success");
      }
    } catch (err: any) {
      showToast(`Erro ao transferir aprovador: ${err.message}`, "error");
      await fetchRMs();
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTransfer = () => {
    setIsTransferModalOpen(false);
    setTransferringRm(null);
    setPendingNewApprover('');
    setPendingNewRecommendation('');
  };

  const handleSaveMotivoEspera = async () => {
    if (!editingMotivoRm) return;
    try {
      setLoading(true);
      const itemIds = editingMotivoRm.itens.map(it => it.id);
      await patchRequisition(itemIds, {
        motivo_espera: motivoText.trim()
      });

      // Atualização otimista do estado local
      setRequisitions(prev => prev.map(item => {
        if (itemIds.includes(item.id)) {
          return {
            ...item,
            motivo_espera: motivoText.trim()
          };
        }
        return item;
      }));

      await fetchRMs();
      showToast(`Motivo salvo com sucesso para a RM ${editingMotivoRm.rmNumber}!`, "success");
      setEditingMotivoRm(null);
      setMotivoText('');
    } catch (err: any) {
      showToast(`Erro ao salvar motivo: ${err.message}`, "error");
      setLoading(false);
    }
  };

  // Handler para confirmação de Decisão Direta (Bypass de Triagem)
  const handleConfirmBypassDirectDecision = async () => {
    if (!bypassRm) return;
    if (!bypassApprover) {
      showToast("Atenção: Selecione o Aprovador Destino!", "error");
      return;
    }

    try {
      setLoading(true);
      const loggedUser = authSession?.nome || authSession?.email || 'Admin/Controladoria';
      const itemIds = bypassRm.itens.map(it => it.id);
      const targetRmNumber = String(bypassRm.rmNumber || bypassRm.id).trim();

      // Payload para persistência no Supabase
      const patchData: any = {
        status_interno: 'Aguardando Aprovador',
        aprovador_destino: bypassApprover,
        orientacao_aprovacao: bypassDecision,
        orientacao_combo: bypassDecision,
        decisao_direta: true,
        acao_recomendada: bypassDecision === 'Aprovar' 
          ? 'Aprovar no Approvo (Atender/Comprar) [Decisão Direta]' 
          : 'Reprovar no Approvo (Reaproveitamento) [Decisão Direta]',
        tratado_por: loggedUser,
        agente_tratamento: loggedUser,
        data_inicio_tratamento: new Date().toISOString(),
        data_conclusao_tratamento: new Date().toISOString(),
      };

      if (bypassJustification.trim()) {
        patchData.parecerDiligenciador = bypassJustification.trim();
        patchData.parecer_diligenciador = bypassJustification.trim();
      }

      // Sanitização contra valores undefined
      Object.keys(patchData).forEach(key => {
        if (patchData[key] === undefined) {
          patchData[key] = null;
        }
      });

      // 1. Atualização no Supabase PRIMEIRO (com validação estrita de erros)
      let supabaseError: any = null;

      // Atualiza via Supabase por ID dos itens se existirem
      if (itemIds.length > 0) {
        const { error: errIn } = await supabase
          .from('requisicoes')
          .update(patchData)
          .in('id', itemIds);
        if (errIn) {
          supabaseError = errIn;
        }
      }

      // Atualiza também buscando por RM Number
      const { error: reqError } = await supabase
        .from('requisicoes')
        .update(patchData)
        .or(`rm_number.eq.${targetRmNumber},rmNumber.eq.${targetRmNumber},id.eq.${targetRmNumber},numero.eq.${targetRmNumber}`);

      if (reqError && !supabaseError) {
        supabaseError = reqError;
      }

      // Envia PATCH nativo para os itens desta RM como contingência
      if (itemIds.length > 0) {
        try {
          await patchRequisition(itemIds, patchData);
        } catch (patchErr: any) {
          console.warn("Aviso ao rodar patchRequisition:", patchErr);
        }
      }

      // 2. TRATAMENTO DE ERRO RIGOROSO: se o Supabase retornar erro, aborta imediatamente sem alterar o estado local!
      if (supabaseError) {
        console.error("❌ ERRO NO SUPABASE AO SALVAR DECISÃO DIRETA:", supabaseError);
        showToast(supabaseError.message || "Erro ao salvar Decisão Direta no Supabase.", "error");
        setLoading(false);
        return;
      }

      // 3. ATUALIZAÇÃO DO ESTADO PÓS-SUCESSO: apenas após confirmação de persistência no Supabase
      setRequisitions(prev =>
        prev.map(item => {
          const itemRmNum = String(item.rmNumber || item.id).trim();
          if (itemRmNum === targetRmNumber || itemIds.includes(item.id)) {
            return {
              ...item,
              ...patchData,
              status_interno: 'Aguardando Aprovador',
              aprovador_destino: bypassApprover,
              orientacao_approvo: bypassDecision,
              orientacao_aprovacao: bypassDecision,
              orientacao_combo: bypassDecision,
              decisao_direta: true,
              tratado_por: loggedUser,
              agente_tratamento: loggedUser,
            };
          }
          return item;
        })
      );

      // Re-fetch atualizado das RMs direto do Supabase para manter tudo sincronizado
      try {
        await fetchRMs();
      } catch (fErr) {
        console.warn("Aviso ao recarregar RMs pós decisão direta:", fErr);
      }

      showToast(`⚡ RM #${targetRmNumber} direcionada com Decisão Direta para ${bypassApprover}!`, "success");
      setIsBypassModalOpen(false);
      setBypassRm(null);
      setBypassApprover('');
      setBypassDecision('Aprovar');
      setBypassJustification('');
    } catch (err: any) {
      console.error("Erro ao aplicar Decisão Direta na RM:", err);
      showToast(`Erro ao redirecionar RM: ${err?.message || 'Falha na comunicação'}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateApproval = async (
    req: GroupedRequisition, 
    decision: 'Aprovado' | 'Reprovado', 
    isCombo: boolean = false
  ) => {
    const linkedRmNumber = req.rm_filha_id ? String(req.rm_filha_id) : (req.rm_mae_id ? String(req.rm_mae_id) : null);

    // 1º Passo: Verifica Trava Mãe/Filha se NÃO for uma ação de Combo explícita
    if (linkedRmNumber && !isCombo) {
      // Procura no estado local primeiro
      const linkedInLocal = requisitions.filter(item => 
        String(item.rmNumber) === linkedRmNumber || 
        String(item.id) === linkedRmNumber || 
        String(item.rm_number ?? '') === linkedRmNumber
      );

      let isLinkedPending = false;
      if (linkedInLocal.length > 0) {
        isLinkedPending = linkedInLocal.some(item => 
          item.status_interno === 'Aguardando Aprovador' || 
          (item.status !== 'Aprovado' && item.status !== 'Reprovado' && item.status !== 'Reprovado/Cancelado')
        );
      } else {
        // Consulta no Supabase caso a RM não esteja no estado local
        const { data: linkedRows } = await supabase
          .from('requisicoes')
          .select('status, status_interno')
          .or(`rm_number.eq.${linkedRmNumber},rmNumber.eq.${linkedRmNumber},id.eq.${linkedRmNumber}`);
          
        if (linkedRows && linkedRows.length > 0) {
          isLinkedPending = linkedRows.some(row => 
            row.status_interno === 'Aguardando Aprovador' || 
            (row.status !== 'Aprovado' && row.status !== 'Reprovado' && row.status !== 'Reprovado/Cancelado')
          );
        }
      }

      if (isLinkedPending) {
        showToast(`Ação bloqueada. Esta RM faz parte de um atendimento parcial. Você precisa definir a aprovação/reprovação da RM ${linkedRmNumber} para liberar este combo.`, "error");
        return; // Intercepta imediatamente: o modal de confirmação NÃO abre!
      }
    }

    // 2º Passo: Se a trava passou ou se é um combo, abre o Modal de Confirmação Customizado
    setApprovalConfirmModal({
      isOpen: true,
      req,
      decision,
      isCombo,
      linkedRmNumber
    });
  };

  const handleConfirmApprovalAction = async () => {
    if (!approvalConfirmModal || !approvalConfirmModal.req) return;

    const { req, decision, isCombo, linkedRmNumber } = approvalConfirmModal;

    try {
      setLoading(true);
      const userName = authSession?.nome || authSession?.email || 'Agente';
      const nowIso = new Date().toISOString();

      const itemIds = req.itens.map(it => it.id);

      // 3º Passo: Faz o UPDATE no banco
      await patchRequisition(itemIds, {
        status: decision,
        status_interno: 'Finalizado',
        data_conclusao_tratamento: nowIso,
        override_manual: true,
        data_override: nowIso,
        usuario_override: userName
      });

      // Se for uma ação de Combo, atualiza também a RM vinculada no Supabase
      if (isCombo && linkedRmNumber) {
        await supabase
          .from('requisicoes')
          .update({
            status: decision,
            status_interno: 'Finalizado',
            data_conclusao_tratamento: nowIso,
            override_manual: true,
            data_override: nowIso,
            usuario_override: userName
          })
          .or(`rm_number.eq.${linkedRmNumber},rmNumber.eq.${linkedRmNumber},id.eq.${linkedRmNumber},numero.eq.${linkedRmNumber},numero_rm.eq.${linkedRmNumber},codigo.eq.${linkedRmNumber},rm.eq.${linkedRmNumber}`);
      }

      // Atualização otimista do estado local
      setRequisitions(prev => prev.map(item => {
        const isTarget = itemIds.includes(item.id);
        const isLinkedTarget = isCombo && linkedRmNumber && (
          String(item.rmNumber) === linkedRmNumber || 
          String(item.id) === linkedRmNumber || 
          String(item.rm_number ?? '') === linkedRmNumber
        );

        if (isTarget || isLinkedTarget) {
          return {
            ...item,
            status: decision,
            status_interno: 'Finalizado',
            data_conclusao_tratamento: nowIso,
            override_manual: true,
            data_override: nowIso,
            usuario_override: userName
          };
        }
        return item;
      }));

      await fetchRMs();

      const successMsg = isCombo && linkedRmNumber
        ? `Combo (RM #${req.rmNumber} + RM #${linkedRmNumber}) definido como ${decision} com sucesso!`
        : `RM #${req.rmNumber} definida como ${decision} com sucesso!`;

      showToast(successMsg, "success");
    } catch (err: any) {
      showToast(`Erro ao aplicar decisão: ${err.message}`, "error");
    } finally {
      setLoading(false);
      setApprovalConfirmModal(null);
    }
  };

  const handleSaveOrientacao = async (req: GroupedRequisition, val: string) => {
    if (!val) return;
    try {
      const itemIds = req.itens.map(it => it.id);
      const motherNum = req.rmNumber || req.id;
      const daughterNum = (req.rm_filha_id || '').toString().trim();
      const parentNum = (req.rm_mae_id || '').toString().trim();

      // Atualiza a RM Mãe no Supabase
      await supabase
        .from('requisicoes')
        .update({
          orientacao_combo: val,
          orientacao_aprovacao: val
        })
        .in('id', itemIds);

      // Se possui RM Filha vinculada, atualiza a RM Filha também
      if (daughterNum) {
        await supabase
          .from('requisicoes')
          .update({
            orientacao_combo: val,
            orientacao_aprovacao: val
          })
          .or(`rm_number.eq.${daughterNum},rmNumber.eq.${daughterNum},id.eq.${daughterNum},numero.eq.${daughterNum},numero_rm.eq.${daughterNum},codigo.eq.${daughterNum},rm.eq.${daughterNum}`);
      }

      // Se for RM Filha com RM Mãe vinculada, atualiza a RM Mãe
      if (parentNum) {
        await supabase
          .from('requisicoes')
          .update({
            orientacao_combo: val,
            orientacao_aprovacao: val
          })
          .or(`rm_number.eq.${parentNum},rmNumber.eq.${parentNum},id.eq.${parentNum},numero.eq.${parentNum},numero_rm.eq.${parentNum},codigo.eq.${parentNum},rm.eq.${parentNum}`);
      }

      // Atualização otimista do estado local
      setRequisitions(prev => prev.map(item => {
        const itemRmNumber = String(item.rm_number || item.rmNumber || item.id);
        if (itemIds.includes(item.id) || (daughterNum && itemRmNumber === daughterNum) || (parentNum && itemRmNumber === parentNum)) {
          return {
            ...item,
            orientacao_combo: val,
            orientacao_aprovacao: val,
            observacao_combo: val
          };
        }
        return item;
      }));

      showToast(`Orientação para o Approvo salva: "${val}"`, "success");
    } catch (err: any) {
      console.error("Erro ao salvar orientação para o Approvo:", err);
      showToast("Erro ao salvar orientação para o Approvo.", "error");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setLoginError('Por favor, preencha todos os campos.');
      return;
    }

    try {
      setLoading(true);
      if (isSignUp) {
        // Sign Up Mode
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (error) {
          throw error;
        }

        if (data.session) {
          showToast('Conta criada e login realizado com sucesso!', 'success');
          setIsLoggedIn(true);
        } else {
          setRegisteredEmail(cleanEmail);
          setShowEmailConfirmModal(true);
          setIsSignUp(false);
        }
      } else {
        // Sign In Mode
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (error) {
          throw error;
        }

        showToast('Login realizado com sucesso!', 'success');
        setIsLoggedIn(true);
      }
      setEmail('');
      setPassword('');
    } catch (err: any) {
      console.error('Erro na autenticação:', err);
      let errMsg = err.message || 'Erro inesperado na autenticação.';
      if (errMsg === 'Invalid login credentials' || errMsg.includes('Invalid login credentials')) {
        errMsg = 'Credenciais inválidas. Verifique seu e-mail e senha.';
      } else if (errMsg === 'User already registered' || errMsg.includes('already registered')) {
        errMsg = 'Este e-mail já está cadastrado. Tente fazer login.';
      } else if (errMsg.includes('at least 6 characters')) {
        errMsg = 'A senha deve conter pelo menos 6 caracteres.';
      }
      setLoginError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setIsLoggedIn(false);
      showToast('Sessão encerrada com sucesso.', 'success');
    } catch (err: any) {
      console.error('Erro ao sair:', err);
      showToast(`Erro ao sair: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // RELATÓRIO GERAL E GLOBAL DE RMS (EXPORTAÇÃO COMPLETA SUPABASE)
  // --------------------------------------------------------------------------
  const exportarRelatorioGeral = async () => {
    if (isExportingReport) return;
    setIsExportingReport(true);

    try {
      const startDate = historicoStartDate || filterStartDate || '';
      const endDate = historicoEndDate || filterEndDate || '';

      showToast('Iniciando busca global no banco de dados...', 'success');

      // 1. Busca global paginada sem limite para trazer TODAS as RMs (Ativas e Histórico)
      let allDbRows: any[] = [];
      let inicio = 0;
      const pageSize = 1000;
      let temMais = true;

      while (temMais) {
        let query = supabase
          .from('requisicoes')
          .select('*');

        if (startDate) {
          query = query.gte('createdTimestamp', startDate);
        }
        if (endDate) {
          query = query.lte('createdTimestamp', endDate + 'T23:59:59.999');
        }

        query = query.order('createdTimestamp', { ascending: false }).range(inicio, inicio + pageSize - 1);

        let { data, error } = await query;

        // Se houver erro por ordenação ou coluna, tenta sem ordenação
        if (error) {
          console.warn('Recorrendo à busca direta sem ordenação para relatório global:', error);
          let fallbackQuery = supabase.from('requisicoes').select('*').range(inicio, inicio + pageSize - 1);
          const fbRes = await fallbackQuery;
          data = fbRes.data;
          error = fbRes.error;
        }

        if (error) {
          console.error("Erro no fetch global de requisições:", error);
          break;
        }

        if (data && data.length > 0) {
          allDbRows = [...allDbRows, ...data];
          if (data.length < pageSize) {
            temMais = false;
          } else {
            inicio += pageSize;
          }
        } else {
          temMais = false;
        }
      }

      if (allDbRows.length === 0) {
        showToast('Nenhuma RM encontrada para exportação.', 'error');
        setIsExportingReport(false);
        return;
      }

      // 2. Mapeamento e estruturação dos dados (Achatamento / Flatten: 1 linha por item)
      const linhasExportacao: any[] = [];

      for (const row of allDbRows) {
        const itemsToProcess = extractEmbeddedItems(row);

        // Normalização de Tipo e Categoria
        let rawTipo = String(row.tipoRM ?? row.tipo_rm ?? '').trim();
        let rawCategoria = String(row.categoria ?? '').trim();

        if (!rawTipo && rawCategoria) {
          const lowerCat = rawCategoria.toLowerCase();
          if (lowerCat.includes('tecnica') || lowerCat.includes('técnica')) rawTipo = 'pre_cotacao_tecnica';
          else if (lowerCat.includes('cotacao') || lowerCat.includes('cotação')) rawTipo = 'pre_cotacao';
          else if (lowerCat.includes('cc99')) rawTipo = 'cc99';
          else if (lowerCat.includes('estoque')) rawTipo = 'estoque';
          else rawTipo = 'RM Normal';
        } else if (!rawTipo) {
          rawTipo = 'RM Normal';
        }

        const tipoReal = rawTipo === 'estoque' ? 'Estoque' :
                         rawTipo === 'pre_cotacao' ? 'Pré-Cotação' :
                         rawTipo === 'pre_cotacao_tecnica' ? 'Pré-Cotação Técnica' :
                         rawTipo === 'cc99' ? 'CC99' : rawCategoria || 'Estoque';

        const rmNumber = String(row.rmNumber ?? row.rm_number ?? row.numero ?? row.id ?? 'RM-SGI');
        const solicitante = String(row.solicitante ?? 'Solicitante SGI');
        const setor = String(row.setor ?? 'Geral');
        const centroCusto = String(row.centroCusto ?? row.centro_custo ?? '');
        const motivo = String(row.motivo ?? '');

        // Formatação da Data de Emissão
        const rawDateStr = String(row.dataSolicitacao ?? row.data_solicitacao ?? row.createdTimestamp ?? row.created_at ?? '');
        const parsedDate = getParsedDate(rawDateStr);
        const dataEmissaoFormatted = parsedDate
          ? `${String(parsedDate.getDate()).padStart(2, '0')}/${String(parsedDate.getMonth() + 1).padStart(2, '0')}/${parsedDate.getFullYear()} ${String(parsedDate.getHours()).padStart(2, '0')}:${String(parsedDate.getMinutes()).padStart(2, '0')}`
          : rawDateStr;

        // Determina se a RM está no Histórico (Finalizada)
        const statusInterno = String(row.status_interno ?? '').trim();
        const statusErp = String(row.status ?? '').trim().toUpperCase();

        const isHistorico = 
          statusInterno === 'Finalizado' ||
          statusInterno.toLowerCase() === 'concluí' ||
          statusInterno.toLowerCase() === 'concluido' ||
          statusErp === 'APROVADA' ||
          statusErp === 'APROVADO' ||
          statusErp === 'REPROVADA' ||
          statusErp === 'REPROVADO' ||
          statusErp === 'CANCELADA' ||
          statusErp === 'CANCELADO' ||
          statusErp === 'CONCLUÍDA' ||
          statusErp === 'CONCLUIDO';

        // Determina Fase Atual / Localização
        let faseAtualLocalizacao = 'Almoxarifado';
        if (isHistorico) {
          faseAtualLocalizacao = 'Histórico';
        } else if (statusInterno === 'Aguardando Aprovador' || statusInterno.toLowerCase().includes('aprovador') || statusInterno.toLowerCase().includes('aprovação')) {
          faseAtualLocalizacao = 'Aprovação';
        } else if (statusInterno === 'Maternidade' || statusErp === 'MATERNIDADE') {
          faseAtualLocalizacao = 'Maternidade';
        } else if (statusInterno === 'Em Tratamento' || statusInterno.toLowerCase().includes('tratamento') || statusInterno.toLowerCase().includes('triagem')) {
          faseAtualLocalizacao = 'Triagem';
        } else if (statusInterno === 'Aguardando Direcionamento' || statusInterno.toLowerCase().includes('direcionamento')) {
          faseAtualLocalizacao = 'Direcionamento';
        } else {
          faseAtualLocalizacao = 'Almoxarifado';
        }

        // Mapeamento de Detalhes do Histórico (RMs Finalizadas vs Em Andamento)
        let statusFinal = '-';
        let numeroRtdGeral = '-';

        if (isHistorico) {
          if (statusErp.includes('REPROV') || statusErp.includes('CANCEL')) {
            statusFinal = 'Reprovado';
          } else {
            statusFinal = 'Aprovado';
          }

          const rtdVal = (() => {
            if (row.numero_rtd) return String(row.numero_rtd);
            if (row.rtd) return String(row.rtd);
            if (row.numeroRtd) return String(row.numeroRtd);
            const rawP = String(row.parecerDiligenciador ?? row.parecer_diligenciador ?? '');
            if (rawP.trim().startsWith('{')) {
              try {
                const pj = JSON.parse(rawP);
                return String(pj.numero_rtd || pj.rtd || pj.numeroRtd || '');
              } catch (e) {}
            }
            return '';
          })();

          numeroRtdGeral = rtdVal.trim() !== '' ? rtdVal.trim() : 'Sem necessidade/Não gerado';
        }

        // Fallback: se não houver itens extraídos, usa a própria RM como 1 linha para que ela não suma do relatório
        const itemsList = itemsToProcess && itemsToProcess.length > 0 ? itemsToProcess : [row];

        for (const itemObj of itemsList) {
          const itemInfo = extractItemInfo(itemObj);

          let totalAtendido: string | number = '-';
          let totalCompra: string | number = '-';
          let numeroRtd = numeroRtdGeral;

          if (isHistorico) {
            const itemQtdAtendida = (() => {
              if (itemObj.qtd_atendida !== undefined && itemObj.qtd_atendida !== null) return Number(itemObj.qtd_atendida);
              if (itemObj.qtdAtendida !== undefined && itemObj.qtdAtendida !== null) return Number(itemObj.qtdAtendida);
              if (itemObj.quantidade_atendida !== undefined && itemObj.quantidade_atendida !== null) return Number(itemObj.quantidade_atendida);
              if (row.qtd_atendida !== undefined && row.qtd_atendida !== null) return Number(row.qtd_atendida);
              if (row.quantidade_atendida !== undefined && row.quantidade_atendida !== null) return Number(row.quantidade_atendida);
              const rawP = String(row.parecerDiligenciador ?? row.parecer_diligenciador ?? '');
              if (rawP.trim().startsWith('{')) {
                try {
                  const pj = JSON.parse(rawP);
                  return Number(pj.qtd_atendida ?? pj.quantidade_atendida ?? 0);
                } catch (e) {}
              }
              return 0;
            })();

            const itemQtdCompra = (() => {
              if (itemObj.qtd_em_compra !== undefined && itemObj.qtd_em_compra !== null) return Number(itemObj.qtd_em_compra);
              if (itemObj.qtd_compra !== undefined && itemObj.qtd_compra !== null) return Number(itemObj.qtd_compra);
              if (itemObj.qtdCompra !== undefined && itemObj.qtdCompra !== null) return Number(itemObj.qtdCompra);
              if (itemObj.quantidade_em_compra !== undefined && itemObj.quantidade_em_compra !== null) return Number(itemObj.quantidade_em_compra);
              if (row.qtd_em_compra !== undefined && row.qtd_em_compra !== null) return Number(row.qtd_em_compra);
              if (row.qtd_compra !== undefined && row.qtd_compra !== null) return Number(row.qtd_compra);
              if (row.quantidade_em_compra !== undefined && row.quantidade_em_compra !== null) return Number(row.quantidade_em_compra);
              const rawP = String(row.parecerDiligenciador ?? row.parecer_diligenciador ?? '');
              if (rawP.trim().startsWith('{')) {
                try {
                  const pj = JSON.parse(rawP);
                  return Number(pj.qtd_em_compra ?? pj.qtd_compra ?? 0);
                } catch (e) {}
              }
              return 0;
            })();

            totalAtendido = itemQtdAtendida;
            totalCompra = itemQtdCompra;

            if (itemObj.numero_rtd || itemObj.rtd || itemObj.numeroRtd) {
              const itemRtd = String(itemObj.numero_rtd || itemObj.rtd || itemObj.numeroRtd).trim();
              if (itemRtd) numeroRtd = itemRtd;
            }
          }

          const rawRowMat = String(row.material ?? '').trim();
          const safeRowMat = isPersonName(rawRowMat) ? '' : rawRowMat;
          const rawMaterialStr = itemInfo.material || safeRowMat || String(itemObj.material || itemObj.descricao || itemObj.nome || row.material || '-');

          let codigoMaterial = String(
            itemObj.codigo_material ??
            itemObj.codigoMaterial ??
            itemObj.codigo ??
            itemObj.cod_material ??
            itemObj.codMaterial ??
            row.codigo_material ??
            row.codigoMaterial ??
            ''
          ).trim();

          let descricaoItem = rawMaterialStr.trim();

          // Separação estrita de Código e Descrição do Material via .split(' - ')
          if (rawMaterialStr.includes(' - ')) {
            const parts = rawMaterialStr.split(' - ');
            const codeFromStr = parts[0].trim();
            const descFromStr = parts.slice(1).join(' - ').trim();

            if (!codigoMaterial) {
              codigoMaterial = codeFromStr;
            }
            descricaoItem = descFromStr || codeFromStr;
          } else if (codigoMaterial && descricaoItem.startsWith(codigoMaterial)) {
            const cleaned = descricaoItem.replace(new RegExp('^' + codigoMaterial + '\\s*-\\s*'), '').trim();
            if (cleaned) descricaoItem = cleaned;
          }

          if (!codigoMaterial) codigoMaterial = '-';
          if (!descricaoItem) descricaoItem = '-';

          const unidade = String(itemInfo.unidade || itemObj.unidade || itemObj.un || row.unidade || 'UN');
          const quantidadeSolicitada = Number(itemInfo.quantidade || itemObj.quantidade || itemObj.qtd || row.quantidade || 0);

          linhasExportacao.push({
            rmNumber,
            dataEmissaoFormatted,
            solicitante,
            setor,
            centroCusto,
            tipoReal,
            motivo,
            faseAtualLocalizacao,
            statusFinal,
            numeroRtd,
            codigoMaterial,
            descricaoItem,
            unidade,
            quantidadeSolicitada,
            totalAtendido,
            totalCompra
          });
        }
      }

      // 3. Montagem do CSV achatado (1 linha por item) com cabeçalhos padronizados
      const headers = [
        'Nº da RM',
        'Data de Emissão',
        'Requisitante',
        'Setor',
        'Centro de Custo',
        'Tipo de RM',
        'Motivo da RM',
        'Fase Atual / Localização',
        'Status Final',
        'Nº da RTD',
        'Código do Material',
        'Descrição do Item',
        'Unidade',
        'Quantidade Solicitada',
        'Quantidade Atendida',
        'Quantidade em Compra'
      ];

      const escapeCsvField = (field: any) => {
        if (field === null || field === undefined) return '""';
        let str = String(field).trim();
        str = str.replace(/"/g, '""');
        return `"${str}"`;
      };

      const csvRows = [headers.join(';')];

      for (const item of linhasExportacao) {
        const rowArr = [
          escapeCsvField(item.rmNumber),
          escapeCsvField(item.dataEmissaoFormatted),
          escapeCsvField(item.solicitante),
          escapeCsvField(item.setor),
          escapeCsvField(item.centroCusto),
          escapeCsvField(item.tipoReal),
          escapeCsvField(item.motivo),
          escapeCsvField(item.faseAtualLocalizacao),
          escapeCsvField(item.statusFinal),
          escapeCsvField(item.numeroRtd),
          escapeCsvField(item.codigoMaterial),
          escapeCsvField(item.descricaoItem),
          escapeCsvField(item.unidade),
          escapeCsvField(item.quantidadeSolicitada),
          escapeCsvField(item.totalAtendido),
          escapeCsvField(item.totalCompra)
        ];
        csvRows.push(rowArr.join(';'));
      }

      // Gerar o blob do CSV com BOM UTF-8 para compatibilidade perfeita com Excel no Windows
      const csvContent = '\uFEFF' + csvRows.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      let dateSuffix = '';
      if (startDate && endDate) {
        dateSuffix = `_de_${startDate}_a_${endDate}`;
      } else if (startDate) {
        dateSuffix = `_desde_${startDate}`;
      } else if (endDate) {
        dateSuffix = `_ate_${endDate}`;
      }

      const filename = `relatorio_geral_rms${dateSuffix}.csv`;
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(`Relatório Geral exportado com sucesso (${linhasExportacao.length} itens)!`, 'success');
    } catch (err: any) {
      console.error("Erro ao gerar relatório geral de RMs:", err);
      showToast(`Erro ao gerar relatório: ${err.message || err}`, 'error');
    } finally {
      setIsExportingReport(false);
    }
  };

  const handleExportarRelatorio = exportarRelatorioGeral;

  const handleCobrar = (approverName: 'André' | 'Maicon' | 'Fábio') => {
    const selectedList = selectedRms[approverName] || [];
    if (selectedList.length === 0) {
      showToast(`Nenhuma RM selecionada para cobrar ${approverName}.`, "error");
      return;
    }

    const activeColumnRms = aprovadoresRequisitions.filter(req => 
      req.aprovador_destino === approverName && selectedList.includes(req.rmNumber)
    );

    if (activeColumnRms.length === 0) {
      showToast("As RMs selecionadas não estão mais nesta coluna.", "error");
      return;
    }

    const blocks = activeColumnRms.map(req => {
      const orientacao = req.orientacao_aprovacao || req.orientacao_combo || req.observacao_combo || req.acao_recomendada || 'Análise Pendente';
      const texto_da_justificativa = req.parecerDiligenciador || req.motivo || '';

      const dNec = getParsedDate(req.dataNecessidade);
      let dataNecessidadeFormatada = req.dataNecessidade || 'Não informada';
      if (dNec) {
        const day = String(dNec.getDate()).padStart(2, '0');
        const month = String(dNec.getMonth() + 1).padStart(2, '0');
        const year = dNec.getFullYear();
        dataNecessidadeFormatada = `${day}/${month}/${year}`;
      }

      return `📦 RM: #${req.rmNumber}
🏢 OBRA: ${req.centroCusto || ''}
📅 DATA DE NECESSIDADE: ${dataNecessidadeFormatada}

🎯 Orientação: ${orientacao}`;
    });

    const text = blocks.join('\n\n====================\n\n');

    const phoneMap = {
      'André': '5598983000054',
      'Maicon': '5598982030050',
      'Fábio': '5598981230670'
    };
    const phone = phoneMap[approverName];
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handlePrintRM = (req: GroupedRequisition) => {
    setPrintingRm(req);
    // Use a small timeout to let the state update propagate, then trigger print
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // --------------------------------------------------------------------------
  // STATS BASEADOS NAS RMs AGRUPADAS
  // --------------------------------------------------------------------------
  const stats = useMemo(() => {
    const allRMs = filteredGroupedAllRequisitions;
    const total = allRMs.length;

    // Is finalized checks (history/finished)
    const getIsFinalizado = (rm: any) => {
      return rm.status_interno === 'Finalizado' || 
             (rm.status || '').toUpperCase() === 'HISTORICO' || 
             (rm.status || '').toUpperCase() === 'FINALIZADO';
    };

    const pendentes = allRMs.filter(rm => !getIsFinalizado(rm)).length;
    const aprovados = allRMs.filter(rm => getIsFinalizado(rm) && rm.acao_recomendada?.toLowerCase().includes('aprovar')).length;
    const cancelados = allRMs.filter(rm => getIsFinalizado(rm) && !rm.acao_recomendada?.toLowerCase().includes('aprovar')).length;

    // Log temporário de auditoria para garantir precisão absoluta
    console.log('Auditoria KPI: Total:', total, '| Soma das partes:', (pendentes + aprovados + cancelados));

    // TOTAL DE ITENS: Somatório de itens_rm.length iterando sobre allRMs.
    const totalItens = allRMs.reduce((sum, rm) => sum + (rm.itens ? rm.itens.length : 0), 0);

    // TOTAL QUANTIDADE: Somatório de qtd_pedida (or fallback to quantidade) de todos os itens_rm de allRMs.
    const rawTotalQuantidade = allRMs.reduce((acc, r) => {
      return acc + (r.itens || []).reduce((sum, item) => {
        const qty = (item as any).qtd_pedida ?? item.quantidade ?? 0;
        const numQty = Number(qty);
        return sum + (isNaN(numQty) ? 0 : numQty);
      }, 0);
    }, 0);
    const totalQuantidade = Math.round(rawTotalQuantidade * 100) / 100;

    return { total, pendentes, aprovados, cancelados, totalItens, totalQuantidade };
  }, [filteredGroupedAllRequisitions]);

  // --------------------------------------------------------------------------
  // LISTA DE RMs FILTRADAS PARA O MODAL DE DRILL-DOWN
  // --------------------------------------------------------------------------
  const modalFilteredRMs = useMemo(() => {
    if (!statusModal) return [];
    const allRMs = filteredGroupedAllRequisitions;
    
    const getIsFinalizado = (rm: any) => {
      return rm.status_interno === 'Finalizado' || 
             (rm.status || '').toUpperCase() === 'HISTORICO' || 
             (rm.status || '').toUpperCase() === 'FINALIZADO';
    };

    return allRMs.filter(rm => {
      const isFinal = getIsFinalizado(rm);
      if (statusModal === 'PENDENTES') {
        return !isFinal;
      }
      if (statusModal === 'APROVADAS') {
        return isFinal && rm.acao_recomendada?.toLowerCase().includes('aprovar');
      }
      if (statusModal === 'REPROVADAS') {
        return isFinal && !rm.acao_recomendada?.toLowerCase().includes('aprovar');
      }
      return false;
    });
  }, [filteredGroupedAllRequisitions, statusModal]);

  // --------------------------------------------------------------------------
  // ROLAGEM INFINITA INTELIGENTE (MODO TV)
  // --------------------------------------------------------------------------
  const tvContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeView !== 'tv') return;

    const container = tvContainerRef.current;
    if (!container) return;

    let direction = 1; // 1 para baixo, -1 para cima
    let scrollInterval: NodeJS.Timeout;

    const startScroll = () => {
      scrollInterval = setInterval(() => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        
        // Se a lista cabe inteira na tela, não rola
        if (scrollHeight <= clientHeight) return;

        // Ajusta a velocidade de rolagem suave
        container.scrollTop += direction * 1.2;

        // Ao atingir a borda inferior, espera um pouco e inverte direção
        if (scrollTop + clientHeight >= scrollHeight - 3 && direction === 1) {
          direction = -1;
        } 
        // Ao atingir o topo, espera um pouco e inverte direção
        else if (scrollTop <= 2 && direction === -1) {
          direction = 1;
        }
      }, 40);
    };

    // Pequeno atraso para carregar e iniciar
    const startDelay = setTimeout(startScroll, 2000);

    return () => {
      clearTimeout(startDelay);
      clearInterval(scrollInterval);
    };
  }, [activeView, requisitions]);

  const getTreatmentDurationStr = (inicio?: string, fim?: string) => {
    if (!inicio || !fim) return null;
    const tInicio = new Date(inicio).getTime();
    const tFim = new Date(fim).getTime();
    if (isNaN(tInicio) || isNaN(tFim)) return null;
    const diffMs = tFim - tInicio;
    if (diffMs <= 0) return "Menos de 1 min";
    
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 60) {
      return `${diffMin} min`;
    }
    const diffHrs = Math.floor(diffMin / 60);
    const remainingMin = diffMin % 60;
    if (remainingMin === 0) {
      return `${diffHrs}h`;
    }
    return `${diffHrs}h ${remainingMin}min`;
  };

  // Auxiliares de Estilização Dinâmica
  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('aprovado') || s.includes('concluid')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
          Aprovado
        </span>
      );
    } else if (s.includes('reprovad') || s.includes('cancelad') || s.includes('arquivad')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          <span className="w-2 h-2 rounded-full bg-rose-600"></span>
          Reprovado/Cancelado
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          Pendente
        </span>
      );
    }
  };

  const getUrgencyBadge = (dataNecessidade: string | undefined) => {
    const status = calcularStatusPrazo(dataNecessidade);
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-current/10 ${status.cor}`}>
        {status.texto}
      </span>
    );
  };

  const tvSemTratamento = useMemo(() => {
    return tvFilteredRequisitions.filter(item => {
      const statusLimpo = String(item.status || (item as any).fase || '').trim().toLowerCase();
      const statusInternoLimpo = String(item.status_interno || '').trim().toLowerCase();
      const isStatusAlmoxarifado = !item.status_interno || statusInternoLimpo === 'aguardando tratamento';
      const isStatusTriagem = statusInternoLimpo === 'em tratamento' || statusInternoLimpo.includes('tratamento') || statusLimpo === 'triagem' || statusLimpo.includes('tratamento');
      const rawTratadoPor = String(item.tratado_por || item.agente_tratamento || '').trim();
      const isSemDono = !rawTratadoPor || rawTratadoPor === 'AGUARDANDO ASSUNÇÃO' || rawTratadoPor.toUpperCase() === 'AGUARDANDO ASSUNÇÃO';
      return isStatusAlmoxarifado || (isStatusTriagem && isSemDono);
    }).length;
  }, [tvFilteredRequisitions]);

  const tvEmTratamento = useMemo(() => {
    return tvFilteredRequisitions.filter(item => {
      const statusLimpo = String(item.status || (item as any).fase || '').trim().toLowerCase();
      const statusInternoLimpo = String(item.status_interno || '').trim().toLowerCase();
      const isStatusTriagem = statusInternoLimpo === 'em tratamento' || statusInternoLimpo.includes('tratamento') || statusLimpo === 'triagem' || statusLimpo.includes('tratamento');
      const rawTratadoPor = String(item.tratado_por || item.agente_tratamento || '').trim();
      const hasDono = !!rawTratadoPor && rawTratadoPor !== 'AGUARDANDO ASSUNÇÃO' && rawTratadoPor.toUpperCase() !== 'AGUARDANDO ASSUNÇÃO';
      return isStatusTriagem && hasDono;
    }).length;
  }, [tvFilteredRequisitions]);

  const tvEmAprovacao = useMemo(() => {
    return tvFilteredRequisitions.filter(item => item.status_interno === 'Aguardando Aprovador').length;
  }, [tvFilteredRequisitions]);

  const costCenterData = useMemo(() => {
    const counts: Record<string, number> = {};
    tvFilteredRequisitions.forEach(req => {
      const cc = req.centroCusto || 'Não Definido';
      counts[cc] = (counts[cc] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [tvFilteredRequisitions]);

  const topSolicitantes = useMemo(() => {
    const counts: Record<string, number> = {};
    tvFilteredRequisitions.forEach(req => {
      const sol = req.solicitante || 'Não Identificado';
      counts[sol] = (counts[sol] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, quantidade]) => ({ name, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);
  }, [tvFilteredRequisitions]);

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        let todosOsDados: any[] = [];
        let inicio = 0;
        const pageSize = 1000;
        let temMais = true;
        let pageCount = 0;
        const maxPages = 15;

        while (temMais && pageCount < maxPages) {
          let res = await supabase
            .from('requisicoes')
            .select('*')
            .order('createdTimestamp', { ascending: false })
            .range(inicio, inicio + pageSize - 1);

          if (res.error) {
            res = await supabase
              .from('requisicoes')
              .select('*')
              .range(inicio, inicio + pageSize - 1);
          }

          const data = res.data;
          const error = res.error;

          if (error) {
            console.error("Erro no fetch de ranking:", error);
            break;
          }

          if (data && data.length > 0) {
            todosOsDados = [...todosOsDados, ...data];
            pageCount++;
            if (data.length < pageSize) {
              temMais = false;
            } else {
              inicio += pageSize;
            }
          } else {
            temMais = false;
          }
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-indexed

        const parseFlexibleDate = (dateStr: any): Date | null => {
          if (!dateStr) return null;
          if (typeof dateStr === 'number') return new Date(dateStr);
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) return d;
          
          if (typeof dateStr === 'string' && dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const day = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10) - 1;
              const year = parseInt(parts[2], 10);
              const parsed = new Date(year, month, day);
              if (!isNaN(parsed.getTime())) return parsed;
            }
          }
          return null;
        };

        // Filtra registros do mês atual que tenham status de Concluído, Entregue ou Aprovado
        const filtered = (todosOsDados || []).filter((row: any) => {
          const statusLower = String(row.status ?? '').toLowerCase();
          const isFinishedStatus = statusLower.includes('concluid') || 
                                   statusLower.includes('concluído') || 
                                   statusLower.includes('entregue') || 
                                   statusLower.includes('aprovado');
          if (!isFinishedStatus) return false;

          const rowDate = parseFlexibleDate(row.created_at ?? row.createdTimestamp ?? row.data_conclusao_tratamento ?? row.dataSolicitacao ?? row.data_solicitacao ?? row.concluidoTimestamp);
          if (!rowDate) return false;

          return rowDate.getFullYear() === currentYear && rowDate.getMonth() === currentMonth;
        });

        // Agrupa por atendente (tratado_por)
        const counts = filtered.reduce((acc: Record<string, number>, row: any) => {
          const name = String(row.tratado_por ?? '').trim();
          if (name) {
            acc[name] = (acc[name] || 0) + 1;
          }
          return acc;
        }, {});

        // Converte para array, ordena decrescente e extrai Top 5
        const sortedRanking = Object.entries(counts)
          .map(([name, count]) => ({
            name,
            quantidade: Number(count)
          }))
          .sort((a: { name: string; quantidade: number }, b: { name: string; quantidade: number }) => b.quantidade - a.quantidade)
          .slice(0, 5);

        setRankingAtendimentos(sortedRanking);
      } catch (err: any) {
        console.error(`Erro no processamento de ranking do Supabase: ${err?.message || err}`);
      }
    };

    fetchRanking();
  }, []);

  const formatOperatorName = (fullName: string) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  };

  if (isAuthChecking && activeView !== 'tv') {
    return <WarehouseLoader customMessage="VERIFICANDO SESSÃO SEGURA..." />;
  }

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${activeView === 'tv' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Interceptador de Autenticação para todas as páginas administrativas */}
      {!isLoggedIn && activeView !== 'tv' && (
        <div className="fixed inset-0 min-h-screen bg-slate-50 flex flex-col justify-between font-sans z-50 overflow-y-auto">
          {/* Header do Login */}
          <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-xs shrink-0">
            <div className="flex items-center gap-3">
              <button 
                onClick={onBackToHub}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                title="Voltar ao Hub de Sistemas"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-slate-800">
                  Diligenciamento SGI
                </h1>
                <p className="text-2xs text-slate-500 font-semibold tracking-wide uppercase">
                  CMPC INDUSTRIAL
                </p>
              </div>
            </div>
            <div>
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#tv';
                  setActiveView('tv');
                }}
                className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <Tv className="w-3.5 h-3.5 text-emerald-600" />
                Acessar Modo TV (Público)
              </button>
            </div>
          </header>

          {/* Form Card */}
          <main className="flex-1 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl max-w-md w-full p-8 shadow-xl border border-slate-200 space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="inline-flex p-3.5 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100">
                  <Lock className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                  {isSignUp ? 'Criar Conta' : 'Área Restrita'}
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {isSignUp 
                    ? 'Cadastre seu e-mail corporativo para criar um novo usuário no painel do SGI.'
                    : 'Insira as credenciais do seu e-mail corporativo CMPC para auditar e monitorar as RMs de materiais.'
                  }
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-2xs font-bold text-slate-700 uppercase tracking-wider">
                    E-mail Corporativo
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nome.sobrenome@cmpc.com.br"
                      required
                      className="w-full text-xs border border-slate-200 rounded-xl pl-9 pr-3 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium bg-slate-50 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-2xs font-bold text-slate-700 uppercase tracking-wider">
                    Senha de Acesso
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full text-xs border border-slate-200 rounded-xl pl-9 pr-3 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium bg-slate-50 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {loginError && (
                  <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer hover:shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    isSignUp ? 'Cadastrar Usuário' : 'Entrar no Painel'
                  )}
                </button>
              </form>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setLoginError('');
                  }}
                  className="text-xs font-bold text-indigo-650 hover:text-indigo-800 transition-colors cursor-pointer"
                >
                  {isSignUp 
                    ? 'Já possui uma conta? Fazer Login' 
                    : 'Não possui uma conta? Criar Conta'
                  }
                </button>
              </div>

              <div className="border-t border-slate-150 pt-4 text-center space-y-3">
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      window.location.hash = '#tv';
                      setActiveView('tv');
                    }}
                    className="text-xs font-bold text-emerald-650 hover:text-emerald-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Tv className="w-3.5 h-3.5 text-emerald-650" />
                    Modo TV (Público)
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={onBackToHub}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Voltar ao Hub
                  </button>
                </div>
              </div>
            </motion.div>
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-slate-200 py-4 text-center text-[10px] text-slate-400 font-medium shrink-0">
            Diligenciamento SGI © 2026 • CMPC INDUSTRIAL S.A.
          </footer>

          {/* Toast de Login */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-4 right-4 z-[100] shadow-lg rounded-xl px-4 py-3 border flex items-center gap-2 bg-white text-slate-800 border-slate-200"
              >
                {toast.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-500" />
                )}
                <span className="text-sm font-medium">{toast.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Modal Flutuante de Confirmação de E-mail */}
          <AnimatePresence>
            {showEmailConfirmModal && (
              <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 15 }}
                  transition={{ type: "spring", duration: 0.4 }}
                  className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-200 space-y-6 relative text-center"
                >
                  <div className="inline-flex p-4 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100 animate-pulse">
                    <Mail className="w-8 h-8 text-indigo-600" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Confirme seu E-mail</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Enviamos um link de ativação seguro para o seu endereço de e-mail cadastrado:
                    </p>
                    <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-150 mt-2">
                      <span className="font-mono text-xs font-bold text-indigo-700 break-all">{registeredEmail}</span>
                    </div>
                  </div>

                  <div className="text-left text-xs text-slate-650 bg-amber-50/50 border border-amber-150 rounded-xl p-4 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="font-extrabold text-amber-900 uppercase tracking-wide text-3xs">Atenção sobre a ativação:</p>
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 text-slate-600 pl-1 text-2xs font-medium">
                      <li>O login só será permitido <strong>após clicar no link</strong> do e-mail de confirmação.</li>
                      <li>Verifique sua pasta de <strong>Lixo Eletrônico (Spam)</strong> ou de Outros na caixa de entrada.</li>
                      <li>O link de verificação expira após algumas horas por segurança.</li>
                    </ul>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowEmailConfirmModal(false)}
                      className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer hover:shadow-lg flex items-center justify-center gap-1.5"
                    >
                      Entendido, vou verificar
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}



      {/* ====================================================================
          NOTIFICAÇÃO INTERNA (TOAST)
          ==================================================================== */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 right-4 z-[100] shadow-lg rounded-xl px-4 py-3 border flex items-center gap-2 bg-white text-slate-800 border-slate-200"
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-500" />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====================================================================
          MODAL: MOTIVO DA ESPERA
          ==================================================================== */}
      <AnimatePresence>
        {editingMotivoRm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 relative flex flex-col"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Motivo da Espera - RM {editingMotivoRm.rmNumber}
                  </h3>
                  <p className="text-2xs text-slate-500 font-semibold tracking-wide uppercase mt-1">
                    Painel de Cobrança Ativa
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setEditingMotivoRm(null);
                    setMotivoText('');
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Anotar motivo da inércia / atraso:
                </label>
                <textarea
                  value={motivoText}
                  onChange={(e) => setMotivoText(e.target.value)}
                  placeholder="Ex: Aguardando orçamento, Gestor de férias, Aguardando aprovação técnica do setor..."
                  rows={4}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-800 placeholder-slate-400 focus:bg-white transition-all outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditingMotivoRm(null);
                    setMotivoText('');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveMotivoEspera}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-3xs"
                >
                  Salvar Motivo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ====================================================================
          MODAL DE CORREÇÃO MANUAL DE ITENS PENDENTES (CATRACA DILIGENCIAMENTO)
          ==================================================================== */}
      {isFixingModalOpen && fixingRm && (() => {
        const unidentifiedItems = fixingRm.itens.filter(isItemNaoIdentificado);

        return (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-[110] animate-fade-in">
            <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-5 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-600/50 rounded-2xl border border-amber-400/30">
                    <AlertTriangle className="w-6 h-6 text-amber-100 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white tracking-wide">
                      Resolver Itens Pendentes (Catraca Audit)
                    </h3>
                    <p className="text-xs text-amber-100 font-medium">
                      RM #{fixingRm.rmNumber} &bull; {fixingRm.solicitante || 'Solicitante'} &bull; {fixingRm.setor || 'Setor'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsFixingModalOpen(false);
                    setFixingRm(null);
                  }}
                  className="p-2 rounded-xl bg-amber-600/40 hover:bg-amber-600 text-amber-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Subheader Notice */}
              <div className="bg-amber-50 p-4 border-b border-amber-200 text-amber-900 text-xs font-semibold flex items-start gap-2.5 shrink-0">
                <HelpCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Esta RM possui <strong>{unidentifiedItems.length} item(ns) não identificado(s) ou com dados incompletos</strong>. 
                  Conforme a regra de auditoria, preencha obrigatoriamente o Código (NM), Descrição, Unidade e Quantidade para liberar a RM no fluxo de atendimento.
                </p>
              </div>

              {/* Lista de Formulários */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-slate-50/50">
                {unidentifiedItems.map((it, idx) => {
                  const itemData = fixingItemsData[it.id] || {
                    codigoNm: '',
                    descricao: '',
                    unidade: 'UN',
                    quantidade: 1
                  };

                  return (
                    <div 
                      key={it.id} 
                      className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3.5 hover:border-amber-300 transition-all"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-amber-500 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-700">
                            Item ID: <span className="font-mono text-slate-500">{it.id.slice(-8)}</span>
                          </span>
                        </div>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          Pendente de Correção
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Código (NM) */}
                        <div className="space-y-1 sm:col-span-1">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600">
                            Código (NM) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: 1002345"
                            value={itemData.codigoNm}
                            onChange={(e) => handleUpdateFixingItem(it.id, 'codigoNm', e.target.value)}
                            className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all"
                            required
                          />
                        </div>

                        {/* Descrição */}
                        <div className="space-y-1 sm:col-span-2">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600">
                            Descrição do Material <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: PARAFUSO SEXTAVADO M12 X 50MM INOX"
                            value={itemData.descricao}
                            onChange={(e) => handleUpdateFixingItem(it.id, 'descricao', e.target.value)}
                            className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all"
                            required
                          />
                        </div>

                        {/* Unidade de Medida */}
                        <div className="space-y-1 sm:col-span-2">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600">
                            Unidade de Medida <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={itemData.unidade}
                            onChange={(e) => handleUpdateFixingItem(it.id, 'unidade', e.target.value)}
                            className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all cursor-pointer"
                            required
                          >
                            <option value="UN">UN - Unidade</option>
                            <option value="PC">PC - Peça</option>
                            <option value="KG">KG - Quilograma</option>
                            <option value="M">M - Metro</option>
                            <option value="L">L - Litro</option>
                            <option value="M2">M² - Metro Quadrado</option>
                            <option value="M3">M³ - Metro Cúbico</option>
                            <option value="CX">CX - Caixa</option>
                            <option value="PAR">PAR - Par</option>
                            <option value="JOGO">JOGO - Jogo</option>
                            <option value="RL">RL - Rolo</option>
                            <option value="GL">GL - Galão</option>
                            <option value="LATA">LATA - Lata</option>
                          </select>
                        </div>

                        {/* Quantidade */}
                        <div className="space-y-1 sm:col-span-1">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600">
                            Quantidade <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            placeholder="1"
                            value={itemData.quantidade}
                            onChange={(e) => handleUpdateFixingItem(it.id, 'quantidade', parseFloat(e.target.value) || 0)}
                            className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsFixingModalOpen(false);
                    setFixingRm(null);
                  }}
                  disabled={savingFixes}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvarCorrecoesItens}
                  disabled={savingFixes}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingFixes ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Salvando e Atualizando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Salvar Correções</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ====================================================================
          MODAL DE FORÇAR RE-SINCRONIZAÇÃO DO APROVO / DEPURAÇÃO
          ==================================================================== */}
      {showResyncModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-[110] animate-fade-in text-left">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-5 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-600/50 rounded-2xl border border-amber-400/30">
                  <RefreshCw className={`w-6 h-6 text-white ${isResyncing ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <h3 className="font-black text-base text-white tracking-wide">
                    Forçar Re-Sincronização do Aprovo
                  </h3>
                  <p className="text-xs text-amber-100 font-medium">
                    Re-processamento profundo de payloads e reparo de dados no Supabase
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResyncModal(false)}
                disabled={isResyncing}
                className="p-2 rounded-xl bg-amber-600/40 hover:bg-amber-600 text-amber-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-left">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-2">
                <p className="font-extrabold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  Reparo Automático de Itens Não Identificados
                </p>
                <p className="text-slate-700 leading-relaxed">
                  Esta ferramenta re-analisa o campo <code className="bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-mono">_raw</code> e a estrutura interna dos registros no Supabase, extraindo o código, descrição, quantidade e unidade reais vindos do Aprovo para substituir de-para "Item não identificado / Incompleto".
                </p>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">
                  Números das RMs para Re-Sincronizar (separados por vírgula):
                </label>
                <input
                  type="text"
                  value={resyncInputRms}
                  onChange={(e) => setResyncInputRms(e.target.value)}
                  placeholder="Ex: 11665, 11699 (ou deixe vazio para re-sincronizar todas as RMs do banco)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Se deixar em branco, o sistema tentará re-processar todas as RMs cadastradas no banco de dados.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleForceResyncAprovo()}
                  disabled={isResyncing}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isResyncing ? 'animate-spin' : ''}`} />
                  <span>Executar Re-Sincronização</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResyncInputRms('11665, 11699, 11574');
                    handleForceResyncAprovo(['11665', '11699', '11574']);
                  }}
                  disabled={isResyncing}
                  className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  Re-Sincronizar RM 11665, 11699 e 11574
                </button>
              </div>

              {/* Console Log de Re-Sincronização */}
              {resyncLogs.length > 0 && (
                <div className="space-y-1 pt-2">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <span>Logs de Execução em Tempo Real</span>
                    <span>{resyncLogs.length} linhas</span>
                  </div>
                  <div className="bg-slate-950 text-emerald-400 font-mono text-[11px] p-4 rounded-2xl max-h-48 overflow-y-auto space-y-1 shadow-inner border border-slate-800 leading-relaxed">
                    {resyncLogs.map((log, idx) => (
                      <div key={idx} className="whitespace-pre-wrap">{log}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowResyncModal(false)}
                disabled={isResyncing}
                className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL DE TRATAMENTO DE RM (DEFINIR STATUS DA RM)
          ==================================================================== */}
      {isTreatmentModalOpen && treatingRm && (() => {
        const exigeRtd = treatingRm.itens.some(it => itemStatuses[it.id] === 'ATENDIDO');
        const exigeRmFilha = treatingRm.itens.some(it => itemStatuses[it.id] === 'COMPRA');
        const allItemsSelected = treatingRm.itens.every(it => itemStatuses[it.id] === 'COMPRA' || itemStatuses[it.id] === 'ATENDIDO');
        const isRtdValid = !exigeRtd || rtdNumber.trim() !== '';
        const isSaveDisabled = loading || !allItemsSelected || !isRtdValid;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 relative flex flex-col max-h-[90vh]">
              
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Definir Status da RM #{treatingRm.rmNumber}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Requisitante: <strong className="font-semibold text-slate-700">{treatingRm.solicitante}</strong> • Setor: <strong className="font-semibold text-slate-700">{treatingRm.setor}</strong>
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setIsTreatmentModalOpen(false);
                    setTreatingRm(null);
                    setItemStatuses({});
                    setItemQuantities({});
                    setRtdNumber('');
                    setRmFilhaNumber('');
                    setDaughterRms([]);
                    setDaughterDecisions({});
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Form Scrollable container */}
              <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avaliação de Itens ({treatingRm.itens.length})</p>
                
                <div className="space-y-3">
                  {treatingRm.itens.map((it) => (
                    <div key={it.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs font-bold text-slate-800 break-words leading-tight">{it.material}</span>
                        <span className="text-2xs font-mono font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                          Qtd Pedida: {it.quantidade} {it.unidade}
                        </span>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                            <input
                              type="radio"
                              name={`status-${it.id}`}
                              value="COMPRA"
                              checked={itemStatuses[it.id] === 'COMPRA'}
                              onChange={() => {
                                setItemStatuses(prev => ({ ...prev, [it.id]: 'COMPRA' }));
                              }}
                              className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            />
                            COMPRA
                          </label>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                            <input
                              type="radio"
                              name={`status-${it.id}`}
                              value="ATENDIDO"
                              checked={itemStatuses[it.id] === 'ATENDIDO'}
                              onChange={() => {
                                setItemStatuses(prev => ({ ...prev, [it.id]: 'ATENDIDO' }));
                              }}
                              className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            />
                            ATENDIDO
                          </label>
                        </div>

                        {itemStatuses[it.id] === 'ATENDIDO' && (
                          <div className="flex items-center gap-2 shrink-0 animate-fade-in">
                            <span className="text-2xs font-semibold text-slate-500">Qtd Atendida:</span>
                            <input
                              type="number"
                              min={0}
                              max={it.quantidade}
                              value={itemQuantities[it.id] ?? ''}
                              onChange={(e) => {
                                const val = Math.min(it.quantidade, Math.max(0, Number(e.target.value)));
                                setItemQuantities(prev => ({ ...prev, [it.id]: val }));
                              }}
                              className="w-20 text-xs bg-white border border-slate-200 rounded-lg p-1.5 font-bold text-slate-700 text-center outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Banner de aviso da Maternidade para Itens em Compra */}
                {exigeRmFilha && (
                  <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl space-y-1 animate-fade-in">
                    <div className="flex items-center gap-1.5 text-purple-950 font-extrabold text-xs">
                      <Baby className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>Retenção na Maternidade (Atendimento Parcial)</span>
                    </div>
                    <p className="text-[11px] text-purple-900 leading-relaxed font-medium">
                      Esta RM possui item(ns) para Compra. Ao concluir a triagem, ela será retida na <strong>Maternidade (Aguardando Desmembramento)</strong>. O Backoffice informará o número da RM Filha lá para liberá-la para aprovação.
                    </p>
                  </div>
                )}

                {/* RMs Filhas Vinculadas (Relação 1:N - Tratamento Individual) */}
                {(loadingDaughterRms || daughterRms.length > 0) && (
                  <div className="space-y-3 border-t border-slate-100 pt-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                        <span>🛒 RMs Filhas Vinculadas ({daughterRms.length})</span>
                      </p>
                      {loadingDaughterRms && (
                        <span className="text-[10px] text-purple-600 font-semibold animate-pulse">Carregando RMs filhas...</span>
                      )}
                    </div>

                    {daughterRms.map((d) => (
                      <div key={d.rmNumber} className="bg-purple-50/80 border border-purple-200 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-black text-purple-950 block">
                              RM Filha #{d.rmNumber}
                            </span>
                            <span className="text-[10px] text-purple-700 font-medium block">
                              Mãe #{d.rm_mae_id} • {d.itens.length} item(ns)
                            </span>
                          </div>

                          {/* Controles de Decisão Independentes */}
                          <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-xl border border-purple-200 shadow-2xs">
                            <label className="flex items-center gap-1 text-xs font-extrabold text-emerald-700 cursor-pointer">
                              <input
                                type="radio"
                                name={`daughter-decision-${d.rmNumber}`}
                                value="Aprovar"
                                checked={daughterDecisions[d.rmNumber] === 'Aprovar'}
                                onChange={() => {
                                  setDaughterDecisions(prev => ({ ...prev, [d.rmNumber]: 'Aprovar' }));
                                }}
                                className="w-3.5 h-3.5 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                              />
                              Aprovar
                            </label>

                            <label className="flex items-center gap-1 text-xs font-extrabold text-rose-700 cursor-pointer">
                              <input
                                type="radio"
                                name={`daughter-decision-${d.rmNumber}`}
                                value="Reprovar"
                                checked={daughterDecisions[d.rmNumber] === 'Reprovar'}
                                onChange={() => {
                                  setDaughterDecisions(prev => ({ ...prev, [d.rmNumber]: 'Reprovar' }));
                                }}
                                className="w-3.5 h-3.5 text-rose-600 border-slate-300 focus:ring-rose-500"
                              />
                              Reprovar
                            </label>
                          </div>
                        </div>

                        {/* Itens da RM Filha */}
                        <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                          {d.itens.map((it, idx) => (
                            <div key={it.id || idx} className="text-[11px] bg-white p-2 rounded-lg border border-purple-100 flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-800 flex-1 leading-tight">{it.material}</span>
                              <span className="font-mono font-extrabold text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                                {it.quantidade} {it.unidade}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input de Número de RTD */}
                <div className="space-y-1.5 border-t border-slate-100 pt-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    📝 Número da RTD {exigeRtd && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="text"
                    placeholder="Digite o número da RTD..."
                    value={rtdNumber}
                    onChange={(e) => setRtdNumber(e.target.value)}
                    className="w-full text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold text-slate-800"
                  />
                  {exigeRtd && rtdNumber.trim() === '' && (
                    <p className="text-[10px] text-rose-500 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      O número da RTD é obrigatório pois há item(ns) marcado(s) como ATENDIDO.
                    </p>
                  )}
                </div>

              </div>

              {/* Footer */}
              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsTreatmentModalOpen(false);
                    setTreatingRm(null);
                    setItemStatuses({});
                    setItemQuantities({});
                    setRtdNumber('');
                    setRmFilhaNumber('');
                    setDaughterRms([]);
                    setDaughterDecisions({});
                  }}
                  className="flex-1 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTreatmentModal}
                  disabled={isSaveDisabled}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:cursor-not-allowed"
                >
                  {loading ? 'Salvando...' : 'Confirmar Decisão'}
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ====================================================================
          MODAL DE REVISÃO DE RECOMENDAÇÃO OPERACIONAL AO TRANSFERIR APROVADOR
          ==================================================================== */}
      {isTransferModalOpen && transferringRm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 relative flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Revisão de Recomendação Operacional
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  RM #{transferringRm.rmNumber} • Requisitante: {transferringRm.solicitante}
                </p>
              </div>
              <button 
                onClick={handleCancelTransfer}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
              <p>
                Você está transferindo a RM para a fila de <strong className="text-slate-800 font-extrabold">{pendingNewApprover}</strong>. 
                A recomendação atual é: <strong className="text-slate-800 font-extrabold">"{transferringRm.acao_recomendada || 'Não definida'}"</strong>.
              </p>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Nova Recomendação Operacional
                </label>
                <select
                  value={pendingNewRecommendation}
                  onChange={(e) => setPendingNewRecommendation(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-indigo-500 font-bold text-slate-700 cursor-pointer"
                >
                  {transferringRm.acao_recomendada && 
                   transferringRm.acao_recomendada !== 'Aprovar no Approvo (Atender/Comprar)' && 
                   transferringRm.acao_recomendada !== 'Reprovar no Approvo (Reaproveitamento)' && (
                    <option value={transferringRm.acao_recomendada}>Manter Atual: {transferringRm.acao_recomendada}</option>
                  )}
                  <option value="Aprovar no Approvo (Atender/Comprar)">Aprovar no Approvo (Atender/Comprar)</option>
                  <option value="Reprovar no Approvo (Reaproveitamento)">Reprovar no Approvo (Reaproveitamento)</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancelTransfer}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all border border-slate-200"
              >
                Cancelar Transferência
              </button>
              <button
                type="button"
                onClick={handleConfirmTransferApprover}
                disabled={loading || !pendingNewRecommendation}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:cursor-not-allowed"
              >
                Confirmar Transferência
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL DE DIRECIONAMENTO EXPRESSO (DECISÃO DIRETA / BYPASS DE TRIAGEM)
          ==================================================================== */}
      {isBypassModalOpen && bypassRm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-purple-200 space-y-4 relative flex flex-col animate-scale-in">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-purple-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                    <Zap className="w-5 h-5" />
                  </span>
                  <h3 className="text-base font-black text-slate-900">
                    Decisão Direta (Direcionamento Expresso)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  RM <strong className="font-bold text-slate-800">#{bypassRm.rmNumber}</strong> • Requisitante: <strong className="font-medium text-slate-700">{bypassRm.solicitante}</strong>
                </p>
              </div>
              <button
                onClick={() => {
                  setIsBypassModalOpen(false);
                  setBypassRm(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 text-xs text-slate-700">
              {/* Banner de Aviso */}
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <p className="text-[11px] font-medium leading-relaxed">
                  Esta ação envia a RM diretamente para a aba de <strong>Aprovadores</strong>, pulando a etapa de triagem. A operação será registrada com a tag <strong>⚡ RM COM DECISÃO DIRETA</strong>.
                </p>
              </div>

              {/* 1. Aprovador Destino */}
              <div className="space-y-1.5">
                <label className="block font-black text-slate-800 text-xs uppercase tracking-wider">
                  Aprovador Destino <span className="text-rose-500">*</span>
                </label>
                <select
                  value={bypassApprover}
                  onChange={(e) => setBypassApprover(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none cursor-pointer"
                >
                  <option value="">Selecione o Aprovador...</option>
                  <option value="André">André</option>
                  <option value="Maicon">Maicon</option>
                  <option value="Fábio">Fábio</option>
                  {bypassRm.proximosAprov && !['André', 'Maicon', 'Fábio'].includes(bypassRm.proximosAprov) && (
                    <option value={bypassRm.proximosAprov}>{bypassRm.proximosAprov}</option>
                  )}
                </select>
              </div>

              {/* 2. Decisão / Orientação */}
              <div className="space-y-1.5">
                <label className="block font-black text-slate-800 text-xs uppercase tracking-wider">
                  Decisão / Orientação <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-black text-xs cursor-pointer transition-all ${
                      bypassDecision === 'Aprovar'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-2xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="bypassDecision"
                      value="Aprovar"
                      checked={bypassDecision === 'Aprovar'}
                      onChange={() => setBypassDecision('Aprovar')}
                      className="sr-only"
                    />
                    <CheckCircle2 className={`w-4 h-4 ${bypassDecision === 'Aprovar' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span>Aprovar</span>
                  </label>

                  <label
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-black text-xs cursor-pointer transition-all ${
                      bypassDecision === 'Reprovar'
                        ? 'border-rose-500 bg-rose-50 text-rose-800 shadow-2xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="bypassDecision"
                      value="Reprovar"
                      checked={bypassDecision === 'Reprovar'}
                      onChange={() => setBypassDecision('Reprovar')}
                      className="sr-only"
                    />
                    <XCircle className={`w-4 h-4 ${bypassDecision === 'Reprovar' ? 'text-rose-600' : 'text-slate-400'}`} />
                    <span>Reprovar</span>
                  </label>
                </div>
              </div>

              {/* 3. Justificativa (Opcional) */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700 text-xs uppercase tracking-wider">
                  Justificativa / Motivo <span className="text-slate-400 font-normal">(Opcional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Digite o motivo ou parecer para este direcionamento expresso..."
                  value={bypassJustification}
                  onChange={(e) => setBypassJustification(e.target.value)}
                  className="w-full text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500/20 font-medium text-slate-800 resize-none"
                />
              </div>
            </div>

            {/* Footer / Buttons */}
            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsBypassModalOpen(false);
                  setBypassRm(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmBypassDirectDecision}
                disabled={loading || !bypassApprover}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? 'Processando...' : 'Confirmar Direcionamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL DE CONFIRMAÇÃO DE APROVAÇÃO / REPROVAÇÃO (APROVVO)
          ==================================================================== */}
      {approvalConfirmModal && approvalConfirmModal.isOpen && approvalConfirmModal.req && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className={`p-5 flex items-center gap-3 border-b ${
              approvalConfirmModal.decision === 'Aprovado' 
                ? 'bg-emerald-50 text-emerald-900 border-emerald-100' 
                : 'bg-rose-50 text-rose-900 border-rose-100'
            }`}>
              <div className={`p-2.5 rounded-xl ${
                approvalConfirmModal.decision === 'Aprovado' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'bg-rose-100 text-rose-700'
              }`}>
                {approvalConfirmModal.decision === 'Aprovado' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <XCircle className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight">
                  Confirmar {approvalConfirmModal.decision === 'Aprovado' ? 'Aprovação' : 'Reprovação'}
                  {approvalConfirmModal.isCombo && ' (Combo)'}
                </h3>
                <p className="text-xs opacity-80 font-medium">
                  Ação requer confirmação para atualizar o banco de dados
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {approvalConfirmModal.isCombo && approvalConfirmModal.linkedRmNumber ? (
                <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-semibold leading-relaxed">
                  <span className="font-bold block mb-1">📦 Atendimento Parcial (Combo Ativo):</span>
                  Esta ação definirá como <strong className="uppercase underline font-bold">{approvalConfirmModal.decision}</strong> simultaneamente a <strong className="font-mono bg-purple-100 px-1.5 py-0.5 rounded">RM #{approvalConfirmModal.req.rmNumber}</strong> e a RM vinculada <strong className="font-mono bg-purple-100 px-1.5 py-0.5 rounded">RM #{approvalConfirmModal.linkedRmNumber}</strong>.
                </div>
              ) : (
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Tem certeza de que deseja marcar a <strong className="text-slate-900 font-bold font-mono">RM #{approvalConfirmModal.req.rmNumber}</strong> como <strong className={`font-bold uppercase ${
                    approvalConfirmModal.decision === 'Aprovado' ? 'text-emerald-700' : 'text-rose-700'
                  }`}>{approvalConfirmModal.decision}</strong>?
                </p>
              )}

              {/* Resumo da Requisição */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Solicitante:</span>
                  <span className="font-semibold text-slate-800">{approvalConfirmModal.req.solicitante || 'Não informado'}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Obra / Centro de Custo:</span>
                  <span className="font-semibold text-slate-800">{approvalConfirmModal.req.centroCusto || 'Não informado'}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Qtd Itens:</span>
                  <span className="font-semibold text-slate-800">{approvalConfirmModal.req.itens?.length || 0} item(ns)</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 italic">
                * A alteração será sincronizada no banco de dados e a requisição sairá da fila de pendências.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setApprovalConfirmModal(null)}
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmApprovalAction}
                disabled={loading}
                className={`px-5 py-2 rounded-xl text-white font-black text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
                  approvalConfirmModal.decision === 'Aprovado'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {loading ? (
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    {approvalConfirmModal.decision === 'Aprovado' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    Confirmar {approvalConfirmModal.decision}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL DE DRILL-DOWN DOS INDICADORES DE STATUS
          ==================================================================== */}
      {statusModal !== null && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setStatusModal(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl border border-slate-200 space-y-4 relative flex flex-col max-h-[85vh] text-left animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                  Resumo de Requisições: {statusModal}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visualizando {modalFilteredRMs.length} {modalFilteredRMs.length === 1 ? 'requisição correspondente' : 'requisições correspondentes'} no período selecionado
                </p>
              </div>
              <button 
                onClick={() => setStatusModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 pr-1 max-h-[60vh]">
              {modalFilteredRMs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Package className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
                  <p className="text-xs font-bold uppercase tracking-wider">Nenhuma requisição encontrada</p>
                  <p className="text-[11px] text-slate-400">Não há dados correspondentes para o status "{statusModal}" no período atual.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        <th className="py-2.5 px-3">Número da RM</th>
                        <th className="py-2.5 px-3">Data Solicitação</th>
                        <th className="py-2.5 px-3">Requisitante / Setor</th>
                        <th className="py-2.5 px-3 text-center">Total Itens</th>
                        <th className="py-2.5 px-3 text-right">Urgência</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {modalFilteredRMs.map((rm) => (
                        <tr key={rm.rmNumber} className="hover:bg-slate-50/80 transition-colors text-xs text-slate-700">
                          <td className="py-3 px-3 font-black text-indigo-600">{rm.rmNumber}</td>
                          <td className="py-3 px-3 text-slate-500 font-medium">{rm.dataSolicitacao ? formatDateBR(rm.dataSolicitacao) : 'Não informada'}</td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-800">{rm.solicitante}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{rm.setor}</div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 uppercase">
                              {rm.itens?.length || 0} { (rm.itens?.length || 0) === 1 ? 'item' : 'itens' }
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                              rm.urgencia === 'Alta' || rm.urgencia === 'Crítica'
                                ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                : rm.urgencia === 'Média'
                                ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                : 'bg-slate-50 text-slate-600 border border-slate-150'
                            }`}>
                              {rm.urgencia}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setStatusModal(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-[11px] font-black uppercase tracking-wider text-white rounded-xl transition cursor-pointer"
              >
                Fechar Detalhes
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ====================================================================
          ESTRUTURA PRINCIPAL (SIDEBAR FIXA + ÁREA DE CONTEÚDO EXPANDIDA)
          ==================================================================== */}
      <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
        
        {/* 1. SIDEBAR FIXA (ESQUERDA) */}
        {!isTVMode && (
          <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col h-full z-10 shadow-sm">
            {/* Cabeçalho da Sidebar */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-800 leading-tight">
                  Diligenciamento<br/>
                  <span className="text-sm font-medium text-slate-500">de Requisições</span>
                </h1>
              </div>
              {onBackToHub && (
                <button 
                  onClick={onBackToHub}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  title="Voltar ao Hub de Sistemas"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Navegação de Abas */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {abas.map((aba) => (
                <button 
                  key={aba.id}
                  onClick={() => setActiveView(aba.id as any)}
                  className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ease-in-out transform hover:translate-x-1 hover:shadow-sm cursor-pointer ${
                    activeView === aba.id 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'text-slate-600 bg-transparent hover:bg-indigo-50 hover:text-indigo-700'
                  }`}
                >
                  {aba.icone} <span className="ml-3">{aba.label}</span>
                  {aba.badge !== undefined && (
                    <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold ${
                      activeView === aba.id ? 'bg-indigo-700 text-white' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {aba.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Rodapé da Sidebar com o Status do Sistema / Robô */}
            <div className="p-3 border-t border-slate-100 bg-slate-50 mt-auto">
              <StatusRobo />
            </div>
          </aside>
        )}

        {/* 2. ÁREA PRINCIPAL EXPANDIDA (DIREITA) */}
        <main className="flex-1 flex flex-col h-full w-full overflow-hidden relative">
          
          {/* Topbar (Ações Globais e Busca) */}
          {!isTVMode && (
            <header className="w-full bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10 shadow-sm min-h-20 shrink-0 gap-4">
              {/* GRUPO ESQUERDO: Buscas e Filtros */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* BARRA DE PESQUISA GLOBAL (BUSCA UNIFICADA COM AUTOCOMPLETE) */}
                <div ref={searchContainerRef} className="relative flex-1 min-w-[200px] sm:min-w-[260px] max-w-md">
                  <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 transform -translate-y-1/2 pointer-events-none z-10 text-blue-500" />
                  <input
                    type="search"
                    placeholder="Pesquisar RM, material, requisitante..."
                    value={searchQuery}
                    onFocus={() => {
                      if (searchQuery.trim().length > 2) setShowAutocomplete(true);
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchQuery(val);
                      setHistoricoSearchQuery(val);
                      setTvSearchQuery(val);
                      if (val.trim().length > 2) {
                        setShowAutocomplete(true);
                      } else {
                        setShowAutocomplete(false);
                      }
                    }}
                    className="w-full bg-blue-50 border border-blue-200 text-blue-900 placeholder-blue-400 focus:bg-blue-100 focus:ring-blue-300 focus:border-blue-300 transition-colors pl-9 pr-7 py-2 rounded-xl text-xs font-semibold"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setHistoricoSearchQuery('');
                        setTvSearchQuery('');
                        setShowAutocomplete(false);
                      }}
                      className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-xs font-bold cursor-pointer z-10 text-blue-400 hover:text-blue-600"
                      title="Limpar busca"
                    >
                      ✕
                    </button>
                  )}

                  {/* DROPDOWN DE AUTOCOMPLETE */}
                  {showAutocomplete && autocompleteResults.length > 0 && (
                    <div className="absolute top-full mt-1 w-full bg-white shadow-lg rounded-md border border-blue-200 z-50 max-h-80 overflow-y-auto divide-y divide-slate-100 p-1.5">
                      <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-blue-500 flex items-center justify-between">
                        <span>Resultados da Busca Master</span>
                        <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono">{autocompleteResults.length} RMs</span>
                      </div>
                      {autocompleteResults.map((rm) => {
                        const target = getRMTargetTab(rm);
                        const firstMat = rm.itens && rm.itens[0] ? rm.itens[0].material : '';
                        return (
                          <button
                            key={rm.id || rm.rmNumber}
                            type="button"
                            onClick={() => handleSelectAutocompleteItem(rm)}
                            className="w-full text-left p-2.5 rounded-md hover:bg-blue-50/80 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs text-blue-950 group-hover:text-blue-700">
                                  RM {rm.rmNumber}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                  {target.label}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
                                {rm.solicitante ? `RM ${rm.rmNumber} • ${rm.solicitante}` : `RM ${rm.rmNumber}`}{firstMat ? ` • ${firstMat}` : ''}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 shrink-0 transition-colors" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {showAutocomplete && searchQuery.trim().length > 2 && autocompleteResults.length === 0 && (
                    <div className="absolute top-full mt-1 w-full bg-white shadow-lg rounded-md border border-blue-200 z-50 p-3 text-center text-xs text-slate-500">
                      Nenhuma RM encontrada para "<span className="font-bold text-slate-700">{searchQuery}</span>".
                    </div>
                  )}
                </div>

                {/* Compact Date Range Picker Popover */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 text-xs font-black uppercase rounded-xl flex items-center gap-2 border border-transparent transition-all cursor-pointer shadow-2xs"
                  >
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {filterStartDate || filterEndDate ? (
                        <>
                          {filterStartDate ? formatDateBR(filterStartDate) : 'Início'}
                          {' - '}
                          {filterEndDate ? formatDateBR(filterEndDate) : 'Fim'}
                        </>
                      ) : (
                        'Filtrar Período'
                      )}
                    </span>
                    <span className="text-[10px] text-slate-400">▼</span>
                  </button>

                  {/* Popover Card */}
                  {showDatePicker && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowDatePicker(false)} />
                      <div className="absolute left-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-20 space-y-3 animate-fade-in text-left">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Filtrar por Período</span>
                          {(filterStartDate || filterEndDate) && (
                            <button
                              onClick={() => {
                                setFilterStartDate('');
                                setFilterEndDate('');
                                setShowDatePicker(false);
                              }}
                              className="text-[9px] font-black text-rose-500 uppercase hover:underline"
                            >
                              Limpar
                            </button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase block">Data Inicial</label>
                            <input
                              type="date"
                              value={filterStartDate}
                              onChange={(e) => setFilterStartDate(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-2.5 py-1.5 rounded-lg focus:border-indigo-500 focus:outline-hidden transition"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase block">Data Final</label>
                            <input
                              type="date"
                              value={filterEndDate}
                              onChange={(e) => setFilterEndDate(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-2.5 py-1.5 rounded-lg focus:border-indigo-500 focus:outline-hidden transition"
                            />
                          </div>
                        </div>

                        <div className="pt-1 flex justify-end">
                          <button
                            onClick={() => setShowDatePicker(false)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-[10px] font-black uppercase text-white rounded-lg transition cursor-pointer"
                          >
                            Aplicar Filtro
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Filtro de Centro de Custo / Setor */}
                <div className="relative flex items-center bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-1.5 shadow-2xs transition-all shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0 pointer-events-none" />
                  <select
                    id="filtro-centro-custo-select"
                    value={filtroCC}
                    onChange={(e) => setFiltroCC(e.target.value)}
                    className="bg-transparent border-none text-xs text-slate-700 font-bold focus:ring-0 cursor-pointer outline-none pl-2 pr-5 appearance-none max-w-44 sm:max-w-56 truncate"
                    title="Filtrar por Centro de Custo / Setor"
                  >
                    <option value="TODOS">Todos os Centros de Custo</option>
                    {centrosDeCustoUnicos.map((cc) => (
                      <option key={cc} value={cc}>
                        {cc}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 pointer-events-none text-[10px] text-slate-400">▼</div>
                </div>

                {/* Filtro de Almoxarife (Aba Triagem) */}
                {activeView === 'triagem' && (
                  <div className="relative flex items-center shrink-0">
                    <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none z-10" />
                    <select
                      value={filtroAlmoxarife}
                      onChange={(e) => setFiltroAlmoxarife(e.target.value)}
                      className="pl-8 pr-7 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 text-xs font-black uppercase rounded-xl border border-transparent focus:border-indigo-500 focus:bg-white transition-all cursor-pointer shadow-2xs appearance-none font-sans"
                    >
                      <option value="Todos">Todos os Almoxarifes</option>
                      {COLABORADORES.map((colab) => (
                        <option key={colab} value={colab}>
                          {colab}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-2.5 pointer-events-none text-[10px] text-slate-400">▼</div>
                  </div>
                )}

                {/* Botão Limpar Filtros (Reset Rápido) */}
                {(searchQuery !== '' || filtroCC !== 'TODOS' || filterStartDate !== '' || filterEndDate !== '' || filtroAlmoxarife !== 'Todos') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setHistoricoSearchQuery('');
                      setTvSearchQuery('');
                      setShowAutocomplete(false);
                      setFiltroCC('TODOS');
                      setFilterStartDate('');
                      setFilterEndDate('');
                      setFiltroAlmoxarife('Todos');
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0 select-none animate-in fade-in zoom-in-95 duration-150"
                    title="Redefinir busca, centro de custo, datas e filtros"
                  >
                    <FilterX className="w-3.5 h-3.5" />
                    <span>Limpar Filtros</span>
                  </button>
                )}
              </div>

              {/* GRUPO DIREITO: Ações e Status */}
              <div className="flex items-center gap-2.5 shrink-0">
                <NetworkStatusIndicator />

                <button
                  type="button"
                  onClick={exportarRelatorioGeral}
                  disabled={isExportingReport}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Exportar Relatório Geral e Global de RMs (Supabase)"
                >
                  {isExportingReport ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
                  )}
                  <span className="hidden md:inline">
                    {isExportingReport ? 'Gerando...' : 'Relatório Global'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowResyncModal(true)}
                  disabled={loading || isResyncing}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:shadow"
                  title="Forçar Re-Sincronização do Aprovo / Depuração de Payload"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-white ${isResyncing ? 'animate-spin' : ''}`} />
                  <span className="hidden lg:inline">Forçar Re-Sincronização</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    fetchRMs();
                    showToast('Dados atualizados com sucesso!', 'success');
                  }}
                  disabled={loading}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  title="Atualizar dados do banco manualmente"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${loading ? 'animate-spin' : ''}`} />
                  <span>Atualizar</span>
                </button>

                {isLoggedIn && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    title="Encerrar sessão administrativa"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
                    <span>Sair</span>
                  </button>
                )}
              </div>
            </header>
          )}

          {/* Área Rolável do Conteúdo (Cards) */}
          <div className={`flex-1 overflow-y-auto ${activeView === 'tv' ? 'p-0 bg-slate-950' : 'p-6'} w-full`}>

            {/* ====================================================================
                VISÃO 1: ALMOXARIFADO / DILIGENCIAMENTO
                ==================================================================== */}
            {activeView === 'principal' && (() => {
              const userPerfil = (authSession?.perfil as string) || '';
              const isAlmoxarifeCentral = userPerfil === 'Almoxarife Central' || userPerfil === 'Almoxarifado' || userPerfil === 'ALMOXARIFADO' || userPerfil === 'Administrador' || userPerfil === 'ADMIN';
              if (!isAlmoxarifeCentral) {
                return (
                  <div className="w-full text-center">
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-xs max-w-md mx-auto mt-12 space-y-4">
                      <div className="mx-auto w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
                        <Lock className="w-8 h-8" />
                      </div>
                      <h2 className="text-lg font-bold text-slate-800">Acesso Restrito</h2>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Esta tela (Diligenciamento) é de acesso restrito e exclusivo para usuários com o perfil de <strong className="text-slate-700">Almoxarife Central</strong>.
                      </p>
                      <button
                        onClick={() => setActiveView('triagem')}
                        className="w-full py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        Ir para a Triagem
                      </button>
                    </div>
                  </div>
                );
              }

              return (
              <div className="w-full space-y-6">
          {/* Card de Estatísticas Rápidas */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Total RMs</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">{loading ? '...' : stats.total}</h3>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <button 
              onClick={() => setStatusModal('PENDENTES')}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between text-left cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200"
            >
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Pendentes</p>
                <h3 className="text-2xl font-bold text-amber-600 mt-1">{loading ? '...' : stats.pendentes}</h3>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
            </button>
            <button 
              onClick={() => setStatusModal('APROVADAS')}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between text-left cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200"
            >
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Aprovadas</p>
                <h3 className="text-2xl font-bold text-emerald-600 mt-1">{loading ? '...' : stats.aprovados}</h3>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle className="w-5 h-5" />
              </div>
            </button>
            <button 
              onClick={() => setStatusModal('REPROVADAS')}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between text-left cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200"
            >
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Reprovadas/Outros</p>
                <h3 className="text-2xl font-bold text-rose-600 mt-1">{loading ? '...' : stats.cancelados}</h3>
              </div>
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <X className="w-5 h-5" />
              </div>
            </button>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Total de Itens</p>
                <h3 className="text-2xl font-bold text-blue-600 mt-1">{loading ? '...' : stats.totalItens}</h3>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Total Quantidade</p>
                <h3 className="text-2xl font-bold text-slate-700 mt-1">
                  {loading ? '...' : (typeof stats.totalQuantidade === 'number' ? stats.totalQuantidade.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : stats.totalQuantidade)}
                </h3>
              </div>
              <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
                <Hash className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filtros Rápidos (tipoRM / categoria) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs font-semibold text-slate-400 self-center mr-2 uppercase tracking-wider">Tipo/Categoria:</span>
              {['Todas', 'Estoque', 'Pré-Cotação', 'Pré-Cotação Técnica', 'CC99'].map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    selectedType === type
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Grid de Cards por RM */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <RefreshCw className="mx-auto w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs text-slate-500 mt-2 font-medium">Carregando dados das requisições...</p>
            </div>
          ) : principalRequisitions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <AlertCircle className="mx-auto w-10 h-10 text-slate-400 mb-2" />
              <p className="text-sm font-semibold text-slate-700">Nenhuma requisição aguardando tratamento</p>
              <p className="text-xs text-slate-400">Tente ajustar seus filtros ou aguarde novas atualizações.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {principalRequisitions.map((req) => (
                <div 
                  key={req.rmNumber} 
                  className="bg-white border border-slate-200 rounded-2xl shadow-xs hover:shadow-md hover:border-slate-300 transition-all p-5 flex flex-col justify-between"
                >
                  <div>
                {/* Cabeçalho do Card */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="font-extrabold text-slate-900 text-lg tracking-tight">RM {req.rmNumber}</span>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {getUrgencyBadge(req.dataNecessidade)}
                          {req.tipoRM && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 uppercase border border-indigo-100">
                              {req.tipoRM}
                            </span>
                          )}
                          {req.decisao_direta && (
                            <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded border border-purple-300 flex items-center gap-1">
                              ⚡ RM COM DECISÃO DIRETA
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {getStatusBadge(req.status)}
                      </div>
                    </div>

                    {/* Corpo do Card (Sub-header) */}
                    <div className="space-y-1 mb-4 border-t border-slate-100 pt-3">
                      <div className="text-[11px] text-slate-400 font-medium">
                        Emissão: <span className="font-semibold text-slate-600">{req.dataSolicitacao}</span> | Necessidade: <span className="font-semibold text-slate-600">{req.dataNecessidade}</span>
                      </div>
                      <div className="text-xs text-slate-600 flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">Requisitante:</span> {req.solicitante} <span className="text-slate-300">•</span> <span className="italic text-slate-500">{req.setor}</span>
                      </div>
                      {req.classeFinanceira && (
                        <div className="text-[10px] text-slate-400 mt-1 line-clamp-1" title={req.classeFinanceira}>
                          <span className="font-bold text-slate-500">Classe Financeira:</span> <span className="italic">{req.classeFinanceira}</span>
                        </div>
                      )}
                    </div>

                    {/* Corpo do Card (Motivo) */}
                    {req.motivo && (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Motivo da RM</p>
                        <p className="text-xs text-slate-700 font-medium italic line-clamp-2 leading-relaxed">
                          "{req.motivo}"
                        </p>
                      </div>
                    )}

                    {/* Corpo do Card (Lista de Itens) */}
                    <div className="border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Itens ({req.itens.length})</h4>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          {req.categoria}
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {req.itens.map((it) => {
                          const isPendente = isItemNaoIdentificado(it);
                          return (
                            <div 
                              key={it.id} 
                              className={`flex items-start gap-2 text-xs p-2 rounded-xl border transition-colors ${
                                isPendente 
                                  ? 'bg-amber-50/80 border-amber-300 text-amber-900' 
                                  : 'bg-slate-50/50 border-slate-100 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span className={`font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                isPendente ? 'bg-amber-200 text-amber-950 font-extrabold' : 'text-indigo-600 bg-indigo-50'
                              }`}>
                                {it.quantidade} {it.unidade}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className="text-slate-800 font-medium break-words leading-tight block">
                                  {it.material}
                                </span>
                                {isPendente && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded mt-1 border border-amber-300">
                                    <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                    Item não identificado / Incompleto
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Parecer do Diligenciador se existir */}
                  {req.parecerDiligenciador && (
                    <div className="mt-4 pt-3 border-t border-slate-100 bg-amber-50/40 p-2.5 rounded-xl border border-amber-100/50 text-[11px] text-amber-900 font-semibold flex gap-1.5 items-start">
                      <HelpCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <span className="font-bold text-amber-800">Parecer: </span>
                        {req.parecerDiligenciador}
                      </div>
                    </div>
                  )}

                  {/* ==========================================
                      WORKFLOW DE DILIGENCIAMENTO (MÁQUINA DE ESTADOS)
                      ========================================== */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                    {(!req.status_interno || req.status_interno === 'Aguardando Tratamento' || !req.tratado_por || req.tratado_por === 'AGUARDANDO ASSUNÇÃO' || String(req.tratado_por).trim() === '') && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 font-semibold bg-amber-50 p-2 rounded-lg border border-amber-100">
                          <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                          <span>Status: {!req.tratado_por || req.tratado_por === 'AGUARDANDO ASSUNÇÃO' || String(req.tratado_por).trim() === '' ? 'Aguardando Assunção' : (req.status_interno || 'Aguardando Tratamento')}</span>
                        </div>
                        
                        {hasItensPendentesOuNaoIdentificados(req) ? (
                          <button
                            onClick={() => handleAbrirModalCorrecao(req)}
                            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 border border-amber-600/50 cursor-pointer animate-pulse"
                          >
                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-100" />
                            <span>RESOLVER ITENS PENDENTES</span>
                          </button>
                        ) : assigningRm === req.rmNumber ? (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 animate-fade-in">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Selecione o Colaborador:
                            </label>
                            <select
                              value={selectedColaborador}
                              onChange={(e) => setSelectedColaborador(e.target.value)}
                              className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                              <option value="" disabled>Selecione um colaborador...</option>
                              {COLABORADORES.map((colab) => (
                                <option key={colab} value={colab}>
                                  {colab}
                                </option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setAssigningRm(null);
                                  setSelectedColaborador('');
                                }}
                                className="flex-1 py-1.5 px-3 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleConfirmarTratamento(req, selectedColaborador)}
                                disabled={!selectedColaborador}
                                className="flex-1 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Confirmar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              onClick={() => {
                                setAssigningRm(req.rmNumber);
                                setSelectedColaborador('');
                              }}
                              className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              ATRIBUIR ATENDIMENTO
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setBypassRm(req);
                                setBypassApprover(req.aprovador_destino || '');
                                setBypassDecision('Aprovar');
                                setBypassJustification('');
                                setIsBypassModalOpen(true);
                              }}
                              className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-purple-50 text-purple-700 border border-purple-300 font-bold text-xs shadow-2xs hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Zap className="w-3.5 h-3.5 text-purple-600" />
                              DECISÃO DIRETA
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {req.status_interno === 'Em Tratamento' && (!!req.tratado_por && req.tratado_por !== 'AGUARDANDO ASSUNÇÃO' && String(req.tratado_por).trim() !== '') && (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 text-xs text-blue-700 font-semibold bg-blue-50 p-2 rounded-lg border border-blue-100">
                          <Clock className="w-4 h-4 text-blue-500" />
                          <span>Tratado por: <strong className="font-extrabold text-blue-900">{req.tratado_por || req.agente_tratamento || 'Colaborador'}</strong></span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              setTreatingRm(req);
                              setTreatmentAction('reaproveitamento');
                              setTreatmentApprover(req.aprovador_destino || '');
                              setTreatmentJustification(req.parecerDiligenciador || '');
                              setRtdNumber('');
                              setIsTreatmentModalOpen(true);
                            }}
                            className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-colors"
                          >
                            Reaproveitamento
                          </button>
                          <button
                            onClick={() => {
                              setTreatingRm(req);
                              setTreatmentAction('compra');
                              setTreatmentApprover(req.aprovador_destino || '');
                              setTreatmentJustification(req.parecerDiligenciador || '');
                              setRtdNumber('');
                              setIsTreatmentModalOpen(true);
                            }}
                            className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-xs"
                          >
                            Compra / Estoque
                          </button>
                        </div>
                      </div>
                    )}

                    {req.status_interno === 'Aguardando Aprovador' && (
                      <div className="p-3 rounded-xl bg-amber-500 text-white border border-amber-400 shadow-sm animate-fade-in">
                        <div className="flex items-center gap-1.5 mb-1">
                          <AlertCircle className="w-4 h-4 text-white shrink-0" />
                          <span className="font-bold uppercase tracking-wider text-[9px] text-amber-100">Ação Requerida (Sinalizada):</span>
                        </div>
                        <p className="text-xs font-black uppercase">
                          {req.acao_recomendada || 'Verificar Approvo'}
                        </p>
                        {req.tratado_por && (
                          <div className="mt-1 text-[10px] text-amber-100 font-mono">
                            Diligenciado por: {req.tratado_por}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer de Sincronização */}
          <div className="bg-slate-100 px-6 py-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-xs">
            <span className="text-xs font-semibold text-slate-600">
              Mostrando {principalRequisitions.length} RMs aguardando tratamento ({requisitions.length} registros)
            </span>
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Sincronizado automaticamente a cada 15s
            </span>
          </div>
        </div>
        );
      })()}

      {/* ====================================================================
          NOVA VISÃO: TELA DE TRIAGEM (O RADAR DE TRATAMENTO)
          ==================================================================== */}
      {activeView === 'triagem' && (
        <div className="w-full space-y-6">
          <div className="bg-amber-50 border border-amber-100 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-700 rounded-xl shrink-0">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-amber-950">Radar de Tratamento (Triagem)</h2>
              <p className="text-xs text-amber-800/80 mt-1 max-w-3xl">
                Esta aba exibe as RMs que estão sendo tratadas ativamente pela equipe do Almoxarifado neste momento. Acompanhe em tempo real quem está tratando e o tempo decorrido desde o início do atendimento.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <RefreshCw className="mx-auto w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs text-slate-500 mt-2 font-medium">Carregando dados do Supabase...</p>
            </div>
          ) : triagemRequisitions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <AlertCircle className="mx-auto w-10 h-10 text-slate-400 mb-2" />
              <p className="text-sm font-semibold text-slate-700">Nenhuma RM em tratamento no momento</p>
              <p className="text-xs text-slate-400">As RMs assumidas pelos colaboradores aparecerão aqui com os seus respectivos cronômetros de atendimento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
              {triagemRequisitions.map((req) => (
                <div 
                  key={req.rmNumber} 
                  className="bg-white border border-slate-200 rounded-2xl shadow-xs hover:shadow-md hover:border-slate-300 transition-all p-5 flex flex-col justify-between"
                >
                  <div>
                    {/* Cabeçalho do Card */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="font-extrabold text-slate-900 text-lg tracking-tight">RM {req.rmNumber}</span>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {getUrgencyBadge(req.dataNecessidade)}
                          {req.tipoRM && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 uppercase border border-indigo-100">
                              {req.tipoRM}
                            </span>
                          )}
                          {req.decisao_direta && (
                            <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded border border-purple-300 flex items-center gap-1">
                              ⚡ RM COM DECISÃO DIRETA
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {getStatusBadge(req.status)}
                      </div>
                    </div>

                    {/* Corpo do Card (Sub-header) */}
                    <div className="space-y-1 mb-4 border-t border-slate-100 pt-3">
                      <div className="text-[11px] text-slate-400 font-medium">
                        Emissão: <span className="font-semibold text-slate-600">{req.dataSolicitacao}</span> | Necessidade: <span className="font-semibold text-slate-600">{req.dataNecessidade}</span>
                      </div>
                      <div className="text-xs text-slate-600 flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">Requisitante:</span> {req.solicitante} <span className="text-slate-300">•</span> <span className="italic text-slate-500">{req.setor}</span>
                      </div>
                      {req.classeFinanceira && (
                        <div className="text-[10px] text-slate-400 mt-1 line-clamp-1" title={req.classeFinanceira}>
                          <span className="font-bold text-slate-500">Classe Financeira:</span> <span className="italic">{req.classeFinanceira}</span>
                        </div>
                      )}
                    </div>

                    {/* Destaque do Colaborador & Cronômetro Real-time */}
                    <div className="mb-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs text-indigo-900 font-bold bg-indigo-50 p-2.5 rounded-xl border border-indigo-150">
                        <User className="w-4 h-4 text-indigo-600" />
                        <span>Tratado por: <strong className="font-black text-indigo-950 uppercase">{req.tratado_por || req.agente_tratamento || 'Aguardando Assunção'}</strong></span>
                      </div>
                      <TreatmentTimer dataInicio={req.data_inicio_tratamento} />
                    </div>

                    {/* Corpo do Card (Motivo) */}
                    {req.motivo && (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Motivo da RM</p>
                        <p className="text-xs text-slate-700 font-medium italic line-clamp-2 leading-relaxed">
                          "{req.motivo}"
                        </p>
                      </div>
                    )}

                    {/* Corpo do Card (Lista de Itens) */}
                    <div className="border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Itens ({req.itens.length})</h4>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          {req.categoria}
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {req.itens.map((it) => (
                          <div 
                            key={it.id} 
                            className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50/50 p-2 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
                          >
                            <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">
                              {it.quantidade} {it.unidade}
                            </span>
                            <span className="text-slate-800 font-medium break-words leading-tight">
                              {it.material}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Parecer do Diligenciador se existir */}
                  {req.parecerDiligenciador && (
                    <div className="mt-4 pt-3 border-t border-slate-100 bg-amber-50/40 p-2.5 rounded-xl border border-amber-100/50 text-[11px] text-amber-900 font-semibold flex gap-1.5 items-start">
                      <HelpCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <span className="font-bold text-amber-800">Parecer: </span>
                        {req.parecerDiligenciador}
                      </div>
                    </div>
                  )}

                  {/* Ações de Decisão de Tratamento */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                    <button
                      onClick={() => handlePrintRM(req)}
                      className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 font-bold text-xs border border-indigo-100 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Printer className="w-4 h-4" />
                      Imprimir RM
                    </button>

                    <div className="border-t border-slate-100 pt-2.5">
                      <button
                        onClick={() => {
                          setTreatingRm(req);
                          const initialStatuses: Record<string, 'COMPRA' | 'ATENDIDO'> = {};
                          const initialQuantities: Record<string, number> = {};
                          req.itens.forEach(it => {
                            initialStatuses[it.id] = 'COMPRA';
                            initialQuantities[it.id] = it.quantidade;
                          });
                          setItemStatuses(initialStatuses);
                          setItemQuantities(initialQuantities);
                          setRtdNumber('');
                          setRmFilhaNumber(req.rm_filha_id ? String(req.rm_filha_id) : '');
                          setIsTreatmentModalOpen(true);
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <Sliders className="w-4 h-4" />
                        Definir Status da RM
                      </button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}

          {/* Footer de Sincronização */}
          <div className="bg-slate-100 px-6 py-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-xs">
            <span className="text-xs font-semibold text-slate-600">
              Mostrando {triagemRequisitions.length} RMs em tratamento ({requisitions.length} itens no Supabase)
            </span>
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Sincronizado automaticamente a cada 15s
            </span>
          </div>
        </div>
      )}

      {/* ====================================================================
          VISÃO: DIRECIONAMENTO (FILA GERAL)
          ==================================================================== */}
      {activeView === 'direcionamento' && (() => {
        const queueGeral = aprovadoresRequisitions.filter(req => 
          !req.aprovador_destino || 
          (req.aprovador_destino !== 'André' && req.aprovador_destino !== 'Maicon' && req.aprovador_destino !== 'Fábio')
        );

        // Helper para renderizar card da Fila Geral sem botões de aprovação
        const renderDirecionamentoCard = (req: GroupedRequisition) => {
          // 1. Cálculo do Status Geral (Derivação)
          const itemsStatusList = req.itens.map(it => (it.item_status || 'COMPRA').toUpperCase());
          const allCompra = itemsStatusList.every(s => s === 'COMPRA');
          const allAtendido = itemsStatusList.every(s => s === 'ATENDIDO');
          
          let summary = "MISTA (COMPRA + ESTOQUE)";
          if (allCompra) {
            summary = "COMPRA TOTAL";
          } else if (allAtendido) {
            summary = "ATENDIDO TOTAL (ESTOQUE)";
          }

          return (
            <div 
              key={req.rmNumber} 
              className="bg-white border border-slate-200 rounded-2xl shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3.5">
                {/* Header Card */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="font-extrabold text-indigo-950 text-base tracking-tight">
                      RM {req.rmNumber}
                    </span>
                    <span className="text-2xs block text-slate-500 mt-0.5 font-medium">
                      Solicitante: <strong className="text-slate-700">{req.solicitante}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {getStatusBadge(req.status)}
                  </div>
                </div>

                {/* Banner RM Mãe se houver */}
                {req.rm_filha_id && (
                  <div className="p-2.5 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-950 text-xs font-extrabold flex items-center gap-2 shadow-2xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>⚠️ RM Mãe de Atendimento Parcial. RM Filha gerada: <strong className="font-mono underline text-amber-900">{req.rm_filha_id}</strong></span>
                  </div>
                )}

                {/* Banner RM Filha se houver */}
                {req.rm_mae_id && (
                  <div className="p-2.5 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-950 text-xs font-extrabold flex items-center gap-2 shadow-2xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>⚠️ RM Filha de Atendimento Parcial. Origem: RM Mãe <strong className="font-mono underline text-amber-900">{req.rm_mae_id}</strong></span>
                  </div>
                )}

                {/* Info Setor e Data */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Setor</span>
                    <span className="font-semibold text-slate-700 truncate block">{req.setor}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Data Emissão</span>
                    <span className="font-semibold text-slate-700 block">
                      {(() => {
                        const rawDate = req.dataSolicitacao || (req._raw && (req._raw.data_emissao || req._raw.created_at || req._raw.data_solicitacao)) || req.createdTimestamp;
                        const parsed = getParsedDate(rawDate);
                        if (parsed) {
                          const day = String(parsed.getDate()).padStart(2, '0');
                          const month = String(parsed.getMonth() + 1).padStart(2, '0');
                          const year = parsed.getFullYear();
                          return `${day}/${month}/${year}`;
                        }
                        if (typeof rawDate === 'string' && rawDate.trim()) {
                          return rawDate.trim();
                        }
                        return "--/--/----";
                      })()}
                    </span>
                  </div>
                </div>

                {/* Histórico de Triagem (Accordion Expansível) */}
                <details className={`group border rounded-xl overflow-hidden transition-all duration-300 ${
                  allCompra 
                    ? 'border-amber-200 bg-amber-50/20' 
                    : 'border-emerald-200 bg-emerald-50/20'
                }`}>
                  <summary className={`flex items-center justify-between p-2.5 cursor-pointer select-none list-none font-extrabold text-[10px] uppercase tracking-wider ${
                    allCompra 
                      ? 'text-amber-800 hover:bg-amber-50/50' 
                      : 'text-emerald-800 hover:bg-emerald-50/50'
                  } transition-colors`}>
                    <div className="flex items-center gap-2">
                      <Clock className={`w-3.5 h-3.5 shrink-0 ${allCompra ? 'text-amber-500' : 'text-emerald-500'}`} />
                      <span>Histórico de Triagem</span>
                    </div>
                    <span className={`text-xs transition-transform duration-200 group-open:rotate-180 ${
                      allCompra ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      ▼
                    </span>
                  </summary>
                  
                  <div className={`p-3 border-t space-y-2 text-xs ${
                    allCompra 
                      ? 'border-amber-200 bg-amber-50/40 text-amber-950' 
                      : 'border-emerald-200 bg-emerald-50/40 text-emerald-950'
                  }`}>
                    <div className="flex flex-col gap-1.5">
                      <div className="text-[10px] uppercase font-bold tracking-wide opacity-90">
                        Triagem realizada por: <span className="underline font-black">{req.agente_tratamento || req.tratado_por || 'Almoxarife'}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[10px] uppercase tracking-wider">Status Geral:</span>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                          allCompra 
                            ? 'bg-amber-100/80 text-amber-800 border border-amber-200' 
                            : 'bg-emerald-100/80 text-emerald-800 border border-emerald-200'
                        }`}>
                          {summary}
                        </span>
                      </div>

                      {req.numero_rtd && req.numero_rtd.trim() !== '' && (
                        <div className={`mt-1 p-2 rounded-lg border font-bold text-[10px] uppercase tracking-wider flex items-center justify-between ${
                          allCompra 
                            ? 'bg-amber-100 border-amber-200 text-amber-900' 
                            : 'bg-emerald-100 border-emerald-200 text-emerald-900'
                        }`}>
                          <span>Documento RTD:</span>
                          <span className="font-mono text-xs bg-white px-2 py-0.5 rounded shadow-xs">{req.numero_rtd}</span>
                        </div>
                      )}

                      {/* Parecer / Observação se houver */}
                      {req.parecerDiligenciador && (
                        <div className="mt-1 text-[10.5px]">
                          <span className="font-bold">Parecer/Observação: </span>
                          <span className="italic">{req.parecerDiligenciador}</span>
                        </div>
                      )}

                      {/* Lista detalhada de itens com Atendido vs Compra */}
                      <div className="mt-2.5 pt-2 border-t border-dashed border-slate-200/60">
                        <div className="text-[9px] uppercase font-bold tracking-wider opacity-85 mb-1.5">
                          Resumo de Atendimento dos Itens:
                        </div>
                        <ul className="space-y-1.5">
                          {req.itens.map((it, idx) => {
                            const isItemCompra = (it.item_status || 'COMPRA').toUpperCase() === 'COMPRA';
                            const qtdAtendida = it.quantidade_atendida || 0;
                            const qtdCompra = isItemCompra ? it.quantidade : (it.quantidade - (it.quantidade_atendida || 0));
                            return (
                              <li key={it.id || idx} className="text-[10.5px] leading-relaxed pb-1 border-b border-slate-200/20 last:border-0 last:pb-0">
                                <span className="font-bold text-slate-800">{it.material}</span>
                                <div className="text-[9.5px] text-slate-600 mt-0.5 font-medium">
                                  Atendido (Estoque): <strong className="text-emerald-700 font-extrabold">{qtdAtendida}</strong> | Compra: <strong className="text-blue-700 font-extrabold">{qtdCompra}</strong>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  </div>
                </details>

                {/* MATERIAIS INCLUSOS (Lista de Itens da RM principal) */}
                <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-black text-slate-800 uppercase tracking-wider">
                    <span>📦 MATERIAIS INCLUSOS ({req.itens.length})</span>
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[9.5px] font-bold border border-indigo-100">
                      {req.categoria}
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {req.itens.map((it, idx) => {
                      const statusUpper = (it.item_status || 'COMPRA').toUpperCase();
                      const isComprar = statusUpper === 'COMPRA' || statusUpper === 'COMPRAR';
                      const codigo = (it as any).codigo || (it as any).codigo_material || (it as any)._raw?.codigo || (it as any)._raw?.codigo_material || '';

                      return (
                        <div 
                          key={it.id || idx} 
                          className="flex items-start justify-between gap-2 text-xs bg-slate-50 p-2 rounded-xl border border-slate-200/80 hover:bg-slate-100/60 transition-colors"
                        >
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <span className="font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-150 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                              {it.quantidade} {it.unidade}
                            </span>
                            <div className="min-w-0 flex-1">
                              {codigo && (
                                <span className="font-mono text-[10px] font-bold text-slate-400 block leading-none mb-0.5">
                                  [{codigo}]
                                </span>
                              )}
                              <span className="text-slate-800 font-extrabold break-words leading-tight block">
                                {it.material}
                              </span>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider shrink-0 mt-0.5 border ${
                            isComprar 
                              ? 'bg-blue-100 text-blue-800 border-blue-200' 
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}>
                            {isComprar ? 'Comprar' : 'Estoque'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bloco Unificado: ITENS DA RM FILHA (COMPRA) */}
                {req.rm_filha_id && (() => {
                  const daughterRmNum = String(req.rm_filha_id).trim();
                  const daughterRm = filteredGroupedAllRequisitions.find(r => 
                    String(r.rmNumber) === daughterRmNum || 
                    String((r as any).rm_number || '') === daughterRmNum ||
                    String(r.id) === daughterRmNum
                  );
                  const daughterItens = daughterRm ? daughterRm.itens : requisitions.filter(item => 
                    String(item.rm_number || item.rmNumber || item.id) === daughterRmNum
                  );

                  return (
                    <div className="mt-2.5 pt-2.5 border-t-2 border-dashed border-purple-300 bg-purple-50/70 p-2.5 rounded-xl space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between text-[10px] font-black text-purple-950 uppercase tracking-wider">
                        <span>🛒 ITENS DA RM FILHA (COMPRA - RM #{daughterRmNum})</span>
                        <span className="bg-purple-200 text-purple-950 px-1.5 py-0.5 rounded text-[9px] font-bold">
                          {daughterItens.length} {daughterItens.length === 1 ? 'item' : 'itens'}
                        </span>
                      </div>
                      {daughterItens.length > 0 ? (
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                          {daughterItens.map((it: any, idx: number) => (
                            <div 
                              key={it.id || idx} 
                              className="flex items-start justify-between gap-1.5 text-[11px] text-purple-950 bg-white p-1.5 rounded-lg border border-purple-200 shadow-2xs"
                            >
                              <div className="flex items-start gap-1.5 min-w-0 flex-1">
                                <span className="font-mono font-extrabold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded shrink-0 text-[10px] mt-0.5">
                                  {it.quantidade} {it.unidade}
                                </span>
                                <span className="text-purple-950 font-bold break-words leading-tight flex-1">
                                  {it.material}
                                </span>
                              </div>
                              <span className="px-1.5 py-0.5 text-[8px] font-extrabold rounded-md bg-blue-100 text-blue-700 border border-blue-200 uppercase tracking-wider shrink-0 mt-0.5">
                                COMPRAR
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-purple-700 font-semibold italic">Carregando itens da RM Filha #{daughterRmNum}...</p>
                      )}
                    </div>
                  );
                })()}

                {/* Seletor Universal de Orientação para o Approvo */}
                <div className="pt-2.5 border-t border-slate-100 flex flex-col gap-1">
                  <label className="text-[11px] font-extrabold text-purple-950 flex items-center justify-between">
                    <span>🎯 Orientação para o Approvo:</span>
                    <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 uppercase">Obrigatório</span>
                  </label>
                  <select
                    value={orientacaoComboState[req.rmNumber] || req.orientacao_aprovacao || req.orientacao_combo || req.observacao_combo || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOrientacaoComboState(prev => ({ ...prev, [req.rmNumber]: val }));
                      if (val) {
                        handleSaveOrientacao(req, val);
                      }
                    }}
                    className="text-xs bg-purple-50 hover:bg-purple-100 focus:bg-white border border-purple-300 focus:border-purple-500 rounded-xl px-2.5 py-2 font-black text-purple-950 focus:ring-2 focus:ring-purple-500/20 cursor-pointer w-full shadow-2xs"
                  >
                    <option value="">Selecione a orientação...</option>
                    {req.rm_filha_id ? (
                      <>
                        <option value="Aprovar Mãe / Aprovar Filha">Aprovar Mãe / Aprovar Filha</option>
                        <option value="Reprovar Mãe / Aprovar Filha">Reprovar Mãe / Aprovar Filha</option>
                        <option value="Aprovar Mãe / Reprovar Filha">Aprovar Mãe / Reprovar Filha</option>
                        <option value="Reprovar Mãe / Reprovar Filha">Reprovar Mãe / Reprovar Filha</option>
                      </>
                    ) : (
                      <>
                        <option value="Aprovar">Aprovar</option>
                        <option value="Reprovar">Reprovar</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Seletor de Aprovador Destino */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-700">Selecione o Aprovador:</span>
                  <select
                    value={req.aprovador_destino || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      if (!req.aprovador_destino) {
                        handleAssignApprover(req, val);
                      } else {
                        handleStartTransferApprover(req, val);
                      }
                    }}
                    className="text-xs bg-indigo-50/70 hover:bg-indigo-50 focus:bg-white border border-indigo-200 focus:border-indigo-400 rounded-xl px-3 py-1.5 font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    <option value="André">André</option>
                    <option value="Maicon">Maicon</option>
                    <option value="Fábio">Fábio</option>
                  </select>
                </div>
              </div>
            </div>
          );
        };

        return (
          <div className="w-full space-y-8">
            {/* Header explicativo do painel de Direcionamento */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-2xl border border-indigo-900/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-800/60 text-indigo-300 rounded-xl shrink-0">
                  <GitFork className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight">Painel de Direcionamento</h2>
                  <p className="text-xs text-indigo-200/80 mt-1 max-w-3xl leading-relaxed">
                    Atribua os aprovadores de destino para cada RM triada na Fila Geral para enviá-las às colunas de cobrança ativa.
                  </p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                <RefreshCw className="mx-auto w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-xs text-slate-500 mt-2 font-medium">Carregando dados do Supabase...</p>
              </div>
            ) : queueGeral.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                <AlertCircle className="mx-auto w-10 h-10 text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-700">Nenhuma RM aguardando direcionamento no momento</p>
                <p className="text-xs text-slate-400 mt-1">Todas as RMs estão atribuídas aos aprovadores ou aguardando triagem/maternidade.</p>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="bg-amber-50/50 border border-amber-200 p-5 rounded-2xl space-y-4 shadow-xs">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg shrink-0">
                      <AlertCircle className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-amber-950">Fila Geral ({queueGeral.length} RMs aguardando direcionamento)</h3>
                      <p className="text-xs text-amber-900/70">Escolha o aprovador no seletor de cada card abaixo para enviá-lo à coluna de cobrança ativa.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                    {queueGeral.map((req) => renderDirecionamentoCard(req))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ====================================================================
          VISÃO: MATERNIDADE (TELA EXCLUSIVA)
          ==================================================================== */}
      {activeView === 'maternidade' && (() => {
        return (
          <div className="w-full space-y-8">
            {/* Header explicativo do painel de Maternidade */}
            <div className="bg-gradient-to-r from-purple-950 to-indigo-950 text-white p-6 rounded-2xl border border-purple-900/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-purple-800/60 text-purple-200 rounded-xl shrink-0">
                  <Baby className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight">Painel Exclusivo da Maternidade</h2>
                  <p className="text-xs text-purple-200/80 mt-1 max-w-3xl leading-relaxed">
                    Gestão de RMs interceptadas por Atendimento Parcial. Informe o número da RM Filha gerada para a compra do saldo restante e liberá-la para o Direcionamento.
                  </p>
                </div>
              </div>

              {/* Botão de Resgate Retroativo */}
              <button
                type="button"
                onClick={handleResgatarRmsParciaisAntigas}
                disabled={resgatandoParciais}
                className="px-4 py-2.5 bg-purple-800/80 hover:bg-purple-700 disabled:opacity-60 text-purple-100 border border-purple-600/60 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer self-start md:self-center"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resgatandoParciais ? 'animate-spin' : ''}`} />
                <span>
                  {resgatandoParciais ? 'Vasculhando Banco de Dados...' : '🔄 Resgatar RMs Parciais Antigas'}
                </span>
              </button>
            </div>

            {loading ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                <RefreshCw className="mx-auto w-8 h-8 text-purple-600 animate-spin" />
                <p className="text-xs text-slate-500 mt-2 font-medium">Carregando dados do Supabase...</p>
              </div>
            ) : maternidadeRequisitions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                <Baby className="mx-auto w-10 h-10 text-purple-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">Nenhuma RM retida na Maternidade no momento</p>
                <p className="text-xs text-slate-400 mt-1">RMs de atendimento parcial enviadas na Triagem aparecerão automaticamente nesta aba.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {maternidadeRequisitions.map((req, mIdx) => {
                  const isPending = maternidadeLoading[req.rmNumber];
                  const currentFilhaVal = maternidadeInputs[req.rmNumber] || '';

                  return (
                    <div 
                      key={req.rmNumber || `maternidade-${mIdx}`} 
                      className="bg-white rounded-2xl border border-purple-200 p-5 space-y-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        {/* Header do Card */}
                        <div className="flex items-start justify-between gap-2 border-b border-purple-100 pb-3">
                          <div>
                            <span className="text-sm font-black text-purple-950 bg-purple-100/80 px-2.5 py-0.5 rounded-md font-mono inline-block">
                              RM Mãe #{req.rmNumber}
                            </span>
                            <span className="text-2xs block text-slate-500 mt-1 font-medium">
                              Solicitante: <strong className="text-slate-700">{req.solicitante}</strong>
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-100/60 border border-purple-200 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                            <Baby className="w-3 h-3 text-purple-600" />
                            Maternidade
                          </span>
                        </div>

                        {/* Setor e Data */}
                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase">Setor</span>
                            <span className="font-semibold text-slate-700 truncate block">{req.setor}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase">Data Criada</span>
                            <span className="font-semibold text-slate-700 block">
                              {(() => {
                                const rawDate = (req as any).created_at || req.dataEmissao || req.dataSolicitacao || req.createdTimestamp;
                                const parsed = getParsedDate(rawDate);
                                if (parsed) {
                                  const day = String(parsed.getDate()).padStart(2, '0');
                                  const month = String(parsed.getMonth() + 1).padStart(2, '0');
                                  const year = parsed.getFullYear();
                                  return `${day}/${month}/${year}`;
                                }
                                if (typeof rawDate === 'string' && rawDate.trim()) {
                                  return rawDate.trim();
                                }
                                return "--/--/----";
                              })()}
                            </span>
                          </div>
                        </div>

                        {/* Agente Responsável pelo Tratamento na Triagem */}
                        <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                          <span className="font-bold">TRATADO POR:</span>
                          <span className="text-slate-700 font-semibold uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                            {req.tratado_por || req.agente_tratamento || (req as any).concluidoPor || 'NÃO IDENTIFICADO'}
                          </span>
                        </div>

                        {/* Itens */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Itens da Requisição ({req.itens.length}):</span>
                          <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                            {req.itens.map((it, idx) => (
                              <div key={it.id || idx} className="text-xs bg-purple-50/30 p-2.5 rounded-xl border border-purple-100/60 flex items-start justify-between gap-2">
                                <span className="text-slate-800 font-medium break-words leading-tight flex-1">{it.material}</span>
                                <span className="font-mono text-[11px] font-bold text-purple-700 shrink-0">
                                  Qtd: {it.quantidade} {it.unidade} {it.quantidade_atendida !== undefined ? `(Atendido: ${it.quantidade_atendida})` : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Rodapé Obrigatório do Card (Input da RM Filha + Vincular e Liberar + Voltar para Triagem) */}
                      <div className="pt-3 border-t border-purple-100 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="block text-[11px] font-extrabold text-purple-950">
                            📦 Nº da RM Filha (Compra): <span className="text-rose-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setAssistenteFilhaRm(req)}
                            className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 font-bold text-[10.5px] rounded-lg transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs hover:shadow-xs"
                          >
                            <Copy className="w-3 h-3 text-purple-700" />
                            <span>📋 Gerar Dados da Filha</span>
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="text"
                            placeholder="Digite o nº da RM Filha..."
                            value={currentFilhaVal}
                            onChange={(e) => setMaternidadeInputs(prev => ({ ...prev, [req.rmNumber]: e.target.value }))}
                            disabled={isPending}
                            className="flex-1 min-w-[150px] text-xs bg-purple-50/40 hover:bg-purple-50 focus:bg-white border border-purple-200 focus:border-purple-400 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500/20 font-semibold text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => handlePartoMaternidade(req)}
                            disabled={isPending || !currentFilhaVal.trim()}
                            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            {isPending ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5" />
                                <span>Vincular e Liberar</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDevolverMaternidadeParaTriagem(req)}
                            disabled={isPending}
                            className="px-3 py-2 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 hover:border-rose-300 font-bold text-xs rounded-xl shadow-2xs hover:shadow-xs transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <span>↩️ Voltar para Triagem</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ====================================================================
          VISÃO 2: TELA DOS APROVADORES (PAINEL DE COBRANÇA ATIVA EM 3 COLUNAS)
          ==================================================================== */}
      {activeView === 'aprovadores' && (() => {
        const colAndre = aprovadoresRequisitions.filter(req => req.aprovador_destino === 'André');
        const colMaicon = aprovadoresRequisitions.filter(req => req.aprovador_destino === 'Maicon');
        const colFabio = aprovadoresRequisitions.filter(req => req.aprovador_destino === 'Fábio');

        const isAndreAllSelected = colAndre.length > 0 && colAndre.every(req => (selectedRms['André'] || []).includes(req.rmNumber));
        const isMaiconAllSelected = colMaicon.length > 0 && colMaicon.every(req => (selectedRms['Maicon'] || []).includes(req.rmNumber));
        const isFabioAllSelected = colFabio.length > 0 && colFabio.every(req => (selectedRms['Fábio'] || []).includes(req.rmNumber));

        const handleToggleAll = (columnApprover: 'André' | 'Maicon' | 'Fábio', rmsDaColuna: GroupedRequisition[]) => {
          const isAllSel = rmsDaColuna.length > 0 && rmsDaColuna.every(req => (selectedRms[columnApprover] || []).includes(req.rmNumber));
          setSelectedRms(prev => {
            const list = prev[columnApprover] || [];
            let newList: string[];
            if (isAllSel) {
              const colRmNumbers = rmsDaColuna.map(r => r.rmNumber);
              newList = list.filter(num => !colRmNumbers.includes(num));
            } else {
              const colRmNumbers = rmsDaColuna.map(r => r.rmNumber);
              newList = Array.from(new Set([...list, ...colRmNumbers]));
            }
            return { ...prev, [columnApprover]: newList };
          });
        };

        // Helper para renderizar os cards de forma consistente
        const renderApproverCard = (req: GroupedRequisition, columnApprover?: 'André' | 'Maicon' | 'Fábio') => {
          const isSelected = columnApprover ? (selectedRms[columnApprover] || []).includes(req.rmNumber) : false;
          
          // 1. Cálculo do Status Geral (Derivação)
          const itemsStatusList = req.itens.map(it => (it.item_status || 'COMPRA').toUpperCase());
          const allCompra = itemsStatusList.every(s => s === 'COMPRA');
          const allAtendido = itemsStatusList.every(s => s === 'ATENDIDO');
          
          let summary = "MISTA (COMPRA + ESTOQUE)";
          if (allCompra) {
            summary = "COMPRA TOTAL";
          } else if (allAtendido) {
            summary = "ATENDIDO TOTAL (ESTOQUE)";
          }
          
          return (
            <div 
              key={req.rmNumber} 
              className={`bg-white border rounded-2xl shadow-xs hover:shadow-md hover:border-slate-300 transition-all p-5 flex flex-col justify-between gap-4 ${
                isSelected ? 'ring-2 ring-indigo-500/50 border-indigo-300 bg-indigo-50/5' : 'border-slate-200'
              }`}
            >
              <div className="space-y-3.5">
                {/* Cabeçalho do Card */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {columnApprover && (
                      <input
                        type="checkbox"
                        id={`check-${columnApprover}-${req.rmNumber}`}
                        className="w-5 h-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedRms(prev => {
                            const list = prev[columnApprover] || [];
                            const newList = list.includes(req.rmNumber)
                              ? list.filter(num => num !== req.rmNumber)
                              : [...list, req.rmNumber];
                            return { ...prev, [columnApprover]: newList };
                          });
                        }}
                      />
                    )}
                    <label 
                      htmlFor={columnApprover ? `check-${columnApprover}-${req.rmNumber}` : undefined} 
                      className="font-extrabold text-indigo-950 text-base tracking-tight cursor-pointer hover:text-indigo-700"
                    >
                      RM {req.rmNumber}
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 relative">
                    {/* Botão de Motivo da Espera */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingMotivoRm(req);
                        setMotivoText(req.motivo_espera || '');
                      }}
                      className={`p-1.5 rounded-full transition-colors cursor-pointer relative group ${
                        req.motivo_espera 
                          ? 'bg-amber-50 text-amber-500 hover:bg-amber-100 hover:text-amber-600' 
                          : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                      }`}
                      title={req.motivo_espera ? `Motivo da Espera: ${req.motivo_espera}` : "Anotar motivo da espera"}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {req.motivo_espera && (
                        <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                      )}
                      
                      {/* Tooltip personalizado */}
                      {req.motivo_espera && (
                        <div className="absolute bottom-full right-1/2 translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 text-white text-[10px] font-medium p-2.5 rounded-xl shadow-md max-w-[180px] whitespace-normal z-30 leading-snug text-center w-48">
                          <p className="font-extrabold text-amber-400 uppercase text-[8px] tracking-wider mb-1">Motivo da Espera:</p>
                          {req.motivo_espera}
                        </div>
                      )}
                    </button>

                    {/* Botão de Impressão de Parecer */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrintRM(req);
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      title="Imprimir Parecer da RM"
                    >
                      <Printer size={16} />
                    </button>

                    {/* Botão de Devolver para Triagem */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDevolverParaTriagem(req);
                      }}
                      className="p-1.5 hover:bg-rose-50 rounded-full text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Devolver RM para Triagem"
                    >
                      <Undo2 size={16} />
                    </button>

                    {getStatusBadge(req.status)}
                    
                    {/* Dropdown de Override */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdownRm(activeDropdownRm === req.rmNumber ? null : req.rmNumber);
                        }}
                        className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        title="Opções de Override"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {activeDropdownRm === req.rmNumber && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownRm(null);
                            }} 
                          />
                          <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1.5 text-left">
                            <div className="px-3 py-1 border-b border-slate-100 mb-1">
                              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                                Forçar Atualização (Override)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownRm(null);
                                handleInitiateApproval(req, 'Aprovado', false);
                              }}
                              className="w-full px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition-colors cursor-pointer text-left"
                            >
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              Marcar como Aprovada
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownRm(null);
                                handleInitiateApproval(req, 'Reprovado', false);
                              }}
                              className="w-full px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer text-left"
                            >
                              <span className="w-2 h-2 rounded-full bg-rose-500" />
                              Marcar como Reprovada
                            </button>
                            <div className="border-t border-slate-100 my-1"></div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownRm(null);
                                handleDevolverParaTriagem(req);
                              }}
                              className="w-full px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer text-left"
                            >
                              <Undo2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              Devolver para Triagem
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Banner de Aviso RM Mãe de Atendimento Parcial */}
                {req.rm_filha_id && (
                  <div className="p-2.5 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-950 text-xs font-extrabold flex items-center gap-2 shadow-2xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>⚠️ RM Mãe de Atendimento Parcial. RM Filha gerada: <strong className="font-mono underline text-amber-900">{req.rm_filha_id}</strong></span>
                  </div>
                )}

                {/* Sub-header (Requisitante e Setor) */}
                <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2.5 flex flex-col gap-y-1.5">
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    <div>
                      <span className="font-semibold text-slate-600">Requisitante: </span>
                      <span className="font-medium text-slate-800">{req.solicitante}</span>
                    </div>
                    <div className="text-slate-300">•</div>
                    <div>
                      <span className="font-semibold text-slate-600">Setor: </span>
                      <span className="font-medium text-slate-800">{req.setor}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    Tratado por: <span className="font-semibold text-slate-600">{req.agente_tratamento || 'Não identificado'}</span>
                  </div>
                </div>

                {/* Urgência e Categoria */}
                <div className="flex flex-wrap gap-1 items-center">
                  {getUrgencyBadge(req.dataNecessidade)}
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 uppercase border border-slate-200">
                    {req.categoria}
                  </span>
                  {req.decisao_direta && (
                    <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded border border-purple-300 flex items-center gap-1">
                      ⚡ RM COM DECISÃO DIRETA
                    </span>
                  )}
                  {req.rm_filha_id && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1 shadow-2xs">
                      📦 RM Mãe (Gerou a RM Filha: <strong className="underline font-mono">{req.rm_filha_id}</strong>)
                    </span>
                  )}
                  {req.rm_mae_id && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs">
                      🛒 RM Filha (Origem: RM Mãe <strong className="underline font-mono">{req.rm_mae_id}</strong>)
                    </span>
                  )}
                  {req.acao_recomendada && req.acao_recomendada.trim() !== '' && (() => {
                    const txt = req.acao_recomendada.trim();
                    const isReprovar = /reprovar/i.test(txt);
                    const isAprovar = /aprovar/i.test(txt);
                    const badgeClass = isReprovar
                      ? "bg-red-100 text-red-800 border-red-200"
                      : isAprovar
                        ? "bg-green-100 text-green-800 border-green-200"
                        : "bg-slate-100 text-slate-800 border-slate-200";
                    return (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${badgeClass}`}>
                        {txt}
                      </span>
                    );
                  })()}
                </div>

                {/* Linha do Tempo Recolhida (Accordion / Details) */}
                <details className={`group border rounded-xl overflow-hidden transition-all duration-300 ${
                  allCompra 
                    ? 'border-amber-200 bg-amber-50/20' 
                    : 'border-emerald-200 bg-emerald-50/20'
                }`}>
                  <summary className={`flex items-center justify-between p-2.5 cursor-pointer select-none list-none font-extrabold text-[10px] uppercase tracking-wider ${
                    allCompra 
                      ? 'text-amber-800 hover:bg-amber-50/50' 
                      : 'text-emerald-800 hover:bg-emerald-50/50'
                  } transition-colors`}>
                    <div className="flex items-center gap-2">
                      <Clock className={`w-3.5 h-3.5 shrink-0 ${allCompra ? 'text-amber-500' : 'text-emerald-500'}`} />
                      <span>Histórico de Triagem</span>
                    </div>
                    <span className={`text-xs transition-transform duration-200 group-open:rotate-180 ${
                      allCompra ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      ▼
                    </span>
                  </summary>
                  
                  <div className={`p-3 border-t space-y-2 text-xs ${
                    allCompra 
                      ? 'border-amber-200 bg-amber-50/40 text-amber-950' 
                      : 'border-emerald-200 bg-emerald-50/40 text-emerald-950'
                  }`}>
                    <div className="flex flex-col gap-1.5">
                      <div className="text-[10px] uppercase font-bold tracking-wide opacity-90">
                        Triagem realizada por: <span className="underline font-black">{req.agente_tratamento || req.tratado_por || 'Almoxarife'}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[10px] uppercase tracking-wider">Status Geral:</span>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                          allCompra 
                            ? 'bg-amber-100/80 text-amber-800 border border-amber-200' 
                            : 'bg-emerald-100/80 text-emerald-800 border border-emerald-200'
                        }`}>
                          {summary}
                        </span>
                      </div>

                      {req.numero_rtd && req.numero_rtd.trim() !== '' && (
                        <div className={`mt-1 p-2 rounded-lg border font-bold text-[10px] uppercase tracking-wider flex items-center justify-between ${
                          allCompra 
                            ? 'bg-amber-100 border-amber-200 text-amber-900' 
                            : 'bg-emerald-100 border-emerald-200 text-emerald-900'
                        }`}>
                          <span>Documento RTD:</span>
                          <span className="font-mono text-xs bg-white px-2 py-0.5 rounded shadow-xs">{req.numero_rtd}</span>
                        </div>
                      )}

                      {/* Lista detalhada de itens com Atendido vs Compra */}
                      <div className="mt-2.5 pt-2 border-t border-dashed border-slate-200/60">
                        <div className="text-[9px] uppercase font-bold tracking-wider opacity-85 mb-1.5">
                          Detalhamento de Itens da RM:
                        </div>
                        <ul className="space-y-1.5">
                          {req.itens.map((it, idx) => {
                            const isItemCompra = (it.item_status || 'COMPRA').toUpperCase() === 'COMPRA';
                            const qtdAtendida = it.quantidade_atendida || 0;
                            const qtdCompra = isItemCompra ? it.quantidade : (it.quantidade - (it.quantidade_atendida || 0));
                            return (
                              <li key={it.id || idx} className="text-[10.5px] leading-relaxed pb-1 border-b border-slate-200/20 last:border-0 last:pb-0">
                                <span className="font-bold text-slate-800">{it.material}</span>
                                <div className="text-[9.5px] text-slate-600 mt-0.5 font-medium">
                                  Atendido: <strong className="text-emerald-700 font-extrabold">{qtdAtendida}</strong> | Compra: <strong className="text-blue-700 font-extrabold">{qtdCompra}</strong>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  </div>
                </details>

                {/* Direcionar/Remanejar Aprovador */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase shrink-0">Aprovador Destino:</span>
                  <select
                    value={req.aprovador_destino || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      if (!req.aprovador_destino) {
                        handleAssignApprover(req, val);
                      } else {
                        handleStartTransferApprover(req, val);
                      }
                    }}
                    className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 font-bold text-slate-700 w-full max-w-[130px] cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    <option value="André">André</option>
                    <option value="Maicon">Maicon</option>
                    <option value="Fábio">Fábio</option>
                  </select>
                </div>

                {/* Lista de materiais inclusos */}
                <div className="border-t border-slate-100 pt-2.5">
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Materiais inclusos ({req.itens.length})</h4>
                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {req.itens.map((it, idx) => {
                      const isItemCompra = (it.item_status || 'COMPRA').toUpperCase() === 'COMPRA';
                      return (
                        <div 
                          key={it.id || idx} 
                          className="flex items-start justify-between gap-1.5 text-[11px] text-slate-700 bg-slate-50/50 p-1.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-start gap-1.5 min-w-0 flex-1">
                            <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded shrink-0 text-[10px] mt-0.5">
                              {it.quantidade} {it.unidade}
                            </span>
                            <span className="text-slate-800 font-medium break-words leading-tight flex-1">
                              {it.material}
                            </span>
                          </div>
                          {isItemCompra ? (
                            <span className="px-1.5 py-0.5 text-[8px] font-extrabold rounded-md bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-wider shrink-0 mt-0.5">
                              COMPRAR
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[8px] font-extrabold rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wider shrink-0 mt-0.5">
                              ATENDIDO: {it.quantidade_atendida || it.quantidade}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bloco Unificado: ITENS DA RM FILHA (COMPRA) */}
                {req.rm_filha_id && (() => {
                  const daughterRmNum = String(req.rm_filha_id).trim();
                  const daughterRm = filteredGroupedAllRequisitions.find(r => 
                    String(r.rmNumber) === daughterRmNum || 
                    String((r as any).rm_number || '') === daughterRmNum ||
                    String(r.id) === daughterRmNum
                  );
                  const daughterItens = daughterRm ? daughterRm.itens : requisitions.filter(item => 
                    String(item.rm_number || item.rmNumber || item.id) === daughterRmNum
                  );

                  return (
                    <div className="mt-2.5 pt-2.5 border-t-2 border-dashed border-purple-300 bg-purple-50/70 p-2.5 rounded-xl space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between text-[10px] font-black text-purple-950 uppercase tracking-wider">
                        <span>🛒 ITENS DA RM FILHA (COMPRA - RM #{daughterRmNum})</span>
                        <span className="bg-purple-200 text-purple-950 px-1.5 py-0.5 rounded text-[9px] font-bold">
                          {daughterItens.length} {daughterItens.length === 1 ? 'item' : 'itens'}
                        </span>
                      </div>
                      {daughterItens.length > 0 ? (
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                          {daughterItens.map((it: any, idx: number) => (
                            <div 
                              key={it.id || idx} 
                              className="flex items-start justify-between gap-1.5 text-[11px] text-purple-950 bg-white p-1.5 rounded-lg border border-purple-200 shadow-2xs"
                            >
                              <div className="flex items-start gap-1.5 min-w-0 flex-1">
                                <span className="font-mono font-extrabold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded shrink-0 text-[10px] mt-0.5">
                                  {it.quantidade} {it.unidade}
                                </span>
                                <span className="text-purple-950 font-bold break-words leading-tight flex-1">
                                  {it.material}
                                </span>
                              </div>
                              <span className="px-1.5 py-0.5 text-[8px] font-extrabold rounded-md bg-blue-100 text-blue-700 border border-blue-200 uppercase tracking-wider shrink-0 mt-0.5">
                                COMPRAR
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-purple-700 font-semibold italic">Carregando itens da RM Filha #{daughterRmNum}...</p>
                      )}
                    </div>
                  );
                })()}

                {/* Orientação para o Aprovvo (Exibe a orientação definida no Direcionamento) */}
                {columnApprover && (
                  <div className="border-t border-slate-100 pt-2.5 mt-2">
                    {(() => {
                      const orientacao = req.orientacao_combo || req.orientacao_aprovacao || req.observacao_combo;
                      if (orientacao) {
                        return (
                          <div className="bg-gradient-to-r from-purple-900 to-indigo-950 border border-purple-700 text-white p-3 rounded-xl flex items-start gap-2.5 shadow-md">
                            <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5 animate-pulse" />
                            <div className="min-w-0 flex-1">
                              <span className="block text-[10px] font-black uppercase tracking-wider text-purple-200">
                                🎯 ORIENTAÇÃO PARA O APROVVO:
                              </span>
                              <span className="block text-xs font-black text-amber-300 leading-snug mt-0.5">
                                {orientacao}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="bg-amber-600 border border-amber-700 text-white p-2.5 rounded-xl text-[10px] font-black text-center flex items-center justify-center gap-1.5 shadow-2xs">
                          <AlertTriangle className="w-3.5 h-3.5 text-white shrink-0" />
                          <span>Aguardando orientação para o Aprovvo</span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          );
        };

        return (
          <div className="w-full space-y-8">
            {/* Header explicativo do painel de cobrança */}
            <div className="bg-gradient-to-r from-indigo-900 to-indigo-950 text-white p-6 rounded-2xl border border-indigo-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-800/60 text-indigo-300 rounded-xl shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight">Painel de Cobrança Ativa (Aprovadores)</h2>
                  <p className="text-xs text-indigo-200/80 mt-1 max-w-3xl leading-relaxed">
                    Selecione as RMs pendentes em cada coluna e clique no botão de cobrança para gerar um link direto e cobrar o aprovador no WhatsApp. A decisão final é realizada diretamente no sistema Approvo com base na Orientação exibida em cada card.
                  </p>
                </div>
              </div>
              <span className="text-xs text-indigo-200/60 font-mono flex items-center gap-1.5 bg-indigo-950/40 px-3 py-1.5 rounded-lg border border-indigo-800/50 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Autosync ativo (15s)
              </span>
            </div>

            {/* Carregando dados */}
            {loading ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                <RefreshCw className="mx-auto w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-xs text-slate-500 mt-2 font-medium">Carregando dados do Supabase...</p>
              </div>
            ) : (colAndre.length === 0 && colMaicon.length === 0 && colFabio.length === 0) ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                <AlertCircle className="mx-auto w-10 h-10 text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-700">Nenhuma RM aguardando aprovação nas colunas dos aprovadores no momento</p>
                <p className="text-xs text-slate-400 mt-1">RMs recém-triadas devem ser direcionadas na aba Direcionamento primeiro.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* GRID DE 3 COLUNAS (André, Maicon, Fábio) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  
                  {/* COLUNA: André */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                          <h3 className="font-extrabold text-slate-800 text-sm tracking-tight uppercase">André</h3>
                          <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded font-bold text-slate-600">
                            {colAndre.length} RMs
                          </span>
                        </div>
                        <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/50">
                          {(selectedRms['André'] || []).filter(num => colAndre.some(r => r.rmNumber === num)).length} selec.
                        </span>
                      </div>

                      {/* Selecionar Todos Checkbox */}
                      <div className="flex items-center px-1">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            id="select-all-andre"
                            className="w-4.5 h-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            checked={isAndreAllSelected}
                            disabled={colAndre.length === 0}
                            onChange={() => handleToggleAll('André', colAndre)}
                          />
                          <span className="text-xs font-extrabold text-slate-600 hover:text-slate-800 transition-colors">
                            Selecionar Todos
                          </span>
                        </label>
                      </div>

                      {/* Botão de Cobrança */}
                      <button
                        onClick={() => handleCobrar('André')}
                        disabled={colAndre.length === 0}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-xs hover:shadow-sm transition-all text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        📱 Cobrar André
                      </button>

                      {/* Lista de Cards */}
                      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                        {colAndre.length === 0 ? (
                          <div className="text-center py-10 bg-white/50 rounded-xl border border-dashed border-slate-200">
                            <p className="text-xs text-slate-400 font-medium">Nenhuma RM encaminhada para André</p>
                          </div>
                        ) : (
                          colAndre.map((req) => renderApproverCard(req, 'André'))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* COLUNA: Maicon */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                          <h3 className="font-extrabold text-slate-800 text-sm tracking-tight uppercase">Maicon</h3>
                          <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded font-bold text-slate-600">
                            {colMaicon.length} RMs
                          </span>
                        </div>
                        <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/50">
                          {(selectedRms['Maicon'] || []).filter(num => colMaicon.some(r => r.rmNumber === num)).length} selec.
                        </span>
                      </div>

                      {/* Selecionar Todos Checkbox */}
                      <div className="flex items-center px-1">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            id="select-all-maicon"
                            className="w-4.5 h-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            checked={isMaiconAllSelected}
                            disabled={colMaicon.length === 0}
                            onChange={() => handleToggleAll('Maicon', colMaicon)}
                          />
                          <span className="text-xs font-extrabold text-slate-600 hover:text-slate-800 transition-colors">
                            Selecionar Todos
                          </span>
                        </label>
                      </div>

                      {/* Botão de Cobrança */}
                      <button
                        onClick={() => handleCobrar('Maicon')}
                        disabled={colMaicon.length === 0}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-xs hover:shadow-sm transition-all text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        📱 Cobrar Maicon
                      </button>

                      {/* Lista de Cards */}
                      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                        {colMaicon.length === 0 ? (
                          <div className="text-center py-10 bg-white/50 rounded-xl border border-dashed border-slate-200">
                            <p className="text-xs text-slate-400 font-medium">Nenhuma RM encaminhada para Maicon</p>
                          </div>
                        ) : (
                          colMaicon.map((req) => renderApproverCard(req, 'Maicon'))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* COLUNA: Fábio */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                          <h3 className="font-extrabold text-slate-800 text-sm tracking-tight uppercase">Fábio</h3>
                          <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded font-bold text-slate-600">
                            {colFabio.length} RMs
                          </span>
                        </div>
                        <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/50">
                          {(selectedRms['Fábio'] || []).filter(num => colFabio.some(r => r.rmNumber === num)).length} selec.
                        </span>
                      </div>

                      {/* Selecionar Todos Checkbox */}
                      <div className="flex items-center px-1">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            id="select-all-fabio"
                            className="w-4.5 h-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            checked={isFabioAllSelected}
                            disabled={colFabio.length === 0}
                            onChange={() => handleToggleAll('Fábio', colFabio)}
                          />
                          <span className="text-xs font-extrabold text-slate-600 hover:text-slate-800 transition-colors">
                            Selecionar Todos
                          </span>
                        </label>
                      </div>

                      {/* Botão de Cobrança */}
                      <button
                        onClick={() => handleCobrar('Fábio')}
                        disabled={colFabio.length === 0}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-xs hover:shadow-sm transition-all text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        📱 Cobrar Fábio
                      </button>

                      {/* Lista de Cards */}
                      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                        {colFabio.length === 0 ? (
                          <div className="text-center py-10 bg-white/50 rounded-xl border border-dashed border-slate-200">
                            <p className="text-xs text-slate-400 font-medium">Nenhuma RM encaminhada para Fábio</p>
                          </div>
                        ) : (
                          colFabio.map((req) => renderApproverCard(req, 'Fábio'))
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ====================================================================
          NOVA VISÃO: TELA DE HISTÓRICO E AUDITORIA (RMs FINALIZADAS)
          ==================================================================== */}
      {activeView === 'historico' && (
        <div className="w-full space-y-6">
          <div className="bg-slate-100 border border-slate-200 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="p-3 bg-slate-200 text-slate-700 rounded-xl shrink-0">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Histórico e Auditoria de RMs Finalizadas</h2>
              <p className="text-xs text-slate-600 mt-1 max-w-3xl">
                Esta aba exibe o histórico consolidado de RMs que já foram finalizadas e arquivadas. É possível consultar as decisões tomadas, os responsáveis pelo atendimento e as métricas de tempo de tratamento.
              </p>
            </div>
          </div>

          {/* Cards de KPI do Histórico */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Total RMs Finalizadas</p>
                <h3 className="text-2xl font-black text-slate-800 mt-1">
                  {loadingHistorico ? '...' : (historicoTotalCount || historicoRequisitions.length)}
                </h3>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <History className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Tempo Médio de Atendimento</p>
                <h3 className="text-2xl font-black text-emerald-600 mt-1">
                  {loadingHistorico ? '...' : tempoMedioAtendimentoFormatado}
                </h3>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Total de Itens Atendidos</p>
                <h3 className="text-2xl font-black text-blue-600 mt-1">
                  {loadingHistorico ? '...' : historicoStats.totalAtendido.toLocaleString('pt-BR')}
                </h3>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Barra de Filtros de Data e Relatório */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="text-xs font-bold text-slate-600">
                Filtros por Período de Finalização:
              </div>

              {/* Filtro de Período (Datas) e Botão Exportar */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                <div className="relative w-full sm:w-auto flex items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 absolute left-3 pointer-events-none">Início:</span>
                  <input
                    type="date"
                    value={historicoStartDate}
                    onChange={(e) => setHistoricoStartDate(e.target.value)}
                    className="w-full sm:w-40 pl-14 pr-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-750 bg-slate-50/50"
                  />
                </div>

                <div className="relative w-full sm:w-auto flex items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 absolute left-3 pointer-events-none">Fim:</span>
                  <input
                    type="date"
                    value={historicoEndDate}
                    onChange={(e) => setHistoricoEndDate(e.target.value)}
                    className="w-full sm:w-40 pl-10 pr-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-750 bg-slate-50/50"
                  />
                </div>

                {/* Botões de Limpar Datas */}
                {(historicoStartDate || historicoEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setHistoricoStartDate('');
                      setHistoricoEndDate('');
                    }}
                    className="px-3 py-2.5 text-2xs font-extrabold uppercase text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors rounded-xl border border-rose-100 cursor-pointer"
                    title="Limpar filtros de data"
                  >
                    Limpar
                  </button>
                )}

                <button
                  type="button"
                  onClick={exportarRelatorioGeral}
                  disabled={isExportingReport}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none shrink-0"
                >
                  {isExportingReport ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Gerando arquivo...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Baixar Relatório Geral</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Resumo de Resultados */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium pt-1 border-t border-slate-100">
              <div>
                RMs encontradas: <span className="font-extrabold text-slate-700">{historicoTotalCount || historicoRequisitions.length}</span>
              </div>
              {(historicoStartDate || historicoEndDate) && (
                <div className="flex items-center gap-1.5 text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded-md font-semibold border border-indigo-100/50">
                  <Calendar className="w-3 h-3" />
                  Período ativo: {historicoStartDate ? new Date(historicoStartDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Início'} até {historicoEndDate ? new Date(historicoEndDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Fim'}
                </div>
              )}
            </div>
          </div>

          {loadingHistorico ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <RefreshCw className="mx-auto w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs text-slate-500 mt-2 font-medium">Carregando dados do Supabase...</p>
            </div>
          ) : historicoRequisitions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <AlertCircle className="mx-auto w-10 h-10 text-slate-400 mb-2" />
              <p className="text-sm font-semibold text-slate-700">Nenhuma RM arquivada encontrada</p>
              <p className="text-xs text-slate-400 mt-1">
                {historicoSearchQuery ? 'Ajuste sua busca ou limpe o termo digitado.' : 'Apenas RMs com status interno "Finalizado" aparecem aqui.'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {historicoRequisitions.map((req) => {
                  const tempoTratamento = getTreatmentDurationStr(req.data_inicio_tratamento, req.data_conclusao_tratamento);
                  const statusReal = (req.status || '').toUpperCase();
                  
                  let badgeColor = 'bg-slate-100 text-slate-800 border-slate-300';
                  let badgeText = req.status || 'ARQUIVADO';
                  let dotColor = 'bg-slate-500';

                  if (statusReal.includes('APROVAD')) {
                    badgeColor = 'bg-green-100 text-green-800 border-green-300';
                    badgeText = 'Aprovado';
                    dotColor = 'bg-green-600';
                  } else if (statusReal.includes('REPROVAD') || statusReal.includes('CANCELAD')) {
                    badgeColor = 'bg-red-100 text-red-800 border-red-300';
                    badgeText = 'Reprovado/Cancelado';
                    dotColor = 'bg-red-600';
                  }

                  const totalAtendido = (() => {
                    if (req.itens && req.itens.length > 0) {
                      const sumItens = req.itens.reduce((acc, item: any) => {
                        const q = Number(item.qtdAtendida ?? item.qtd_atendida ?? item.quantidade_atendida ?? 0);
                        return acc + (isNaN(q) ? 0 : q);
                      }, 0);
                      if (sumItens > 0) return sumItens;
                    }
                    const rootVal = Number(req.qtd_atendida ?? (req as any).quantidade_atendida ?? (req as any).total_atendido ?? 0);
                    return isNaN(rootVal) ? 0 : rootVal;
                  })();

                  const totalCompra = (() => {
                    if (req.itens && req.itens.length > 0) {
                      const sumItens = req.itens.reduce((acc, item: any) => {
                        const q = Number(item.qtdCompra ?? item.qtd_compra ?? item.quantidade_em_compra ?? item.qtd_em_compra ?? 0);
                        return acc + (isNaN(q) ? 0 : q);
                      }, 0);
                      if (sumItens > 0) return sumItens;
                    }
                    const rootVal = Number(req.qtd_em_compra ?? (req as any).qtd_compra ?? (req as any).quantidade_em_compra ?? 0);
                    return isNaN(rootVal) ? 0 : rootVal;
                  })();

                  const rtdNumero = (() => {
                    if (req.numero_rtd && String(req.numero_rtd).trim() !== '' && String(req.numero_rtd).trim() !== 'N/A') return String(req.numero_rtd);
                    if ((req as any).rtd && String((req as any).rtd).trim() !== '') return String((req as any).rtd);
                    if ((req as any).numeroRtd && String((req as any).numeroRtd).trim() !== '') return String((req as any).numeroRtd);
                    if (req.itens && req.itens.length > 0) {
                      for (const item of req.itens as any[]) {
                        const rtdItem = item.numero_rtd || item.rtd || item.numeroRtd;
                        if (rtdItem && String(rtdItem).trim() !== '') return String(rtdItem);
                      }
                    }
                    const rawObj = req._raw || {};
                    if (rawObj.numero_rtd) return String(rawObj.numero_rtd);
                    if (rawObj.rtd) return String(rawObj.rtd);
                    if (rawObj.numeroRtd) return String(rawObj.numeroRtd);
                    if (typeof rawObj.parecerDiligenciador === 'string' && rawObj.parecerDiligenciador.trim().startsWith('{')) {
                      try {
                        const p = JSON.parse(rawObj.parecerDiligenciador);
                        if (p.numero_rtd || p.rtd || p.numeroRtd) return String(p.numero_rtd || p.rtd || p.numeroRtd);
                      } catch (e) {}
                    }
                    return 'N/A';
                  })();

                  const tipoNome = formatarTipo(req.tipoRM, req.categoria);
                  const finalizationTimestamp = getFormattedFinalizationTimestamp(req);

                  const displayRtd = (() => {
                    const hasRtd = rtdNumero && rtdNumero !== 'N/A' && rtdNumero.trim() !== '';
                    if (hasRtd) return rtdNumero;
                    if (totalCompra > 0) return 'Sem necessidade, Compra solicitada';
                    return 'N/A';
                  })();

                  return (
                    <div 
                      key={req.rmNumber} 
                      className="bg-slate-50/80 border border-slate-200 rounded-2xl shadow-xs hover:border-slate-300 transition-all p-5 flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        {/* Cabeçalho */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 text-lg tracking-tight">RM {req.rmNumber}</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-600 uppercase border border-slate-300">
                                Arquivado
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {getUrgencyBadge(req.dataNecessidade)}
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                                tipoNome.includes('COTAÇÃO')
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : tipoNome.includes('CC99')
                                  ? 'bg-purple-100 text-purple-800 border-purple-300'
                                  : 'bg-blue-100 text-blue-800 border-blue-300'
                              }`}>
                                {tipoNome}
                              </span>
                              {req.decisao_direta && (
                                <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded border border-purple-300 flex items-center gap-1">
                                  ⚡ RM COM DECISÃO DIRETA
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badgeColor}`}>
                              <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                              {badgeText}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              Finalizado em: {finalizationTimestamp}
                            </span>
                          </div>
                        </div>

                        {/* Sub-header (Requisitante e Setor) */}
                        <div className="text-xs text-slate-500 border-t border-slate-200 pt-3 flex flex-wrap gap-x-3 gap-y-1">
                          <div>
                            <span className="font-semibold text-slate-600">Requisitante: </span>
                            {req.solicitante}
                          </div>
                          <div className="text-slate-300">•</div>
                          <div>
                            <span className="font-semibold text-slate-600">Setor: </span>
                            {req.setor}
                          </div>
                        </div>

                        {/* Timeline e Resumo Consolidado de Triagem (Histórico de Triagem - Fonte Única) */}
                        <details open className="group border rounded-xl overflow-hidden transition-all duration-300 border-amber-200 bg-amber-50/40">
                          <summary className="flex items-center justify-between p-2.5 cursor-pointer select-none list-none font-extrabold text-[10px] uppercase tracking-wider text-amber-900 hover:bg-amber-100/60 transition-colors">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                              <span>Histórico de Triagem</span>
                            </div>
                            <span className="text-xs transition-transform duration-200 group-open:rotate-180 text-amber-600">
                              ▼
                            </span>
                          </summary>

                          <div className="p-3 border-t border-amber-200 bg-amber-50/70 text-amber-950 space-y-2 text-xs">
                            <div className="flex flex-col gap-1.5">
                              <div className="text-[10px] uppercase font-bold tracking-wide opacity-90">
                                Triagem realizada por: <span className="underline font-black">{req.agente_tratamento || req.tratado_por || 'Almoxarife'}</span>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[10px] uppercase tracking-wider">Status Geral:</span>
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
                                  {req.acao_recomendada || req.status_interno || 'Finalizado'}
                                </span>
                              </div>

                              {/* Detalhamento de Itens */}
                              {req.itens && req.itens.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-dashed border-amber-300/60">
                                  <div className="text-[9px] uppercase font-bold tracking-wider opacity-85 mb-1.5">
                                    Detalhamento de Itens da RM ({req.itens.length}):
                                  </div>
                                  <ul className="space-y-1.5">
                                    {req.itens.map((it: any, idx: number) => {
                                      const isItemCompra = (it.item_status || 'COMPRA').toUpperCase() === 'COMPRA';
                                      const qAtendida = Number(it.qtdAtendida ?? it.qtd_atendida ?? it.quantidade_atendida ?? 0);
                                      const qCompra = isItemCompra 
                                        ? Number(it.quantidade) 
                                        : Number(it.qtdCompra ?? it.qtd_compra ?? (it.quantidade - qAtendida));
                                      return (
                                        <li key={it.id || idx} className="text-[10.5px] leading-relaxed pb-1 border-b border-amber-200/50 last:border-0 last:pb-0">
                                          <span className="font-bold text-slate-900">{it.material}</span>
                                          <div className="text-[9.5px] text-slate-700 mt-0.5 font-medium">
                                            Atendido: <strong className="text-emerald-700 font-extrabold">{qAtendida}</strong> | Compra: <strong className="text-blue-700 font-extrabold">{qCompra > 0 ? qCompra : 0}</strong>
                                          </div>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              )}

                              {/* Rodapé Consolidado com Cálculos Dinâmicos */}
                              {(() => {
                                const itensTriagem = req.itens || [];
                                const totalAtendidoReal = itensTriagem.reduce((acc: number, item: any) => {
                                  const q = Number(item.qtdAtendida ?? item.qtd_atendida ?? item.quantidade_atendida ?? 0);
                                  return acc + (isNaN(q) ? 0 : q);
                                }, 0);
                                const totalCompraReal = itensTriagem.reduce((acc: number, item: any) => {
                                  const isItemCompra = (item.item_status || 'COMPRA').toUpperCase() === 'COMPRA';
                                  const qAtendida = Number(item.qtdAtendida ?? item.qtd_atendida ?? item.quantidade_atendida ?? 0);
                                  const qCompra = isItemCompra 
                                    ? Number(item.quantidade) 
                                    : Number(item.qtdCompra ?? item.qtd_compra ?? (item.quantidade - qAtendida));
                                  return acc + (isNaN(qCompra) ? 0 : (qCompra > 0 ? qCompra : 0));
                                }, 0);

                                return (
                                  <div className="mt-3 pt-3 border-t border-amber-300/80 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/90 p-3 rounded-xl border border-amber-200 text-slate-800 shadow-2xs">
                                    <div>
                                      <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Nº da RTD</p>
                                      {(!rtdNumero || rtdNumero === 'N/A') && totalCompraReal > 0 ? (
                                        <span className="text-xs text-gray-500 font-semibold leading-tight block mt-0.5">Sem necessidade, Compra solicitada</span>
                                      ) : (
                                        <span className="text-xs text-gray-900 font-bold block mt-0.5">{rtdNumero || 'N/A'}</span>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Total Atendido</p>
                                      <p className="text-sm font-black text-emerald-700 mt-0.5">{totalAtendidoReal}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Total em Compra</p>
                                      <p className="text-sm font-black text-blue-700 mt-0.5">{totalCompraReal}</p>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </details>

                        {/* Corpo do Card (Motivo se houver) */}
                        {req.motivo && (
                          <div className="bg-white p-3 rounded-xl border border-slate-200">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Motivo da RM</p>
                            <p className="text-xs text-slate-600 font-medium italic line-clamp-2 leading-relaxed">
                              "{req.motivo}"
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Controles de Paginação */}
              {historicoTotalCount > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mt-6">
                  <div className="text-xs text-slate-500 font-medium">
                    Exibindo <span className="font-bold text-slate-800">{currentPage * itemsPerPage + 1}</span> a{' '}
                    <span className="font-bold text-slate-800">
                      {Math.min((currentPage + 1) * itemsPerPage, historicoTotalCount)}
                    </span>{' '}
                    de <span className="font-bold text-slate-800">{historicoTotalCount}</span> registros
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentPage === 0 || loadingHistorico}
                      onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
                      className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      ‹ Anterior
                    </button>

                    <span className="text-xs font-bold text-slate-600 px-3">
                      Página {currentPage + 1} de {Math.max(1, Math.ceil(historicoTotalCount / itemsPerPage))}
                    </span>

                    <button
                      type="button"
                      disabled={(currentPage + 1) * itemsPerPage >= historicoTotalCount || loadingHistorico}
                      onClick={() => setCurrentPage((prev) => prev + 1)}
                      className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      Próxima ›
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ====================================================================
          VISÃO 3: MODO TV (GESTÃO À VISTA - LAYOUT ESCURO ALTO CONTRASTE)
          ==================================================================== */}
      {activeView === 'tv' && (
        <div id="active-tv-mode-flag" className={`w-full ${isTVMode ? 'px-6 md:px-8 py-3 h-full max-h-screen justify-between min-h-0' : 'px-6 py-4 h-[calc(100vh-80px)] justify-center'} flex flex-col overflow-hidden bg-slate-950`}>
          {isTVMode ? (
            /* Premium, high-impact full-screen Kiosk dashboard for Diligenciamento de RMs */
            <div className="flex-1 flex flex-col justify-between w-full h-full gap-3 md:gap-4 animate-in fade-in duration-500 py-0.5 min-h-0">
              {/* Elegant Display Header */}
              <div className="text-center pt-0 shrink-0">
                <span className="text-emerald-400 text-[10px] md:text-xs font-black tracking-widest uppercase font-mono bg-emerald-950/80 border border-emerald-800/80 px-3 py-1 rounded-full shadow-[0_0_16px_rgba(16,185,129,0.25)]">
                  GESTÃO À VISTA • TEMPO REAL
                </span>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase mt-1">
                  Diligenciamento de Requisições (RMs)
                </h2>
              </div>

              {/* Three High-Impact KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 w-full shrink-0">
                {/* Indicador 1: Sem Tratamento */}
                <div className="flex items-center gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl py-3 px-4 md:px-6 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-2 h-full bg-amber-500" />
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 shadow-[0_0_14px_#f59e0b]"></span>
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-400 leading-none mb-1">RMs Sem Tratamento</span>
                    <span className="text-3xl md:text-4xl lg:text-5xl font-black text-amber-400 font-mono tracking-tight">{tvSemTratamento}</span>
                  </div>
                </div>

                {/* Indicador 2: Em Tratamento */}
                <div className="flex items-center gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl py-3 px-4 md:px-6 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500" />
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500 shadow-[0_0_14px_#6366f1]"></span>
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-400 leading-none mb-1">RMs Em Tratamento</span>
                    <span className="text-3xl md:text-4xl lg:text-5xl font-black text-indigo-400 font-mono tracking-tight">{tvEmTratamento}</span>
                  </div>
                </div>

                {/* Indicador 3: Em Aprovação */}
                <div className="flex items-center gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl py-3 px-4 md:px-6 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-2 h-full bg-pink-500" />
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500 shadow-[0_0_14px_#ec4899]"></span>
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-400 leading-none mb-1">RMs Em Aprovação</span>
                    <span className="text-3xl md:text-4xl lg:text-5xl font-black text-pink-400 font-mono tracking-tight">{tvEmAprovacao}</span>
                  </div>
                </div>
              </div>

              {/* Three panels side-by-side inside TV mode */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 w-full flex-1 min-h-0">
                
                {/* Panel 1: Centered Operator Atendimento Podium Card */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 md:p-4 flex flex-col justify-between flex-1 h-full min-h-0 shadow-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-3 mb-3 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <Trophy className="w-5 h-5 text-amber-400 animate-bounce shrink-0" />
                      <div>
                        <h3 className="text-sm md:text-base font-black text-white uppercase tracking-wider">Top Atendimentos</h3>
                        <p className="text-xs text-slate-400 font-mono uppercase">Líderes de agilidade do mês</p>
                      </div>
                    </div>
                  </div>

                  {rankingAtendimentos.length === 0 ? (
                    <div className="flex-grow flex items-center justify-center py-6">
                      <span className="text-xs md:text-sm font-semibold text-slate-500 italic">
                        Sem atendimentos registrados...
                      </span>
                    </div>
                  ) : (
                    <div className="flex-grow flex items-end justify-center gap-5 md:gap-6 h-48 md:h-56 pt-2 pb-2">
                      {/* 2º Lugar */}
                      {rankingAtendimentos.length >= 2 ? (
                        <div className="flex flex-col items-center w-24 md:w-28 shrink-0">
                          <span className="text-xs md:text-sm font-bold text-slate-200 leading-none mb-1.5 truncate max-w-full" title={rankingAtendimentos[1].name}>
                            {formatOperatorName(rankingAtendimentos[1].name)}
                          </span>
                          <span className="text-xs text-slate-400 font-mono leading-none mb-2 font-bold">
                            {rankingAtendimentos[1].quantidade} RMs
                          </span>
                          <div className="w-20 md:w-24 h-20 md:h-24 bg-slate-800/90 rounded-t-2xl flex items-center justify-center border-t border-slate-600 shadow-lg">
                            <span className="text-xs md:text-sm font-black text-slate-300">2º Lugar</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-24 md:w-28"></div>
                      )}

                      {/* 1º Lugar */}
                      {rankingAtendimentos.length >= 1 && (
                        <div className="flex flex-col items-center w-28 md:w-32 shrink-0">
                          <span className="text-sm md:text-base font-black text-amber-400 leading-none mb-1.5 truncate max-w-full animate-pulse" title={rankingAtendimentos[0].name}>
                            {formatOperatorName(rankingAtendimentos[0].name)}
                          </span>
                          <span className="text-xs md:text-sm text-amber-300 font-mono leading-none mb-2 font-black">
                            {rankingAtendimentos[0].quantidade} RMs
                          </span>
                          <div className="w-24 md:w-28 h-28 md:h-36 bg-gradient-to-t from-amber-600 to-amber-500 rounded-t-2xl flex items-center justify-center border-t-2 border-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.35)]">
                            <span className="text-xs md:text-sm font-black text-slate-950">1º Lugar</span>
                          </div>
                        </div>
                      )}

                      {/* 3º Lugar */}
                      {rankingAtendimentos.length >= 3 ? (
                        <div className="flex flex-col items-center w-24 md:w-28 shrink-0">
                          <span className="text-xs md:text-sm font-bold text-amber-600 leading-none mb-1.5 truncate max-w-full" title={rankingAtendimentos[2].name}>
                            {formatOperatorName(rankingAtendimentos[2].name)}
                          </span>
                          <span className="text-xs text-slate-400 font-mono leading-none mb-2 font-bold">
                            {rankingAtendimentos[2].quantidade} RMs
                          </span>
                          <div className="w-20 md:w-24 h-14 md:h-16 bg-amber-950/90 rounded-t-2xl flex items-center justify-center border-t border-amber-800/80 shadow-md">
                            <span className="text-xs md:text-sm font-black text-amber-500">3º Lugar</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-24 md:w-28"></div>
                      )}
                    </div>
                  )}
                </div>

                {/* Panel 2: Distribuição por Centro de Custo */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 md:p-4 flex flex-col justify-between flex-1 h-full min-h-0 shadow-2xl relative overflow-hidden">
                  <div className="border-b border-slate-800/80 pb-2 mb-2 shrink-0">
                    <h3 className="text-sm md:text-base font-black text-white uppercase tracking-wider">Centro de Custo</h3>
                    <p className="text-xs text-slate-400 font-mono uppercase">Distribuição por centro de custo</p>
                  </div>
                  <div className="flex-1 flex items-center justify-between min-h-0 gap-3">
                    <div className="w-[50%] h-full flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={costCenterData}
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={55}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {costCenterData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'][index % 5]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px', color: '#f8fafc', fontWeight: 'bold' }}
                            itemStyle={{ color: '#f8fafc' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Legend on the right side with larger font */}
                    <div className="flex flex-col gap-2 pl-1 w-[50%] overflow-hidden shrink-0">
                      {costCenterData.length === 0 ? (
                        <span className="text-xs text-slate-500 italic">Nenhum dado</span>
                      ) : (
                        costCenterData.map((entry, index) => (
                          <div key={entry.name} className="flex items-center gap-2 justify-between pr-2">
                            <div className="flex items-center gap-2 truncate">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'][index % 5] }} />
                              <span className="text-xs md:text-sm text-slate-200 font-mono font-bold truncate uppercase" title={entry.name}>
                                {entry.name.replace('CENTRO DE CUSTO', 'CC').replace('Centro de Custo', 'CC')}
                              </span>
                            </div>
                            <span className="text-xs md:text-sm text-slate-300 font-mono font-black shrink-0">({entry.value})</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Panel 3: Top 5 Solicitantes */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 md:p-4 flex flex-col justify-between flex-1 h-full min-h-0 shadow-2xl relative overflow-hidden">
                  <div className="border-b border-slate-800/80 pb-2 mb-2 shrink-0">
                    <h3 className="text-sm md:text-base font-black text-white uppercase tracking-wider">Top 5 Solicitantes</h3>
                    <p className="text-xs text-slate-400 font-mono uppercase">Maiores emissores de RM da Parada</p>
                  </div>
                  <div className="flex-1 overflow-hidden flex flex-col justify-center min-h-0">
                    {topSolicitantes.length === 0 ? (
                      <p className="text-xs text-slate-500 italic text-center py-6">Sem solicitantes registrados</p>
                    ) : (
                      <div className="space-y-2.5">
                        {topSolicitantes.map((item, index) => (
                          <div key={item.name} className="flex items-center justify-between text-xs md:text-sm font-mono py-2.5 px-3 rounded-xl bg-slate-950/40 border border-slate-800/50">
                            <div className="flex items-center gap-3 truncate pr-2">
                              <span className="text-xs font-black text-slate-300 bg-slate-950 px-2 py-0.5 rounded-md min-w-[24px] text-center border border-slate-800">
                                #{index + 1}
                              </span>
                              <span className="text-xs md:text-sm font-bold text-slate-200 truncate uppercase">
                                {item.name}
                              </span>
                            </div>
                            <span className="text-xs md:text-sm font-black text-indigo-400 shrink-0 bg-indigo-950/50 border border-indigo-800/50 px-2.5 py-0.5 rounded-lg">
                              {item.quantidade} RMs
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <>
              {/* Header Interno do Modo TV */}
              <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                  {/* Campo de Busca por Número da RM na TV */}
                  <div className="relative w-full sm:w-64 shrink-0">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Pesquisar RM por número..."
                      value={tvSearchQuery}
                      onChange={(e) => setTvSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-9 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all shadow-inner"
                    />
                    {tvSearchQuery && (
                      <button 
                        onClick={() => setTvSearchQuery('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white hover:bg-slate-800/80 p-0.5 rounded-md transition-colors leading-none"
                        title="Limpar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Indicador 1: Sem Tratamento */}
                  <div className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 shadow-[0_0_8px_#f59e0b]"></span>
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 leading-none">RMs Sem Tratamento</span>
                      <span className="text-lg font-black text-amber-400 leading-tight font-mono">{tvSemTratamento}</span>
                    </div>
                  </div>

                  {/* Indicador 2: Em Tratamento */}
                  <div className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500 shadow-[0_0_8px_#6366f1]"></span>
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 leading-none">RMs Em Tratamento</span>
                      <span className="text-lg font-black text-indigo-400 leading-tight font-mono">{tvEmTratamento}</span>
                    </div>
                  </div>

                  {/* Indicador 3: Em Aprovação */}
                  <div className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pink-500 shadow-[0_0_8px_#ec4899]"></span>
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 leading-none">RMs Em Aprovação</span>
                      <span className="text-lg font-black text-pink-400 leading-tight font-mono">{tvEmAprovacao}</span>
                    </div>
                  </div>
                </div>

                {/* PÓDIO / RANKING DE ATENDIMENTOS REAIS */}
                <div className="hidden lg:flex items-center gap-5 bg-slate-950/40 border border-slate-800/50 rounded-2xl px-5 py-2.5 shadow-inner">
                  <div className="flex flex-col justify-center max-w-[130px]">
                    <div className="flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">Top Atendimentos</span>
                    </div>
                    <span className="text-[8px] text-slate-400 font-mono leading-tight mt-0.5 uppercase">Atendimentos no mês atual</span>
                  </div>

                  {rankingAtendimentos.length === 0 ? (
                    <div className="flex items-center h-14 pb-0.5">
                      <span className="text-[10px] font-semibold text-slate-400 italic">
                        Aguardando primeiros atendimentos do mês...
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-end gap-3 h-14 pb-0.5">
                      {/* 2º Lugar */}
                      {rankingAtendimentos.length >= 2 ? (
                        <div className="flex flex-col items-center w-14">
                          <span className="text-[9px] font-bold text-slate-300 leading-none mb-0.5 truncate max-w-full" title={rankingAtendimentos[1].name}>
                            {formatOperatorName(rankingAtendimentos[1].name)}
                          </span>
                          <span className="text-[8px] text-slate-400 font-mono leading-none mb-1">
                            {rankingAtendimentos[1].quantidade} RMs
                          </span>
                          <div className="w-12 h-6 bg-slate-700 rounded-t-md flex items-center justify-center border-t border-slate-500 shadow-md">
                            <span className="text-[8px] font-black text-white">2º</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-14"></div>
                      )}

                      {/* 1º Lugar */}
                      {rankingAtendimentos.length >= 1 && (
                        <div className="flex flex-col items-center w-14">
                          <span className="text-[10px] font-black text-amber-400 leading-none mb-0.5 truncate max-w-full" title={rankingAtendimentos[0].name}>
                            {formatOperatorName(rankingAtendimentos[0].name)}
                          </span>
                          <span className="text-[8px] text-amber-300 font-mono leading-none mb-1">
                            {rankingAtendimentos[0].quantidade} RMs
                          </span>
                          <div className="w-12 h-10 bg-gradient-to-t from-amber-600 to-amber-500 rounded-t-md flex items-center justify-center border-t border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)]">
                            <span className="text-[9px] font-black text-slate-950">1º</span>
                          </div>
                        </div>
                      )}

                      {/* 3º Lugar */}
                      {rankingAtendimentos.length >= 3 ? (
                        <div className="flex flex-col items-center w-14">
                          <span className="text-[9px] font-bold text-amber-700 leading-none mb-0.5 truncate max-w-full" title={rankingAtendimentos[2].name}>
                            {formatOperatorName(rankingAtendimentos[2].name)}
                          </span>
                          <span className="text-[8px] text-slate-400 font-mono leading-none mb-1">
                            {rankingAtendimentos[2].quantidade} RMs
                          </span>
                          <div className="w-12 h-4 bg-amber-800 rounded-t-md flex items-center justify-center border-t border-amber-600 shadow-sm">
                            <span className="text-[8px] font-black text-amber-200">3º</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-14"></div>
                      )}

                      {/* 4º e 5º lugares listados compactamente */}
                      {rankingAtendimentos.length >= 4 && (
                        <div className="flex flex-col justify-end h-full gap-0.5 pl-2 border-l border-slate-800 text-[8px] text-slate-400 font-mono leading-none">
                          {rankingAtendimentos.slice(3, 5).map((item, idx) => (
                            <div key={item.name} className="flex items-center gap-1">
                              <span className="font-bold text-slate-500">{idx + 4}º</span>
                              <span className="text-slate-300 font-medium truncate max-w-[50px]" title={item.name}>
                                {formatOperatorName(item.name)}
                              </span>
                              <span className="text-[8px] text-slate-500 font-bold">({item.quantidade})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="text-right flex flex-col sm:items-end justify-center shrink-0">
                  <span className="text-xs font-bold text-slate-400 tracking-wider font-mono uppercase">PAINEL GESTÃO À VISTA</span>
                  <span className="text-lg font-black font-mono tracking-wider text-white">
                    {new Date().toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Grid de Cards Auto-Roldável Inteligente */}
              <div 
                ref={tvContainerRef}
                className="flex-1 overflow-y-auto scrollbar-none pr-1"
                style={{ scrollBehavior: 'smooth' }}
              >
                {tvFilteredRequisitions.length === 0 ? (
                  <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-20 text-center text-slate-500 text-sm font-medium">
                    {tvSearchQuery ? 'Nenhuma RM ativa encontrada com este número.' : 'Nenhuma requisição registrada no Supabase.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                    {tvFilteredRequisitions.map((req) => (
                      <div 
                        key={req.rmNumber} 
                        className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors"
                      >
                        <div>
                          {/* Cabeçalho */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div>
                              <span className="font-black text-white text-lg tracking-tight font-mono">RM {req.rmNumber}</span>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {getUrgencyBadge(req.dataNecessidade)}
                                {req.tipoRM && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-indigo-950/80 text-indigo-300 uppercase border border-indigo-900/60 font-mono">
                                    {req.tipoRM}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0">
                              {getStatusBadge(req.status)}
                            </div>
                          </div>

                          {/* Sub-header */}
                          <div className="space-y-1 mb-4 border-t border-slate-800 pt-3">
                            <div className="text-[11px] text-slate-400 font-mono">
                              Emissão: <span className="text-slate-300">{req.dataSolicitacao}</span> | Necessidade: <span className="text-slate-300">{req.dataNecessidade}</span>
                            </div>
                            <div className="text-xs text-slate-300">
                              <span className="font-bold text-slate-400">Requisitante:</span> {req.solicitante} <span className="text-slate-600">•</span> <span className="italic text-slate-400 font-mono text-[11px]">{req.setor}</span>
                            </div>
                          </div>

                          {/* Motivo */}
                          {req.motivo && (
                            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 mb-4">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">Motivo da RM</p>
                              <p className="text-xs text-slate-300 font-medium italic line-clamp-2 leading-relaxed">
                                "{req.motivo}"
                              </p>
                            </div>
                          )}

                          {/* Lista de Itens */}
                          <div className="border-t border-slate-800 pt-3">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Itens ({req.itens.length})</h4>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase font-mono">
                                {req.categoria}
                              </span>
                            </div>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {req.itens.map((it) => (
                                <div 
                                  key={it.id} 
                                  className="flex items-start gap-2 text-xs text-slate-300 bg-slate-950/40 p-2 rounded-xl border border-slate-800 hover:bg-slate-950 transition-colors"
                                >
                                  <span className="font-mono font-bold text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded shrink-0 border border-emerald-900/30">
                                    {it.quantidade} {it.unidade}
                                  </span>
                                  <span className="text-slate-200 font-semibold break-words leading-tight uppercase font-mono">
                                    {it.material}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Parecer do Diligenciador se existir */}
                        {req.parecerDiligenciador && (
                          <div className="mt-4 pt-3 border-t border-slate-800 bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-900/40 text-[11px] text-indigo-200 font-semibold flex gap-1.5 items-start">
                            <HelpCircle className="w-3.5 h-3.5 shrink-0 text-indigo-400 mt-0.5" />
                            <div>
                              <span className="font-bold text-indigo-300 font-mono">PARECER: </span>
                              {req.parecerDiligenciador}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

          </div>
        </main>
      </div>

      {/* Elemento de impressão de alta fidelidade */}
      {printingRm && (
        <div id="print-view" className="hidden print:block bg-white text-slate-900 p-8 font-sans w-full max-w-4xl mx-auto">
          {/* Cabeçalho de Impressão */}
          <div className="border-b-4 border-double border-slate-900 pb-4 mb-6 text-center">
            <h1 className="text-xl font-extrabold tracking-tight uppercase text-slate-900">
              PARECER TÉCNICO DE REQUISIÇÃO - RM {printingRm.rmNumber}
            </h1>
            <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1">
              Controle de Fluxo e Triagem Almoxarifado • CMPC • Impresso em: {new Date().toLocaleString('pt-BR')}
            </div>
          </div>

          {/* Grid de Metadados */}
          <div className="grid grid-cols-3 gap-4 bg-slate-50 border border-slate-200 p-4 rounded-xl mb-6 text-xs">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Requisitante</div>
              <div className="font-semibold text-slate-900 mt-0.5">{printingRm.solicitante || 'Não informado'}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Setor</div>
              <div className="font-semibold text-slate-900 mt-0.5">{printingRm.setor || 'Não informado'}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tratado por</div>
              <div className="font-semibold text-slate-900 mt-0.5 uppercase">{printingRm.agente_tratamento || printingRm.tratado_por || 'Não informado'}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Data de Emissão</div>
              <div className="font-semibold text-slate-900 mt-0.5">{printingRm.dataSolicitacao || 'Não informado'}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Data de Necessidade</div>
              <div className="font-semibold text-slate-900 mt-0.5">{printingRm.dataNecessidade || 'Não informado'}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Início do Tratamento</div>
              <div className="font-semibold text-slate-900 mt-0.5">
                {printingRm.data_inicio_tratamento ? new Date(printingRm.data_inicio_tratamento).toLocaleString('pt-BR') : 'Não informado'}
              </div>
            </div>
          </div>

          {/* NOVO: Bloco de Resumo da Triagem */}
          <div className="border-2 border-slate-900 p-4 rounded-xl mb-6 bg-slate-50/80 text-center print-avoid-break">
            <div className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
              Resumo da Triagem Técnica
            </div>
            <div className="text-sm font-black text-slate-900 uppercase tracking-tight mb-2">
              RECOMENDAÇÃO: {printingRm.acao_recomendada || 'NÃO DEFINIDA'}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-left border-t border-dashed border-slate-300 pt-2 text-xs mt-2">
              <div>
                <span className="font-bold text-slate-500 uppercase text-[9px] tracking-wider block">Documento RTD:</span>
                <span className="font-mono font-black text-sm bg-white px-2 py-0.5 rounded border border-slate-200 shadow-xs inline-block mt-0.5">
                  {printingRm.numero_rtd || 'Não informado'}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-500 uppercase text-[9px] tracking-wider block">Agente de Tratamento:</span>
                <span className="font-semibold text-slate-850 mt-0.5 inline-block font-mono">
                  {printingRm.agente_tratamento || printingRm.tratado_por || 'Almoxarife'}
                </span>
              </div>
            </div>

            {printingRm.parecerDiligenciador && (
              <div className="mt-3 pt-2.5 border-t border-slate-200 text-left text-xs text-slate-700">
                <strong className="text-slate-900 font-bold uppercase text-[9px] tracking-wide block mb-0.5">Parecer Técnico / Justificativa:</strong>
                <p className="italic leading-relaxed">{printingRm.parecerDiligenciador}</p>
              </div>
            )}
          </div>

          {/* Motivo da RM */}
          <div className="mb-6 print-avoid-break">
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1 mb-2">
              Motivo da RM
            </h2>
            <div className="bg-slate-100/60 italic p-3 rounded-lg text-xs text-slate-700 border-l-4 border-indigo-600">
              "{printingRm.motivo || 'Nenhum motivo detalhado informado pelo requisitante.'}"
            </div>
          </div>

          {/* Tabela de Itens com colunas específicas de impressão */}
          <div className="mb-8 print-avoid-break">
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1 mb-2">
              Relação de Materiais e Fluxo de Separação
            </h2>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                  <th className="p-2.5 rounded-l-lg">Código / Descrição do Material</th>
                  <th className="p-2.5 text-center">Qtd Pedida</th>
                  <th className="p-2.5 text-center">Qtd Atendida (Estoque)</th>
                  <th className="p-2.5 text-center">Qtd para Compra</th>
                  <th className="p-2.5 rounded-r-lg text-center border-l border-dashed border-white/20">Visto / Controle</th>
                </tr>
              </thead>
              <tbody>
                {printingRm.itens.map((it) => {
                  const isItemCompra = (it.item_status || 'COMPRA').toUpperCase() === 'COMPRA';
                  const qtdAtendida = it.quantidade_atendida || 0;
                  const qtdCompra = isItemCompra ? it.quantidade : (it.quantidade - (it.quantidade_atendida || 0));

                  return (
                    <tr key={it.id} className="border-b border-slate-200 hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-900 max-w-sm break-words">
                        {it.material}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-700">
                        {it.quantidade} {it.unidade}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-700 bg-emerald-50/10">
                        {qtdAtendida} {it.unidade}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-blue-700 bg-blue-50/10">
                        {qtdCompra} {it.unidade}
                      </td>
                      <td className="p-3 border-l border-dashed border-slate-200 w-24">&nbsp;</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Assinaturas */}
          <div className="flex justify-between mt-12 pt-4 border-t border-slate-200 text-[11px] text-slate-500 print-avoid-break">
            <div className="border-t border-slate-400 w-56 text-center pt-1 font-bold">
              Assinatura do Almoxarife / Diligenciador
            </div>
            <div className="border-t border-slate-400 w-56 text-center pt-1 font-bold">
              Visto do Requisitante / Recebedor
            </div>
          </div>

          {/* Rodapé */}
          <div className="flex justify-between items-center mt-12 text-[10px] text-slate-400 border-t border-slate-100 pt-3 print-avoid-break">
            <span>Documento gerado eletronicamente em {new Date().toLocaleString('pt-BR')}</span>
            <span>SGI CMPC - Controle de RMs</span>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: ASSISTENTE DE CRIAÇÃO DE RM FILHA (MATERNIDADE)
          ==================================================================== */}
      {assistenteFilhaRm && (() => {
        const req = assistenteFilhaRm;
        const centroCusto = req.centroCusto || req._raw?.['Centro de Custo'] || req._raw?.centro_custo || req.setor || 'Não Informado';
        const dataNecessidade = req.dataNecessidade || req.dataSolicitacao || req.dataEmissao || 'Não Informada';
        const motivoTexto = `RM FILHA GERADA PARA COMPRA REFERENTE AO ATENDIMENTO PARCIAL DA RM MÃE Nº ${req.rmNumber}.`;

        const itensCalculados = req.itens.map(it => {
          const qtdSolicitada = Number(it.quantidade || 0);
          const isItemCompra = (it.item_status || '').toUpperCase() === 'COMPRA';
          const qtdAtendida = isItemCompra ? 0 : Number(it.quantidade_atendida ?? it.qtd_atendida ?? 0);
          const qtdComprar = Math.max(0, qtdSolicitada - qtdAtendida);
          const cod = (it as any).codigo || (it as any).codigo_nm || (it as any).codigo_item || (it as any)._raw?.['Código'] || (it as any)._raw?.codigo || '';
          
          return {
            ...it,
            cod,
            qtdSolicitada,
            qtdAtendida,
            qtdComprar
          };
        }).filter(it => it.qtdComprar > 0);

        const formatTextForClipboard = () => {
          const textLines = [
            `=== DADOS PARA CRIAÇÃO DE RM FILHA ===`,
            `RM MÃE: #${req.rmNumber}`,
            `CENTRO DE CUSTO: ${centroCusto}`,
            `DATA DE NECESSIDADE: ${dataNecessidade}`,
            ``,
            `MOTIVO / JUSTIFICATIVA:`,
            `${motivoTexto}`,
            ``,
            `ITENS A SOLICITAR (COMPRA):`
          ];

          if (itensCalculados.length === 0) {
            textLines.push(`(Nenhum item pendente de compra encontrado)`);
          } else {
            itensCalculados.forEach((it, idx) => {
              const itemHeader = it.cod ? `${it.cod} - ${it.material}` : `${it.material}`;
              textLines.push(`${idx + 1}. ${itemHeader}`);
              textLines.push(`   Quantidade a Comprar: ${it.qtdComprar} ${it.unidade || 'UN'}`);
            });
          }

          return textLines.join('\n');
        };

        const handleCopyClipboard = () => {
          const fullText = formatTextForClipboard();
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(fullText).then(() => {
              showToast('Dados da RM Filha copiados para a área de transferência com sucesso!', 'success');
              setAssistenteFilhaRm(null);
            }).catch(err => {
              console.error('Erro ao copiar via Clipboard API:', err);
              showToast('Erro ao copiar dados para a área de transferência.', 'error');
            });
          } else {
            // Fallback para navegadores sem clipboard API direta
            const textArea = document.createElement("textarea");
            textArea.value = fullText;
            document.body.appendChild(textArea);
            textArea.select();
            try {
              document.execCommand('copy');
              showToast('Dados da RM Filha copiados com sucesso!', 'success');
              setAssistenteFilhaRm(null);
            } catch (err) {
              showToast('Erro ao copiar dados.', 'error');
            }
            document.body.removeChild(textArea);
          }
        };

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full border border-purple-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-purple-700/60 rounded-xl border border-purple-500/40">
                    <Baby className="w-5 h-5 text-purple-200" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
                      Assistente de Criação de RM Filha
                    </h3>
                    <p className="text-xs text-purple-200/80 font-medium">
                      Espelho calculado para entrada no ERP (SAP/Sankhya) • RM Mãe #{req.rmNumber}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAssistenteFilhaRm(null)}
                  className="p-1.5 rounded-lg text-purple-200 hover:text-white hover:bg-purple-700/50 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-xs">
                {/* Grid: Centro de Custo + Data de Necessidade */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100">
                    <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider block mb-0.5">
                      Centro de Custo
                    </span>
                    <span className="font-bold text-slate-800 text-sm block">
                      {centroCusto}
                    </span>
                  </div>
                  <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100">
                    <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider block mb-0.5">
                      Data de Necessidade
                    </span>
                    <span className="font-bold text-slate-800 text-sm block">
                      {dataNecessidade}
                    </span>
                  </div>
                </div>

                {/* Motivo / Justificativa */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                    Motivo / Justificativa (Preenchimento Automático ERP):
                  </label>
                  <textarea
                    readOnly
                    rows={2}
                    value={motivoTexto}
                    className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg p-2.5 outline-none resize-none cursor-text select-all"
                  />
                </div>

                {/* Itens a Solicitar (Cálculo) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase text-purple-950 tracking-wider flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-purple-600" />
                      Itens a Solicitar ({itensCalculados.length}):
                    </span>
                    <span className="text-[10px] text-slate-500 italic">
                      Apenas saldos pendentes de compra
                    </span>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {itensCalculados.length === 0 ? (
                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center text-amber-800 font-medium">
                        Nenhum item pendente de compra nesta RM.
                      </div>
                    ) : (
                      itensCalculados.map((it, idx) => (
                        <div key={it.id || idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:border-purple-200 transition-all flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-900 text-xs truncate">
                              {it.cod ? `${it.cod} - ${it.material}` : it.material}
                            </div>
                            <div className="text-[10.5px] text-slate-500 mt-0.5">
                              Solicitado: <strong className="text-slate-700">{it.qtdSolicitada}</strong> | Atendido: <strong className="text-emerald-700">{it.qtdAtendida}</strong>
                            </div>
                          </div>
                          <div className="bg-purple-100 text-purple-900 px-3 py-1.5 rounded-lg border border-purple-200 text-right shrink-0">
                            <span className="text-[9px] font-black uppercase text-purple-700 block leading-tight">Qtd a Comprar</span>
                            <span className="font-mono font-black text-sm text-purple-950">
                              {it.qtdComprar} <span className="text-xs font-normal text-purple-800">{it.unidade}</span>
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAssistenteFilhaRm(null)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 font-bold text-xs text-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleCopyClipboard}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copiar para Área de Transferência</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
