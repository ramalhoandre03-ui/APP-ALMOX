import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Settings, 
  Activity, 
  Radio, 
  FileText, 
  Calendar, 
  Plus, 
  Trash2, 
  Building2, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  Layers, 
  Package,
  ClipboardList,
  Users,
  Clock,
  Truck,
  Award,
  AlertCircle,
  BarChart3,
  Check,
  Tv,
  RotateCcw,
  Filter,
  Zap
} from 'lucide-react';
import DevolucaoAtivos from './DevolucaoAtivos';
import TVDashboardCentral from './TVDashboardCentral';
import { DashboardAdmissoes } from './DashboardAdmissoes';
import TeamProductionDashboard from './TeamProductionDashboard';
import CardProdutividadeOficina from './CardProdutividadeOficina';
import CardMedicaoProprios from './CardMedicaoProprios';
import { supabase } from '../lib/supabase';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const normalizarNomeOperador = (nomeBruto: string | null | undefined): string => {
  if (!nomeBruto) return 'NÃO IDENTIFICADO';
  
  // 1. Remove espaços extras e padroniza para maiúsculas
  let nome = nomeBruto.trim().toUpperCase();

  // 2. Dicionário de Correção (Alias Map)
  // Centraliza todas as variações do Widerley em um nome canônico correto
  if (nome.includes('WIDERLEY')) return 'WIDERLEY VIEIRA DA SILVA';
  
  // Pode adicionar outros se necessário no futuro
  // if (nome.includes('ERECIAS')) return 'ERECIAS DIAS';

  return nome;
};

const formatarDataVisual = (dataStr: string | null | undefined): string => {
  if (!dataStr) return '-';
  try {
    const isoDateMatch = dataStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDateMatch) {
      const [_, year, month, day] = isoDateMatch;
      return `${day}/${month}/${year}`;
    }
    const dataObj = new Date(dataStr);
    if (isNaN(dataObj.getTime())) return dataStr;
    const day = String(dataObj.getUTCDate()).padStart(2, '0');
    const month = String(dataObj.getUTCMonth() + 1).padStart(2, '0');
    const year = dataObj.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch (err) {
    return dataStr;
  }
};

interface OverhaulManagerProps {
  onBackToHub: () => void;
  onNavigateApp?: (app: string, tab?: string) => void;
}

export default function OverhaulManager({ onBackToHub, onNavigateApp }: OverhaulManagerProps) {
  const [activeTab, setActiveTab] = useState<'visao_geral' | 'desmobilizacao' | 'radios' | 'requisicoes' | 'entradas' | 'dashboard_admissoes' | 'produtividade_oficina'>('visao_geral');
  const [isTvMode, setIsTvMode] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  
  // State for RMs loaded from Supabase
  const [rms, setRms] = useState<any[]>([]);
  const [loadingRms, setLoadingRms] = useState(false);

  // Filtros Globais para Diligenciamento de RMs
  const [rmDataInicial, setRmDataInicial] = useState<string>('');
  const [rmDataFinal, setRmDataFinal] = useState<string>('');
  const [rmCentroCusto, setRmCentroCusto] = useState<string>('');
  const [rmSolicitante, setRmSolicitante] = useState<string>('');

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

  const getRMDateString = (rm: any) => {
    const d = getParsedDate(rm.createdTimestamp) || getParsedDate(rm.dataSolicitacao);
    if (!d) return 'Sem Data';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getIsFinalizado = (rm: any) => {
    return rm.status_interno === 'Finalizado' || 
           (rm.status || '').toUpperCase() === 'HISTORICO' || 
           (rm.status || '').toUpperCase() === 'FINALIZADO';
  };

  const fetchRMs = async () => {
    setLoadingRms(true);
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
          // Fallback if created_at column doesn't exist in Supabase table
          res = await supabase
            .from('requisicoes')
            .select('*')
            .range(inicio, inicio + pageSize - 1);
        }

        const data = res.data;
        const error = res.error;

        if (error) {
          console.error("Erro no fetch de RMs:", error);
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

      const parsed = todosOsDados.map((row: any) => {
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

        return {
          id: String(row.id || ''),
          rmNumber: String(row.rmNumber ?? row.rm_number ?? 'RM-SGI'),
          material: String(row.material ?? 'Sem descrição'),
          quantidade: Number(row.quantidade ?? 1),
          unidade: String(row.unidade ?? 'UN'),
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
          tratado_por: String(row.tratado_por ?? ''),
          acao_recomendada: String(row.acao_recomendada ?? ''),
          status_interno: (() => {
            const rawStatusInterno = String(row.status_interno ?? '').trim();
            if (rawStatusInterno === 'Finalizado') {
              return 'Finalizado';
            }
            if (rawStatusInterno === 'Em Tratamento' || rawStatusInterno === 'Aguardando Aprovador' || rawStatusInterno === 'Aguardando Tratamento') {
              return rawStatusInterno;
            }
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
                return String(parsedJson.numero_rtd || '');
              } catch (e) {
                return '';
              }
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
              } catch (e) {
                return '';
              }
            }
            return '';
          })(),
          quantidade_atendida: row.quantidade_atendida ?? 0
        };
      });

      setRms(parsed);
    } catch (e) {
      console.error("Erro ao carregar RMs no OverhaulManager:", e);
    } finally {
      setLoadingRms(false);
    }
  };

  const groupedRMs = useMemo(() => {
    const groups: { [key: string]: any } = {};
    for (const item of rms) {
      const rmNum = item.rmNumber || 'RM-SGI';
      if (!groups[rmNum]) {
        groups[rmNum] = {
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
          status_interno: item.status_interno || 'Aguardando Tratamento',
          data_inicio_tratamento: item.data_inicio_tratamento || '',
          data_conclusao_tratamento: item.data_conclusao_tratamento || '',
          aprovador_destino: item.aprovador_destino || '',
          createdTimestamp: item.createdTimestamp || '',
          centroCusto: item.centroCusto || '',
          agente_tratamento: item.agente_tratamento || item.tratado_por || '',
          motivo_espera: item.motivo_espera || '',
          override_manual: item.override_manual,
          data_override: item.data_override || '',
          usuario_override: item.usuario_override || '',
          numero_rtd: item.numero_rtd || '',
          itens: []
        };
      }
      if (item.numero_rtd && !groups[rmNum].numero_rtd) {
        groups[rmNum].numero_rtd = item.numero_rtd;
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
  }, [rms]);

  const rmCentroCustoOptions = useMemo(() => {
    const setCC = new Set<string>();
    groupedRMs.forEach(rm => {
      if (rm.centroCusto?.trim()) {
        setCC.add(rm.centroCusto.trim());
      }
    });
    return Array.from(setCC).sort();
  }, [groupedRMs]);

  const rmSolicitanteOptions = useMemo(() => {
    const setSol = new Set<string>();
    groupedRMs.forEach(rm => {
      if (rm.solicitante?.trim()) {
        setSol.add(rm.solicitante.trim());
      }
    });
    return Array.from(setSol).sort();
  }, [groupedRMs]);

  const filteredRMs = useMemo(() => {
    return groupedRMs.filter(rm => {
      const rmDateStr = getRMDateString(rm);
      if (rmDataInicial && rmDateStr !== 'Sem Data' && rmDateStr < rmDataInicial) {
        return false;
      }
      if (rmDataFinal && rmDateStr !== 'Sem Data' && rmDateStr > rmDataFinal) {
        return false;
      }
      if (rmCentroCusto && (rm.centroCusto || '').trim() !== rmCentroCusto) {
        return false;
      }
      if (rmSolicitante && (rm.solicitante || '').trim() !== rmSolicitante) {
        return false;
      }
      return true;
    });
  }, [groupedRMs, rmDataInicial, rmDataFinal, rmCentroCusto, rmSolicitante]);

  const rmStats = useMemo(() => {
    const allRMs = filteredRMs;
    const total = allRMs.length;

    const pendentes = allRMs.filter(rm => !getIsFinalizado(rm) && rm.status_interno === 'Aguardando Tratamento').length;
    const emTriagem = allRMs.filter(rm => !getIsFinalizado(rm) && rm.status_interno === 'Em Tratamento').length;
    const emAprovacao = allRMs.filter(rm => !getIsFinalizado(rm) && rm.status_interno === 'Aguardando Aprovador').length;
    const aprovados = allRMs.filter(rm => getIsFinalizado(rm) && rm.acao_recomendada?.toLowerCase().includes('aprovar')).length;
    const reprovados = allRMs.filter(rm => getIsFinalizado(rm) && !rm.acao_recomendada?.toLowerCase().includes('aprovar')).length;

    const totalItens = allRMs.reduce((sum, rm) => sum + (rm.itens ? rm.itens.length : 0), 0);

    const rawTotalQuantidade = allRMs.reduce((acc, r) => {
      return acc + (r.itens || []).reduce((sum, item) => {
        const qty = (item as any).qtd_pedida ?? item.quantidade ?? 0;
        const numQty = Number(qty);
        return sum + (isNaN(numQty) ? 0 : numQty);
      }, 0);
    }, 0);
    const totalQuantidade = Math.round(rawTotalQuantidade * 100) / 100;

    return { total, pendentes, emTriagem, emAprovacao, aprovados, reprovados, totalItens, totalQuantidade };
  }, [filteredRMs]);

  const rmEvolutionChartData = useMemo(() => {
    const groupedByDate: { [key: string]: { Pendentes: number; Triagem: number; Aprovação: number; Aprovadas: number; Reprovadas: number } } = {};

    filteredRMs.forEach(rm => {
      const dateKey = getRMDateString(rm);
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = { Pendentes: 0, Triagem: 0, Aprovação: 0, Aprovadas: 0, Reprovadas: 0 };
      }

      const isFinal = getIsFinalizado(rm);
      if (!isFinal) {
        if (rm.status_interno === 'Em Tratamento') {
          groupedByDate[dateKey].Triagem += 1;
        } else if (rm.status_interno === 'Aguardando Aprovador') {
          groupedByDate[dateKey].Aprovação += 1;
        } else {
          groupedByDate[dateKey].Pendentes += 1;
        }
      } else {
        if (rm.acao_recomendada?.toLowerCase().includes('aprovar')) {
          groupedByDate[dateKey].Aprovadas += 1;
        } else {
          groupedByDate[dateKey].Reprovadas += 1;
        }
      }
    });

    return Object.keys(groupedByDate)
      .sort()
      .map(dateKey => {
        const parts = dateKey.split('-');
        const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateKey;
        return {
          date: formattedDate,
          originalDate: dateKey,
          ...groupedByDate[dateKey]
        };
      });
  }, [filteredRMs]);

  const rmCcChartData = useMemo(() => {
    const counts: { [key: string]: number } = {};
    filteredRMs.forEach(rm => {
      const cc = rm.centroCusto?.trim() || 'Sem CC';
      counts[cc] = (counts[cc] || 0) + 1;
    });

    return Object.keys(counts).map(name => ({
      name,
      value: counts[name]
    })).sort((a, b) => b.value - a.value);
  }, [filteredRMs]);

  const solicitanteTop5 = useMemo(() => {
    const map: { [key: string]: { solicitante: string; totalRMs: number; totalLinhas: number; totalQuantidade: number } } = {};

    filteredRMs.forEach(rm => {
      const sol = rm.solicitante || 'Não Informado';
      if (!map[sol]) {
        map[sol] = {
          solicitante: sol,
          totalRMs: 0,
          totalLinhas: 0,
          totalQuantidade: 0
        };
      }
      map[sol].totalRMs += 1;
      map[sol].totalLinhas += rm.itens ? rm.itens.length : 0;
      const itemSum = (rm.itens || []).reduce((sum: number, it: any) => {
        const q = Number(it.quantidade ?? 0);
        return sum + (isNaN(q) ? 0 : q);
      }, 0);
      map[sol].totalQuantidade = Math.round((map[sol].totalQuantidade + itemSum) * 100) / 100;
    });

    return Object.values(map)
      .sort((a, b) => b.totalRMs - a.totalRMs)
      .slice(0, 5);
  }, [filteredRMs]);

  // State for Devolucoes (Desmobilizacao) loaded from Supabase
  const [devolucoes, setDevolucoes] = useState<any[]>([]);
  const [loadingDevolucoes, setLoadingDevolucoes] = useState(false);

  const fetchDevolucoes = async () => {
    setLoadingDevolucoes(true);
    try {
      const { data, error } = await supabase
        .from('devolucoes_ativos')
        .select('*');
      if (error) throw error;
      if (data) {
        setDevolucoes(data);
      }
    } catch (e) {
      console.error("Erro ao buscar devoluções de ativos para o painel:", e);
    } finally {
      setLoadingDevolucoes(false);
    }
  };

  // State for Recebimentos (Monitoramento de Entradas) loaded from Supabase
  const [recebimentos, setRecebimentos] = useState<any[]>([]);
  const [loadingRecebimentos, setLoadingRecebimentos] = useState(false);

  // Chave Seletora Master no Dashboard de Overhaul (Entradas)
  const [filtroClasse, setFiltroClasse] = useState<'CONSOLIDADO' | 'ESTOQUE' | 'DESPESA'>('CONSOLIDADO');

  // Filtragem de dados por classe financeira (Estoque vs Despesas Diretas)
  const recebimentosFiltrados = useMemo(() => {
    if (filtroClasse === 'CONSOLIDADO') return recebimentos;
    return recebimentos.filter(item => {
      let classesList: string[] = [];
      if (Array.isArray(item.classes_financeiras)) {
        classesList = item.classes_financeiras.map((c: any) => String(c));
      } else if (typeof item.classes_financeiras === 'string') {
        try {
          const parsed = JSON.parse(item.classes_financeiras);
          if (Array.isArray(parsed)) {
            classesList = parsed.map((c: any) => String(c));
          } else {
            classesList = [item.classes_financeiras];
          }
        } catch {
          classesList = [item.classes_financeiras];
        }
      } else if (item.classe_financeira) {
        classesList = [String(item.classe_financeira)];
      }

      const isEstoque = classesList.some(c => c.toUpperCase().includes('(ESTOQUE)'));
      return filtroClasse === 'ESTOQUE' ? isEstoque : !isEstoque;
    });
  }, [recebimentos, filtroClasse]);

  const fetchRecebimentos = async () => {
    setLoadingRecebimentos(true);
    try {
      let todosOsDados: any[] = [];
      let inicio = 0;
      const pageSize = 1000;
      let temMais = true;
      let pageCount = 0;
      const maxPages = 15;

      while (temMais && pageCount < maxPages) {
        let res = await supabase
          .from('recebimentos_itens')
          .select('*')
          .order('data_entrada', { ascending: false })
          .range(inicio, inicio + pageSize - 1);

        if (res.error) {
          res = await supabase
            .from('recebimentos_itens')
            .select('*')
            .range(inicio, inicio + pageSize - 1);
        }

        const data = res.data;
        const error = res.error;

        if (error) {
          console.error("Erro no fetch de recebimentos_itens:", error);
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
      setRecebimentos(todosOsDados);
    } catch (e) {
      console.error("Erro ao carregar recebimentos no OverhaulManager:", e);
    } finally {
      setLoadingRecebimentos(false);
    }
  };

  // Helper date utilities
  const parseDateToObj = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const cleanStr = dateStr.trim();
    
    // Check DD/MM/YYYY or DD/MM/YYYY HH:MM:SS or DD/MM/YYYY HH:MM first
    if (cleanStr.includes('/')) {
      const parts = cleanStr.split(' ');
      const dateParts = parts[0].split('/');
      if (dateParts.length === 3) {
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const year = parseInt(dateParts[2], 10);
        
        let hour = 0, minute = 0, second = 0;
        if (parts[1]) {
          const timeParts = parts[1].split(':');
          if (timeParts.length >= 2) {
            hour = parseInt(timeParts[0], 10);
            minute = parseInt(timeParts[1], 10);
            if (timeParts[2]) {
              second = parseInt(timeParts[2], 10);
            }
          }
        }
        
        const d = new Date(year, month, day, hour, minute, second);
        if (!isNaN(d.getTime()) && year > 1990) {
          return d;
        }
      }
    }
    
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1990) return d;
    
    return null;
  };

  const extractFiscalDateString = (ocorrencia?: string): string | null => {
    if (!ocorrencia) return null;
    const dateMatch = ocorrencia.match(/\[(\d{2}\/\d{2}\/\d{4})\]/);
    if (dateMatch) return dateMatch[1];
    return null;
  };

  // Calculation logic for "Monitoramento de Entradas" module
  const entradasStats = useMemo(() => {
    let totalReceipts = recebimentosFiltrados.length;
    let pcsProcessed = new Set(recebimentosFiltrados.map(r => r.numero_pc).filter(Boolean)).size;
    let totalLines = recebimentosFiltrados.length;
    let totalQty = recebimentosFiltrados.reduce((sum, r) => sum + (Number(r.qtd_recebida) || 0), 0);
    
    // Determine current month and year for filtering (supports both 2026 baseline and real-time dates)
    const now = new Date();
    const currentMonth = now.getFullYear() >= 2026 ? now.getMonth() : 6; // 0-indexed (6 = July)
    const currentYear = now.getFullYear() >= 2026 ? now.getFullYear() : 2026;

    const isDateInCurrentMonth = (dObj: Date | null) => {
      if (!dObj) return false;
      return dObj.getMonth() === currentMonth && dObj.getFullYear() === currentYear;
    };

    // Calculate Recebimentos (Mês): items received physically during the current month
    let recebimentosMes = recebimentosFiltrados.filter(r => {
      const dObj = parseDateToObj(r.data_recebimento || r.data_entrada);
      return isDateInCurrentMonth(dObj);
    }).length;

    // Calculate NFs Lançadas (Mês): items with fiscal launch date in the current month
    let nfsLancadasMes = recebimentosFiltrados.filter(r => {
      const fiscalDateStr = extractFiscalDateString(r.ocorrencia_fiscal);
      if (!fiscalDateStr) return false;
      const dObj = parseDateToObj(fiscalDateStr);
      return isDateInCurrentMonth(dObj);
    }).length;

    // SLA calculation: Global Average SLA for all received items in the current month (or overall if empty)
    const validReceiptsInMonth = recebimentosFiltrados.filter(r => {
      const physicalDateObj = parseDateToObj(r.data_recebimento || r.data_entrada);
      if (!physicalDateObj || physicalDateObj.getFullYear() < 1990) return false;
      return isDateInCurrentMonth(physicalDateObj);
    });

    const targetItemsForSLA = validReceiptsInMonth.length > 0 ? validReceiptsInMonth : recebimentosFiltrados.filter(r => {
      const physicalDateObj = parseDateToObj(r.data_recebimento || r.data_entrada);
      return physicalDateObj && physicalDateObj.getFullYear() >= 1990;
    });

    const nowObj = now.getFullYear() >= 2026 ? now : new Date('2026-07-18');

    const totalSLAHours = targetItemsForSLA.reduce((acc, r) => {
      const physicalDateObj = parseDateToObj(r.data_recebimento || r.data_entrada)!;
      const fiscalDateStr = extractFiscalDateString(r.ocorrencia_fiscal);
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

    const averageSLAHours = targetItemsForSLA.length > 0 ? (totalSLAHours / targetItemsForSLA.length) : 0;

    let tempoMedioFormatado = '0:00 horas (0 dias)';
    if (targetItemsForSLA.length > 0) {
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

    // Real-time backlog SLA saturations (> 48 hours pending fiscal launch)
    let slaSaturations = 0;

    recebimentosFiltrados.forEach(r => {
      const physicalDateObj = parseDateToObj(r.data_recebimento || r.data_entrada);
      if (physicalDateObj) {
        const fiscalDateStr = extractFiscalDateString(r.ocorrencia_fiscal);
        if (!fiscalDateStr) {
          const diffTimePending = nowObj.getTime() - physicalDateObj.getTime();
          const diffHoursPending = diffTimePending / (1000 * 60 * 60);
          if (diffHoursPending > 48) {
            slaSaturations++;
          }
        }
      }
    });

    return {
      totalReceipts,
      pcsProcessed,
      totalLines,
      totalQty,
      recebimentosMes,
      nfsLancadasMes,
      averageSLAHours,
      tempoMedioFormatado,
      slaSaturations
    };
  }, [recebimentosFiltrados]);

  const ofensoresParciais = useMemo(() => {
    const counts: { [key: string]: number } = {};
    recebimentosFiltrados.forEach(r => {
      const statusFisico = String(r.status_fisico || '').toLowerCase();
      if (statusFisico === 'parcial') {
        const forn = r.fornecedor || 'Desconhecido';
        counts[forn] = (counts[forn] || 0) + 1;
      }
    });

    return Object.keys(counts)
      .map(name => ({
        name,
        value: counts[name]
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 ofensores
  }, [recebimentosFiltrados]);

  const evolucaoEntradasData = useMemo(() => {
    const grouped: { [key: string]: { date: string; Recebidos: number; Lancados: number } } = {};
    
    recebimentosFiltrados.forEach(r => {
      // Get physical date
      let physicalDateStr = '';
      if (r.data_recebimento) {
        physicalDateStr = r.data_recebimento;
      } else if (r.data_entrada) {
        physicalDateStr = r.data_entrada.split('T')[0];
      }
      
      if (physicalDateStr) {
        const parts = physicalDateStr.split('-');
        const dateKey = parts.length === 3 ? `${parts[2]}/${parts[1]}` : physicalDateStr;
        if (!grouped[dateKey]) {
          grouped[dateKey] = { date: dateKey, Recebidos: 0, Lancados: 0 };
        }
        grouped[dateKey].Recebidos += 1;
      }

      // Get fiscal date
      const fiscalDateStr = extractFiscalDateString(r.ocorrencia_fiscal);
      if (fiscalDateStr) {
        const parts = fiscalDateStr.split('/');
        const dateKey = parts.length === 3 ? `${parts[0]}/${parts[1]}` : fiscalDateStr;
        if (!grouped[dateKey]) {
          grouped[dateKey] = { date: dateKey, Recebidos: 0, Lancados: 0 };
        }
        grouped[dateKey].Lancados += 1;
      }
    });

    return Object.values(grouped)
      .sort((a, b) => {
        const [dayA, monthA] = a.date.split('/').map(Number);
        const [dayB, monthB] = b.date.split('/').map(Number);
        if (monthA !== monthB) return monthA - monthB;
        return dayA - dayB;
      })
      .slice(-10); // Last 10 days
  }, [recebimentosFiltrados]);

  const rankingEquipe = useMemo(() => {
    const counts: { [key: string]: { nome: string; recebidos: number; nfs: number } } = {};
    recebimentosFiltrados.forEach(r => {
      const conf = normalizarNomeOperador(r.conferente);
      if (!counts[conf]) {
        counts[conf] = { nome: conf, recebidos: 0, nfs: 0 };
      }
      counts[conf].recebidos += 1;
      if (r.ocorrencia_fiscal && r.ocorrencia_fiscal.trim() !== '') {
        counts[conf].nfs += 1;
      }
    });

    return Object.values(counts)
      .sort((a, b) => b.recebidos - a.recebidos);
  }, [recebimentosFiltrados]);

  const pendenciasFiscalSLA = useMemo(() => {
    const list: any[] = [];
    const now = new Date();
    const nowObj = now.getFullYear() >= 2026 ? now : new Date('2026-07-18');
    
    recebimentosFiltrados.forEach(r => {
      const isPendingFiscal = !r.ocorrencia_fiscal || r.ocorrencia_fiscal.trim() === '';
      if (isPendingFiscal) {
        const physicalDateObj = parseDateToObj(r.data_recebimento || r.data_entrada);
        if (physicalDateObj) {
          const diffTime = nowObj.getTime() - physicalDateObj.getTime();
          const horas_paradas = Math.floor(diffTime / (1000 * 60 * 60));
          
          if (horas_paradas > 48) {
            list.push({
              id: r.id,
              numero_pc: r.numero_pc || '-',
              nota_fiscal: r.nota_fiscal || '-',
              fornecedor: r.fornecedor || '-',
              descricao_item: r.descricao_item || '-',
              conferente: r.conferente || '-',
              data_recebimento: r.data_recebimento || (r.data_entrada ? r.data_entrada.split('T')[0] : '-'),
              horas_paradas: Math.max(0, horas_paradas)
            });
          }
        }
      }
    });

    return list.sort((a, b) => {
      if (sortOrder === 'desc') {
        return b.horas_paradas - a.horas_paradas;
      }
      return a.horas_paradas - b.horas_paradas;
    });
  }, [recebimentosFiltrados, sortOrder]);

  // Real Admissions loaded from database
  const [realAdmissions, setRealAdmissions] = useState<any[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);

  // Fetch from Supabase
  const fetchAtendimentosFardamento = async () => {
    setLoadingDb(true);
    try {
      const { data, error } = await supabase
        .from('admissoes_fardamento')
        .select('*');
      if (error) throw error;
      if (data) {
        // Map database records identically to FardamentoAdmissoes.tsx to guarantee 100% KPI parity
        const parsed = data.map((item: any) => {
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
            data_previsao: item.data_previsao,
            tamanhos: tamanhosObj,
            especificacoes: especificacoesObj,
            status: (item.status === 'Aguardando RM' && !item.lote_id) ? 'Aguardando Lote' : (item.status === 'Aguardando RM' ? 'Aguardando Número RM' : item.status),
            tipo_requisicao: item.tipo_requisicao || 'Admissão'
          };
        });
        setRealAdmissions(parsed);
      }
    } catch (e) {
      console.error("Erro ao buscar atendimentos de fardamento:", e);
    } finally {
      setLoadingDb(false);
    }
  };

  const [successToast, setSuccessToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    fetchAtendimentosFardamento();
    fetchDevolucoes();
    fetchRMs();
    fetchRecebimentos();
  }, []);

  const admissionsKpis = useMemo(() => {
    let rmsAprovacao = 0;
    let emSeparacao = 0;
    let jaFardados = 0;
    let fardamentosAtrasados = 0;
    let programadosHoje = 0;

    const today = new Date();
    const todayClean = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const parseDateToObj = (dateStr?: string): Date | null => {
      if (!dateStr) return null;
      const cleanStr = dateStr.trim();
      if (cleanStr.includes('/')) {
        const parts = cleanStr.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          const d = new Date(year, month, day);
          if (!isNaN(d.getTime())) return d;
        }
      }
      const d = new Date(cleanStr);
      if (!isNaN(d.getTime())) return d;
      return null;
    };

    realAdmissions.forEach(item => {
      const statusUpper = String(item.status || "").trim().toUpperCase();
      const schedDateStr = item.data_previsao || item.data_agendamento;
      const itemDate = parseDateToObj(schedDateStr);

      // Já Fardados: Filtrar por status "Fardado / Pronto" or equivalent completed statuses
      const isDelivered = [
        'FARDADO',
        'CONCLUIDO',
        'CONCLUÍDO',
        'FINALIZADO',
        'FARDADO / PRONTO',
        'FARDADO/PRONTO',
        'PRONTO'
      ].includes(statusUpper);
      
      if (isDelivered) {
        jaFardados++;
      }

      // RMs para Aprovação: Filtrar pelo status correspondente a "Aguardando Nº RM" (ex: status === 'AGUARDANDO RM')
      const isAwaitingRM = [
        'AGUARDANDO RM',
        'AGUARDANDO NÚMERO RM',
        'AGUARDANDO NUMERO RM',
        'AGUARDANDO LOTE',
        'RM SOLICITADA',
        'RM REPROVADA'
      ].includes(statusUpper);
      if (isAwaitingRM) {
        rmsAprovacao++;
      }

      // Em Separação: Filtrar por status correspondente a "Agendado" ou "Em Separação"
      const isSeparating = [
        'AGENDADO',
        'EM SEPARACAO',
        'EM SEPARAÇÃO',
        'DISPONIVEL PARA SEPARAR',
        'TRATAMENTO ALMOXARIFADO',
        'SEPARADO',
        'AGUARDANDO SEPARACAO',
        'AGUARDANDO SEPARAÇÃO',
        'AGUARDANDO FARDAMENTO'
      ].includes(statusUpper);
      if (isSeparating) {
        emSeparacao++;
      }

      if (itemDate) {
        const itemDateClean = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());

        if (itemDateClean < todayClean) {
          if (!isDelivered && statusUpper !== 'CONCLUIDO COM RESSALVA - DESISTENTE') {
            fardamentosAtrasados++;
          }
        } else if (itemDateClean.getTime() === todayClean.getTime()) {
          programadosHoje++;
        }
      }
    });

    return {
      rmsAprovacao,
      emSeparacao,
      jaFardados,
      fardamentosAtrasados,
      programadosHoje
    };
  }, [realAdmissions]);

  const menuItems = [
    { id: 'visao_geral', label: 'Visão Geral', icon: Layers },
    { id: 'desmobilizacao', label: 'Desmobilização', icon: Settings },
    { id: 'radios', label: 'Rádios', icon: Radio },
    { id: 'dashboard_admissoes', label: 'Dashboard Admissões', icon: BarChart3 },
    { id: 'requisicoes', label: 'Diligenciamento de RMs', icon: ClipboardList },
    { id: 'entradas', label: 'Entradas', icon: TrendingUp },
    { id: 'produtividade_oficina', label: 'Produtividade Oficina', icon: Zap },
  ];

  if (isTvMode) {
    return <TVDashboardCentral onExit={() => setIsTvMode(false)} />;
  }

  return (
    <div className="flex h-screen bg-[#F8F9FA] overflow-hidden text-slate-700 font-sans" id="overhaul-manager-root">
      {/* SIDEBAR FIXA */}
      <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-full z-10">
        <div className="p-6 border-b border-slate-100">
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block font-mono">PARADA GERAL 2026</span>
          <h2 className="text-sm font-bold text-slate-800 tracking-wider uppercase mt-0.5">MENU GERENCIAL</h2>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="flex flex-col gap-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer text-left ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-indigo-600' : (item.id === 'produtividade_oficina' ? 'text-amber-500' : 'text-slate-400')}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {onBackToHub && (
          <div className="p-4 border-t border-slate-100 mt-auto bg-slate-50/50">
            <button
              onClick={onBackToHub}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-all cursor-pointer shadow-xs"
              title="Voltar ao Painel Principal"
            >
              <ArrowLeft className="w-4 h-4 shrink-0 text-slate-500" />
              <span>Voltar ao Hub</span>
            </button>
          </div>
        )}
      </aside>

      {/* CONTEÚDO PRINCIPAL (Scrollável) */}
      <main className="flex-1 h-full overflow-y-auto p-6 sm:p-8 flex flex-col">
        {/* Cabeçalho do Cockpit (agora com mais espaço) */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
          <div>
            <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest block font-mono">PARADA GERAL 2026</span>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight uppercase mt-1 font-display">
              Cockpit Gerencial de KPI's do Almoxarifado
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsTvMode(true)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-2 border border-slate-800 shadow-sm shrink-0"
              title="Transmitir TV (Gestão à Vista)"
            >
              <Tv className="w-4 h-4 text-indigo-400 animate-pulse shrink-0" />
              <span className="whitespace-nowrap">Transmissão TV</span>
            </button>
          </div>
        </header>

        {/* Toast Notification */}
        <AnimatePresence>
          {successToast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`fixed top-6 right-6 z-[100] max-w-sm w-full border text-white rounded-2xl shadow-xl p-4 flex items-start gap-3 ${
                toastType === 'success'
                  ? 'bg-emerald-900 border-emerald-800'
                  : 'bg-rose-900 border-rose-800'
              }`}
            >
              <div className={`p-1 rounded-lg shrink-0 ${
                toastType === 'success' ? 'bg-emerald-800 text-emerald-300' : 'bg-rose-800 text-rose-300'
              }`}>
                {toastType === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <span className={`font-extrabold uppercase tracking-widest text-[9px] block font-mono ${
                  toastType === 'success' ? 'text-emerald-300' : 'text-rose-300'
                }`}>
                  {toastType === 'success' ? 'Sucesso' : 'Erro'}
                </span>
                <p className={`text-xs font-sans mt-0.5 ${
                  toastType === 'success' ? 'text-emerald-100' : 'text-rose-100'
                }`}>
                  {successToast}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Container */}
        <div className="w-full flex-grow">
        {/* Tab 0: Visão Geral */}
        {activeTab === 'visao_geral' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
            id="tab-visao-geral-container"
          >
            {/* Header/Welcome Banner */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden">
              <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-10 translate-y-10">
                <Layers className="w-72 h-72" />
              </div>
              <div className="relative z-10 max-w-2xl">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono">TORRE DE CONTROLE OVERHAUL</span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase mt-1 text-white font-display">
                  Cockpit Gerencial de Parada 2026
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                  Monitore em tempo real o status de desmobilização de ativos pesados, produtividade da oficina e diligenciamento de RMs para as frentes de serviço da Parada Geral de Manutenção.
                </p>
              </div>
            </div>

            {/* Main Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Card Executivo KPI: Faturamento de Próprios (Mês Atual) */}
              <CardMedicaoProprios onNavigate={(tab) => onNavigateApp ? onNavigateApp('medicao-proprios', tab || 'bi') : null} />

              {/* Card 1: Desmobilização */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl">
                      <Settings className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-mono bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full border border-violet-100 font-bold uppercase">
                      Ativo
                    </span>
                  </div>
                  
                  {(() => {
                    const isConcluded = (d: any) => 
                      d.entrega_concluida === true || 
                      d.entregaConcluida === true || 
                      d.etapa_atual === 5 || 
                      d.etapa_atual === '5' || 
                      d.etapaAtual === 'Entrega realizada' || 
                      d.etapa_atual === 'Entrega realizada';
                    
                    const entreguesCount = devolucoes.filter(isConcluded).length;
                    const emTransitoCount = devolucoes.length - entreguesCount;
                    const taxaConclusao = devolucoes.length ? Math.round((entreguesCount / devolucoes.length) * 100) : 0;

                    return (
                      <>
                        <div className="mt-5">
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider font-mono">Desmobilização de Ativos</h3>
                          <p className="text-2xl font-black text-slate-900 mt-1">
                            {emTransitoCount}
                            <span className="text-xs text-slate-400 font-normal ml-1.5">Ativos em Trânsito</span>
                          </p>
                        </div>

                        <div className="mt-5 space-y-2">
                          <div className="flex justify-between text-xs font-bold text-slate-600">
                            <span>Progresso de Devolução</span>
                            <span>{taxaConclusao}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-violet-600 h-full rounded-full transition-all duration-500"
                              style={{ width: `${taxaConclusao}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                            <span>Total de remessas: {devolucoes.length}</span>
                            <span>Entregas: {entreguesCount}</span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <button
                  onClick={() => setActiveTab('desmobilizacao')}
                  className="w-full mt-6 bg-slate-900 hover:bg-violet-700 text-white font-extrabold text-xs py-3 rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:shadow-lg shadow-violet-100 uppercase tracking-wider"
                >
                  <span>Acessar Desmobilização</span>
                  <span>→</span>
                </button>
              </div>

              {/* Card 3: Produtividade da Oficina */}
              <CardProdutividadeOficina onNavigate={() => setActiveTab('produtividade_oficina')} />

              {/* Card 4: Diligenciamento de RMs */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                      <ClipboardList className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-mono bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-100 font-bold uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                      SGI Ativo
                    </span>
                  </div>
                  
                  <div className="mt-5">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider font-mono">Diligenciamento de RMs</h3>
                    <p className="text-2xl font-black text-slate-900 mt-1">
                      {rmStats.total}
                      <span className="text-xs text-slate-400 font-normal ml-1.5">Total de RMs</span>
                    </p>
                  </div>

                  {/* Sub-status Summary */}
                  <div className="mt-5 space-y-2 text-xs font-medium text-slate-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span>Pendentes / Sem Tratamento</span>
                      </div>
                      <span className="font-bold text-slate-900">{rmStats.pendentes}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                        <span>Em Triagem</span>
                      </div>
                      <span className="font-bold text-slate-900">{rmStats.emTriagem}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                        <span>Em Aprovação</span>
                      </div>
                      <span className="font-bold text-slate-900">{rmStats.emAprovacao}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span>Aprovadas</span>
                      </div>
                      <span className="font-bold text-emerald-600">{rmStats.aprovados}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span>Reprovadas</span>
                      </div>
                      <span className="font-bold text-rose-600">{rmStats.reprovados}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('requisicoes')}
                  className="w-full mt-6 bg-slate-900 hover:bg-amber-600 text-white font-extrabold text-xs py-3 rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:shadow-lg shadow-amber-100 uppercase tracking-wider"
                >
                  <span>Acessar Diligenciamento</span>
                  <span>→</span>
                </button>
              </div>

              {/* Card 5: Monitoramento de Entradas */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-100 font-bold uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Fiscal Integrado
                    </span>
                  </div>
                  
                  <div className="mt-5">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider font-mono">Monitoramento de Entradas</h3>
                    <p className="text-2xl font-black text-slate-900 mt-1">
                      {entradasStats.tempoMedioFormatado}
                      <span className="text-xs text-slate-400 font-normal ml-1.5">SLA Médio</span>
                    </p>
                  </div>

                  {/* Sub-status Summary of Entries */}
                  <div className="mt-5 space-y-2.5 text-xs font-medium text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Recebimentos (Mês):</span>
                      <span className="font-extrabold text-slate-900 font-mono">{entradasStats.recebimentosMes}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">NFs Lançadas (Mês):</span>
                      <span className="font-extrabold text-emerald-600 font-mono">{entradasStats.nfsLancadasMes}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Atraso SLA (&gt;48h):</span>
                      <span className={`font-extrabold font-mono ${entradasStats.slaSaturations > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-600'}`}>
                        {entradasStats.slaSaturations} itens
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('entradas')}
                  className="w-full mt-6 bg-slate-900 hover:bg-emerald-600 text-white font-extrabold text-xs py-3 rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:shadow-lg shadow-emerald-100 uppercase tracking-wider"
                >
                  <span>Acessar Entradas</span>
                  <span>→</span>
                </button>
              </div>

              {/* Card 6: Dashboard de Admissões */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl">
                      <Users className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-mono bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full border border-violet-100 font-bold uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                      RH Integrado
                    </span>
                  </div>
                  
                  <div className="mt-5">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider font-mono">Admissões e Fardamentos</h3>
                    <p className="text-2xl font-black text-slate-900 mt-1">
                      {realAdmissions.length}
                      <span className="text-xs text-slate-400 font-normal ml-1.5">Cadastrados</span>
                    </p>
                  </div>

                  {/* Sub-status Summary of Admissions */}
                  <div className="mt-5 space-y-2.5 text-xs font-medium text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">RMs Pendentes:</span>
                      <span className="font-extrabold text-slate-900 font-mono">{admissionsKpis.rmsAprovacao}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Fardamentos Atrasados:</span>
                      <span className={`font-extrabold font-mono ${admissionsKpis.fardamentosAtrasados > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-600'}`}>
                        {admissionsKpis.fardamentosAtrasados}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Programados para Hoje:</span>
                      <span className="font-extrabold text-slate-900 font-mono">{admissionsKpis.programadosHoje}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('dashboard_admissoes')}
                  className="w-full mt-6 bg-slate-900 hover:bg-violet-700 text-white font-extrabold text-xs py-3 rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:shadow-lg shadow-violet-100 uppercase tracking-wider"
                >
                  <span>Acessar Admissões</span>
                  <span>→</span>
                </button>
              </div>

            </div>
          </motion.div>
        )}

        {/* Tab 1: Desmobilização */}
        {activeTab === 'desmobilizacao' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
            id="tab-desmobilizacao-container"
          >
            {/* Embedded Active Returns Component */}
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-violet-50 text-violet-600 rounded-xl">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm uppercase">Retornos e Logística Reversa de Ativos</h3>
                    <p className="text-xs text-slate-500 font-sans">
                      Painel sincronizado do controle de desmobilização de ativos locados da parada geral.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full border border-violet-100 font-mono">
                  SGI INTEGRADO
                </span>
              </div>
              
              <div className="p-2 sm:p-4">
                <DevolucaoAtivos onBackToHub={onBackToHub} />
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab 2: Rádios */}
        {activeTab === 'radios' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center min-h-[450px] bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-xs"
            id="tab-radios-container"
          >
            <div className="w-20 h-20 bg-violet-50 border border-violet-100 rounded-full flex items-center justify-center text-violet-600 mb-6 shadow-xs animate-pulse">
              <Radio className="w-10 h-10" />
            </div>
            
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight font-display">
              Módulo em Construção
            </h2>
            
            <p className="text-sm text-slate-500 max-w-md mt-3 leading-relaxed">
              O controle de movimentação e rastreamento de rádios comunicadores nas obras da parada geral estará disponível em breve. Estamos preparando as integrações de telemetria e inventário de rádio frequência.
            </p>
            
            <div className="mt-8 flex items-center space-x-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-[11px] font-mono font-bold text-slate-500">
              <Activity className="w-3.5 h-3.5 text-violet-500" />
              <span>SISTEMA DE COMUNICAÇÕES OVERHAUL v2.0 - AGENDADO</span>
            </div>
          </motion.div>
        )}

        {/* Tab 4: Diligenciamento de RMs */}
        {activeTab === 'requisicoes' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
            id="tab-requisicoes-container"
          >
            {/* Toolbar de Filtros Globais */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 text-xs w-full lg:w-auto">
                <div className="flex items-center gap-1.5 text-slate-800 font-extrabold pr-2 border-r border-slate-200">
                  <Filter className="w-4 h-4 text-indigo-600" />
                  <span className="uppercase tracking-wider font-mono text-[11px]">Filtros:</span>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <div className="flex flex-col">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono">Data Inicial</label>
                    <input
                      type="date"
                      value={rmDataInicial}
                      onChange={(e) => setRmDataInicial(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <div className="flex flex-col">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono">Data Final</label>
                    <input
                      type="date"
                      value={rmDataFinal}
                      onChange={(e) => setRmDataFinal(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex flex-col min-w-[170px]">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono">Centro de Custo</label>
                  <select
                    value={rmCentroCusto}
                    onChange={(e) => setRmCentroCusto(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
                  >
                    <option value="">Todos os Centros de Custo</option>
                    {rmCentroCustoOptions.map(cc => (
                      <option key={cc} value={cc}>{cc}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col min-w-[180px]">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono">Solicitante</label>
                  <select
                    value={rmSolicitante}
                    onChange={(e) => setRmSolicitante(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
                  >
                    <option value="">Todos os Solicitantes</option>
                    {rmSolicitanteOptions.map(sol => (
                      <option key={sol} value={sol}>{sol}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(rmDataInicial || rmDataFinal || rmCentroCusto || rmSolicitante) && (
                <button
                  type="button"
                  onClick={() => {
                    setRmDataInicial('');
                    setRmDataFinal('');
                    setRmCentroCusto('');
                    setRmSolicitante('');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl transition-all border border-rose-200 cursor-pointer shrink-0 ml-auto"
                  title="Limpar Filtros"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpar Filtros</span>
                </button>
              )}
            </div>

            {/* Top Cards KPI */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block font-mono">Total RMs</span>
                <span className="text-xl font-black text-slate-800 tracking-tight mt-1">
                  {rmStats.total}
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block font-mono">Pendentes</span>
                <span className="text-xl font-black text-amber-600 tracking-tight mt-1">
                  {rmStats.pendentes + rmStats.emTriagem + rmStats.emAprovacao}
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block font-mono">Aprovadas</span>
                <span className="text-xl font-black text-emerald-600 tracking-tight mt-1">
                  {rmStats.aprovados}
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block font-mono">Reprovadas</span>
                <span className="text-xl font-black text-rose-600 tracking-tight mt-1">
                  {rmStats.reprovados}
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block font-mono">Linhas (Itens)</span>
                <span className="text-xl font-black text-slate-800 tracking-tight mt-1">
                  {rmStats.totalItens}
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block font-mono">Total Quantidade</span>
                <span className="text-xl font-black text-slate-800 tracking-tight mt-1">
                  {typeof rmStats.totalQuantidade === 'number' 
                    ? rmStats.totalQuantidade.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                    : rmStats.totalQuantidade}
                </span>
              </div>
            </div>

            {/* StackedBarChart for Daily Evolution of Status */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight font-display">
                    Evolução Diária de Status de RMs
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Histórico cronológico do andamento de requisições empilhadas por estágio de tratamento.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-[#f59e0b]" /> Pendentes</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-[#d97706]" /> Triagem</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-[#fbbf24]" /> Aprovação</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-[#10b981]" /> Aprovadas</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-[#ef4444]" /> Reprovadas</span>
                </div>
              </div>

              <div className="h-80 w-full">
                {rmEvolutionChartData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                    <TrendingUp className="w-8 h-8 opacity-40 mb-2" />
                    <span>Nenhuma RM encontrada no banco de dados.</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={rmEvolutionChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        tickLine={false}
                        fontFamily="Inter"
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        tickLine={false}
                        fontFamily="Inter"
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#0f172a', 
                          border: 'none', 
                          borderRadius: '12px',
                          color: '#fff',
                          fontSize: '11px',
                          fontFamily: 'Inter',
                          fontWeight: 'bold'
                        }}
                      />
                      <Bar dataKey="Pendentes" stackId="a" fill="#f59e0b" name="Pendentes" />
                      <Bar dataKey="Triagem" stackId="a" fill="#d97706" name="Em Triagem" />
                      <Bar dataKey="Aprovação" stackId="a" fill="#fbbf24" name="Em Aprovação" />
                      <Bar dataKey="Aprovadas" stackId="a" fill="#10b981" name="Aprovadas" />
                      <Bar dataKey="Reprovadas" stackId="a" fill="#ef4444" name="Reprovadas" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Split Inferior: PieChart (Rosca) + Tabela / Top 5 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* PieChart: Centro de Custo */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight font-display">
                    Distribuição por Centro de Custo
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Volume absoluto de requisições classificadas por Centro de Custo (CC).
                  </p>
                </div>

                <div className="h-64 w-full flex items-center justify-center relative mt-4">
                  {rmCcChartData.length === 0 ? (
                    <div className="text-slate-400 text-xs">Sem dados de Centro de Custo.</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={rmCcChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={65}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {rmCcChartData.map((entry, index) => {
                              const colors = [
                                '#6366f1', '#4f46e5', '#4338ca', '#3730a3',
                                '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'
                              ];
                              return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                            })}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#0f172a', 
                              border: 'none', 
                              borderRadius: '12px',
                              color: '#fff',
                              fontSize: '11px',
                              fontWeight: 'bold'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute text-center">
                        <span className="text-2xl font-black text-slate-800 block">
                          {rmStats.total}
                        </span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-mono">
                          RMs Totais
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Pie Chart Legend */}
                <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] text-slate-600 font-mono">
                  {rmCcChartData.slice(0, 6).map((item, index) => {
                    const colors = [
                      '#6366f1', '#4f46e5', '#4338ca', '#3730a3',
                      '#818cf8', '#a5b4fc'
                    ];
                    return (
                      <div key={item.name} className="flex items-center gap-2 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors[index % colors.length] }} />
                        <span className="truncate font-bold">{item.name}:</span>
                        <span className="text-slate-900 font-black shrink-0">{item.value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tabela / Top 5 Solicitantes */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight font-display">
                    Top 5 Solicitantes de RMs
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Ranking de solicitantes classificados pelo maior volume de RMs emitidas.
                  </p>
                </div>

                <div className="mt-6 flex-grow overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-sans">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-mono font-black text-[9px]">
                          <th className="pb-3 pl-2">Solicitante</th>
                          <th className="pb-3 text-center">Total RMs</th>
                          <th className="pb-3 text-center">Linhas (Itens)</th>
                          <th className="pb-3 text-right pr-2">Qtd Solicitada</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {solicitanteTop5.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400 font-normal">
                              Sem solicitantes cadastrados.
                            </td>
                          </tr>
                        ) : (
                          solicitanteTop5.map((sol, index) => (
                            <tr key={sol.solicitante} className="hover:bg-slate-50/40 transition-colors">
                              <td className="py-3.5 pl-2 flex items-center gap-3">
                                <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-600 font-mono">
                                  #{index + 1}
                                </span>
                                <span className="font-bold text-slate-800 truncate max-w-[160px]" title={sol.solicitante}>
                                  {sol.solicitante}
                                </span>
                              </td>
                              <td className="py-3.5 text-center font-extrabold text-slate-900 font-mono">
                                {sol.totalRMs}
                              </td>
                              <td className="py-3.5 text-center font-bold text-slate-600 font-mono">
                                {sol.totalLinhas}
                              </td>
                              <td className="py-3.5 text-right pr-2 font-black text-slate-800 font-mono">
                                {typeof sol.totalQuantidade === 'number'
                                  ? sol.totalQuantidade.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                                  : sol.totalQuantidade}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 text-[10px] text-slate-500 font-mono leading-relaxed mt-4">
                  * Os dados apresentados acima são gerados em tempo real diretamente a partir das requisições registradas via SGI e homologadas pela equipe de Diligenciamento de Paradas.
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab 5: Monitoramento de Entradas */}
        {activeTab === 'entradas' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
            id="tab-entradas-container"
          >
            {/* Chave Seletora Master no Dashboard de Entradas */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                    filtroClasse === 'ESTOQUE' ? 'bg-blue-500' : filtroClasse === 'DESPESA' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight font-display">
                    Visão & Segmentação de Entradas
                  </h2>
                </div>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  {filtroClasse === 'CONSOLIDADO' && 'Exibindo visão consolidada unificando compras de Estoque e Despesas Diretas.'}
                  {filtroClasse === 'ESTOQUE' && 'Filtrando estritamente materiais destinados a Estoque (Classes com tag ESTOQUE).'}
                  {filtroClasse === 'DESPESA' && 'Filtrando estritamente Despesas Diretas / Não-Estoque (Classes de Serviço ou Aplicação).'}
                </p>
              </div>

              {/* Chave Seletora (3 Opções) */}
              <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 flex items-center gap-1 w-full md:w-auto overflow-x-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setFiltroClasse('CONSOLIDADO')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    filtroClasse === 'CONSOLIDADO'
                      ? 'bg-slate-900 text-white shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Visão Consolidada</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFiltroClasse('ESTOQUE')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    filtroClasse === 'ESTOQUE'
                      ? 'bg-blue-600 text-white shadow-xs font-black'
                      : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50/60'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>📦 Apenas Estoque</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFiltroClasse('DESPESA')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    filtroClasse === 'DESPESA'
                      ? 'bg-amber-600 text-white shadow-xs font-black'
                      : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50/60'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>⚠️ Despesas Diretas</span>
                </button>
              </div>
            </div>

            {/* Top Cards KPI */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className={`bg-white border rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all ${
                filtroClasse === 'ESTOQUE' ? 'border-t-4 border-t-blue-500 border-slate-200' : filtroClasse === 'DESPESA' ? 'border-t-4 border-t-amber-500 border-slate-200' : 'border-slate-200'
              }`}>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block font-mono">Recebimentos Feitos (Total)</span>
                  <span className="text-xl font-black text-slate-800 tracking-tight mt-1">
                    {entradasStats.totalReceipts}
                  </span>
                </div>
                <span className="text-[9px] text-slate-400 font-mono mt-2">Soma total do período (linhas)</span>
              </div>

              <div className={`bg-white border rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all ${
                filtroClasse === 'ESTOQUE' ? 'border-t-4 border-t-blue-500 border-slate-200' : filtroClasse === 'DESPESA' ? 'border-t-4 border-t-amber-500 border-slate-200' : 'border-slate-200'
              }`}>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block font-mono">Pedidos (PC) Processados</span>
                  <span className="text-xl font-black text-indigo-600 tracking-tight mt-1">
                    {entradasStats.pcsProcessed}
                  </span>
                </div>
                <span className="text-[9px] text-slate-400 font-mono mt-2">PCs únicos independentemente do nº de linhas</span>
              </div>

              <div className={`bg-white border rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all ${
                filtroClasse === 'ESTOQUE' ? 'border-t-4 border-t-blue-500 border-slate-200' : filtroClasse === 'DESPESA' ? 'border-t-4 border-t-amber-500 border-slate-200' : 'border-slate-200'
              }`}>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block font-mono">Linhas / Qtd Recebida</span>
                  <span className="text-xl font-black text-emerald-600 tracking-tight mt-1">
                    {entradasStats.totalLines} <span className="text-xs text-slate-400 font-normal">linhas</span>
                  </span>
                </div>
                <span className="text-[9px] text-slate-500 font-mono mt-2 font-bold">Soma total do período ({entradasStats.totalQty.toLocaleString('pt-BR')} un)</span>
              </div>

              <div className={`bg-white border rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all ${
                filtroClasse === 'ESTOQUE' ? 'border-t-4 border-t-blue-500 border-slate-200' : filtroClasse === 'DESPESA' ? 'border-t-4 border-t-amber-500 border-slate-200' : 'border-slate-200'
              }`}>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block font-mono">NFs Lançadas (Mês)</span>
                  <span className="text-xl font-black text-blue-600 tracking-tight mt-1">
                    {entradasStats.nfsLancadasMes}
                  </span>
                </div>
                <span className="text-[9px] text-slate-400 font-mono mt-2">Lançadas no mês corrente</span>
              </div>

              <div className={`bg-white border rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all ${
                filtroClasse === 'ESTOQUE' ? 'border-t-4 border-t-blue-500 border-slate-200' : filtroClasse === 'DESPESA' ? 'border-t-4 border-t-amber-500 border-slate-200' : 'border-slate-200'
              }`}>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block font-mono">Tempo Médio (Balcão x NF)</span>
                  <span className={`text-xl font-black tracking-tight mt-1 ${entradasStats.averageSLAHours > 48 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {entradasStats.tempoMedioFormatado}
                  </span>
                </div>
                <span className="text-[9px] text-slate-400 font-mono mt-2">SLA Médio de Processamento</span>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1: Evolução Diária de Entradas vs Lançamentos */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
                <div>
                  <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100 font-bold uppercase">
                    PRODUTIVIDADE FISCAL
                  </span>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mt-3 font-display">
                    Evolução Diária de Entradas e Lançamentos
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Cruzamento diário entre recebimento físico no balcão e homologação de NF no ERP.
                  </p>
                </div>

                <div className="h-80 w-full mt-6">
                  {loadingRecebimentos ? (
                    <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                      Carregando dados...
                    </div>
                  ) : evolucaoEntradasData.length === 0 ? (
                    <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                      Nenhum dado registrado para gerar evolução diária.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={evolucaoEntradasData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" fontSize={10} stroke="#94a3b8" />
                        <YAxis fontSize={10} stroke="#94a3b8" />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }} />
                        <Legend wrapperStyle={{ fontSize: '11px', marginTop: '10px' }} />
                        <Bar name="Linhas Recebidas (Físico)" dataKey="Recebidos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar name="NFs Lançadas (Linhas)" dataKey="Lancados" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Chart 2: Fornecedores Ofensores de Entregas Parciais */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
                <div>
                  <span className="text-[10px] font-mono bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-100 font-bold uppercase">
                    QUALIDADE DE FORNECIMENTO
                  </span>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mt-3 font-display">
                    Ofensores de Entregas Parciais
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Ranking de fornecedores com maior número de ocorrências de entregas com saldo pendente (Parcial).
                  </p>
                </div>

                <div className="h-80 w-full mt-6">
                  {loadingRecebimentos ? (
                    <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                      Carregando dados...
                    </div>
                  ) : ofensoresParciais.length === 0 ? (
                    <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                      Nenhum fornecedor registrado com entrega parcial.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={ofensoresParciais} margin={{ top: 10, right: 10, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" fontSize={10} stroke="#94a3b8" />
                        <YAxis dataKey="name" type="category" fontSize={10} stroke="#94a3b8" width={100} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }} />
                        <Bar name="Entregas Parciais" dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Split Bottom Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Table 1: Ranking da Equipe SGI ("Quem mais recebe") */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight font-display">
                      Ranking de Operação da Equipe
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Desempenho dos operadores e conferentes no registro de check-in físico.
                    </p>
                  </div>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Users className="w-5 h-5" />
                  </div>
                </div>

                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-mono font-black text-[9px]">
                        <th className="pb-2.5 pl-2">Operador / Conferente</th>
                        <th className="pb-2.5 text-center">Registros Físicos</th>
                        <th className="pb-2.5 text-center">NFs Associadas</th>
                        <th className="pb-2.5 text-right pr-2">Aproveitamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rankingEquipe.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400 font-normal">
                            Nenhum registro de conferente localizado.
                          </td>
                        </tr>
                      ) : (
                        rankingEquipe.slice(0, 6).map((c, idx) => {
                          const rate = c.recebidos > 0 ? (c.nfs / c.recebidos) * 100 : 0;
                          return (
                            <tr key={c.nome} className="hover:bg-slate-50/40 transition-colors">
                              <td className="py-3 pl-2 flex items-center gap-3">
                                <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-600 font-mono">
                                  #{idx + 1}
                                </span>
                                <span className="font-bold text-slate-800 truncate" title={c.nome}>
                                  {c.nome}
                                </span>
                              </td>
                              <td className="py-3 text-center font-extrabold text-slate-900 font-mono">
                                {c.recebidos}
                              </td>
                              <td className="py-3 text-center font-bold text-slate-600 font-mono">
                                {c.nfs}
                              </td>
                              <td className="py-3 text-right pr-2 font-black text-indigo-600 font-mono">
                                {rate.toFixed(0)}%
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table 2: Lista de Pendências Fiscal */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight font-display">
                      Pendências Fiscais (SLA Estourado)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Itens físicos recebidos há mais de 48 horas e que continuam sem lançamento fiscal.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                      title="Ordenar por maior tempo de atraso"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black font-mono uppercase bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer border border-slate-200 shadow-2xs"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{sortOrder === 'desc' ? 'Maior Atraso ↓' : 'Menor Atraso ↑'}</span>
                    </button>
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                      <Clock className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto mt-4 max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-mono font-black text-[9px]">
                        <th className="pb-2.5 pl-2">Pedido / Fornecedor</th>
                        <th className="pb-2.5">Descrição Item</th>
                        <th className="pb-2.5 text-center">Físico Recebido</th>
                        <th className="pb-2.5 text-right pr-2">
                          <button
                            type="button"
                            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                            className="inline-flex items-center gap-1 font-mono font-black text-[9px] uppercase tracking-wider text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer ml-auto"
                            title="Ordenar por maior tempo de atraso"
                          >
                            <span>Atraso</span>
                            {sortOrder === 'desc' ? (
                              <ArrowDown className="w-3 h-3 text-rose-600" />
                            ) : (
                              <ArrowUp className="w-3 h-3 text-indigo-600" />
                            )}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendenciasFiscalSLA.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400 font-normal">
                            Nenhuma pendência fiscal estourando SLA (&gt;48 horas) no balcão.
                          </td>
                        </tr>
                      ) : (
                        pendenciasFiscalSLA.slice(0, 10).map((p) => {
                          const isEstourado = p.horas_paradas > 48;
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/40 transition-colors">
                              <td className="py-2.5 pl-2">
                                <span className="font-extrabold text-slate-800 block font-mono">PC {p.numero_pc}</span>
                                <span className="text-[10px] text-slate-450 block truncate max-w-[150px]" title={p.fornecedor}>
                                  {p.fornecedor}
                                </span>
                              </td>
                              <td className="py-2.5 font-medium text-slate-600 max-w-[150px] truncate" title={p.descricao_item}>
                                {p.descricao_item}
                              </td>
                              <td className="py-2.5 text-center text-slate-500 font-mono">
                                {p.data_recebimento}
                              </td>
                              <td className="py-2.5 text-right pr-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black font-mono uppercase ${
                                  isEstourado ? 'bg-rose-50 text-rose-700 border border-rose-100 animate-pulse' : 'bg-amber-50 text-amber-700 border border-amber-100'
                                }`}>
                                  {p.horas_paradas} HORAS
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 text-[10px] text-slate-500 font-mono leading-relaxed">
              * Indicadores consolidados cruzando os tempos e lançamentos cadastrados na base do Almoxarifado Central (SGI Overhaul) e o Hub de Pedidos de Compras do ERP Overhaul 2026.
            </div>
          </motion.div>
        )}

        {activeTab === 'dashboard_admissoes' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <DashboardAdmissoes admissions={realAdmissions} loading={loadingDb} />
          </motion.div>
        )}

        {activeTab === 'produtividade_oficina' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <TeamProductionDashboard />
          </motion.div>
        )}

        </div>
      </main>
    </div>
  );
}
