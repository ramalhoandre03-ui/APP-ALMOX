import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  Search, 
  ArrowLeft, 
  FileText, 
  Printer, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Database, 
  Building, 
  MapPin, 
  DollarSign, 
  Clock, 
  Briefcase,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  Hash,
  X,
  ExternalLink,
  AlertTriangle,
  Filter,
  Eye,
  Calendar,
  Info,
  User,
  Lock,
  XCircle,
  Package,
  PackageSearch
} from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import ConsultaPedidosMestreDetalhe from './ConsultaPedidosMestreDetalhe';
import RastreioPedidoCompra from './RastreioPedidoCompra';
import MonitorCompras from './MonitorCompras';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { PRE_REGISTERED_EMPLOYEES } from './ExtraHoursPanel';
import {
  BarChart as ReChartsBarChart,
  Bar as ReChartsBar,
  XAxis as ReChartsXAxis,
  YAxis as ReChartsYAxis,
  CartesianGrid as ReChartsCartesianGrid,
  Tooltip as ReChartsTooltip,
  ResponsiveContainer as ReChartsResponsiveContainer,
  Cell as ReChartsCell,
  Legend as ReChartsLegend,
  LabelList as ReChartsLabelList
} from 'recharts';

import { 
  TrendingUp, 
  BarChart2, 
  Users, 
  Award, 
  Activity
} from 'lucide-react';

const normalizarNomeOperador = (nomeBruto: string | null | undefined): string => {
  if (!nomeBruto) return 'NÃO IDENTIFICADO';
  let nome = nomeBruto.trim().toUpperCase();
  if (nome.includes('WIDERLEY')) return 'WIDERLEY VIEIRA DA SILVA';
  return nome;
};

interface ConsultaPedidosProps {
  onBackToHub: () => void;
  pedidoId?: string;
  isTVMode?: boolean;
}

// Interface para representação do pedido
interface ItemPedido {
  codigo: string;
  descricao: string;
  quantidade?: number;
  qtd: number;
  valorUnitario?: number;
  vl_unitario: number;
  valorTotal?: number;
  vl_total: number;
  ocorrencia?: string;
  ocorrencia_fiscal?: string;
  ocorrencias?: any[];
  historico?: any[];
  logs?: any[];
  status_item?: string;
  qtd_pedida?: number;
  qtd_recebida_erp?: number;
  saldo_pendente?: number;
}

interface PedidoCompra {
  numeroPedido: string;
  status: 'Aprovado' | 'Pendente' | 'Em Análise';
  dataEmissao: string;
  fornecedor: {
    razao_social: string;
    razaoSocial?: string;
    cnpj: string;
    contato: string;
    endereco: string;
  };
  itens: ItemPedido[];
  centro_custo: string;
  centroDeCusto?: string;
  condicaoPagamento: string;
  observacoes: string;
  comprador?: string;
  classes_financeiras?: string[];
  classes?: string[];
}

interface CheckInRecord {
  id?: string;
  numero_pc: string;
  fornecedor: string;
  status_recebimento: 'total' | 'parcial' | 'reagendar' | 'recusar';
  registrado_em: string;
  recebedor: string;
  detalhes?: string;
  numero_nf?: string;
  centro_custo?: string;
  itens_conferidos?: Array<{
    codigo: string;
    descricao: string;
    qtd_original: number;
    qtd_entregue: number;
  }>;
}

// Extração e validação de Classes Financeiras (Regra de Negócio de Estoque)
export const getClassesList = (input: any): string[] => {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input.map(x => String(x || '').trim()).filter(Boolean);
  }

  if (typeof input === 'string') {
    return input.split(/;|\n|,/).map(s => s.trim()).filter(Boolean);
  }

  if (typeof input === 'object') {
    const list: string[] = [];
    if (input.classes_financeiras) {
      if (Array.isArray(input.classes_financeiras)) list.push(...input.classes_financeiras.map((c: any) => String(c || '')));
      else list.push(String(input.classes_financeiras));
    }

    if (input.classes && Array.isArray(input.classes)) {
      list.push(...input.classes.map((c: any) => String(c || '')));
    } else if (typeof input.classes === 'string') {
      list.push(input.classes);
    }

    if (input.classe_financeira) {
      if (Array.isArray(input.classe_financeira)) list.push(...input.classe_financeira.map((c: any) => String(c || '')));
      else list.push(String(input.classe_financeira));
    }
    if (input.classeFinanceira) {
      if (Array.isArray(input.classeFinanceira)) list.push(...input.classeFinanceira.map((c: any) => String(c || '')));
      else list.push(String(input.classeFinanceira));
    }

    if (input.items && Array.isArray(input.items)) {
      input.items.forEach((it: any) => {
        if (it.classes_financeiras) {
          if (Array.isArray(it.classes_financeiras)) list.push(...it.classes_financeiras.map((c: any) => String(c || '')));
          else list.push(String(it.classes_financeiras));
        }
        if (it.classe_financeira) {
          if (Array.isArray(it.classe_financeira)) list.push(...it.classe_financeira.map((c: any) => String(c || '')));
          else list.push(String(it.classe_financeira));
        }
        if (it.classeFinanceira) {
          if (Array.isArray(it.classeFinanceira)) list.push(...it.classeFinanceira.map((c: any) => String(c || '')));
          else list.push(String(it.classeFinanceira));
        }
        if (it.classe) list.push(String(it.classe));
        if (it.rateio) {
          if (Array.isArray(it.rateio)) list.push(...it.rateio.map((c: any) => String(c || '')));
          else list.push(String(it.rateio));
        }
        if (it.record?.classe_financeira) list.push(String(it.record.classe_financeira));
        if (it.record?.classes_financeiras) {
          if (Array.isArray(it.record.classes_financeiras)) list.push(...it.record.classes_financeiras.map((c: any) => String(c || '')));
          else list.push(String(it.record.classes_financeiras));
        }
      });
    }

    return Array.from(new Set(list.map(s => s.trim()).filter(Boolean)));
  }

  return [];
};

/**
 * Lógica de Identificação de Estoque (Regra de Negócio):
 * Retorna true se pelo menos uma das classes contiver a palavra "(ESTOQUE)" (independente de case).
 * Mesmo em pedidos mistos (Estoque + Custo/Despesa), ter ao menos 1 classe de Estoque roteia o pedido para a aba "Recebimentos de Estoque".
 */
export const isPedidoEstoque = (classesFinanceiras: any): boolean => {
  const classes = getClassesList(classesFinanceiras);
  return classes.some(c => {
    const u = c.toUpperCase();
    return u.includes('(ESTOQUE)') || u.includes('ESTOQUE');
  });
};

/**
 * Retorna se o pedido é de estoque e se possui Rateio Misto
 * (ex: possui classe de (ESTOQUE) E também possui classe de (CUSTO) ou (DESPESA))
 */
export const checkEstoqueStatus = (classesFinanceiras: any): { isEstoque: boolean; isRateioMisto: boolean; classes: string[] } => {
  const classes = getClassesList(classesFinanceiras);
  const isEstoque = classes.some(c => {
    const u = c.toUpperCase();
    return u.includes('(ESTOQUE)') || u.includes('ESTOQUE');
  });
  const hasOutros = classes.some(c => {
    const u = c.toUpperCase();
    return u.includes('(CUSTO)') || u.includes('(DESPESA)') || u.includes('CUSTO') || u.includes('DESPESA') || (u.includes('(') && !u.includes('ESTOQUE'));
  });
  const isRateioMisto = isEstoque && hasOutros;
  return { isEstoque, isRateioMisto, classes };
};


const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStartOfMonthString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

const calcularQuantidadeRealtime = (item: any): number => {
  if (!item) return 0;
  
  // 1. Capture the list/array of occurrences
  let list: any[] = [];
  if (Array.isArray(item.ocorrencias)) {
    list = item.ocorrencias;
  } else if (Array.isArray(item.ocorrencia_lista)) {
    list = item.ocorrencia_lista;
  } else if (Array.isArray(item.historico)) {
    list = item.historico;
  } else {
    const ocorrenciaStr = item.ocorrencia || item.ocorrencia_fiscal || '';
    if (typeof ocorrenciaStr === 'string' && ocorrenciaStr.trim() !== '') {
      list = ocorrenciaStr.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    }
  }
  
  let total = 0;
  
  list.forEach(occ => {
    let text = '';
    if (typeof occ === 'string') {
      text = occ;
    } else if (occ && typeof occ === 'object') {
      text = occ.texto || occ.descricao || occ.historico || occ.ocorrencia || occ.mensagem || JSON.stringify(occ);
    }
    
    const textLower = text.toLowerCase();
    
    const isAddition = textLower.includes('baixado') || 
                       textLower.includes('recebido') || 
                       textLower.includes('no recebimento') ||
                       textLower.includes('entrada') ||
                       textLower.includes('lançado') ||
                       textLower.includes('lancado');
                       
    const isSubtraction = textLower.includes('excluído') || 
                          textLower.includes('excluido') || 
                          textLower.includes('cancelado') || 
                          textLower.includes('estornado') ||
                          textLower.includes('devolvido');
    
    // 1. Extração do Valor Numérico (Regex):
    const match = text.match(/Qtde\s*\(([\d.,]+)\)/i);
    let quantidade = 0;
    
    if (match) {
      // 2. Sanitização do Formato Brasileiro (String para Float):
      const capturado = match[1];
      const valorLimpo = capturado.replace(/\./g, '').replace(',', '.');
      quantidade = parseFloat(valorLimpo) || 0;
    } else {
      // Fallback robusto se não achar o padrão Qtde (X)
      const fallbackMatch = text.match(/Quantidade:?\s*([\d.,]+)/i) || text.match(/([\d.,]+)\s*unidades/i);
      if (fallbackMatch) {
        const capturado = fallbackMatch[1];
        const valorLimpo = capturado.replace(/\./g, '').replace(',', '.');
        quantidade = parseFloat(valorLimpo) || 0;
      } else if (occ && typeof occ === 'object') {
        quantidade = Number(occ.quantidade !== undefined ? occ.quantidade : (occ.qtd !== undefined ? occ.qtd : 0));
      }
    }
    
    if (isNaN(quantidade)) quantidade = 0;
    
    // 3. Aplicação da Lógica de Operação:
    if (isAddition) {
      total += quantidade;
    } else if (isSubtraction) {
      total -= quantidade;
    } else if (match) {
      // Se tiver padrão mas não especificar a operação explicitly, assumimos adição por padrão
      total += quantidade;
    }
  });
  
  return Math.max(0, total);
};

const calculateLiquidQuantity = (ocorrencia?: string): number => {
  if (!ocorrencia) return 0;
  const lines = ocorrencia.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  
  const total = lines.reduce((acc, line) => {
    const lineLower = line.toLowerCase();
    
    const isSubtraction = lineLower.includes("excluído") || 
                          lineLower.includes("excluido") || 
                          lineLower.includes("cancelado") || 
                          lineLower.includes("estornado") || 
                          lineLower.includes("devolvido");
                          
    const isAddition = lineLower.includes("baixado") || 
                        lineLower.includes("recebido") || 
                        lineLower.includes("entrada") ||
                        lineLower.includes("lançado") ||
                        lineLower.includes("lancado") ||
                        lineLower.includes("no recebimento");
                        
    // 1. Extração do Valor Numérico (Regex):
    const match = line.match(/Qtde\s*\(([\d.,]+)\)/i);
    if (!match) {
      // Tenta fallback com Quantidade se não achar o match principal
      const fallbackMatch = line.match(/Quantidade:?\s*([\d.,]+)/i) || line.match(/([\d.,]+)\s*unidades/i);
      if (!fallbackMatch) return acc;
      
      const capturado = fallbackMatch[1];
      const valorLimpo = capturado.replace(/\./g, '').replace(',', '.');
      const quantidade = parseFloat(valorLimpo) || 0;
      
      if (isSubtraction) {
        return acc - quantidade;
      } else {
        return acc + quantidade;
      }
    }
    
    // 2. Sanitização do Formato Brasileiro (String para Float):
    const capturado = match[1];
    const valorLimpo = capturado.replace(/\./g, '').replace(',', '.');
    const quantidade = parseFloat(valorLimpo) || 0;
    
    if (isNaN(quantidade)) return acc;
    
    // 3. Aplicação da Lógica de Operação:
    if (isSubtraction) {
      return acc - quantidade;
    } else if (isAddition) {
      return acc + quantidade;
    } else {
      return acc + quantidade; // Adiciona por padrão se não encaixar nas palavras-chave específicas mas tiver quantidade
    }
  }, 0);
  
  return Math.max(0, total);
};

// Helper function to normalize NF string to clean digits or lowercase string
const cleanNF = (nf?: string): string => {
  if (!nf) return '';
  const digitsOnly = nf.replace(/\D/g, '').replace(/^0+/, '');
  return digitsOnly || nf.trim().toLowerCase();
};

// Helper function to check if two NFs match
const isNFMatch = (nf1?: string, nf2?: string): boolean => {
  const c1 = cleanNF(nf1);
  const c2 = cleanNF(nf2);
  if (!c1 || !c2) return false;
  return c1 === c2;
};

// Helper function to extract all NFs mentioned in a line of text
const getLineNFs = (line: string): string[] => {
  if (!line) return [];
  const nfs: string[] = [];
  const matches = line.matchAll(/(?:NF|NFe|NF-e|Nota\s*Fiscal|Doc|Documento)\s*[:.#-]?\s*(?:nº?\s*)?(\d+)/gi);
  for (const m of matches) {
    if (m[1]) {
      const cleaned = cleanNF(m[1]);
      if (cleaned && !nfs.includes(cleaned)) {
        nfs.push(cleaned);
      }
    }
  }
  return nfs;
};

// Função utilitária para extrair Data e Quantidade da ocorrência fiscal usando Expressões Regulares e Chave Composta (PC + Item + NF)
const extractFiscalData = (ocorrencia?: string, targetNF?: string) => {
  if (!ocorrencia) return { data: '-', qtd: '-' };
  
  const rawLines = ocorrencia.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const cleanedTargetNF = cleanNF(targetNF);

  // Filter lines if targetNF is provided
  const lines = rawLines.filter(line => {
    if (!cleanedTargetNF || cleanedTargetNF === '-' || cleanedTargetNF === 'sem_nf') return true;

    const lineNFs = getLineNFs(line);
    if (lineNFs.length > 0) {
      // If line explicitly mentions NFs, it MUST include cleanedTargetNF
      return lineNFs.includes(cleanedTargetNF);
    }

    // If line doesn't explicitly mention "NF XXX", check if line contains target NF digits
    if (cleanedTargetNF.length >= 2 && line.includes(cleanedTargetNF)) {
      return true;
    }

    // Check if whole occurrence text mentions other NFs and not targetNF
    const allNFsInOcorrencia = getLineNFs(ocorrencia);
    if (allNFsInOcorrencia.length > 0 && !allNFsInOcorrencia.includes(cleanedTargetNF)) {
      return false; // Occurrence belongs to a different NF
    }

    // CRITICAL FIX: If targetNF is specified and neither the line nor the full occurrence contains targetNF digits,
    // do NOT attribute generic unlabelled fiscal logs to this targetNF!
    if (cleanedTargetNF && !line.includes(cleanedTargetNF) && !ocorrencia.includes(cleanedTargetNF)) {
      return false;
    }

    return true;
  });

  if (lines.length === 0) {
    return { data: '-', qtd: '-' };
  }
  
  let lastDate = '-';
  for (let i = lines.length - 1; i >= 0; i--) {
    const dateMatch = lines[i].match(/\[(\d{2}\/\d{2}\/\d{4})\]/);
    if (dateMatch) {
      lastDate = dateMatch[1];
      break;
    }
  }
  
  if (lastDate === '-') {
    for (let i = lines.length - 1; i >= 0; i--) {
      const dateMatch = lines[i].match(/(\d{2}\/\d{2}\/\d{4})/);
      if (dateMatch) {
        lastDate = dateMatch[1];
        break;
      }
    }
  }

  // Calculate liquid quantity from filtered lines
  const liquidQty = lines.reduce((acc, line) => {
    const lineLower = line.toLowerCase();
    
    const isSubtraction = lineLower.includes("excluído") || 
                          lineLower.includes("excluido") || 
                          lineLower.includes("cancelado") || 
                          lineLower.includes("estornado") || 
                          lineLower.includes("devolvido");
                          
    const isAddition = lineLower.includes("baixado") || 
                        lineLower.includes("recebido") || 
                        lineLower.includes("entrada") ||
                        lineLower.includes("lançado") ||
                        lineLower.includes("lancado") ||
                        lineLower.includes("no recebimento");
                        
    const match = line.match(/Qtde\s*\(([\d.,]+)\)/i);
    let quantidade = 0;

    if (match) {
      const capturado = match[1];
      const valorLimpo = capturado.replace(/\./g, '').replace(',', '.');
      quantidade = parseFloat(valorLimpo) || 0;
    } else {
      const fallbackMatch = line.match(/Quantidade:?\s*([\d.,]+)/i) || line.match(/([\d.,]+)\s*unidades/i);
      if (fallbackMatch) {
        const capturado = fallbackMatch[1];
        const valorLimpo = capturado.replace(/\./g, '').replace(',', '.');
        quantidade = parseFloat(valorLimpo) || 0;
      }
    }

    if (isNaN(quantidade)) return acc;

    if (isSubtraction) {
      return acc - quantidade;
    } else if (isAddition) {
      return acc + quantidade;
    } else if (match) {
      return acc + quantidade;
    }
    return acc;
  }, 0);
  
  const finalQty = Math.max(0, liquidQty);

  return {
    data: lastDate,
    qtd: finalQty > 0 ? finalQty.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 }) : '-'
  };
};

const parseFiscalQtd = (qtdStr: string): number => {
  if (!qtdStr || qtdStr === '-') return 0;
  const cleaned = qtdStr.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export default function ConsultaPedidos({ onBackToHub, pedidoId, isTVMode = false }: ConsultaPedidosProps) {
  const { session } = useAuth();
  const isAdmin = session?.perfil === 'Administrador' || session?.perfil?.toUpperCase() === 'ADMIN';

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [dadosPedido, setDadosPedido] = useState<PedidoCompra | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isSimulatedFallback, setIsSimulatedFallback] = useState(false);

  // Estados de Roteamento Dinâmico e Data Binding do Supabase
  const [pedidoAtual, setPedidoAtual] = useState<string>(pedidoId || '');
  const [itensPedidoSupabase, setItensPedidoSupabase] = useState<any[]>([]);
  const [loadingItensSupabase, setLoadingItensSupabase] = useState(false);
  const [dadosRateioBI, setDadosRateioBI] = useState<any[]>([]);
  const [loadingRateioBI, setLoadingRateioBI] = useState(false);

  // Estados de Abas / Navegação e Histórico de Check-ins
  const [activeTab, setActiveTab] = useState<'consulta' | 'monitoramento' | 'recebimento_estoque' | 'senior_rastreio' | 'monitor_compras_rpa'>('consulta');
  const [recebimentosItens, setRecebimentosItens] = useState<any[]>([]);
  const [recebimentosPC, setRecebimentosPC] = useState<any[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // Estados dos Filtros da Aba 2 e Modal de Detalhes
  const todayStr = getTodayDateString();
  const startOfMonthStr = getStartOfMonthString();
  const [searchQueryMonitoramento, setSearchQueryMonitoramento] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'total' | 'parcial' | 'reagendar' | 'recusar'>('all');
  const [startDateFilter, setStartDateFilter] = useState<string>(() => isTVMode ? startOfMonthStr : todayStr);
  const [endDateFilter, setEndDateFilter] = useState<string>(todayStr);
  const [selectedRecordDetails, setSelectedRecordDetails] = useState<CheckInRecord | null>(null);
  const [selectedGroupDetails, setSelectedGroupDetails] = useState<any | null>(null);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editQtd, setEditQtd] = useState<number>(0);
  const [editData, setEditData] = useState<string>('');
  const [deletingItem, setDeletingItem] = useState<any | null>(null);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    try {
      const { error } = await supabase
        .from('recebimentos_itens')
        .delete()
        .eq('id', deletingItem.id_original_db);

      if (error) {
        throw error;
      }

      // Log deletion activity
      try {
        await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'PHYSICAL_CANCEL',
            timestamp: new Date().toISOString(),
            description: `[Almoxarifado] Cancelamento de recebimento do PC ${deletingItem.numero_pc}, item ${deletingItem.codigo}. Saldo retornado ao pedido.`,
            details: deletingItem
          })
        });
      } catch (_) {}

      await carregarRecebimentosItens();
      setSyncSuccessMsg("Recebimento cancelado com sucesso. O saldo retornou ao pedido!");
    } catch (err: any) {
      console.error("Erro ao cancelar recebimento:", err);
      setSyncErrorMsg("Erro ao cancelar recebimento: " + (err.message || err));
    } finally {
      setDeletingItem(null);
    }
  };

  const handleConfirmEdit = async () => {
    if (!editingItem) return;
    try {
      const newSaldoPendente = Math.max(0, Number(editingItem.qtd_original) - Number(editQtd));
      const newStatusFisico = newSaldoPendente <= 0 ? 'total' : 'parcial';

      const { error } = await supabase
        .from('recebimentos_itens')
        .update({
          qtd_recebida: editQtd,
          data_recebimento: editData,
          saldo_pendente: newSaldoPendente,
          status_fisico: newStatusFisico
        })
        .eq('id', editingItem.id_original_db);

      if (error) {
        throw error;
      }

      // Log editing activity
      try {
        await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'PHYSICAL_EDIT',
            timestamp: new Date().toISOString(),
            description: `[Almoxarifado] Edição de recebimento do PC ${editingItem.numero_pc}, item ${editingItem.codigo}. Nova Qtd: ${editQtd}, Nova Data: ${editData}`,
            details: { ...editingItem, nova_qtd: editQtd, nova_data: editData }
          })
        });
      } catch (_) {}

      await carregarRecebimentosItens();
      setSyncSuccessMsg("Recebimento atualizado com sucesso!");
    } catch (err: any) {
      console.error("Erro ao editar recebimento:", err);
      setSyncErrorMsg("Erro ao editar recebimento: " + (err.message || err));
    } finally {
      setEditingItem(null);
    }
  };

  const carregarRecebimentosItens = async () => {
    setLoadingHistorico(true);
    try {
      const queryTerm = searchQueryMonitoramento.trim();
      const hasSearch = queryTerm.length > 0;

      let todosOsDados: any[] = [];
      let inicio = 0;
      const pageSize = 1000;
      let temMais = true;
      let pageCount = 0;
      const maxPages = 15;

      while (temMais && pageCount < maxPages) {
        let req = supabase
          .from('recebimentos_itens')
          .select('*');

        // Se houver termo de busca, filtra por ILIKE nos campos principais
        if (hasSearch) {
          req = req.or(`numero_pc.ilike.%${queryTerm}%,fornecedor.ilike.%${queryTerm}%,nota_fiscal.ilike.%${queryTerm}%,codigo_item.ilike.%${queryTerm}%,descricao_item.ilike.%${queryTerm}%,conferente.ilike.%${queryTerm}%,centro_custo.ilike.%${queryTerm}%`);
        }

        // Filtro estrito pelo período selecionado (GTE e LTE em data_entrada)
        if (startDateFilter) {
          req = req.gte('data_entrada', startDateFilter);
        }
        if (endDateFilter) {
          req = req.lte('data_entrada', `${endDateFilter}T23:59:59.999Z`);
        }

        if (statusFilter !== 'all') {
          req = req.eq('status_fisico', statusFilter);
        }

        const { data, error } = await req
          .order('data_entrada', { ascending: false })
          .range(inicio, inicio + pageSize - 1);

        if (error) {
          console.error("Erro no fetch de recebimentos_itens:", error);
          // Fallback sem ordenação
          let fallbackReq = supabase.from('recebimentos_itens').select('*');
          if (hasSearch) {
            fallbackReq = fallbackReq.or(`numero_pc.ilike.%${queryTerm}%,fornecedor.ilike.%${queryTerm}%,nota_fiscal.ilike.%${queryTerm}%,codigo_item.ilike.%${queryTerm}%,descricao_item.ilike.%${queryTerm}%`);
          }
          if (startDateFilter) fallbackReq = fallbackReq.gte('data_entrada', startDateFilter);
          if (endDateFilter) fallbackReq = fallbackReq.lte('data_entrada', `${endDateFilter}T23:59:59.999Z`);
          if (statusFilter !== 'all') {
            fallbackReq = fallbackReq.eq('status_fisico', statusFilter);
          }

          const { data: fallbackData, error: fallbackError } = await fallbackReq.range(inicio, inicio + pageSize - 1);
            
          if (fallbackError) {
             console.error("Erro no fallback de recebimentos_itens:", fallbackError);
             break;
          } else if (fallbackData && fallbackData.length > 0) {
             todosOsDados = [...todosOsDados, ...fallbackData];
             pageCount++;
             if (fallbackData.length < pageSize) temMais = false;
             else inicio += pageSize;
          } else {
             temMais = false;
          }
        } else if (data && data.length > 0) {
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
      
      setRecebimentosItens(todosOsDados);
      if (dadosPedido?.numeroPedido) {
        fetchRecebimentosPC(dadosPedido.numeroPedido);
      }
    } catch (err) {
      console.warn('Exceção ao buscar recebimentos_itens:', err);
    } finally {
      setLoadingHistorico(false);
    }
  };

  const fetchRecebimentosPC = async (pcNum: string) => {
    if (!pcNum) return;
    const cleanNum = String(pcNum).trim().toLowerCase();
    const cleanNFVal = cleanNF(cleanNum) || cleanNum;
    try {
      let allPCRecords: any[] = [];
      let start = 0;
      const pageSize = 1000;
      let hasMore = true;
      let pageCount = 0;
      const maxPages = 10;

      while (hasMore && pageCount < maxPages) {
        const { data, error } = await supabase
          .from('recebimentos_itens')
          .select('*')
          .or(`numero_pc.ilike.%${cleanNum}%,numero_pc.ilike.%${cleanNFVal}%`)
          .range(start, start + pageSize - 1);

        if (error) {
           console.warn("Erro ao buscar histórico do PC no while loop:", error);
           break;
        } else if (data && data.length > 0) {
           allPCRecords = [...allPCRecords, ...data];
           pageCount++;
           if (data.length < pageSize) {
             hasMore = false;
           } else {
             start += pageSize;
           }
        } else {
           hasMore = false;
        }
      }
      
      if (allPCRecords.length > 0) {
         setRecebimentosPC(allPCRecords);
      } else {
         const filtered = recebimentosItens.filter(r => {
            const rPC = String(r.numero_pc || r.pc || '').trim().toLowerCase();
            const rCleanPC = cleanNF(rPC) || rPC;
            return rPC === cleanNum || rCleanPC === cleanNFVal || rPC.includes(cleanNum) || cleanNum.includes(rPC);
         });
         setRecebimentosPC(filtered);
      }
    } catch (err) {
      console.warn("Erro ao buscar histórico de recebimentos do PC:", err);
    }
  };

  useEffect(() => {
    if (isTVMode) {
      setStartDateFilter(getStartOfMonthString());
      setEndDateFilter(getTodayDateString());
    }
  }, [isTVMode]);

  // Tickle / Force Reset de Atividade para Modo TV a cada 5 minutos (300.000 ms)
  useEffect(() => {
    if (!isTVMode) return;

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
  }, [isTVMode]);

  useEffect(() => {
    carregarRecebimentosItens();
  }, [activeTab, searchQueryMonitoramento, statusFilter, startDateFilter, endDateFilter, isTVMode]);

  // Estados de Registro de Entrada Física / Check-in
  const [statusRecebimento, setStatusRecebimento] = useState<'total' | 'parcial' | 'reagendar' | 'recusar' | null>('total');
  const [nomeRecebedor, setNomeRecebedor] = useState('');
  const [numeroNF, setNumeroNF] = useState('');
  const [dataRecebimento, setDataRecebimento] = useState(getTodayDateString());
  const [previsaoSaldoRestante, setPrevisaoSaldoRestante] = useState('');
  const [novaDataPrometida, setNovaDataPrometida] = useState('');
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [observacoesCheckIn, setObservacoesCheckIn] = useState('');
  const [qtdsEntregues, setQtdsEntregues] = useState<{ [codigo: string]: number }>({});
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInSuccessMsg, setCheckInSuccessMsg] = useState<string | null>(null);

  // Estados para Modal de Sucesso (SweetAlert / Overlay)
  const [successOverlay, setSuccessOverlay] = useState<{
    isOpen: boolean;
    quantity: number;
    description: string;
    isSingle: boolean;
  }>({
    isOpen: false,
    quantity: 0,
    description: '',
    isSingle: true,
  });

  const handleCloseSuccessOverlay = async () => {
    setSuccessOverlay({
      isOpen: false,
      quantity: 0,
      description: '',
      isSingle: true,
    });
    setCheckInItem(null);
    setCheckInSuccessMsg(null);
    setErrorMsg(null);
    
    // Reset checkin inputs
    setSingleNomeRecebedor('');
    setSingleNumeroNF('');
    setCheckInQtd('');

    // Also reset bulk inputs
    setNomeRecebedor('');
    setNumeroNF('');
    setPrevisaoSaldoRestante('');
    setNovaDataPrometida('');
    setMotivoRecusa('');
    setObservacoesCheckIn('');
    setQtdsEntregues({});
    setStatusRecebimento('total');

    await carregarRecebimentosItens();
  };

  // Estados para Check-in individual de item (Modal)
  const [checkInItem, setCheckInItem] = useState<any | null>(null);
  const [checkInQtd, setCheckInQtd] = useState<number | string>('');
  const [singleNomeRecebedor, setSingleNomeRecebedor] = useState('');
  const [singleNumeroNF, setSingleNumeroNF] = useState('');
  const [singleDataRecebimento, setSingleDataRecebimento] = useState(getTodayDateString());
  const [singleStatusRecebimento, setSingleStatusRecebimento] = useState<'total' | 'parcial'>('total');

  // Estados para sincronização fiscal (Aba 2)
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null);

  const handleSincronizarLancamentosFiscais = async () => {
    setSyncLoading(true);
    setSyncProgress({ current: 0, total: 0 });
    setSyncSuccessMsg(null);
    setSyncErrorMsg(null);
    try {
      // Passo A: Select no Supabase de todos os itens
      const { data: allItems, error: selectError } = await supabase
        .from('recebimentos_itens')
        .select('*');

      if (selectError) {
        throw new Error('Falha ao consultar recebimentos_itens no Supabase: ' + selectError.message);
      }

      // Filtrar itens locais que estão com a ocorrencia_fiscal vazia ou nula (pendentes de lançamento)
      const pendingItems = (allItems || []).filter(item => !item.ocorrencia_fiscal || item.ocorrencia_fiscal.trim() === '');

      if (pendingItems.length === 0) {
        setSyncSuccessMsg("Sincronização concluída: Todos os lançamentos fiscais já estão atualizados!");
        return;
      }

      // Passo B: Agrupar os números de pedido (numero_pc) únicos
      const uniquePCs = Array.from(new Set(pendingItems.map(item => item.numero_pc).filter(Boolean)));
      setSyncProgress({ current: 0, total: uniquePCs.length });

      let updatedCount = 0;
      let currentCount = 0;

      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token || '';

      // Passo C: Fetch na API para cada pedido pendente
      for (const pc of uniquePCs) {
        currentCount++;
        setSyncProgress({ current: currentCount, total: uniquePCs.length });
        try {
          const response = await fetch(`/api/consultar-pc?numero=${encodeURIComponent(pc)}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (!response.ok) {
            console.warn(`[SYNC] API retornou erro para o pedido ${pc}: Código ${response.status}`);
            continue;
          }
          const apiData = await response.json();
          const apiItems = Array.isArray(apiData?.itens) ? apiData.itens : (Array.isArray(apiData?.items) ? apiData.items : []);

          // Filtrar itens locais deste PC que estão pendentes
          const localPendingItemsForPC = pendingItems.filter(item => item.numero_pc === pc);

          for (const localItem of localPendingItemsForPC) {
            // Passo D: Compare por código ou descrição
            const matchedApiItem = apiItems.find((apiItem: any) => {
              const apiCod = (apiItem.codigo || apiItem.codigo_item || apiItem.cod || apiItem.sku || apiItem.id || '').toString().toLowerCase().trim();
              const apiDesc = (apiItem.descricao || apiItem.descricao_item || apiItem.nome || apiItem.description || apiItem.nome_item || '').toString().toLowerCase().trim();

              const localCod = (localItem.codigo_item || '').toString().toLowerCase().trim();
              const localDesc = (localItem.descricao_item || '').toString().toLowerCase().trim();

              return (localCod && apiCod && localCod === apiCod) || (localDesc && apiDesc && localDesc === apiDesc);
            });

            if (matchedApiItem) {
              const ocorrText = matchedApiItem.ocorrencia || matchedApiItem.ocorrencia_fiscal || matchedApiItem.ocorrenciaFiscal || '';
              if (ocorrText && ocorrText.trim() !== '') {
                // Atualizar o registro no Supabase (o scraper já envia o histórico consolidado por check-in físico)
                const { error: updateError } = await supabase
                  .from('recebimentos_itens')
                  .update({ ocorrencia_fiscal: ocorrText.trim() })
                  .eq('id', localItem.id);

                if (updateError) {
                  console.error(`[SYNC] Erro ao atualizar item ${localItem.id}:`, updateError);
                } else {
                  updatedCount++;
                }
              }
            }
          }
        } catch (err) {
          console.warn(`[SYNC] Erro ao processar PC ${pc}:`, err);
        }
      }

      // Passo E: Recarregar dados e mostrar sucesso
      await carregarRecebimentosItens();
      setSyncSuccessMsg(`Sincronização concluída: ${updatedCount} ${updatedCount === 1 ? 'item atualizado' : 'itens atualizados'} com sucesso!`);
    } catch (err: any) {
      console.error(err);
      setSyncErrorMsg("Erro durante a sincronização fiscal: " + (err.message || err));
    } finally {
      setSyncLoading(false);
      setSyncProgress({ current: 0, total: 0 });
    }
  };

  const getRecebimentosDoItem = (itemCodigo: string) => {
    if (!dadosPedido) return [];
    const targetCod = String(itemCodigo || '').trim().toLowerCase();
    if (!targetCod) return [];

    // Array global/cru de ocorrências para o pedido atual.
    // Usamos recebimentosPC que tem todos os dados puxados da base para esse pedido específico.
    const baseArray = recebimentosPC.length > 0 ? recebimentosPC : recebimentosItens;

    // Filtro direto (1:1), sem agrupamento, sem Map() ou deduplicação, como solicitado
    return baseArray.filter((r) => {
      const rCod = String(r.codigo_item || r.codigo || r.codigo_do_item || '').trim().toLowerCase();
      const codMatch = rCod === targetCod || (targetCod && rCod && targetCod.includes(rCod)) || (rCod && targetCod && rCod.includes(targetCod));
      
      const rPC = String(r.numero_pc || r.pc || '').trim().toLowerCase();
      const pcNum = String(dadosPedido.numeroPedido || '').trim().toLowerCase();
      const pcMatch = !pcNum || rPC === pcNum || rPC.includes(pcNum) || pcNum.includes(rPC);

      return pcMatch && codMatch;
    }).sort((a, b) => {
      const dA = new Date(a.data_recebimento || a.data_entrada || a.created_at || 0).getTime();
      const dB = new Date(b.data_recebimento || b.data_entrada || b.created_at || 0).getTime();
      return dA - dB;
    });
  };

  const getQtdJaBaixada = (itemCodigo: string, _qtdPedida?: number, _descricaoItem?: string) => {
    const recebimentosDesteItem = getRecebimentosDoItem(itemCodigo);
    if (!recebimentosDesteItem || recebimentosDesteItem.length === 0) return 0;
    
    const ultimoRegistro = recebimentosDesteItem[recebimentosDesteItem.length - 1];
    const rawString = ultimoRegistro.ocorrencia_fiscal || '';
    
    if (rawString) {
      const historicoArray = rawString.split(' | ').filter(Boolean);
      let soma = 0;
      historicoArray.forEach(linha => {
        const match = linha.match(/Qtde\s*\(([\d.,]+)\)/i);
        let quantidade = 0;
        if (match) {
          const capturado = match[1];
          const valorLimpo = capturado.replace(/\./g, '').replace(',', '.');
          quantidade = parseFloat(valorLimpo) || 0;
        } else {
          const fallbackMatch = linha.match(/Quantidade:?\s*([\d.,]+)/i) || linha.match(/([\d.,]+)\s*unidades/i);
          if (fallbackMatch) {
            const capturado = fallbackMatch[1];
            const valorLimpo = capturado.replace(/\./g, '').replace(',', '.');
            quantidade = parseFloat(valorLimpo) || 0;
          }
        }
        if (!isNaN(quantidade)) {
          const lineLower = linha.toLowerCase();
          const isSubtraction = lineLower.includes("excluído") || 
                                lineLower.includes("excluido") || 
                                lineLower.includes("cancelado") || 
                                lineLower.includes("estornado") || 
                                lineLower.includes("devolvido");
          if (isSubtraction) {
            soma -= quantidade;
          } else {
            soma += quantidade;
          }
        }
      });
      return Math.max(0, soma);
    }
    
    return recebimentosDesteItem.reduce((acc, curr) => {
      const val = Number(curr.qtd_recebida !== undefined ? curr.qtd_recebida : (curr.qtd_entregue !== undefined ? curr.qtd_entregue : (curr.quantidade !== undefined ? curr.quantidade : (curr.qtd !== undefined ? curr.qtd : 0))));
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  };

  const carregarItensPedidoDinamico = async (pedidoIdVal: string) => {
    if (!pedidoIdVal) return;
    setLoadingItensSupabase(true);
    try {
      const { data, error } = await supabase
        .from('itens_pedido')
        .select('*')
        .eq('pedido_id', pedidoIdVal);

      if (error) {
        console.warn('Erro ao carregar itens_pedido do Supabase:', error.message);
        if (dadosPedido?.itens) {
          const fallback = dadosPedido.itens.map(it => {
            const qtd_rec = getQtdJaBaixada(it.codigo, undefined, it.descricao);
            return {
              codigo: it.codigo,
              descricao: it.descricao,
              qtd_total: it.qtd || it.quantidade || 0,
              qtd_recebida: qtd_rec,
              valor_unitario: it.vl_unitario || it.valorUnitario || 0,
              valor_total: (it.qtd || it.quantidade || 0) * (it.vl_unitario || it.valorUnitario || 0)
            };
          });
          setItensPedidoSupabase(fallback);
        }
      } else if (data && data.length > 0) {
        const mapped = data.map(item => {
          const qtd_total = Number(item.qtd_total !== undefined ? item.qtd_total : (item.qtd_pedida !== undefined ? item.qtd_pedida : (item.quantidade !== undefined ? item.quantidade : 0)));
          const qtd_recebida = Number(item.qtd_recebida !== undefined ? item.qtd_recebida : 0);
          const valor_unitario = Number(item.valor_unitario !== undefined ? item.valor_unitario : (item.vl_unitario !== undefined ? item.vl_unitario : 0));
          return {
            codigo: item.codigo || item.codigo_item || item.id || '-',
            descricao: item.descricao || item.descricao_item || '-',
            qtd_total,
            qtd_recebida,
            valor_unitario,
            valor_total: qtd_total * valor_unitario
          };
        });
        setItensPedidoSupabase(mapped);
      } else {
        if (dadosPedido?.itens) {
          const fallback = dadosPedido.itens.map(it => {
            const qtd_rec = getQtdJaBaixada(it.codigo, undefined, it.descricao);
            return {
              codigo: it.codigo,
              descricao: it.descricao,
              qtd_total: it.qtd || it.quantidade || 0,
              qtd_recebida: qtd_rec,
              valor_unitario: it.vl_unitario || it.valorUnitario || 0,
              valor_total: (it.qtd || it.quantidade || 0) * (it.vl_unitario || it.valorUnitario || 0)
            };
          });
          setItensPedidoSupabase(fallback);
        } else {
          setItensPedidoSupabase([]);
        }
      }
    } catch (err) {
      console.warn('Exceção ao buscar itens_pedido:', err);
    } finally {
      setLoadingItensSupabase(false);
    }
  };

  // Carrega dados de rateio enriquecidos da tabela pedidos_compras_bi
  const carregarRateioBI = async (pedidoIdVal: string) => {
    if (!pedidoIdVal || !String(pedidoIdVal).trim()) {
      setDadosRateioBI([]);
      return;
    }
    const cleanPC = String(pedidoIdVal).trim();
    const digitsPC = cleanPC.replace(/\D/g, '');
    setLoadingRateioBI(true);

    try {
      // 1. Busca exata por pedido
      const { data, error } = await supabase
        .from('pedidos_compras_bi')
        .select('*')
        .eq('pedido', cleanPC);

      if (!error && data && data.length > 0) {
        setDadosRateioBI(data);
        return;
      }

      // 2. Busca por dígitos / ilike se não encontrou exato
      if (digitsPC) {
        const { data: dataIlike } = await supabase
          .from('pedidos_compras_bi')
          .select('*')
          .ilike('pedido', `%${digitsPC}%`);

        if (dataIlike && dataIlike.length > 0) {
          setDadosRateioBI(dataIlike);
          return;
        }
      }
      setDadosRateioBI([]);
    } catch (e) {
      console.warn('Erro ao carregar rateio da pedidos_compras_bi:', e);
      setDadosRateioBI([]);
    } finally {
      setLoadingRateioBI(false);
    }
  };

  useEffect(() => {
    if (pedidoId) {
      setPedidoAtual(pedidoId);
      setSearchQuery(pedidoId);
    }
  }, [pedidoId]);

  useEffect(() => {
    if (pedidoAtual) {
      carregarItensPedidoDinamico(pedidoAtual);
      carregarRateioBI(pedidoAtual);
      fetchRecebimentosPC(pedidoAtual);
    }
  }, [pedidoAtual, dadosPedido]);

  useEffect(() => {
    if (dadosPedido?.numeroPedido) {
      setPedidoAtual(dadosPedido.numeroPedido);
      carregarRateioBI(dadosPedido.numeroPedido);
      fetchRecebimentosPC(dadosPedido.numeroPedido);
    }
  }, [dadosPedido]);

  useEffect(() => {
    if (pedidoAtual && (!dadosPedido || dadosPedido.numeroPedido !== pedidoAtual)) {
      const fetchOrder = async () => {
        try {
          setDadosPedido(null);
          setItensPedidoSupabase([]);
          setLoading(true);
          setErrorMsg(null);
          const { data: { session: authSession } } = await supabase.auth.getSession();
          const response = await fetch(`/api/consultar-pc?numero=${encodeURIComponent(pedidoAtual)}`, {
            headers: {
              'Authorization': `Bearer ${authSession?.access_token || ''}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            const mapped = mapResponseToPedido(data, pedidoAtual);
            console.log("Payload recebido do backend:", mapped);
            setDadosPedido(mapped);
          } else {
            const simulatedData = {
              status: 'Aprovado',
              dataEmissao: new Date().toLocaleDateString('pt-BR'),
              fornecedor: {
                razao_social: 'FORNECEDOR CMPC HOMOLOGADO LTDA',
                razaoSocial: 'FORNECEDOR CMPC HOMOLOGADO LTDA',
                cnpj: '88.888.888/0001-88',
                contato: 'contato@cmpchomologado.com.br',
                endereco: 'Av. Industrial, 1000 - Guaíba/RS'
              },
              itens: [
                { 
                  codigo: 'MAT-GEN-001', 
                  descricao: 'REPARO VÁLVULA ESFÉRICA FLANGEADA 2 POL', 
                  quantidade: 5, 
                  qtd: 5, 
                  valorUnitario: 150.00, 
                  vl_unitario: 150.00, 
                  valorTotal: 750.00, 
                  vl_total: 750.00,
                  ocorrencias: [
                    'Recebido no Recebimento - Qtde (2)',
                    'Recebido no Recebimento - Qtde (1)'
                  ]
                },
                { 
                  codigo: 'MAT-GEN-002', 
                  descricao: 'JUNTA DE VEDAÇÃO DE BORRACHA NEOPRENE', 
                  quantidade: 10, 
                  qtd: 10, 
                  valorUnitario: 25.00, 
                  vl_unitario: 25.00, 
                  valorTotal: 250.00, 
                  vl_total: 250.00,
                  ocorrencias: [
                    'Baixado no almoxarifado - Qtde (10)',
                    'Estornado do Recebimento - Qtde (2)'
                  ]
                }
              ],
              centro_custo: 'ALMOXARIFADO-GUAÍBA | 100.201.302',
              classes_financeiras: ['MANUTENÇÃO GERAL (ESTOQUE)'],
              condicaoPagamento: '30 DIAS DDL',
              observacoes: 'ENTREGA URGENTE NA SEÇÃO DE MANUTENÇÃO MECÂNICA.',
              numeroPedido: pedidoAtual,
              comprador: '210 - Glayson Lima'
            };
            const mapped = mapResponseToPedido(simulatedData, pedidoAtual);
            setDadosPedido(mapped);
            setIsSimulatedFallback(true);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      };
      fetchOrder();
    }
  }, [pedidoAtual]);

  // Sincronizar as quantidades entregues iniciais e limpar status quando o pedido muda
  useEffect(() => {
    if (dadosPedido?.itens) {
      const initialQtds: { [codigo: string]: number } = {};
      dadosPedido.itens.forEach(item => {
        const pcNum = dadosPedido.numeroPedido;
        const matchingRecords = recebimentosItens.filter(
          (r) => 
            String(r.numero_pc).toLowerCase().trim() === String(pcNum).toLowerCase().trim() &&
            String(r.codigo_item || r.codigo || '').toLowerCase().trim() === String(item.codigo).toLowerCase().trim() &&
            (Number(r.qtd_pedida) || 0) === (Number(item.qtd) || 0) &&
            String(r.descricao_item || r.descricao || '').toLowerCase().trim() === String(item.descricao || '').toLowerCase().trim()
        );
        const sumDB = matchingRecords.reduce((sum, r) => sum + (Number(r.qtd_recebida || r.qtd_entregue) || 0), 0);
        const descNormalizada = (item.descricao || '').trim().toLowerCase();
        const keyComposta = `${item.codigo}-${item.qtd || 0}-${descNormalizada}`;
        initialQtds[keyComposta] = Math.max(0, (item.qtd || 0) - sumDB);
      });
      setQtdsEntregues(initialQtds);
    }
    setStatusRecebimento('total');
    setNumeroNF('');
    setDataRecebimento(getTodayDateString());
    setPrevisaoSaldoRestante('');
    setNovaDataPrometida('');
    setMotivoRecusa('');
    setObservacoesCheckIn('');
    setCheckInSuccessMsg(null);
  }, [dadosPedido, recebimentosItens]);

  // Mapeador robusto para converter os retornos da API Python (seja em snake_case ou camelCase)
  const mapResponseToPedido = (data: any, searchedNum: string): PedidoCompra => {
    const getField = (obj: any, ...keys: string[]) => {
      if (!obj) return '';
      for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null) return obj[k];
      }
      return '';
    };

    // Extração do Status
    const statusRaw = getField(data, 'status', 'status_pedido', 'situacao');
    let statusMapped: 'Aprovado' | 'Pendente' | 'Em Análise' = 'Aprovado';
    if (statusRaw) {
      const lowStatus = String(statusRaw).toLowerCase();
      if (lowStatus.includes('pendente') || lowStatus.includes('pending') || lowStatus.includes('aguardando')) {
        statusMapped = 'Pendente';
      } else if (lowStatus.includes('analise') || lowStatus.includes('análise') || lowStatus.includes('analysing')) {
        statusMapped = 'Em Análise';
      }
    }

    // Extração do Fornecedor (Suporta estrutura aninhada ou plana)
    let fornecedorMapped = {
      razao_social: '',
      razaoSocial: '',
      cnpj: '',
      contato: '',
      endereco: ''
    };

    if (data.fornecedor && typeof data.fornecedor === 'object') {
      const f = data.fornecedor;
      const rz = getField(f, 'razao_social', 'razaoSocial', 'nome', 'razao', 'nome_fornecedor');
      fornecedorMapped = {
        razao_social: rz,
        razaoSocial: rz,
        cnpj: getField(f, 'cnpj', 'cnpj_fornecedor', 'documento') || '-',
        contato: getField(f, 'contato', 'contato_fornecedor', 'telefone', 'email') || '-',
        endereco: getField(f, 'endereco', 'endereco_fornecedor', 'logradouro') || '-'
      };
    } else {
      const rz = getField(data, 'fornecedor_razao_social', 'razao_social', 'fornecedor_nome', 'razao_social', 'fornecedor');
      fornecedorMapped = {
        razao_social: rz,
        razaoSocial: rz,
        cnpj: getField(data, 'fornecedor_cnpj', 'cnpj', 'cnpj_fornecedor') || '-',
        contato: getField(data, 'fornecedor_contato', 'contato', 'fornecedor_telefone') || '-',
        endereco: getField(data, 'fornecedor_endereco', 'endereco', 'fornecedor_logradouro') || '-'
      };
    }

    // Extração de Itens (sem inclusão estática de MAT-GENERIC se estiver vazio, como instruído)
    const rawItens = Array.isArray(data.itens) ? data.itens : (Array.isArray(data.items) ? data.items : []);
    const itensMapped: ItemPedido[] = rawItens.map((item: any, idx: number) => {
      const qty = Number(getField(item, 'qtd', 'quantidade', 'quantidade_item', 'quantity')) || 0;
      const unitVal = Number(getField(item, 'vl_unitario', 'valorUnitario', 'valor_unitario', 'preco', 'preco_unitario', 'unit_price', 'valor_unit')) || 0;
      const totVal = Number(getField(item, 'vl_total', 'valorTotal', 'valor_total', 'total', 'preco_total', 'total_price', 'valor_total_item')) || (qty * unitVal);

      const backendQtdPedida = item.qtd_pedida !== undefined ? Number(item.qtd_pedida) : qty;
      const backendQtdRecebidaErp = item.qtd_recebida_erp !== undefined ? Number(item.qtd_recebida_erp) : 0;
      const backendSaldoPendente = item.saldo_pendente !== undefined ? Number(item.saldo_pendente) : qty;

      return {
        codigo: getField(item, 'codigo', 'codigo_item', 'cod', 'sku', 'id') || '-',
        descricao: getField(item, 'descricao', 'descricao_item', 'nome', 'description', 'nome_item') || '-',
        quantidade: qty,
        qtd: qty,
        valorUnitario: unitVal,
        vl_unitario: unitVal,
        valorTotal: totVal,
        vl_total: totVal,
        ocorrencia: getField(item, 'ocorrencia', 'ocorrencia_fiscal', 'ocorrenciaFiscal') || '',
        ocorrencias: item.ocorrencias || item.ocorrencia_lista || item.historico || [],
        qtd_pedida: backendQtdPedida,
        qtd_recebida_erp: backendQtdRecebidaErp,
        saldo_pendente: backendSaldoPendente
      };
    });

    const cc = getField(data, 'centro_custo', 'centroDeCusto', 'centro_de_custo', 'cc', 'centroCusto', 'cc_pedido');
    const comprador = getField(data, 'comprador', 'responsavel', 'comprador_nome', 'nome_comprador', 'comprador_responsavel');
    const extractedClasses = getClassesList(data);

    return {
      numeroPedido: getField(data, 'numeroPedido', 'numero_pedido', 'numero', 'id', 'pedido') || searchedNum.toUpperCase(),
      status: statusMapped,
      dataEmissao: getField(data, 'dataEmissao', 'data_emissao', 'data', 'date', 'data_emissao_pedido') || new Date().toLocaleDateString('pt-BR'),
      fornecedor: fornecedorMapped,
      itens: itensMapped,
      centro_custo: cc,
      centroDeCusto: cc,
      condicaoPagamento: getField(data, 'condicaoPagamento', 'condicao_pagamento', 'condicao', 'pagamento', 'condicao_pgto') || '-',
      observacoes: getField(data, 'observacoes', 'observacoes_pedido', 'observacao', 'obs', 'comentarios') || '-',
      comprador: comprador || '',
      classes_financeiras: extractedClasses,
      classes: extractedClasses
    };
  };

  const handleConsultar = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setErrorMsg('Por favor, informe o número do pedido antes de consultar.');
      return;
    }

    setPedidoAtual(query);
    setErrorMsg(null);
    setDadosPedido(null);
    setItensPedidoSupabase([]);
    setIsSimulatedFallback(false);
    loadingTimer(); // Let's check where timers were declared, or simply run the timers
    setLoading(true);
    setLoadingStep(1);

    // Passo 1: Conectando
    const timer1 = setTimeout(() => {
      setLoadingStep(2);
    }, 900);

    // Passo 2: Extraindo dados do Approvo
    const timer2 = setTimeout(() => {
      setLoadingStep(3);
    }, 1800);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

      const { data: { session: authSession } } = await supabase.auth.getSession();
      const response = await fetch(
        `/api/consultar-pc?numero=${encodeURIComponent(query)}`,
        { 
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${authSession?.access_token || ''}`
          },
          signal: controller.signal 
        }
      );
      
      clearTimeout(timeoutId);
      clearTimeout(timer1);
      clearTimeout(timer2);

      if (!response.ok) {
        let errorMsgFromApi = `Servidor retornou erro: Código ${response.status}`;
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errorMsgFromApi = `Erro no Robô: ${errData.error}`;
          }
        } catch (_) {}
        throw new Error(errorMsgFromApi);
      }

      const data = await response.json();
      
      // Salva os dados mapeados no estado
      const mapped = mapResponseToPedido(data, query);
      console.log("Payload recebido do backend:", mapped);
      setDadosPedido(mapped);
      setIsSimulatedFallback(false);
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      console.error("ERRO DE INTEGRAÇÃO:", err);
      setErrorMsg(err.message || "Erro ao consultar o pedido de compra. Verifique o número digitado e tente novamente.");
      setDadosPedido(null);
      setIsSimulatedFallback(false);
    } finally {
      setLoading(false);
      setLoadingStep(0);
    }
  };

  // Safe helper to avoid undeclared functions
  const loadingTimer = () => {};

  const handleNovaConsulta = () => {
    setPedidoAtual('');
    setDadosPedido(null);
    setSearchQuery('');
    setErrorMsg(null);
    setIsSimulatedFallback(false);
    setItensPedidoSupabase([]);
    setDadosRateioBI([]);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportarExcel = () => {
    try {
      if (filteredHistorico.length === 0) {
        return;
      }

      const dataToExport = filteredHistorico.map((row) => {
        const fStatus = verificarBaixaERP(row);
        const fiscalInfo = { data: fStatus.dataOcorrencia, qtd: fStatus.qtdLancada.toString() };
        const statusFisicoTexto = 
          row.status_recebimento === 'total' ? 'Recebido Total' :
          row.status_recebimento === 'parcial' ? 'Recebido Parcial' :
          row.status_recebimento === 'reagendar' ? 'Reagendado' :
          row.status_recebimento === 'recusar' ? 'Recusado/Cancelado' : row.status_recebimento;

        const statusFiscalTexto = fStatus.isLancado ? 'Lançado no ERP' : (fStatus.qtdLancada > 0 ? 'Lançado Parcial' : 'Aguardando Integrador Fiscal');

        return {
          'Pedido (PC)': row.numero_pc,
          'Nota Fiscal (NF)': row.numero_nf,
          'Código Item': row.codigo,
          'Descrição Item': row.descricao,
          'Centro de Custo': row.centro_custo,
          'Status Físico': statusFisicoTexto,
          'Status Fiscal': statusFiscalTexto,
          'Data Baixa Fiscal': fiscalInfo.data,
          'Qtd Lançada ERP': fiscalInfo.qtd,
          'Qtd Pedida': row.qtd_original,
          'Qtd Recebida': row.qtd_entregue,
          'Saldo Pendente': Math.max(0, row.qtd_original - parseFiscalQtd(fiscalInfo.qtd)),
          'Conferente': row.recebedor,
          'Data de Recebimento': row.registrado_em
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Monitoramento");

      // Auto-fit columns
      const maxLens = Object.keys(dataToExport[0]).map(key => {
        let maxLen = key.length;
        dataToExport.forEach(row => {
          const val = String((row as any)[key] || '');
          if (val.length > maxLen) {
            maxLen = val.length;
          }
        });
        return { wch: maxLen + 3 };
      });
      worksheet['!cols'] = maxLens;

      XLSX.writeFile(workbook, `Relatorio_Monitoramento_Entradas_${getTodayDateString()}.xlsx`);
    } catch (error) {
      console.error('Erro ao exportar para Excel:', error);
    }
  };

  const handleOpenCheckIn = (item: any, saldoPermitido: number) => {
    if (dadosPedido?.status?.toLowerCase() === 'pendente') {
      alert("Este pedido de compra está com o status 'Pendente' e o recebimento de seus itens está bloqueado.");
      return;
    }
    const isCancelado = item.status_item && item.status_item.toLowerCase().includes('cancelado');
    if (isCancelado) {
      alert("Este item está cancelado no ERP e não pode ser recebido.");
      return;
    }
    setCheckInItem(item);
    setCheckInQtd(saldoPermitido);
    setSingleNomeRecebedor(nomeRecebedor || '');
    setSingleNumeroNF(numeroNF || '');
    setSingleDataRecebimento(dataRecebimento || getTodayDateString());
    setSingleStatusRecebimento('total');
  };

  const handleConfirmSingleCheckIn = async () => {
    if (dadosPedido?.status?.toLowerCase() === 'pendente') {
      alert("Este pedido de compra está com o status 'Pendente' e o recebimento de seus itens está bloqueado.");
      return;
    }
    const qtdNumerica = Number(checkInQtd);
    if (isNaN(qtdNumerica) || qtdNumerica <= 0) {
       console.error("Tentativa de payload zerado bloqueada no front.");
       return; // Mata a execução silenciosamente
    }

    if (!checkInItem) return;

    const isCancelado = checkInItem.status_item && checkInItem.status_item.toLowerCase().includes('cancelado');
    if (isCancelado) {
      alert("Este item está cancelado no ERP e não pode ser recebido.");
      return;
    }

    const quantidadeDigitada = qtdNumerica;
    const _qtd_pedida = Number(checkInItem.qtd) || 0;
    const _qtdCalculadaOcc = calcularQuantidadeRealtime(checkInItem);
    const _qtdJaBaixada = Math.max(_qtdCalculadaOcc, getQtdJaBaixada(checkInItem.codigo, _qtd_pedida, checkInItem.descricao));
    const saldoRestanteDoItem = Math.max(0, _qtd_pedida - _qtdJaBaixada);

    if (!quantidadeDigitada || quantidadeDigitada <= 0) {
      alert("A quantidade deve ser maior que zero.");
      return; 
    }
    if (quantidadeDigitada > saldoRestanteDoItem) {
      alert(`A quantidade máxima permitida é ${saldoRestanteDoItem}.`);
      return;
    }

    if (!singleNomeRecebedor.trim()) {
      alert("Por favor, informe o nome do Almoxarife / Recebedor para identificação.");
      return;
    }
    if (!singleNumeroNF.trim()) {
      alert("Por favor, informe o número da Nota Fiscal (NF) para identificação.");
      return;
    }

    setCheckInLoading(true);

    try {
      const saldo_restante = Math.max(0, saldoRestanteDoItem - quantidadeDigitada);
      const classesVal = getClassesList(dadosPedido);
      
      const itemBiMatch = (itensPedidoSupabase || []).find((x: any) => 
        (x.produto_descricao && checkInItem.descricao && String(x.produto_descricao).trim().toLowerCase() === String(checkInItem.descricao).trim().toLowerCase()) ||
        (x.codigo && checkInItem.codigo && String(x.codigo).trim() === String(checkInItem.codigo).trim())
      );
      const compradorReal = dadosPedido?.comprador ||
        itemBiMatch?.comprador_real ||
        (itensPedidoSupabase && itensPedidoSupabase[0]?.comprador_real) ||
        '';
      const valorUnitario = Number(
        checkInItem.valorUnitario ??
        checkInItem.vl_unitario ??
        itemBiMatch?.valor_unitario ??
        0
      );
      const valorTotalItem = Number((valorUnitario * quantidadeDigitada).toFixed(2));

      const itemsToInsert = [{
        numero_pc: dadosPedido?.numeroPedido || searchQuery,
        fornecedor: dadosPedido?.fornecedor?.razao_social || '-',
        centro_custo: dadosPedido?.centro_custo || dadosPedido?.centroDeCusto || '-',
        classes_financeiras: classesVal,
        nota_fiscal: singleNumeroNF.trim(),
        codigo_item: checkInItem.codigo,
        descricao_item: checkInItem.descricao,
        qtd_pedida: _qtd_pedida,
        qtd_recebida: quantidadeDigitada,
        saldo_pendente: saldo_restante,
        status_fisico: quantidadeDigitada === saldoRestanteDoItem ? 'total' : 'parcial',
        conferente: singleNomeRecebedor.trim(),
        data_entrada: new Date().toISOString(),
        data_recebimento: singleDataRecebimento,
        comprador_real: compradorReal,
        valor_unitario: valorUnitario,
        valor_total_item: valorTotalItem,
        id: crypto.randomUUID()
      }];

      const { error: errorInsert } = await supabase
        .from('recebimentos_itens')
        .insert(itemsToInsert);

      if (errorInsert) {
        throw new Error('Falha ao inserir registro no Supabase: ' + errorInsert.message);
      }

      try {
        await fetch('/api/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'PHYSICAL_CHECKIN',
            timestamp: new Date().toISOString(),
            description: `[Almoxarifado] Registro de Entrada Física Individual do PC ${dadosPedido?.numeroPedido || searchQuery}, Item ${checkInItem.codigo} (${quantidadeDigitada} un)`,
            details: itemsToInsert
          })
        });
      } catch (_) {}

      if (!nomeRecebedor.trim()) setNomeRecebedor(singleNomeRecebedor);
      if (!numeroNF.trim()) setSingleNumeroNF(singleNumeroNF);

      const qtyDigitada = quantidadeDigitada;
      const descItem = checkInItem.descricao || '';

      await new Promise(resolve => setTimeout(resolve, 800));
      
      setSuccessOverlay({
        isOpen: true,
        quantity: qtyDigitada,
        description: descItem,
        isSingle: true
      });
    } catch (err: any) {
      console.error(err);
      alert("Erro ao registrar entrada física: " + (err.message || err));
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleConfirmarEntradaFisica = async () => {
    if (dadosPedido?.status?.toLowerCase() === 'pendente') {
      setErrorMsg('Este pedido de compra está com o status "Pendente" e o recebimento de mercadorias está bloqueado.');
      return;
    }
    // Validação de campos obrigatórios conforme o status escolhido
    if (!nomeRecebedor.trim()) {
      setErrorMsg('Por favor, informe o nome do Almoxarife / Recebedor para identificação.');
      return;
    }
    if (!numeroNF.trim()) {
      setErrorMsg('Por favor, informe o número da Nota Fiscal (NF) para identificação.');
      return;
    }
    if (!statusRecebimento) {
      setErrorMsg('Por favor, selecione um status de recebimento.');
      return;
    }
    if (statusRecebimento === 'total' && temAlgumItemJaRecebido) {
      setErrorMsg('Este pedido possui itens que já foram recebidos parcialmente. O recebimento deve ser registrado como Parcial.');
      return;
    }
    if (statusRecebimento === 'recusar' && !motivoRecusa.trim()) {
      setErrorMsg('É obrigatório informar o motivo da recusa para prosseguir.');
      return;
    }
    if (statusRecebimento === 'parcial' && !previsaoSaldoRestante) {
      setErrorMsg('Por favor, informe a previsão de entrega do saldo restante.');
      return;
    }
    if (statusRecebimento === 'reagendar' && !novaDataPrometida) {
      setErrorMsg('Por favor, informe a nova data prometida pelo fornecedor.');
      return;
    }

    // Trava de Quantidade no Recebimento Parcial (Prevenção de Over-delivery)
    if (statusRecebimento === 'parcial') {
      const uniqueItens = (dadosPedido?.itens || []).filter((item, index, self) =>
        index === self.findIndex((t) => (
          t.codigo === item.codigo && 
          (t.qtd || 0) === (item.qtd || 0) &&
          (t.descricao || '').trim().toLowerCase() === (item.descricao || '').trim().toLowerCase()
        ))
      );
      for (const item of uniqueItens) {
        const isCancelado = item.status_item && item.status_item.toLowerCase().includes('cancelado');
        const descNormalizada = (item.descricao || '').trim().toLowerCase();
        const keyComposta = `${item.codigo}-${Number(item.qtd) || 0}-${descNormalizada}`;
        if (isCancelado) {
          if (qtdsEntregues[keyComposta] && Number(qtdsEntregues[keyComposta]) > 0) {
            setErrorMsg(`O item ${item.codigo} está cancelado no ERP e não pode ter quantidades de recebimento inseridas.`);
            return;
          }
          continue;
        }

        const qtd_pedida = Number(item.qtd) || 0;
        
        const qtdCalculadaOcc = calcularQuantidadeRealtime(item);
        const qtdJaBaixada = Math.max(qtdCalculadaOcc, getQtdJaBaixada(item.codigo, qtd_pedida, item.descricao));
        const saldoPendenteItem = Math.max(0, qtd_pedida - qtdJaBaixada);
        const inputQty = qtdsEntregues[keyComposta] !== undefined ? Number(qtdsEntregues[keyComposta]) : saldoPendenteItem;

        if (inputQty > saldoPendenteItem) {
          setErrorMsg(`A quantidade informada excede o saldo pendente do pedido para o item ${item.codigo} (${saldoPendenteItem} unidades restantes).`);
          return;
        }
      }
    }

    setErrorMsg(null);
    setCheckInLoading(true);
    setCheckInSuccessMsg(null);

    try {
      const classesVal = getClassesList(dadosPedido);
      // 1. Monta os itens a serem inseridos
      const reasonText = statusRecebimento === 'recusar' 
        ? motivoRecusa.trim() 
        : (observacoesCheckIn ? observacoesCheckIn.trim() : undefined);

      const itemsToInsert = (dadosPedido?.itens || []).map(item => {
        const qtd_pedida = Number(item.qtd) || 0;
        const isCancelado = item.status_item && item.status_item.toLowerCase().includes('cancelado');
        const descNormalizada = (item.descricao || '').trim().toLowerCase();

        if (isCancelado) {
          const cancelItemObj: Record<string, any> = {
            numero_pc: dadosPedido?.numeroPedido || searchQuery,
            fornecedor: dadosPedido?.fornecedor?.razao_social || '-',
            centro_custo: dadosPedido?.centro_custo || dadosPedido?.centroDeCusto || '-',
            classes_financeiras: classesVal,
            nota_fiscal: numeroNF.trim(),
            codigo_item: item.codigo,
            descricao_item: item.descricao,
            qtd_pedida,
            qtd_recebida: 0,
            saldo_pendente: qtd_pedida,
            status_fisico: 'cancelado',
            conferente: nomeRecebedor.trim(),
            data_entrada: new Date().toISOString(),
            data_recebimento: dataRecebimento,
            id: crypto.randomUUID()
          };
          if (reasonText) {
            cancelItemObj.motivo_recusa = reasonText;
            cancelItemObj.observacao = reasonText;
            cancelItemObj.observacoes = reasonText;
            cancelItemObj.justificativa = reasonText;
          }
          return cancelItemObj;
        }

        const qtdCalculadaOcc = calcularQuantidadeRealtime(item);
        const qtdJaBaixada = Math.max(qtdCalculadaOcc, getQtdJaBaixada(item.codigo, qtd_pedida, item.descricao));
        const saldoPendenteAnterior = Math.max(0, qtd_pedida - qtdJaBaixada);

        let qtd_recebida = 0;
        if (statusRecebimento === 'total') {
          qtd_recebida = saldoPendenteAnterior;
        } else if (statusRecebimento === 'parcial') {
          const keyComposta = `${item.codigo}-${qtd_pedida}-${descNormalizada}`;
          qtd_recebida = qtdsEntregues[keyComposta] !== undefined ? Number(qtdsEntregues[keyComposta]) : saldoPendenteAnterior;
        } else {
          // 'recusar' ou 'reagendar'
          qtd_recebida = 0;
        }

        // Garante que não haja over-delivery (limita ao saldo pendente anterior)
        qtd_recebida = Math.max(0, Math.min(saldoPendenteAnterior, qtd_recebida));
        const saldo_pendente = Math.max(0, saldoPendenteAnterior - qtd_recebida);

        let item_status_fisico = statusRecebimento;
        if (statusRecebimento === 'parcial' && saldo_pendente <= 0) {
          item_status_fisico = 'total';
        }

        const itemBiMatch = (itensPedidoSupabase || []).find((x: any) => 
          (x.produto_descricao && item.descricao && String(x.produto_descricao).trim().toLowerCase() === String(item.descricao).trim().toLowerCase()) ||
          (x.codigo && item.codigo && String(x.codigo).trim() === String(item.codigo).trim())
        );
        const compradorReal = dadosPedido?.comprador ||
          itemBiMatch?.comprador_real ||
          (itensPedidoSupabase && itensPedidoSupabase[0]?.comprador_real) ||
          '';
        const valorUnitario = Number(
          item.valorUnitario ??
          item.vl_unitario ??
          itemBiMatch?.valor_unitario ??
          0
        );
        const valorTotalItem = Number((valorUnitario * qtd_recebida).toFixed(2));

        const itemObj: Record<string, any> = {
          numero_pc: dadosPedido?.numeroPedido || searchQuery,
          fornecedor: dadosPedido?.fornecedor?.razao_social || '-',
          centro_custo: dadosPedido?.centro_custo || dadosPedido?.centroDeCusto || '-',
          classes_financeiras: classesVal,
          nota_fiscal: numeroNF.trim(),
          codigo_item: item.codigo,
          descricao_item: item.descricao,
          qtd_pedida,
          qtd_recebida,
          saldo_pendente,
          status_fisico: item_status_fisico,
          conferente: nomeRecebedor.trim(),
          data_entrada: new Date().toISOString(),
          data_recebimento: dataRecebimento,
          comprador_real: compradorReal,
          valor_unitario: valorUnitario,
          valor_total_item: valorTotalItem,
          id: crypto.randomUUID()
        };

        // Somente se for explicitamente recusa ou cancelamento é que motivo_cancelamento / motivo_recusa são vinculados
        if (statusRecebimento === 'recusar' || item_status_fisico === 'recusar' || (item_status_fisico as string) === 'cancelado') {
          if (reasonText) {
            itemObj.motivo_recusa = reasonText;
            itemObj.motivo_cancelamento = reasonText;
            itemObj.observacao = reasonText;
            itemObj.observacoes = reasonText;
            itemObj.justificativa = reasonText;
          }
        } else if (reasonText) {
          itemObj.observacao = reasonText;
          itemObj.observacoes = reasonText;
        }

        return itemObj;
      });

      // Filtra itens com quantidade maior que zero para recebimento físico (evitando payload zero)
      const filteredItemsToInsert = itemsToInsert.filter(it => {
        if (statusRecebimento === 'total' || statusRecebimento === 'parcial') {
          return it.qtd_recebida > 0;
        }
        return true; // Mantém para 'recusar' ou 'reagendar'
      });

      if ((statusRecebimento === 'total' || statusRecebimento === 'parcial') && filteredItemsToInsert.length === 0) {
        setErrorMsg("Não há itens pendentes com quantidade maior que zero para receber neste pedido.");
        setCheckInLoading(false);
        return;
      }

      // Sanitização estrita do payload antes do envio para o Supabase:
      // Se o status selecionado não for "recusar" ou cancelado, remove estritamente motivo_cancelamento e motivo_recusa
      const payloadSanitizado = filteredItemsToInsert.map(it => {
        const payload = { ...it } as any;
        const isRecusaOuCancelado = statusRecebimento === 'recusar' || payload.status_fisico === 'recusar' || payload.status_fisico === 'cancelado';
        if (!isRecusaOuCancelado) {
          delete payload.motivo_cancelamento;
          delete payload.motivo_recusa;
        }
        return payload;
      });

      // 2. Grava no Supabase na tabela recebimentos_itens
      const { error: errorInsert } = await supabase
        .from('recebimentos_itens')
        .insert(payloadSanitizado);

      if (errorInsert) {
        throw new Error('Falha ao inserir registros no Supabase: ' + errorInsert.message);
      }

      // 3. Grava log de auditoria no servidor express local para visibilidade cruzada
      try {
        await fetch('/api/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'PHYSICAL_CHECKIN',
            timestamp: new Date().toISOString(),
            description: `[Almoxarifado] Registro de Entrada Física do PC ${dadosPedido?.numeroPedido || searchQuery} como ${statusRecebimento?.toUpperCase()}`,
            details: filteredItemsToInsert
          })
        });
      } catch (_) {}

      // 4. Delay intencional para UX Premium de processamento industrial real-time
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 5. Sincroniza o estado local buscando do Supabase
      await carregarRecebimentosItens();

      const totalUnits = filteredItemsToInsert.reduce((acc, item) => acc + (item.qtd_recebida || 0), 0);
      setSuccessOverlay({
        isOpen: true,
        quantity: totalUnits,
        description: `Entrada física registrada! Informação enviada em tempo real para o setor de Suprimentos.`,
        isSingle: false
      });
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Erro ao registrar entrada física: " + (err.message || err));
    } finally {
      setCheckInLoading(false);
    }
  };

  // Cálculo do total geral do pedido (usa vl_total)
  const totalPedido = useMemo(() => {
    if (dadosPedido?.itens && dadosPedido.itens.length > 0) {
      return dadosPedido.itens.reduce((acc, item) => {
        const qty = item.qtd || item.quantidade || 0;
        const val = item.vl_unitario || item.valorUnitario || 0;
        return acc + (qty * val);
      }, 0);
    }
    if (itensPedidoSupabase && itensPedidoSupabase.length > 0) {
      return itensPedidoSupabase.reduce((acc, item) => acc + ((item.qtd_total || 0) * (item.valor_unitario || 0)), 0);
    }
    return 0;
  }, [itensPedidoSupabase, dadosPedido]);

  const isPedidoTotalmenteAtendido = useMemo(() => {
    if (!dadosPedido?.itens || dadosPedido.itens.length === 0) return false;
    return dadosPedido.itens.every(item => {
      const requestedQty = item.qtd || 0;
      const qtdCalculadaOcc = calcularQuantidadeRealtime(item);
      const qtdJaBaixada = Math.max(qtdCalculadaOcc, getQtdJaBaixada(item.codigo, requestedQty, item.descricao));
      return (requestedQty - qtdJaBaixada) <= 0;
    });
  }, [dadosPedido, recebimentosItens]);

  const temAlgumItemJaRecebido = useMemo(() => {
    if (!dadosPedido?.itens || dadosPedido.itens.length === 0) return false;
    return dadosPedido.itens.some(item => {
      const isCancelado = item.status_item && item.status_item.toLowerCase().includes('cancelado');
      if (isCancelado) return false;
      const requestedQty = item.qtd || item.quantidade || 0;
      const qtdCalculadaOcc = calcularQuantidadeRealtime(item);
      const qtdJaBaixada = Math.max(qtdCalculadaOcc, getQtdJaBaixada(item.codigo, requestedQty, item.descricao));
      return qtdJaBaixada > 0;
    });
  }, [dadosPedido, recebimentosItens]);

  useEffect(() => {
    if (temAlgumItemJaRecebido && statusRecebimento === 'total') {
      setStatusRecebimento('parcial');
    }
  }, [temAlgumItemJaRecebido, statusRecebimento]);

  // Flatten records to item-level granularity
  const flatItensHistorico = useMemo(() => {
    return recebimentosItens.map((row, idx) => {
      const parentNF = row.nota_fiscal || '-';
      const parentCC = row.centro_custo || '-';
      
      let dataStr = '-';
      if (row.data_recebimento) {
        const parts = row.data_recebimento.split('-');
        if (parts.length === 3) {
          dataStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
          try {
            const dObj = new Date(row.data_recebimento);
            if (!isNaN(dObj.getTime())) {
              const d = String(dObj.getUTCDate()).padStart(2, '0');
              const m = String(dObj.getUTCMonth() + 1).padStart(2, '0');
              const y = dObj.getUTCFullYear();
              dataStr = `${d}/${m}/${y}`;
            }
          } catch (_) {
            dataStr = row.data_recebimento;
          }
        }
      } else {
        const fallbackDate = row.data_entrada || row.created_at;
        if (fallbackDate) {
          try {
            const dateObj = new Date(fallbackDate);
            if (!isNaN(dateObj.getTime())) {
              const day = String(dateObj.getDate()).padStart(2, '0');
              const month = String(dateObj.getMonth() + 1).padStart(2, '0');
              const year = dateObj.getFullYear();
              dataStr = `${day}/${month}/${year}`;
            }
          } catch (_) {}
        }
      }
        
      // For details popup, we need a CheckInRecord record
      const recordDetails: CheckInRecord = {
        id: row.id?.toString(),
        numero_pc: row.numero_pc,
        fornecedor: row.fornecedor || '-',
        status_recebimento: row.status_fisico || 'total',
        registrado_em: dataStr,
        recebedor: row.conferente || '-',
        numero_nf: parentNF,
        centro_custo: parentCC,
        detalhes: row.saldo_pendente > 0 ? `Saldo pendente: ${row.saldo_pendente}` : undefined,
        itens_conferidos: [
          {
            codigo: row.codigo_item || '-',
            descricao: row.descricao_item || '-',
            qtd_original: Number(row.qtd_pedida) || 0,
            qtd_entregue: Number(row.qtd_recebida) || 0
          }
        ]
      };

      const rawDateStr = row.data_recebimento || (row.data_entrada ? row.data_entrada.split('T')[0] : (row.created_at ? row.created_at.split('T')[0] : ''));

      return {
        id_row: row.id?.toString() || `${row.numero_pc}-${idx}`,
        record: recordDetails,
        numero_pc: row.numero_pc,
        fornecedor: row.fornecedor || '-',
        numero_nf: parentNF,
        centro_custo: parentCC,
        classes_financeiras: row.classes_financeiras || row.classe_financeira || row.classeFinanceira || row.classes || row.rateio || [],
        classe_financeira: row.classe_financeira || row.classes_financeiras || row.classeFinanceira || '',
        status_recebimento: row.status_fisico || 'total',
        registrado_em: dataStr,
        recebedor: row.conferente || '-',
        detalhes: row.saldo_pendente > 0 ? `Saldo pendente: ${row.saldo_pendente}` : undefined,
        codigo: row.codigo_item || '-',
        descricao: row.descricao_item || '-',
        qtd_original: Number(row.qtd_pedida) || 0,
        qtd_entregue: Number(row.qtd_recebida) || 0,
        ocorrencia_fiscal: row.ocorrencia_fiscal,
        id_original_db: row.id,
        data_recebimento_raw: rawDateStr,
        motivo_cancelamento: row.motivo_cancelamento || row.motivo_recusa || row.motivo || row.observacao || row.observacoes || row.justificativa || row.detalhes_recusa || row.obs,
        motivo_recusa: row.motivo_recusa || row.motivo_cancelamento || row.motivo || row.observacao || row.observacoes || row.justificativa || row.detalhes_recusa || row.obs,
        observacao: row.observacao || row.observacoes || row.motivo_recusa || row.motivo_cancelamento || row.justificativa
      };
    });
  }, [recebimentosItens]);

  // Helper to filter dates based on startDateFilter and endDateFilter
  const isDateInPeriod = (dateStr: string, rawDateStr?: string) => {
    let itemDate: Date | null = null;
    if (rawDateStr) {
      itemDate = new Date(rawDateStr + 'T12:00:00');
    }
    if (!itemDate || isNaN(itemDate.getTime())) {
      if (dateStr && dateStr.includes('/')) {
        const parts = dateStr.split(' ')[0].split('/');
        if (parts.length === 3) {
          const day = Number(parts[0]);
          const month = Number(parts[1]) - 1;
          const year = Number(parts[2]);
          itemDate = new Date(year, month, day, 12, 0, 0);
        }
      }
    }
    
    if (!itemDate || isNaN(itemDate.getTime())) {
      return true;
    }

    const compareTime = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate()).getTime();

    if (startDateFilter) {
      const startParts = startDateFilter.split('-');
      if (startParts.length === 3) {
        const startD = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2])).getTime();
        if (compareTime < startD) return false;
      }
    }

    if (endDateFilter) {
      const endParts = endDateFilter.split('-');
      if (endParts.length === 3) {
        const endD = new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2])).getTime();
        if (compareTime > endD) return false;
      }
    }

    return true;
  };

  // Filtragem dos registros da Aba 2 (Monitoramento de Entradas / Recebimentos de Estoque)
  const filteredHistorico = useMemo(() => {
    return flatItensHistorico.filter(row => {
      // Filtro de Estoque para a Aba "Recebimentos de Estoque"
      if (activeTab === 'recebimento_estoque' && !isPedidoEstoque(row)) {
        return false;
      }

      // 1. Busca rápida por PC, Fornecedor, NF ou Item (Código/Descrição)
      const query = searchQueryMonitoramento.toLowerCase().trim();
      if (query) {
        const matchPC = row.numero_pc.toLowerCase().includes(query);
        const matchFornecedor = row.fornecedor.toLowerCase().includes(query);
        const matchNF = row.numero_nf.toLowerCase().includes(query);
        const matchCodigo = row.codigo.toLowerCase().includes(query);
        const matchDesc = row.descricao.toLowerCase().includes(query);
        const matchDetails = row.detalhes?.toLowerCase().includes(query);
        if (!matchPC && !matchFornecedor && !matchNF && !matchCodigo && !matchDesc && !matchDetails) return false;
      }

      // 2. Filtro de Status
      if (statusFilter !== 'all') {
        if (row.status_recebimento !== statusFilter) return false;
      }

      // 3. Filtro de Período (Data Inicial e Final)
      if (!isDateInPeriod(row.registrado_em, row.data_recebimento_raw)) {
        return false;
      }

      return true;
    });
  }, [flatItensHistorico, searchQueryMonitoramento, statusFilter, startDateFilter, endDateFilter, activeTab]);

  // 1. Agrupamento por Evento Único (Reduce): Consolidação em Cabeçalho da Nota (PC + NF) para garantir 1 único card por Nota Fiscal
  const groupedAll = useMemo(() => {
    const notasAgrupadas = flatItensHistorico.reduce((acc, row) => {
      const rowAny = row as any;
      const pc = (row.numero_pc || rowAny.pc || '').toString().trim();
      const rawNf = (row.numero_nf || rowAny.nf || '').toString().trim();
      const cleanNfStr = cleanNF(rawNf) || rawNf;

      let nfKey = cleanNfStr;
      if (!nfKey || nfKey === '-' || nfKey.toLowerCase() === 'sem nf' || nfKey.toLowerCase() === 'sem_nf') {
        nfKey = 'sem_nf';
      }

      // Chave Única primária: combinação de PC e NF
      const key = `${pc}-${nfKey}`;

      if (!acc[key]) {
        const initialReason = row.motivo_recusa || row.motivo_cancelamento || row.observacao || rowAny.observacoes || rowAny.justificativa;
        acc[key] = {
          key,
          numero_pc: row.numero_pc || pc || '-',
          numero_nf: row.numero_nf || rawNf || '-',
          fornecedor: row.fornecedor || '-',
          centro_custo: row.centro_custo || '-',
          classes_financeiras: row.classes_financeiras || rowAny.classes_financeiras || row.classe_financeira || rowAny.classe_financeira || [],
          classe_financeira: row.classe_financeira || rowAny.classe_financeira || row.classes_financeiras || '',
          recebedor: row.recebedor || '-',
          registrado_em: row.registrado_em || '-',
          data_recebimento_raw: row.data_recebimento_raw,
          status_recebimento: row.status_recebimento,
          motivo_cancelamento: initialReason,
          motivo_recusa: initialReason,
          observacao: initialReason,
          observacoes: rowAny.observacoes || initialReason,
          justificativa: rowAny.justificativa || initialReason,
          items: []
        };
      }

      acc[key].items.push(row);

      // Consolida motivos de recusa/cancelamento se algum item do grupo possuir
      const rowReason = row.motivo_recusa || row.motivo_cancelamento || row.observacao || rowAny.observacoes || rowAny.justificativa;
      if (rowReason && typeof rowReason === 'string' && rowReason.trim() !== '' && rowReason.trim() !== '-') {
        acc[key].motivo_recusa = rowReason.trim();
        acc[key].motivo_cancelamento = rowReason.trim();
        acc[key].observacao = rowReason.trim();
        acc[key].observacoes = rowReason.trim();
        acc[key].justificativa = rowReason.trim();
      }

      return acc;
    }, {} as Record<string, {
      key: string;
      numero_pc: string;
      numero_nf: string;
      fornecedor: string;
      centro_custo: string;
      classes_financeiras?: any;
      classe_financeira?: any;
      recebedor: string;
      registrado_em: string;
      data_recebimento_raw?: string;
      status_recebimento: string;
      motivo_cancelamento?: string;
      motivo_recusa?: string;
      observacao?: string;
      observacoes?: string;
      justificativa?: string;
      items: typeof flatItensHistorico;
    }>);

    return Object.values(notasAgrupadas);
  }, [flatItensHistorico]);

  // 2. Filter grouped records
  const filteredGroups = useMemo(() => {
    return groupedAll.map(group => {
      // Apply status and period filters on items first
      const filteredItems = group.items.filter(item => {
        // Status Filter
        if (statusFilter !== 'all' && item.status_recebimento !== statusFilter) {
          return false;
        }

        // Period Filter (Data Inicial e Final)
        if (!isDateInPeriod(item.registrado_em, item.data_recebimento_raw)) {
          return false;
        }

        return true;
      });

      // Now apply Search Query with multi-field search across 5 fields
      const query = searchQueryMonitoramento.toLowerCase().trim();
      if (!query) {
        if (filteredItems.length === 0) return null;
        return {
          ...group,
          items: filteredItems
        };
      }

      // Check group level matches (PC, NF, Supplier, Receiver)
      const groupMatchesQuery = group.numero_pc.toLowerCase().includes(query) ||
                                group.numero_nf.toLowerCase().includes(query) ||
                                group.fornecedor.toLowerCase().includes(query) ||
                                group.recebedor.toLowerCase().includes(query);

      // Check item level matches (including RM, quantity, etc.)
      const hasMatchingItem = group.items.some(item => {
        const matchCodigo = item.codigo.toLowerCase().includes(query);
        const matchDesc = item.descricao.toLowerCase().includes(query);
        
        // RM number
        const rmVal = ((item as any).numero_rm || (item as any).rm || (item.record as any)?.numero_rm || (item.record as any)?.rm || '').toString().toLowerCase();
        const matchRM = rmVal.includes(query);

        const matchNF = item.numero_nf.toLowerCase().includes(query);
        const matchRecebedor = item.recebedor.toLowerCase().includes(query);
        
        const matchQtdOrig = item.qtd_original.toString().includes(query);
        const matchQtdEntr = item.qtd_entregue.toString().includes(query);

        return matchCodigo || matchDesc || matchRM || matchNF || matchRecebedor || matchQtdOrig || matchQtdEntr;
      });

      if (groupMatchesQuery || hasMatchingItem) {
        return {
          ...group,
          items: filteredItems
        };
      }

      return null;
    }).filter(Boolean) as typeof groupedAll;
  }, [groupedAll, searchQueryMonitoramento, statusFilter, startDateFilter, endDateFilter]);

  const activeGroupDetails = useMemo(() => {
    if (!selectedGroupDetails) return null;
    return filteredGroups.find((g: any) => g.key === selectedGroupDetails.key) || selectedGroupDetails;
  }, [selectedGroupDetails, filteredGroups]);

  const formatarDataSegura = (dataBase: any): string => {
    if (dataBase === null || dataBase === undefined) return '-';

    if (dataBase instanceof Date) {
      if (isNaN(dataBase.getTime())) return '-';
      const day = String(dataBase.getDate()).padStart(2, '0');
      const month = String(dataBase.getMonth() + 1).padStart(2, '0');
      const year = dataBase.getFullYear();
      return `${day}/${month}/${year}`;
    }

    let str = String(dataBase).trim();
    if (!str || str === '-' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
      return '-';
    }

    if (str.includes('undefined')) {
      str = str.replace(/undefined/gi, String(new Date().getFullYear()));
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
      return str;
    }

    if (str.includes('-')) {
      const isoPart = str.split('T')[0];
      const parts = isoPart.split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        if (year && month && day && year.length === 4) {
          return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
        }
      }
    }

    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}/${month}/${year}`;
      }
    } catch (e) {
      // ignore
    }

    return str.includes('/') ? str : '-';
  };

  const verificarBaixaERP = (item: any) => {
    const qtd_recebida = Number(item.qtd_entregue || item.qtd_recebida || 0);
    if (qtd_recebida === 0) return { isLancado: false, qtdLancada: 0, dataOcorrencia: '-' };
    
    let dataRecebimentoTS = 0;
    if (item.data_recebimento || item.created_at) {
       const rawDate = item.data_recebimento || item.created_at;
       const d = new Date(rawDate);
       d.setHours(0, 0, 0, 0);
       dataRecebimentoTS = d.getTime();
    }
    
    const ocorrencia_fiscal = item.ocorrencia_fiscal || '';
    if (!ocorrencia_fiscal) return { isLancado: false, qtdLancada: 0, dataOcorrencia: '-' };
    
    const linhas = ocorrencia_fiscal.split(' | ').filter(Boolean);
    let somaBaixasPosRecebimento = 0;
    let ultimaDataOcorrencia = '-';
    
    for (const linha of linhas) {
      const lineLower = linha.toLowerCase();
      const isSubtraction = lineLower.includes("excluído") || 
                            lineLower.includes("excluido") || 
                            lineLower.includes("cancelado") || 
                            lineLower.includes("estornado") || 
                            lineLower.includes("devolvido");
      if (isSubtraction) continue;
      
      const dateMatch = linha.match(/\[(\d{2})\/(\d{2})\/(\d{4})\]/);
      let dataOcorrenciaTS = 0;
      let dataOcorrenciaStr = '-';
      if (dateMatch) {
         dataOcorrenciaStr = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
         dataOcorrenciaTS = new Date(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}T00:00:00`).getTime();
      }
      
      let qtdOcorrencia = 0;
      const match = linha.match(/Qtde\s*\(([\d.,]+)\)/i);
      if (match) {
        const capturado = match[1];
        const valorLimpo = capturado.replace(/\./g, '').replace(',', '.');
        qtdOcorrencia = parseFloat(valorLimpo) || 0;
      } else {
        const fallbackMatch = linha.match(/Quantidade:?\s*([\d.,]+)/i) || linha.match(/([\d.,]+)\s*unidades/i);
        if (fallbackMatch) {
          const capturado = fallbackMatch[1];
          const valorLimpo = capturado.replace(/\./g, '').replace(',', '.');
          qtdOcorrencia = parseFloat(valorLimpo) || 0;
        }
      }
      
      if (dataOcorrenciaTS >= dataRecebimentoTS) {
        if (qtdOcorrencia === qtd_recebida) {
           return { isLancado: true, qtdLancada: Number(qtdOcorrencia) || 0, dataOcorrencia: formatarDataSegura(dataOcorrenciaStr) }; 
        }
        somaBaixasPosRecebimento += Number(qtdOcorrencia) || 0;
        ultimaDataOcorrencia = dataOcorrenciaStr !== '-' ? formatarDataSegura(dataOcorrenciaStr) : ultimaDataOcorrencia;
      }
    }
    
    return { 
      isLancado: somaBaixasPosRecebimento >= qtd_recebida, 
      qtdLancada: Number(somaBaixasPosRecebimento) || 0, 
      dataOcorrencia: formatarDataSegura(ultimaDataOcorrencia) 
    };
  };

  const groupsParaExibir = useMemo(() => {
    if (activeTab === 'recebimento_estoque') {
      return filteredGroups.filter(group => isPedidoEstoque(group));
    }
    return filteredGroups;
  }, [filteredGroups, activeTab]);

  const kanbanColumns = useMemo(() => {
    const noBalcao: typeof filteredGroups = [];
    const lancamentoParcial: typeof filteredGroups = [];
    const lancadoFinalizado: typeof filteredGroups = [];

    groupsParaExibir.forEach(group => {
      let totalQtdRecebida = 0;
      let totalQtdLancadaERP = 0;

      if (group.items && Array.isArray(group.items)) {
        group.items.forEach((item: any) => {
          const check = verificarBaixaERP(item);
          const qtd_recebida = Number(item.qtd_entregue || item.qtd_recebida || 0);
          const qtd_lancada_erp = Number(check.qtdLancada || item.qtd_lancada_erp || 0);
          totalQtdRecebida += qtd_recebida;
          totalQtdLancadaERP += qtd_lancada_erp;
        });
      }

      const totalRecebido = Number(totalQtdRecebida) || 0;
      const totalLancado = Number(totalQtdLancadaERP) || 0;

      if (totalLancado === 0) {
        noBalcao.push(group);
      } else if (totalLancado > 0 && totalLancado < totalRecebido) {
        lancamentoParcial.push(group);
      } else if (totalLancado > 0 && totalLancado >= totalRecebido) {
        lancadoFinalizado.push(group);
      } else {
        noBalcao.push(group);
      }
    });

    return {
      noBalcao,
      lancamentoParcial,
      lancadoFinalizado
    };
  }, [groupsParaExibir]);

  const renderKanbanCard = (group: any) => {
    const statusRec = (group.status_recebimento || '').toLowerCase();
    const isRecusadoOuCancelado = 
      statusRec === 'recusar' || 
      statusRec === 'recusado' || 
      statusRec === 'cancelado' || 
      statusRec.includes('recus') || 
      statusRec.includes('cancel') ||
      (group.items && Array.isArray(group.items) && group.items.some((it: any) => {
        const s = (it.status_recebimento || it.status_fisico || it.status_item || '').toLowerCase();
        return s.includes('recus') || s.includes('cancel');
      }));

    const findMotivo = () => {
      if (group.motivo_cancelamento) return group.motivo_cancelamento;
      if (group.motivo_recusa) return group.motivo_recusa;
      if (group.observacao) return group.observacao;
      if (group.observacoes) return group.observacoes;
      if (group.justificativa) return group.justificativa;
      if (group.detalhes_recusa) return group.detalhes_recusa;

      if (group.items && Array.isArray(group.items)) {
        for (const item of group.items) {
          const itemVal = 
            item.motivo_cancelamento || 
            item.motivo_recusa || 
            item.motivo || 
            item.observacao || 
            item.observacoes || 
            item.justificativa || 
            item.detalhes_recusa ||
            (item.record as any)?.motivo_cancelamento ||
            (item.record as any)?.motivo_recusa ||
            (item.record as any)?.observacao ||
            (item.record as any)?.observacoes;
          if (itemVal && typeof itemVal === 'string' && itemVal.trim() !== '' && itemVal.trim() !== '-') {
            return itemVal.trim();
          }
        }
      }
      return null;
    };

    const rawMotivo = findMotivo();
    const motivoText = rawMotivo && rawMotivo.trim() !== '' 
      ? rawMotivo.trim() 
      : 'Motivo não informado pelo conferente.';

    let totalQtdRecebida = 0;
    let totalQtdLancadaERP = 0;
    if (group.items && Array.isArray(group.items)) {
      group.items.forEach((item: any) => {
        const check = verificarBaixaERP(item);
        const qtd_recebida = Number(item.qtd_entregue || item.qtd_recebida || 0);
        const qtd_lancada = Number(check.qtdLancada || item.qtd_lancada_erp || 0);
        totalQtdRecebida += qtd_recebida;
        totalQtdLancadaERP += qtd_lancada;
      });
    }

    const totalRecebido = Number(totalQtdRecebida) || 0;
    const totalLancado = Number(totalQtdLancadaERP) || 0;

    let erpStatus = 'PENDENTE';
    if (totalLancado === 0) {
      erpStatus = 'PENDENTE';
    } else if (totalLancado > 0 && totalLancado < totalRecebido) {
      erpStatus = 'PARCIAL';
    } else if (totalLancado > 0 && totalLancado >= totalRecebido) {
      erpStatus = 'TOTAL';
    }

    return (
      <div 
        key={group.key}
        className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-3xs hover:shadow-2xs transition-all duration-150 relative flex flex-col justify-between text-left"
      >
        <div>
          {/* Cabeçalho do Card */}
          <div className="flex items-center justify-between gap-2 mb-2 flex-nowrap w-full overflow-hidden">
            <div className="flex items-center gap-1 shrink-0 flex-nowrap min-w-0">
              <span className="text-[9px] font-mono font-black bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 whitespace-nowrap">
                PC: {group.numero_pc}
              </span>
              <span className="text-[9px] font-mono font-black bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                NF: {group.numero_nf}
              </span>
              {(() => {
                const estInfo = checkEstoqueStatus(group);
                if (estInfo.isRateioMisto) {
                  return (
                    <span className="text-[9px] font-mono font-black bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded border border-rose-300 whitespace-nowrap shadow-3xs" title="Atenção Backoffice: Pedido Misto (contém Estoque e Custo/Despesa)">
                      ⚠️ PEDIDO MISTO
                    </span>
                  );
                }
                return null;
              })()}
            </div>
            <span className="text-[9px] text-slate-400 font-black shrink-0 font-mono whitespace-nowrap">
              {group.registrado_em}
            </span>
          </div>

          {/* Corpo do Card */}
          <h5 className="text-xs font-black text-slate-800 uppercase tracking-tight line-clamp-2 leading-tight" title={group.fornecedor}>
            {group.fornecedor}
          </h5>

          <div className="mt-2 space-y-0.5 text-[11px] text-slate-500 font-semibold border-t border-slate-50 pt-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-slate-400 font-black uppercase shrink-0">CC:</span>
              <span className="text-slate-600 truncate max-w-[130px] md:max-w-none" title={group.centro_custo}>{group.centro_custo}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-slate-400 font-black uppercase shrink-0">Rec:</span>
              <span className="text-slate-600 truncate max-w-[130px] md:max-w-none" title={group.recebedor}>{group.recebedor}</span>
            </div>
          </div>

          {/* Bloco de Alerta do Motivo da Recusa / Cancelamento */}
          {isRecusadoOuCancelado && (
            <div className="mt-2.5 p-2 bg-red-50 border-l-2 border-red-500 rounded-r-lg flex items-start gap-1.5 text-red-700 shadow-3xs">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
              <div className="leading-tight overflow-hidden">
                <span className="text-[9px] font-black uppercase tracking-wider text-red-800 block not-italic">
                  Motivo da Recusa / Cancelamento:
                </span>
                <p className="text-xs italic font-medium text-red-700 mt-0.5 break-words">
                  "{motivoText}"
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé do Card */}
        <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {group.status_recebimento === 'total' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-150">
                Físico: Total
              </span>
            )}
            {group.status_recebimento === 'parcial' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-150">
                Físico: Parcial
              </span>
            )}
            {group.status_recebimento === 'reagendar' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-150">
                Reagendado
              </span>
            )}
            {(group.status_recebimento === 'recusar' || group.status_recebimento === 'recusado' || group.status_recebimento === 'cancelado') && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-150">
                Recusado
              </span>
            )}

            {/* Status Fiscal ERP */}
            {erpStatus === 'TOTAL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                ERP: Total
              </span>
            )}
            {erpStatus === 'PARCIAL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                ERP: Parcial
              </span>
            )}
            {erpStatus === 'PENDENTE' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
                ERP: Pendente
              </span>
            )}

            {/* Badges de Classe Financeira (Estoque e Rateio Misto) */}
            {(() => {
              const estInfo = checkEstoqueStatus(group);
              return (
                <>
                  {estInfo.isEstoque && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-sky-100 text-sky-800 border border-sky-200 shadow-3xs">
                      <Package className="w-2.5 h-2.5 text-sky-600" />
                      <span>PC DE ESTOQUE</span>
                    </span>
                  )}
                  {estInfo.isRateioMisto && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300 shadow-3xs" title="Atenção Backoffice: Pedido Misto (contém Estoque e Custo/Despesa)">
                      ⚠️ PEDIDO MISTO
                    </span>
                  )}
                </>
              );
            })()}
          </div>

          <button
            type="button"
            onClick={() => setSelectedGroupDetails(group)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition duration-150 text-[9px] font-black uppercase border border-indigo-150/40 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Auditar</span>
          </button>
        </div>
      </div>
    );
  };

  // TV Mode variables and dashboard
  const tvKpis = useMemo(() => {
    const sourceData = isTVMode ? flatItensHistorico : filteredHistorico;
    const uniqueReceipts = new Set();
    const uniquePCs = new Set();
    const uniqueNFs = new Set();
    const totalLines = sourceData.length;
    
    sourceData.forEach(item => {
      uniqueReceipts.add(`${item.numero_pc}_${item.numero_nf}`);
      uniquePCs.add(item.numero_pc);
      if (item.numero_nf && item.numero_nf !== '-') {
        uniqueNFs.add(item.numero_nf);
      }
    });

    const numReceipts = uniqueReceipts.size;
    const numPCs = uniquePCs.size;
    const numLines = totalLines;
    const numNFs = uniqueNFs.size;
    
    // Real SLA Calculation mirroring OverhaulManager
    const extractFiscalDateString = (ocorrencia: any) => {
      if (!ocorrencia) return null;
      if (typeof ocorrencia === 'string') return ocorrencia;
      if (ocorrencia.data_lancamento) return ocorrencia.data_lancamento;
      if (ocorrencia.data_fiscal) return ocorrencia.data_fiscal;
      if (ocorrencia.data_recebimento) return ocorrencia.data_recebimento;
      return null;
    };

    const parseDateToObj = (dateStr: string) => {
      if (!dateStr) return null;
      if (dateStr.includes('T')) {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
      }
      if (dateStr.includes('/')) {
        const parts = dateStr.split(' ')[0].split('/');
        if (parts.length === 3) {
          const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
          return isNaN(d.getTime()) ? null : d;
        }
      }
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    };

    const now = new Date();
    const nowObj = now.getFullYear() >= 2026 ? now : new Date('2026-07-18');

    const validItemsForSLA = sourceData.filter(item => {
      const physicalDateObj = parseDateToObj(item.data_recebimento_raw || item.registrado_em);
      return physicalDateObj && physicalDateObj.getFullYear() >= 1990;
    });

    const totalSLAHours = validItemsForSLA.reduce((acc, item) => {
      const physicalDateObj = parseDateToObj(item.data_recebimento_raw || item.registrado_em)!;
      const fiscalDateStr = extractFiscalDateString(item.ocorrencia_fiscal);
      const fiscalDateObj = fiscalDateStr ? parseDateToObj(fiscalDateStr) : null;
      
      let diffTimeMs = 0;
      if (fiscalDateObj && fiscalDateObj.getFullYear() >= 1990 && fiscalDateObj.getTime() >= physicalDateObj.getTime()) {
        diffTimeMs = fiscalDateObj.getTime() - physicalDateObj.getTime();
      } else {
        diffTimeMs = Math.max(0, nowObj.getTime() - physicalDateObj.getTime());
      }

      const diffHours = diffTimeMs / (1000 * 60 * 60);
      return acc + diffHours;
    }, 0);

    const averageSLAHours = validItemsForSLA.length > 0 ? (totalSLAHours / validItemsForSLA.length) : 0;

    let tempoMedioFormatado = '0:00 horas (0 dias)';
    if (validItemsForSLA.length > 0) {
      const totalMinutes = Math.round(averageSLAHours * 60);
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      const hoursFormatted = `${hours}:${mins < 10 ? '0' : ''}${mins}`;
      const days = averageSLAHours / 24;
      const daysFormatted = days.toFixed(1).replace('.0', '').replace('.', ',');
      const daysText = days === 1 ? '1 dia' : `${daysFormatted} dias`;
      tempoMedioFormatado = `${hoursFormatted} horas (${daysText})`;
    } else {
      tempoMedioFormatado = 'N/A';
    }

    return {
      recebimentos: numReceipts,
      pedidos: numPCs,
      linhas: numLines,
      nfs: numNFs,
      tempoMedio: tempoMedioFormatado
    };
  }, [flatItensHistorico, filteredHistorico, isTVMode]);

  const chartEvolucaoData = useMemo(() => {
    const sourceData = isTVMode ? flatItensHistorico : filteredHistorico;
    const counts: Record<string, { data: string; recebidos: number; volume: number }> = {};
    sourceData.forEach(item => {
      const date = item.registrado_em || 'Sem Data';
      if (!counts[date]) {
        counts[date] = { data: date, recebidos: 0, volume: 0 };
      }
      counts[date].recebidos += 1;
      counts[date].volume += Number(item.qtd_entregue) || 0;
    });
    
    let result = Object.values(counts);
    result.sort((a, b) => {
      const [dayA, monthA, yearA] = a.data.split('/').map(Number);
      const [dayB, monthB, yearB] = b.data.split('/').map(Number);
      const timeA = new Date(yearA, monthA - 1, dayA).getTime();
      const timeB = new Date(yearB, monthB - 1, dayB).getTime();
      return timeA - timeB;
    });
    
    return isTVMode ? result : result.slice(-7);
  }, [flatItensHistorico, filteredHistorico, isTVMode]);

  const chartOfensoresData = useMemo(() => {
    const sourceData = isTVMode ? flatItensHistorico : filteredHistorico;
    const counts: Record<string, { name: string; parciais: number; saldoPendente: number }> = {};
    sourceData.forEach(item => {
      if (item.status_recebimento === 'parcial') {
        const supplier = item.fornecedor || 'Desconhecido';
        if (!counts[supplier]) {
          counts[supplier] = { name: supplier, parciais: 0, saldoPendente: 0 };
        }
        counts[supplier].parciais += 1;
        const pending = (Number(item.qtd_original) || 0) - (Number(item.qtd_entregue) || 0);
        counts[supplier].saldoPendente += Math.max(0, pending);
      }
    });

    const result = Object.values(counts)
      .sort((a, b) => b.parciais - a.parciais)
      .slice(0, 5);

    return result;
  }, [flatItensHistorico, filteredHistorico, isTVMode]);

  const rankingEquipeData = useMemo(() => {
    const sourceData = isTVMode ? flatItensHistorico : filteredHistorico;
    const users: Record<string, { nome: string; linhas: number; totalEntregue: number; totais: number }> = {};
    sourceData.forEach(item => {
      const name = normalizarNomeOperador(item.recebedor);
      if (!users[name]) {
        users[name] = { nome: name, linhas: 0, totalEntregue: 0, totais: 0 };
      }
      users[name].linhas += 1;
      users[name].totalEntregue += Number(item.qtd_entregue) || 0;
      if (item.status_recebimento === 'total') {
        users[name].totais += 1;
      }
    });

    const result = Object.values(users)
      .map(u => ({
        ...u,
        acuracia: u.linhas > 0 ? Math.round((u.totais / u.linhas) * 100) : 100
      }))
      .sort((a, b) => b.linhas - a.linhas)
      .slice(0, 5);

    return result;
  }, [flatItensHistorico, filteredHistorico, isTVMode]);

  const CustomDarkTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl shadow-2xl text-xs font-mono text-slate-200">
          <p className="font-bold text-white mb-1">{payload[0].payload.data || payload[0].payload.name}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} style={{ color: p.color || '#818cf8' }}>
              {p.name}: <span className="font-black">{p.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isTVMode) {
    return (
      <main id="active-tv-mode-flag" className="px-6 py-2 h-full max-h-screen flex flex-col overflow-hidden bg-slate-950 justify-between min-h-0">
        <div className="flex-1 flex flex-col justify-between max-w-7xl mx-auto w-full gap-2.5 animate-in fade-in duration-500 min-h-0">
          {/* Elegant Display Header */}
          <div className="text-center pt-0 shrink-0">
            <span className="text-indigo-400 text-[8px] font-black tracking-widest uppercase font-mono bg-indigo-950/50 border border-indigo-900/60 px-2.5 py-0.5 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.15)]">
              MONITORAMENTO DE ENTRADAS & FISCAL • ACUMULADO DO MÊS (TEMPO REAL)
            </span>
            <h2 className="text-base font-black text-white tracking-tight uppercase mt-0.5">
              Painel de Recebimento Físico e Lançamento Fiscal
            </h2>
          </div>

          {/* Top Cards KPIs */}
          <div className="flex flex-row gap-2.5 w-full shrink-0 [&>*]:flex-1 [&>*]:min-w-0">
            {/* Card 1: Recebimentos */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between relative overflow-hidden shadow-md">
              <div className="space-y-0.5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">RECEBIMENTOS <span className="text-indigo-400 font-extrabold">(MÊS)</span></span>
                <h3 className="text-lg font-black text-white leading-none">{tvKpis.recebimentos}</h3>
                <p className="text-[8px] text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  SGI Integrado
                </p>
              </div>
              <div className="p-1.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
                <Activity className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 2: Pedidos */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between relative overflow-hidden shadow-md">
              <div className="space-y-0.5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">PEDIDOS DE COMPRA <span className="text-indigo-400 font-extrabold">(MÊS)</span></span>
                <h3 className="text-lg font-black text-white leading-none">{tvKpis.pedidos}</h3>
                <p className="text-[8px] text-slate-400 font-semibold mt-0.5">Cartas de Pedidos ativas</p>
              </div>
              <div className="p-1.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
                <BarChart2 className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 3: Linhas */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between relative overflow-hidden shadow-md">
              <div className="space-y-0.5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">LINHAS CONFERIDAS <span className="text-indigo-400 font-extrabold">(MÊS)</span></span>
                <h3 className="text-lg font-black text-white leading-none">{tvKpis.linhas}</h3>
                <p className="text-[8px] text-slate-400 font-semibold mt-0.5">Itens conferidos fisicamente</p>
              </div>
              <div className="p-1.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 4: NFs */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between relative overflow-hidden shadow-md">
              <div className="space-y-0.5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">NOTAS FISCAIS <span className="text-indigo-400 font-extrabold">(MÊS)</span></span>
                <h3 className="text-lg font-black text-white leading-none">{tvKpis.nfs}</h3>
                <p className="text-[8px] text-slate-400 font-semibold mt-0.5">NFs processadas em lote</p>
              </div>
              <div className="p-1.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
                <FileText className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 5: Tempo Médio */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between relative overflow-hidden shadow-md">
              <div className="space-y-0.5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">TEMPO MÉDIO <span className="text-indigo-400 font-extrabold">(MÊS)</span></span>
                <h3 className="text-lg font-black text-indigo-400 leading-none">{tvKpis.tempoMedio}</h3>
                <p className="text-[8px] text-indigo-400 font-bold mt-0.5">Ciclo conferência / fiscal</p>
              </div>
              <div className="p-1.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Wrapper for remaining screen space */}
          <div className="flex-1 flex flex-col gap-2.5 min-h-0 overflow-hidden">
            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 flex-1 min-h-0">
              {/* Left: Evolução Diária */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-md overflow-hidden min-h-0 flex-1">
                <div className="flex items-center justify-between mb-1 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] font-black text-white uppercase tracking-wider">Evolução Diária de Entradas</span>
                  </div>
                  <span className="text-[8px] font-mono text-cyan-400 font-extrabold uppercase bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">Acumulado do Mês</span>
                </div>
                <div className="flex-1 w-full min-h-0">
                  <ReChartsResponsiveContainer width="100%" height="100%">
                    <ReChartsBarChart data={chartEvolucaoData} margin={{ top: 15, right: 10, left: -10, bottom: 5 }}>
                      <ReChartsCartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <ReChartsXAxis 
                        dataKey="data" 
                        stroke="#475569" 
                        fontSize={8} 
                        tickLine={false} 
                        axisLine={false} 
                        height={18}
                      />
                      <ReChartsYAxis 
                        stroke="#475569" 
                        fontSize={8} 
                        tickLine={false} 
                        axisLine={false} 
                        width={20}
                      />
                      <ReChartsBar dataKey="recebidos" name="Recebimentos" fill="#38bdf8" radius={[4, 4, 0, 0]} barSize={10}>
                        <ReChartsLabelList dataKey="recebidos" fill="#38bdf8" fontSize={10} fontWeight="bold" position="top" />
                        {chartEvolucaoData.map((entry, index) => (
                          <ReChartsCell key={`cell-${index}`} fill={index === chartEvolucaoData.length - 1 ? '#00ffcc' : '#38bdf8'} />
                        ))}
                      </ReChartsBar>
                      <ReChartsBar dataKey="volume" name="Qtd Itens" fill="#ff9900" radius={[4, 4, 0, 0]} barSize={10}>
                        <ReChartsLabelList dataKey="volume" fill="#ff9900" fontSize={10} fontWeight="bold" position="top" />
                      </ReChartsBar>
                      <ReChartsLegend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '2px' }} />
                    </ReChartsBarChart>
                  </ReChartsResponsiveContainer>
                </div>
              </div>

              {/* Right: Ofensores de Entregas Parciais */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-md overflow-hidden min-h-0 flex-1">
                <div className="flex items-center justify-between mb-1 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[10px] font-black text-white uppercase tracking-wider">Ofensores de Entregas Parciais</span>
                  </div>
                  <span className="text-[8px] font-mono text-slate-400 uppercase">Top 5 Fornecedores</span>
                </div>
                <div className="flex-1 w-full min-h-0">
                  <ReChartsResponsiveContainer width="100%" height="100%">
                    <ReChartsBarChart data={chartOfensoresData} layout="vertical" margin={{ top: 10, right: 25, left: 110, bottom: 5 }}>
                      <ReChartsCartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <ReChartsXAxis 
                        type="number" 
                        stroke="#475569" 
                        fontSize={8} 
                        tickLine={false} 
                        axisLine={false} 
                        height={18}
                      />
                      <ReChartsYAxis 
                        dataKey="name" 
                        type="category" 
                        stroke="#475569" 
                        fontSize={8} 
                        tickLine={false} 
                        axisLine={false} 
                        width={100}
                      />
                      <ReChartsBar dataKey="parciais" name="Entregas Parciais" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={8}>
                        <ReChartsLabelList dataKey="parciais" fill="#ffffff" fontSize={11} fontWeight="bold" position="right" />
                        {chartOfensoresData.map((entry, index) => (
                          <ReChartsCell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#f59e0b'} />
                        ))}
                      </ReChartsBar>
                      <ReChartsLegend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '2px' }} />
                    </ReChartsBarChart>
                  </ReChartsResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Ranking de Operação da Equipe */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between shadow-md overflow-hidden flex-1 min-h-0">
              <div className="flex items-center justify-between mb-1 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] font-black text-white uppercase tracking-wider">Ranking de Operação da Equipe</span>
                </div>
                <span className="text-[8px] font-mono text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900/50 px-2 py-0.5 rounded-full uppercase">
                  Acurácia Geral Almoxarifado
                </span>
              </div>
              <div className="flex-1 overflow-auto scrollbar-none">
                <table className="w-full text-left text-[10px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-mono text-[8px] uppercase">
                      <th className="pb-1 text-slate-400 font-bold">Colaborador / Conferente</th>
                      <th className="pb-1 text-center text-slate-400 font-bold">Linhas Conferidas</th>
                      <th className="pb-1 text-center text-slate-400 font-bold">Volume Total</th>
                      <th className="pb-1 text-right text-slate-400 font-bold">Acurácia de Conferência</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {rankingEquipeData.map((user, idx) => {
                      const badgeColors = 
                        user.acuracia >= 95 ? 'text-emerald-400 bg-emerald-950/50 border-emerald-900/50' : 
                        user.acuracia >= 85 ? 'text-blue-400 bg-blue-950/50 border-blue-900/50' : 
                        'text-amber-400 bg-amber-950/50 border-amber-900/50';
                      return (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-all">
                          <td className="py-1 font-bold text-white flex items-center gap-1.5">
                            <span className="text-slate-500 font-mono w-4 text-center">{idx + 1}.</span>
                            <span className="truncate max-w-[280px]">{user.nome}</span>
                          </td>
                          <td className="py-1 text-center font-mono text-slate-300 font-semibold">{user.linhas} lines</td>
                          <td className="py-1 text-center font-mono text-slate-300 font-semibold">{user.totalEntregue} un</td>
                          <td className="py-1 text-right font-mono">
                            <div className="inline-flex items-center gap-2">
                              <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden hidden sm:block">
                                <div className="h-full bg-emerald-500" style={{ width: `${user.acuracia}%` }} />
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black border uppercase tracking-wider ${badgeColors}`}>
                                {user.acuracia}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16 print:bg-white print:p-0 print:h-auto print:min-h-0 print:overflow-visible print:block print:w-full print:max-w-full">
      
      {/* Barra superior com navegação (oculta na impressão) */}
      <header className="bg-white border-b border-slate-200/80 px-6 py-4 sticky top-0 z-40 shadow-2xs print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBackToHub}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-black uppercase rounded-xl flex items-center gap-2 border border-transparent transition-all cursor-pointer shadow-3xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao HUB</span>
            </button>
            <div className="border-l border-slate-200 pl-4 py-1">
              <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">MÓDULO DE INTEGRAÇÃO</span>
              <h2 className="font-sans font-black text-sm text-slate-900 tracking-tight leading-tight uppercase">
                Consulta de Pedido de Compra (PC)
              </h2>
            </div>
          </div>
          <CompanyLogo height={34} />
        </div>
      </header>
      
      {/* Grid Decoração */}
      <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 print:hidden" />
 
      {/* Área Central / Layout */}
      <main className={`mx-auto px-4 sm:px-6 mt-10 space-y-8 print:mt-0 print:px-0 print:h-auto print:min-h-0 print:overflow-visible print:block print:w-full print:max-w-full transition-all duration-300 ${activeTab === 'monitoramento' || activeTab === 'recebimento_estoque' || activeTab === 'monitor_compras_rpa' ? 'w-full max-w-none' : 'max-w-5xl'}`}>
        
        {/* NAVEGAÇÃO DE ABAS (TABS) & AÇÕES GLOBAIS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3 print:hidden overflow-x-auto">
          <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60 shadow-3xs min-w-max">
            <button
              type="button"
              onClick={() => setActiveTab('consulta')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'consulta'
                  ? 'bg-white text-indigo-700 shadow-3xs border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/50'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Consulta e Check-in</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('monitoramento');
                carregarRecebimentosItens();
              }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'monitoramento'
                  ? 'bg-white text-indigo-700 shadow-3xs border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Monitoramento de Entradas</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('recebimento_estoque');
                carregarRecebimentosItens();
              }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'recebimento_estoque'
                  ? 'bg-white text-indigo-700 shadow-3xs border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/50'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>📦 Recebimentos de Estoque</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('monitor_compras_rpa');
              }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'monitor_compras_rpa'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/50'
              }`}
            >
              <PackageSearch className="w-3.5 h-3.5 text-amber-500" />
              <span>🤖 Rastreio de RM's com Pedidos de Compra</span>
            </button>
          </div>
        </div>

        {activeTab === 'consulta' && (
          <ConsultaPedidosMestreDetalhe 
            initialPedidoId={pedidoAtual || pedidoId} 
            onRefreshParentHistorico={carregarRecebimentosItens}
          />
        )}

        {/* LAYOUT DA ABA DE MONITORAMENTO E RECEBIMENTOS DE ESTOQUE */}
        {(activeTab === 'monitoramento' || activeTab === 'recebimento_estoque') && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 text-left"
          >
            {/* Banner Informativo Exclusivo da Aba de Recebimento de Estoque */}
            {activeTab === 'recebimento_estoque' && (
              <div className="bg-gradient-to-r from-sky-50 via-indigo-50 to-blue-50 border border-sky-200/80 rounded-3xl p-5 shadow-3xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-3 bg-sky-500 text-white rounded-2xl shadow-sm shrink-0">
                    <Package className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black text-sky-950 uppercase tracking-tight">
                        📦 Painel de Recebimento Físico de Estoque
                      </h2>
                      <span className="bg-sky-200/80 text-sky-900 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-sky-300">
                        Filtro Ativo: (ESTOQUE)
                      </span>
                    </div>
                    <p className="text-xs text-sky-800 font-medium leading-relaxed">
                      Triagem automatizada de Pedidos de Compra cuja Classe Financeira contém a especificação de <strong className="font-bold text-sky-950">(ESTOQUE)</strong>. Apenas os itens deste painel devem dar entrada física nas prateleiras do armazém.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Banner de Alerta para Rateio Misto em Estoque */}
            {activeTab === 'recebimento_estoque' && (
              <div className="bg-amber-50/90 border border-amber-200 text-amber-900 rounded-2xl p-4 text-xs font-semibold flex items-start gap-3 shadow-3xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-black text-amber-950 uppercase tracking-tight text-xs flex items-center gap-2">
                    <span>⚠️ ALERTA AO CONFERENTE — ATENÇÃO PARA RATEIO MISTO</span>
                  </h4>
                  <p className="text-[11.5px] leading-relaxed text-amber-800">
                    Pedidos sinalizados com o ícone <strong className="bg-amber-100 text-amber-950 px-1.5 py-0.5 rounded border border-amber-300">⚠️ Rateio Misto</strong> (ex: PC 7964 com 95% Estoque e 5% Despesa) possuem fração de nota fiscal referente a Custo ou Despesa direta. Apenas os itens destinados ao estoque devem ser armazenados fisicamente na prateleira.
                  </p>
                </div>
              </div>
            )}
            {/* DASHBOARD RESUMO */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 print:hidden">
              {/* Card 1: Entradas Registradas */}
              <div className="bg-white border border-slate-200/85 rounded-3xl p-6 shadow-xs relative overflow-hidden flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">ENTRADAS REGISTRADAS</span>
                  <h3 className="text-3xl font-black text-slate-900 leading-none">
                    {filteredHistorico.length}
                  </h3>
                  <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    SGI Tempo Real Ativo
                  </p>
                </div>
                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
                  <Database className="w-6 h-6" />
                </div>
              </div>

              {/* Card 2: Recebidos Parciais */}
              <div className="bg-white border border-slate-200/85 rounded-3xl p-6 shadow-xs relative overflow-hidden flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">RECEBIDOS PARCIAIS</span>
                  <h3 className="text-3xl font-black text-amber-600 leading-none">
                    {filteredHistorico.filter(h => h.status_recebimento === 'parcial').length}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-semibold mt-1">
                    Gestão de saldo pendente
                  </p>
                </div>
                <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
              </div>

              {/* Card 3: Recusados */}
              <div className="bg-white border border-slate-200/85 rounded-3xl p-6 shadow-xs relative overflow-hidden flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">RECUSADOS / CANCELADOS</span>
                  <h3 className="text-3xl font-black text-rose-600 leading-none">
                    {filteredHistorico.filter(h => h.status_recebimento === 'recusar' || h.status_recebimento === 'recusado' || h.status_recebimento === 'cancelado').length}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-semibold mt-1">
                    Bloqueio fiscal e físico
                  </p>
                </div>
                <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Mensagens de Feedback do Sync */}
            {syncSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-2xl p-4 text-xs font-semibold flex items-center justify-between shadow-3xs animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{syncSuccessMsg}</span>
                </div>
                <button 
                  onClick={() => setSyncSuccessMsg(null)}
                  className="text-[10px] uppercase font-black tracking-wider text-emerald-600 hover:text-emerald-800 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            )}

            {syncErrorMsg && (
              <div className="bg-rose-50 border border-rose-150 text-rose-800 rounded-2xl p-4 text-xs font-semibold flex items-center justify-between shadow-3xs animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span>{syncErrorMsg}</span>
                </div>
                <button 
                  onClick={() => setSyncErrorMsg(null)}
                  className="text-[10px] uppercase font-black tracking-wider text-rose-600 hover:text-rose-800 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            )}

            {/* BARRA DE FERRAMENTAS / FILTROS TOP */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-3xs flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 print:hidden">
              {/* Campo de Busca */}
              <div className="flex-1 min-w-[220px] relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQueryMonitoramento}
                  onChange={(e) => setSearchQueryMonitoramento(e.target.value)}
                  placeholder="Buscar por PC, Fornecedor ou NF..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 transition-all focus:outline-hidden"
                />
                {searchQueryMonitoramento && (
                  <button 
                    onClick={() => setSearchQueryMonitoramento('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded-md text-slate-600 font-bold transition-all uppercase tracking-wider cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Filtro de Status */}
              <div className="w-full sm:w-auto min-w-[170px] relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Filter className="w-3.5 h-3.5" />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-bold text-slate-700 transition-all focus:outline-hidden appearance-none cursor-pointer"
                >
                  <option value="all">Filtro: Todos Status</option>
                  <option value="total">Recebido Total</option>
                  <option value="parcial">Recebido Parcial</option>
                  <option value="reagendar">Reagendado</option>
                  <option value="recusar">Recusado/Cancelado</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                </div>
              </div>

              {/* Filtro de Data Inicial */}
              <div className="w-full sm:w-auto min-w-[130px] relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="w-full pl-9 pr-2 py-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-bold text-slate-700 transition-all focus:outline-hidden cursor-pointer"
                  title="Data Inicial"
                  placeholder="Data Inicial"
                />
              </div>

              {/* Filtro de Data Final */}
              <div className="w-full sm:w-auto min-w-[130px] relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="w-full pl-9 pr-2 py-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-bold text-slate-700 transition-all focus:outline-hidden cursor-pointer"
                  title="Data Final"
                  placeholder="Data Final"
                />
              </div>

              {/* Botões de Ações: Sincronização de Lançamentos Fiscais + Atualização Rápida */}
              <div className="flex items-center gap-2 w-full lg:w-auto justify-end flex-wrap">
                <button
                  type="button"
                  onClick={handleSincronizarLancamentosFiscais}
                  disabled={syncLoading || loadingHistorico}
                  className="relative overflow-hidden h-11 min-w-[270px] bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-white text-white font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-3xs flex items-center justify-center gap-2 border border-transparent shrink-0"
                >
                  {syncLoading && syncProgress.total > 0 ? (
                    <>
                      {/* Barra de progresso embutida */}
                      <div
                        className="absolute left-0 top-0 h-full bg-emerald-500 transition-all duration-300 ease-out"
                        style={{ width: `${Math.round((syncProgress.current / syncProgress.total) * 100)}%` }}
                      />
                      {/* Texto sobreposto */}
                      <span className="relative z-10 flex items-center gap-2 font-black text-white drop-shadow-xs">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-white" />
                        <span>
                          Sincronizando {syncProgress.current} de {syncProgress.total} ({Math.round((syncProgress.current / syncProgress.total) * 100)}%)
                        </span>
                      </span>
                    </>
                  ) : syncLoading ? (
                    <span className="relative z-10 flex items-center gap-2 font-black text-white">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                      <span>Sincronizando...</span>
                    </span>
                  ) : (
                    <span className="relative z-10 flex items-center gap-2 font-black">
                      <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                      <span>Sincronizar Lançamentos Fiscais</span>
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={carregarRecebimentosItens}
                  disabled={loadingHistorico || syncLoading}
                  title="Atualizar SGI"
                  className="w-11 h-11 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 disabled:opacity-50 flex items-center justify-center rounded-xl border border-indigo-150 transition-all cursor-pointer shadow-3xs shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingHistorico ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* GRUPOS DE ENTRADAS (ACCORDION) */}
            <div className="bg-white border border-slate-200 shadow-xs rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h4 className="text-base font-black text-slate-900 tracking-tight uppercase">
                    Auditoria e Monitoramento de Entradas
                  </h4>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Visão unificada das conferências físicas e monitoramento fiscal no ERP por lote de recebimento (PC / NF).
                  </p>
                </div>

                {filteredHistorico.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportarExcel}
                    className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-3xs hover:shadow-2xs shrink-0"
                    title="Exportar registros filtrados para Excel"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Exportar Excel</span>
                  </button>
                )}
              </div>

              {/* Kanban Board Layout */}
              <div className="pt-2">
                {loadingHistorico ? (
                  <div className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-3.5">
                      <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Buscando lançamentos no sistema...</p>
                    </div>
                  </div>
                ) : filteredGroups.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Coluna 1: NO BALCÃO (Aguardando Lançamento Fiscal ERP) */}
                    <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-200 flex flex-col h-[75vh] min-h-[550px]">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                          <h5 className="text-xs font-black uppercase tracking-wider text-slate-700">No Balcão</h5>
                        </div>
                        <span className="bg-blue-50 text-blue-700 border border-blue-150 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono">
                          {kanbanColumns.noBalcao.length}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-4 leading-normal">
                        Físico recebido sem lançamento fiscal no ERP (Qtd Lançada = 0).
                      </p>

                      <div className="space-y-3.5 flex-1 overflow-y-auto pr-1.5 scrollbar-thin">
                        {kanbanColumns.noBalcao.length > 0 ? (
                          kanbanColumns.noBalcao.map(group => renderKanbanCard(group))
                        ) : (
                          <div className="h-32 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl p-4 text-center text-slate-400">
                            <p className="text-[10px] font-bold uppercase text-slate-400/80">Nenhum pedido nesta etapa</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Coluna 2: LANÇAMENTO PARCIAL (Amarelo / Alerta) */}
                    <div className="bg-amber-50/30 rounded-2xl p-4 border border-amber-200/80 flex flex-col h-[75vh] min-h-[550px]">
                      <div className="flex items-center justify-between pb-3 border-b border-amber-200/60 mb-3.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                          <h5 className="text-xs font-black uppercase tracking-wider text-amber-900">Lançamento Parcial</h5>
                        </div>
                        <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono">
                          {kanbanColumns.lancamentoParcial.length}
                        </span>
                      </div>
                      <p className="text-[10px] text-amber-700/80 font-bold uppercase tracking-wider mb-4 leading-normal">
                        Lançamento fiscal no ERP iniciado, porém pendente de saldo (Qtd Lançada &gt; 0 e &lt; Qtd Recebida).
                      </p>

                      <div className="space-y-3.5 flex-1 overflow-y-auto pr-1.5 scrollbar-thin">
                        {kanbanColumns.lancamentoParcial.length > 0 ? (
                          kanbanColumns.lancamentoParcial.map(group => renderKanbanCard(group))
                        ) : (
                          <div className="h-32 flex flex-col items-center justify-center border border-dashed border-amber-200/60 rounded-xl p-4 text-center text-amber-500/70">
                            <p className="text-[10px] font-bold uppercase">Nenhum pedido nesta etapa</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Coluna 3: LANÇADO / FINALIZADO */}
                    <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-200 flex flex-col h-[75vh] min-h-[550px]">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <h5 className="text-xs font-black uppercase tracking-wider text-slate-700">Lançado / Finalizado</h5>
                        </div>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-150 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono">
                          {kanbanColumns.lancadoFinalizado.length}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-4 leading-normal">
                        Lançamento fiscal no ERP concluído com sucesso (Qtd Lançada &ge; Qtd Recebida).
                      </p>

                      <div className="space-y-3.5 flex-1 overflow-y-auto pr-1.5 scrollbar-thin">
                        {kanbanColumns.lancadoFinalizado.length > 0 ? (
                          kanbanColumns.lancadoFinalizado.map(group => renderKanbanCard(group))
                        ) : (
                          <div className="h-32 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl p-4 text-center text-slate-400">
                            <p className="text-[10px] font-bold uppercase text-slate-400/80">Nenhum pedido nesta etapa</p>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <div className="flex flex-col items-center justify-center space-y-3.5">
                      <div className="p-4 bg-slate-100 border border-slate-150 rounded-full text-slate-350">
                        <Search className="w-8 h-8" />
                      </div>
                      <div className="space-y-1 max-w-md mx-auto">
                        <p className="text-sm font-black text-slate-700 uppercase tracking-tight">
                          {searchQueryMonitoramento || statusFilter !== 'all' || startDateFilter || endDateFilter 
                            ? "Nenhum recebimento encontrado para os filtros selecionados." 
                            : "Aguardando registros de entrada física."}
                        </p>
                        <p className="text-xs text-slate-500 font-medium">
                          {searchQueryMonitoramento || statusFilter !== 'all' || startDateFilter || endDateFilter
                            ? "Experimente ajustar ou limpar os filtros de busca para visualizar os registros."
                            : "Nenhum check-in físico de material foi realizado no almoxarifado até o momento."}
                        </p>
                      </div>
                      {(searchQueryMonitoramento || statusFilter !== 'all' || startDateFilter || endDateFilter) && (
                        <button
                          onClick={() => {
                            setSearchQueryMonitoramento('');
                            setStatusFilter('all');
                            setStartDateFilter(todayStr);
                            setEndDateFilter(todayStr);
                          }}
                          className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all border border-indigo-150/50 cursor-pointer"
                        >
                          Limpar Filtros
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'monitor_compras_rpa' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
          >
            <MonitorCompras />
          </motion.div>
        )}

      </main>

      {/* MODAL DE CHECK-IN DE ITEM INDIVIDUAL */}
      <AnimatePresence>
        {checkInItem && (() => {
          const qtd_pedida = Number(checkInItem.qtd) || 0;
          const qtdCalculada_recebida = Math.max(calcularQuantidadeRealtime(checkInItem), getQtdJaBaixada(checkInItem.codigo, qtd_pedida, checkInItem.descricao));
          const saldo_pendente = qtd_pedida - qtdCalculada_recebida;
          const saldoPermitido = Math.max(0, saldo_pendente);

          return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-fade-in text-left text-xs">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-slate-200 shadow-2xl space-y-6"
              >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">Portaria / Check-in de Material</span>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-indigo-600" />
                      Receber Item {checkInItem.codigo}
                    </h3>
                  </div>
                  <button
                    onClick={() => setCheckInItem(null)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition duration-150 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Info Card */}
                <div className="bg-indigo-50/40 border border-indigo-100 p-4 rounded-2xl space-y-2">
                  <span className="text-[9px] font-black text-indigo-800 uppercase tracking-widest block">Descrição do Material</span>
                  <p className="text-xs font-semibold text-slate-800 leading-relaxed">{checkInItem.descricao}</p>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-indigo-50 text-[11px]">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block">Pedida</span>
                      <span className="font-mono font-black text-slate-700">{qtd_pedida} un</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block">Já Recebida</span>
                      <span className="font-mono font-black text-blue-700">{qtdCalculada_recebida} un</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block">Saldo Pendente</span>
                      <span className="font-mono font-black text-rose-700">{saldoPermitido} un</span>
                    </div>
                  </div>
                </div>

                {/* Form Fields / Hard Block of Rendering */}
                {saldoPermitido <= 0 ? (
                  <div className="space-y-6">
                    <div className="bg-red-50 border-3 border-red-200 text-red-950 rounded-2xl p-6 flex items-start gap-4 shadow-xs">
                      <span className="text-4xl shrink-0">⚠️</span>
                      <div className="space-y-1">
                        <span className="text-[11px] font-black uppercase tracking-wider text-red-800 block">Item Totalmente Recebido</span>
                        <p className="text-xs font-bold leading-relaxed text-red-950">
                          ⚠️ ATENÇÃO: Este item já teve 100% da sua quantidade física recebida. O sistema bloqueou novas entradas para evitar duplicidade.
                        </p>
                      </div>
                    </div>

                    {/* Footer Buttons (No send button, only Close/Voltar) */}
                    <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={() => setCheckInItem(null)}
                        className="px-5 py-2.5 border border-slate-200 text-slate-500 font-black uppercase tracking-wider rounded-xl hover:bg-slate-50 hover:text-slate-700 active:scale-98 transition text-[10px] cursor-pointer"
                      >
                        Voltar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {/* Quantidade */}
                      <div className="space-y-1.5 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                        <label className="text-[10px] font-black text-indigo-950 uppercase tracking-wider block">
                          Quantidade Física Recebida (Chegando no Caminhão) <span className="text-red-500 font-bold">*</span>
                        </label>
                        <p className="text-[11px] text-slate-500 mb-2">Informe a quantidade física exata que está a chegar no camião para este item.</p>
                        <div className="relative">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            max={saldoPermitido}
                            value={checkInQtd}
                            onChange={(e) => {
                              const valStr = e.target.value;
                              if (valStr === '') {
                                setCheckInQtd('');
                              } else {
                                const val = Number(valStr);
                                if (val < 0.01) {
                                  setCheckInQtd(0.01);
                                } else if (val > saldoPermitido) {
                                  setCheckInQtd(saldoPermitido);
                                } else {
                                  setCheckInQtd(val);
                                }
                              }
                            }}
                            className="w-full px-4 py-2.5 bg-white border border-indigo-300 rounded-xl text-xs font-black text-indigo-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-indigo-500">
                            max: {saldoPermitido} un
                          </span>
                        </div>
                      </div>

                      {/* Nota Fiscal */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                            Número da Nota Fiscal <span className="text-red-500 font-bold">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: 105432"
                            value={singleNumeroNF}
                            onChange={(e) => setSingleNumeroNF(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-slate-250 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                            Data de Recebimento <span className="text-red-500 font-bold">*</span>
                          </label>
                          <input
                            type="date"
                            value={singleDataRecebimento}
                            onChange={(e) => setSingleDataRecebimento(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-slate-250 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Nome do Almoxarife */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                          Nome do Almoxarife / Recebedor <span className="text-red-500 font-bold">*</span>
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                          <select
                            required
                            value={singleNomeRecebedor}
                            onChange={(e) => setSingleNomeRecebedor(e.target.value)}
                            className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-250 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                          >
                            <option value="" disabled>Selecione o Recebedor...</option>
                            {PRE_REGISTERED_EMPLOYEES.map((emp, idx) => (
                              <option key={idx} value={emp.name}>
                                {emp.name} ({emp.cargo})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={() => setCheckInItem(null)}
                        className="px-5 py-2.5 border border-slate-200 text-slate-500 font-black uppercase tracking-wider rounded-xl hover:bg-slate-50 hover:text-slate-700 active:scale-98 transition text-[10px]"
                      >
                        Voltar
                      </button>
                      <button
                        type="button"
                        disabled={
                          checkInLoading ||
                          !checkInQtd ||
                          Number(checkInQtd) <= 0 ||
                          Number(checkInQtd) > saldoPermitido ||
                          !singleNomeRecebedor.trim() ||
                          !singleNumeroNF.trim()
                        }
                        onClick={handleConfirmSingleCheckIn}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider rounded-xl active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed transition text-[10px] flex items-center gap-1.5 shadow-3xs"
                      >
                        {checkInLoading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Processando...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Confirmar Check-In</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* MODAL DE SUCESSO EXTRAORDINÁRIO (SWEETALERT / OVERLAY) */}
      <AnimatePresence>
        {successOverlay.isOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-70 text-slate-100">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white text-slate-900 border border-slate-200 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-8 flex flex-col items-center text-center space-y-6"
            >
              {/* Giant checkmark icon */}
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border-4 border-emerald-100 shadow-inner">
                <span className="text-4xl">✅</span>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <h3 className="text-lg font-black text-emerald-900 tracking-tight leading-snug uppercase">
                  CHECK-IN REALIZADO COM SUCESSO!
                </h3>
                <p className="text-xs font-bold text-slate-600 leading-relaxed px-2">
                  Você deu entrada em <span className="font-mono text-emerald-700 font-black text-sm">{successOverlay.quantity}</span> unidades do item.
                </p>
                {successOverlay.description && (
                  <p className="text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 mt-2 italic max-w-xs mx-auto">
                    {successOverlay.description}
                  </p>
                )}
              </div>

              {/* Big Action Button */}
              <button
                type="button"
                onClick={handleCloseSuccessOverlay}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95 cursor-pointer"
              >
                <span>Entendi / Fechar</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <AnimatePresence>
        {deletingItem && (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-fade-in text-left text-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-black uppercase tracking-tight">Cancelar Recebimento</h3>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs text-slate-600 font-semibold">
                  Tem certeza que deseja cancelar este recebimento? O saldo voltará para o pedido.
                </p>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-[11px] font-semibold text-slate-700 space-y-1">
                  <div><span className="font-bold">Item:</span> ({deletingItem.codigo}) {deletingItem.descricao}</div>
                  <div><span className="font-bold">PC:</span> {deletingItem.numero_pc} | <span className="font-bold">NF:</span> {deletingItem.numero_nf}</div>
                  <div><span className="font-bold">Qtd Recebida:</span> {deletingItem.qtd_entregue}</div>
                  <div><span className="font-bold">Conferente:</span> {deletingItem.recebedor}</div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeletingItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Não, Voltar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-3xs"
                >
                  Sim, Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE EDIÇÃO DE RECEBIMENTO */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-fade-in text-left">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-4"
            >
              <div className="flex items-center gap-3 text-indigo-600">
                <Pencil className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-black uppercase tracking-tight">Editar Recebimento</h3>
              </div>
              
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-[11px] font-semibold text-slate-700 space-y-1">
                  <div><span className="font-bold">Item:</span> ({editingItem.codigo}) {editingItem.descricao}</div>
                  <div><span className="font-bold">PC:</span> {editingItem.numero_pc} | <span className="font-bold">NF:</span> {editingItem.numero_nf}</div>
                  <div><span className="font-bold">Qtd Pedida:</span> {editingItem.qtd_original}</div>
                </div>

                {/* Input de Quantidade */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Quantidade Recebida
                  </label>
                  <input
                    type="number"
                    value={editQtd}
                    onChange={(e) => setEditQtd(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden"
                  />
                  <p className="text-[9px] text-slate-400 font-semibold">
                    A quantidade atualizada não deve exceder o total pedido de {editingItem.qtd_original}.
                  </p>
                </div>

                {/* Input de Data */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Data de Recebimento
                  </label>
                  <input
                    type="date"
                    value={editData}
                    onChange={(e) => setEditData(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEdit}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-3xs"
                >
                  Salvar Alterações
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL AUXILIAR DE IMPRESSÃO (IFRAME SAFE) */}
      <AnimatePresence>
        {showPrintModal && (
          <div 
            className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in print:hidden text-left"
            onClick={() => setShowPrintModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative space-y-5"
            >
              {/* Close Button */}
              <button 
                onClick={() => setShowPrintModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
                  <Printer className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">
                    Instruções de Impressão / PDF
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                    Ambiente Integrado AI Studio
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed font-medium">
                <div className="p-3.5 bg-amber-50/50 border border-amber-150 rounded-2xl flex items-start gap-3 text-amber-800">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-normal font-semibold">
                    Os navegadores restringem o comando <code className="bg-amber-100/80 px-1 py-0.5 rounded-sm font-mono text-[10px] text-amber-900 font-bold">window.print()</code> de ser executado diretamente de dentro de iFrames externos por questões de privacidade e sandbox do painel.
                  </p>
                </div>

                <p className="text-slate-700 font-bold uppercase text-[10px] tracking-wider">Como gerar seu PDF perfeitamente:</p>
                
                <ol className="list-decimal pl-5 space-y-2 text-slate-600">
                  <li>
                    Clique no botão de <strong className="text-indigo-600">"Abrir em Nova Aba"</strong> (ícone de seta diagonal saindo do quadrado) no canto superior direito do visualizador do AI Studio.
                  </li>
                  <li>
                    Com o aplicativo aberto na nova aba dedicada, clique no botão <strong className="text-slate-900">"Imprimir / Salvar PDF"</strong> novamente.
                  </li>
                  <li>
                    A janela de impressão padrão do seu sistema será aberta. Selecione a opção <strong className="text-indigo-600">"Salvar como PDF"</strong> ou envie diretamente para sua impressora física.
                  </li>
                </ol>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-[11px] text-slate-500 text-center font-semibold">
                  A folha de estilos de impressão foi otimizada para ocultar botões e barras de navegação automaticamente ao gerar o PDF.
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowPrintModal(false);
                    try {
                      window.print();
                    } catch (e) {}
                  }}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  Tentar Mesmo Assim
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer shadow-3xs"
                >
                  Entendi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DETALHES DE CONFERÊNCIA FÍSICA */}
      <AnimatePresence>
        {selectedRecordDetails && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-left print:hidden"
            onClick={() => setSelectedRecordDetails(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 relative space-y-6 max-h-[90vh] overflow-y-auto"
            >
              {/* Close button */}
              <button 
                onClick={() => setSelectedRecordDetails(null)}
                className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-2xl border shrink-0 ${
                  selectedRecordDetails.status_recebimento === 'total' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                  selectedRecordDetails.status_recebimento === 'parcial' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                  selectedRecordDetails.status_recebimento === 'reagendar' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                  'bg-rose-50 text-rose-600 border-rose-100'
                }`}>
                  <FileText className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black text-indigo-600">{selectedRecordDetails.numero_pc}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                      selectedRecordDetails.status_recebimento === 'total' ? 'bg-emerald-50 text-emerald-700 border-emerald-150' :
                      selectedRecordDetails.status_recebimento === 'parcial' ? 'bg-amber-50 text-amber-700 border-amber-150' :
                      selectedRecordDetails.status_recebimento === 'reagendar' ? 'bg-blue-50 text-blue-700 border-blue-150' :
                      'bg-rose-50 text-rose-700 border-rose-150'
                    }`}>
                      {selectedRecordDetails.status_recebimento === 'total' ? 'Recebido Total' :
                       selectedRecordDetails.status_recebimento === 'parcial' ? 'Recebido Parcial' :
                       selectedRecordDetails.status_recebimento === 'reagendar' ? 'Reagendado' : 'Recusado / Cancelado'}
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                    {selectedRecordDetails.fornecedor}
                  </h3>
                </div>
              </div>

              {/* Detalhes específicos e observações */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-150 text-xs">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">Data/Hora de Registro</span>
                  <p className="font-mono text-slate-700 font-bold mt-0.5">{selectedRecordDetails.registrado_em}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">Conferente / Responsável</span>
                  <p className="text-slate-700 font-bold mt-0.5">{selectedRecordDetails.recebedor}</p>
                </div>
                {selectedRecordDetails.detalhes && (
                  <div className="sm:col-span-2 border-t border-slate-200/65 pt-3 mt-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">Observações / Pendências</span>
                    <p className="text-slate-800 font-semibold mt-0.5 bg-white border border-slate-150 px-3 py-2 rounded-lg leading-relaxed">
                      {selectedRecordDetails.detalhes}
                    </p>
                  </div>
                )}
              </div>

              {/* Itens Conferidos list */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider font-bold">Itens do Recebimento</span>
                {selectedRecordDetails.itens_conferidos && selectedRecordDetails.itens_conferidos.length > 0 ? (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          <th className="py-2.5 px-4">Código</th>
                          <th className="py-2.5 px-4">Descrição</th>
                          <th className="py-2.5 px-4 text-center w-28">Qtd Original</th>
                          <th className="py-2.5 px-4 text-center w-28">Qtd Entregue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {(() => {
                          const itemsToDeduplicate = selectedRecordDetails.itens_conferidos || [];
                          const itensUnicos = itemsToDeduplicate.filter((item, index, self) =>
                            index === self.findIndex((t) => (
                              t.codigo === item.codigo && 
                              (Number(t.qtd_original) || 0) === (Number(item.qtd_original) || 0) &&
                              (t.descricao || '').trim().toLowerCase() === (item.descricao || '').trim().toLowerCase()
                            ))
                          );
                          return itensUnicos.map((item, idx) => {
                            const isDivergent = item.qtd_entregue !== item.qtd_original;
                            const descNormalizada = (item.descricao || '').trim().toLowerCase();
                            const keyComposta = `${item.codigo}-${item.qtd_original || 0}-${descNormalizada}`;
                            return (
                              <tr key={keyComposta} className="hover:bg-slate-50/40">
                                <td className="py-3 px-4 font-mono text-indigo-600 font-bold">{item.codigo}</td>
                                <td className="py-3 px-4 text-slate-700 font-semibold">{item.descricao}</td>
                                <td className="py-3 px-4 text-center text-slate-500 font-bold">{item.qtd_original}</td>
                                <td className={`py-3 px-4 text-center font-bold ${isDivergent ? 'text-amber-600 bg-amber-50/40' : 'text-emerald-600'}`}>
                                  {item.qtd_entregue}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-250 rounded-2xl text-slate-400 italic text-xs font-semibold">
                    Sem itens físicos registrados nesta conferência (Ação de Reagendamento / Recusa Total).
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedRecordDetails(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL / SLIDE-OVER DE DETALHES DO PEDIDO (KANBAN CARD CLICK) */}
      <AnimatePresence>
        {activeGroupDetails && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-left print:hidden animate-fade-in"
            onClick={() => setSelectedGroupDetails(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-5xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative space-y-6 max-h-[90vh] overflow-y-auto"
            >
              {/* Botão Fechar */}
              <button 
                onClick={() => setSelectedGroupDetails(null)}
                className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Cabeçalho do Modal */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <span className="text-xs font-mono font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                      PC: {activeGroupDetails.numero_pc}
                    </span>
                    <span className="text-xs font-mono font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                      NF: {activeGroupDetails.numero_nf}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 font-mono">
                      Registrado em: {activeGroupDetails.registrado_em}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                    {activeGroupDetails.fornecedor}
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  {/* Status Badge */}
                  {activeGroupDetails.status_recebimento === 'total' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-150">
                      Total
                    </span>
                  )}
                  {activeGroupDetails.status_recebimento === 'parcial' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-150">
                      Parcial
                    </span>
                  )}
                  {activeGroupDetails.status_recebimento === 'reagendar' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-150">
                      Reagendado
                    </span>
                  )}
                  {activeGroupDetails.status_recebimento === 'recusar' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-150">
                      Recusado
                    </span>
                  )}

                  {/* Status de Estoque e Classe Financeira */}
                  {(() => {
                    const estInfo = checkEstoqueStatus(activeGroupDetails);
                    return (
                      <>
                        {estInfo.isEstoque && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-sky-100 text-sky-800 border border-sky-200">
                            <Package className="w-3 h-3 text-sky-600" />
                            <span>PC DE ESTOQUE</span>
                          </span>
                        )}
                        {estInfo.isRateioMisto && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300 shadow-3xs" title="Atenção Backoffice: Pedido Misto (contém Estoque e Custo/Despesa)">
                            ⚠️ PEDIDO MISTO
                          </span>
                        )}
                      </>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRecordDetails(activeGroupDetails.items[0]?.record);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-xl transition duration-150 text-[10px] font-black uppercase border border-slate-200 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Gerar PDF / PC</span>
                  </button>
                </div>
              </div>

              {/* Informações Auxiliares */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/80 text-xs">
                <div>
                  <span className="text-[9px] uppercase font-black text-slate-400 block tracking-wider mb-0.5">Centro de Custo</span>
                  <p className="text-slate-700 font-bold">{activeGroupDetails.centro_custo}</p>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-black text-slate-400 block tracking-wider mb-0.5">Recebedor</span>
                  <p className="text-slate-700 font-bold">{activeGroupDetails.recebedor}</p>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-black text-slate-400 block tracking-wider mb-0.5">Qtd Total de Itens</span>
                  <p className="text-indigo-600 font-bold font-mono">{activeGroupDetails.items.length}</p>
                </div>
              </div>

              {/* Contexto Global do Pedido (PC) Banner */}
              {(() => {
                const targetPC = (activeGroupDetails.numero_pc || '').trim().toLowerCase();
                const targetNF = (activeGroupDetails.numero_nf || '').trim().toLowerCase();

                // Registros de todo o PC
                const allRecordsForPC = flatItensHistorico.filter((r: any) => 
                  String(r.numero_pc || '').trim().toLowerCase() === targetPC
                );

                const totalEntreguePC = allRecordsForPC.reduce((acc, r) => acc + (Number(r.qtd_entregue) || 0), 0);
                
                // Soma do que foi lançado fiscal em outras NFs deste mesmo PC
                const totalLancadoOutrasNFs = allRecordsForPC.reduce((acc, r) => {
                  const rNF = String(r.numero_nf || '').trim().toLowerCase();
                  if (rNF !== targetNF && cleanNF(rNF) !== cleanNF(targetNF)) {
                    const check = verificarBaixaERP(r);
                    return acc + check.qtdLancada;
                  }
                  return acc;
                }, 0);

                return (
                  <div className="bg-indigo-50/60 border border-indigo-150 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl shrink-0">
                        <Info className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-black text-indigo-950 uppercase tracking-wide block">
                          Contexto Global do Pedido (PC {activeGroupDetails.numero_pc})
                        </span>
                        <span className="text-[11px] text-slate-600 font-medium">
                          Saldos e históricos consolidados somando todas as entregas e NFs vinculadas a este Pedido.
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-bold">
                      {totalLancadoOutrasNFs > 0 && (
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-xl shadow-3xs" title="Total já faturado no ERP em outras NFs deste PC">
                          Já Lançado ERP (Outras NFs): {totalLancadoOutrasNFs} un
                        </span>
                      )}
                      <span className="bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-xl shadow-3xs" title="Qtd total entregue no almoxarifado somando todas as NFs">
                        Entregue Acumulado (PC): {totalEntreguePC} un
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Tabela de Itens */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-3xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs min-w-[800px] whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-slate-200 text-[9px] font-black uppercase text-slate-400 tracking-widest bg-slate-50/50">
                        <th className="py-3 px-4">Item (Código + Descrição)</th>
                        <th className="py-3 px-3 text-center">Status Físico</th>
                        <th className="py-3 px-3 text-center">Status Fiscal</th>
                        <th className="py-3 px-3 text-center">Data Baixa Fiscal</th>
                        <th className="py-3 px-3 text-center">Qtd Lançada ERP</th>
                        <th className="py-3 px-3 text-center">Qtd Pedida</th>
                        <th className="py-3 px-3 text-center">Qtd Recebida (Esta NF)</th>
                        <th className="py-3 px-3 text-center">Saldo Físico Pendente</th>
                        <th className="py-3 px-4 text-center w-24">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                      {(() => {
                        const targetPC = (activeGroupDetails.numero_pc || '').trim().toLowerCase();
                        const targetNF = (activeGroupDetails.numero_nf || '').trim().toLowerCase();

                        // 1. Filtro Estrito: Apenas itens pertencentes exatamente a este PC e a esta NF
                        const rawItems = activeGroupDetails.items || [];
                        const itensDestaNF = rawItems.filter((item: any) => {
                          const itemPC = String(item.numero_pc || item.pc || '').trim().toLowerCase();
                          const pcMatch = !targetPC || itemPC === targetPC;

                          const itemNF = String(item.numero_nf || item.nf || '').trim().toLowerCase();
                          const nfMatch = !targetNF || isNFMatch(itemNF, targetNF) || cleanNF(itemNF) === cleanNF(targetNF) || itemNF === targetNF;

                          return pcMatch && nfMatch;
                        });

                        const itemsToRender = itensDestaNF.length > 0 ? itensDestaNF : rawItems;

                        return itemsToRender.map((row: any, idx: number) => {
                          const targetNFStr = activeGroupDetails.numero_nf || row.numero_nf;
                          const vCheck = verificarBaixaERP(row);
                          const qtd_pedida = Number(row.qtd_original) || 0;
                          const qtd_recebida_nesta_nf = Number(row.qtd_entregue) || 0;
                          const qtd_lancada_erp = vCheck.qtdLancada;
                          const statusRec = (row.status_recebimento || '').toString().toLowerCase();

                          // 2. Isolamento de Lançamento Fiscal
                          const dataBaixaFiscal = qtd_lancada_erp > 0 ? formatarDataSegura(vCheck.dataOcorrencia) : '-';
                          const qtdLancadaERPStr = qtd_lancada_erp > 0 ? qtd_lancada_erp.toString() : '0';

                          // 3. CONTEXTO GLOBAL DO PEDIDO (PC) PARA ESTE ITEM
                          const itemCodigo = String(row.codigo || row.codigo_item || '').trim().toLowerCase();
                          const allRecordsForThisPCItem = flatItensHistorico.filter((r: any) => {
                            const rPC = String(r.numero_pc || '').trim().toLowerCase();
                            const rCod = String(r.codigo || r.codigo_item || '').trim().toLowerCase();
                            return rPC === targetPC && rCod === itemCodigo;
                          });

                          // SOMA(Todas as Qtd_Recebidas de todas as NFs daquele PC)
                          const somaQtdEntregueTodasNFs = allRecordsForThisPCItem.reduce(
                            (acc, r) => acc + (Number(r.qtd_entregue) || 0),
                            0
                          );

                          // QTD TOTAL JÁ LANÇADA EM OUTRAS NFs DO MESMO PC
                          const somaQtdLancadaOutrasNFs = allRecordsForThisPCItem.reduce((acc, r) => {
                            const rNF = String(r.numero_nf || '').trim().toLowerCase();
                            if (rNF !== targetNF && cleanNF(rNF) !== cleanNF(targetNF)) {
                              const check = verificarBaixaERP(r);
                              return acc + check.qtdLancada;
                            }
                            return acc;
                          }, 0);

                          // FÓRMULA SOLICITADA: Item.Qtd_Pedida - SOMA(Todas as Qtd_Recebidas de todas as NFs daquele PC)
                          const saldo_fisico_pendente = Math.max(0, qtd_pedida - somaQtdEntregueTodasNFs);

                          const keyComposta = `${row.id_original_db || row.id || row.id_row || row.codigo}-${targetNFStr}-${idx}`;

                          return (
                            <tr key={keyComposta} className="hover:bg-slate-50/50 transition">
                              <td className="py-3 px-4 max-w-xs whitespace-normal">
                                <div className="space-y-0.5">
                                  <span className="font-mono text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold border border-slate-200 inline-block leading-none">
                                    {row.codigo}
                                  </span>
                                  <span className="font-bold text-slate-800 block truncate" title={row.descricao}>
                                    {row.descricao}
                                  </span>
                                </div>
                              </td>

                              <td className="py-3 px-3 text-center">
                                {(() => {
                                  if (statusRec === 'recusar' || statusRec === 'recusado' || statusRec === 'cancelado') {
                                    return (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-200">
                                        RECUSADO
                                      </span>
                                    );
                                  } else if (statusRec === 'reagendar') {
                                    return (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                                        REAGENDADO
                                      </span>
                                    );
                                  } else if (somaQtdEntregueTodasNFs >= qtd_pedida || statusRec === 'total') {
                                    return (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        TOTAL
                                      </span>
                                    );
                                  } else if (somaQtdEntregueTodasNFs > 0) {
                                    return (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                                        PARCIAL
                                      </span>
                                    );
                                  } else {
                                    return (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
                                        PENDENTE
                                      </span>
                                    );
                                  }
                                })()}
                              </td>

                              <td className="py-3 px-3 text-center">
                                {(() => {
                                  if (qtd_lancada_erp === 0 || vCheck.dataOcorrencia === '-' || dataBaixaFiscal === '-') {
                                    return (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200 shadow-3xs">
                                        PENDENTE
                                      </span>
                                    );
                                  } else if (qtd_lancada_erp > 0 && qtd_lancada_erp < qtd_pedida) {
                                    return (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                                        PARCIAL
                                      </span>
                                    );
                                  } else {
                                    return (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        TOTAL
                                      </span>
                                    );
                                  }
                                })()}
                              </td>

                              <td className="py-3 px-3 text-center font-mono text-slate-600">
                                {dataBaixaFiscal}
                              </td>

                              <td className="py-3 px-3 text-center font-mono text-slate-600">
                                <div className="flex flex-col items-center">
                                  <span className="font-bold">{qtdLancadaERPStr}</span>
                                  {somaQtdLancadaOutrasNFs > 0 && (
                                    <span className="text-[9px] font-sans text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5 font-bold" title="Total já faturado no ERP em outras notas fiscais deste PC">
                                      Outras NFs: {somaQtdLancadaOutrasNFs}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-3 text-center font-mono text-slate-600">
                                {qtd_pedida}
                              </td>

                              <td className="py-3 px-3 text-center font-mono text-indigo-600">
                                <div className="flex flex-col items-center">
                                  <span className="font-bold text-indigo-700">{qtd_recebida_nesta_nf}</span>
                                  {somaQtdEntregueTodasNFs > qtd_recebida_nesta_nf && (
                                    <span className="text-[9px] font-sans text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mt-0.5 font-bold" title="Soma total recebida no almoxarifado somando todas as entregas deste PC">
                                      Total PC: {somaQtdEntregueTodasNFs}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className={`py-3 px-3 text-center font-mono ${
                                saldo_fisico_pendente > 0 ? 'text-amber-600 font-black' : 'text-slate-500'
                              }`}>
                                {saldo_fisico_pendente}
                              </td>

                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {isAdmin ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingItem(row);
                                          setEditQtd(row.qtd_entregue);
                                          setEditData(row.data_recebimento_raw || '');
                                        }}
                                        className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-md transition cursor-pointer animate-pulse"
                                        title="Editar recebimento"
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeletingItem(row)}
                                        className="p-1 text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                                        title="Cancelar recebimento"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          alert("Atenção: Ação requer permissão administrativa. Exibindo controles de edição com confirmação extra.");
                                          setEditingItem(row);
                                          setEditQtd(row.qtd_entregue);
                                          setEditData(row.data_recebimento_raw || '');
                                        }}
                                        className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-md transition cursor-pointer"
                                        title="Editar recebimento (Modo Confirmação)"
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeletingItem(row)}
                                        className="p-1 text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                                        title="Cancelar recebimento (Modo Confirmação)"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Botão para fechar no rodapé */}
              <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedGroupDetails(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer font-bold"
                >
                  Fechar Painel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
