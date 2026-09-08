import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Clock, 
  CheckCircle, 
  TrendingUp, 
  User, 
  RefreshCw, 
  AlertCircle,
  Award,
  Zap,
  ClipboardList,
  X,
  Calendar,
  Activity,
  Filter
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

interface OficinaEletricaDemanda {
  id: string;
  tipo_demanda: 'Semanal' | 'Avulsa';
  categoria_atividade: 'SERVIÇO' | 'FABRICAÇÃO' | 'MANUTENÇÃO';
  tipo_manutencao?: 'Preventiva' | 'Corretiva' | 'Adaptação' | null;
  descricao: string;
  quantidade: number;
  prazo_original: string;
  prazo_atual: string;
  status: 'Rascunho' | 'Sem atendimento' | 'Em andamento' | 'Executado' | 'CONCLUÍDO' | 'FINALIZADO' | 'Cancelado' | 'PARCIALMENTE ATRIBUÍDO' | 'TOTALMENTE ATRIBUÍDO' | 'PARCIALMENTE DISTRIBUÍDO' | 'TOTALMENTE DISTRIBUÍDO';
  executor_nome?: string;
  co_realizadores?: string[];
  historico_timeline?: any[];
  sub_atribuicoes?: any[];
  created_at: string;
}

const equipe = [
  { nome: 'JOSÉ PAULO', cargo: 'ELETRICISTA PROFISSIONAL' },
  { nome: 'LEOMAR', cargo: 'ELETRICISTA PROFISSIONAL' },
  { nome: 'SEBASTIÃO', cargo: 'AJUDANTE' },
  { nome: 'MARCELO', cargo: 'ELETRICISTA PROFISSIONAL' }
];

const listaEletricistas = equipe.map(member => member.nome);

const COLORS = ['#2563eb', '#16a34a', '#eab308', '#ea580c', '#8b5cf6'];

const getCoRealizadores = (dem: any): string[] => {
  if (dem && Array.isArray(dem.co_realizadores)) {
    return dem.co_realizadores;
  }
  if (dem && Array.isArray(dem.historico_timeline)) {
    const startEvent = [...dem.historico_timeline]
      .reverse()
      .find((e: any) => e.co_realizadores && Array.isArray(e.co_realizadores));
    if (startEvent) {
      return startEvent.co_realizadores;
    }
  }
  return [];
};

const isEmAndamentoStatus = (statusStr: string | null | undefined): boolean => {
  if (!statusStr) return false;
  const s = statusStr.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return (
    s === 'EM ANDAMENTO' ||
    s.includes('ANDAMENTO') ||
    s.includes('ATRIBU') ||
    s.includes('DISTRIB')
  );
};

const isConcluidaStatus = (statusStr: string | null | undefined): boolean => {
  if (!statusStr) return false;
  const s = statusStr.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return (
    s === 'CONCLUIDO' ||
    s === 'CONCLUIDA' ||
    s === 'FINALIZADO' ||
    s === 'EXECUTADO' ||
    s.includes('CONCLU') ||
    s.includes('FINALIZ') ||
    s.includes('EXECUT')
  );
};

const formatDateToBR = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'N/A';
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const parts = dateStr.split('-');
      const date = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
      return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('pt-BR');
  } catch (e) {
    return dateStr;
  }
};

export default function TeamProductionDashboard() {
  const [loading, setLoading] = useState(true);
  const [demandas, setDemandas] = useState<OficinaEletricaDemanda[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState<{ nome: string; cargo: string } | null>(null);

  // Filter States
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedEletricistaFilter, setSelectedEletricistaFilter] = useState<string>('');

  const fetchDemandas = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const dummyUuid = `00000000-0000-0000-0000-${String(Date.now()).padStart(12, '0').slice(-12)}`;
      const { data, error } = await supabase
        .from('oficina_eletrica')
        .select('*')
        .neq('id', dummyUuid);

      if (error) {
        throw error;
      }

      if (data) {
        setDemandas(data as OficinaEletricaDemanda[]);
      }
    } catch (err: any) {
      console.error('Erro ao buscar dados para o dashboard:', err);
      setErrorMsg(err.message || 'Erro ao carregar dados do banco de dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemandas();

    // Set up Realtime listener for strict, instant reactive synchronization
    const channel = supabase
      .channel('team_production_dashboard_realtime_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'oficina_eletrica'
        },
        () => {
          fetchDemandas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter Logic with safe date checks and fallback
  const demandasFiltradas = React.useMemo(() => {
    return demandas.filter(d => {
      // 1. Date Period Filter (by created_at date portion)
      if (startDate || endDate) {
        const dateStr = d.created_at || new Date().toISOString();
        const dateOnly = dateStr.split('T')[0]; // format YYYY-MM-DD
        if (startDate && dateOnly < startDate) return false;
        if (endDate && dateOnly > endDate) return false;
      }

      // 2. Colaborador Selection Filter
      if (selectedEletricistaFilter) {
        // Helper to match names robustly
        const isMatch = (nome1: string | null | undefined, nome2: string): boolean => {
          if (!nome1) return false;
          const norm1 = nome1.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
          const norm2 = nome2.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
          return norm1 === norm2 || norm1.includes(norm2);
        };

        const subAtribs = d.sub_atribuicoes;
        const hasSubAtribs = Array.isArray(subAtribs) && subAtribs.length > 0;

        if (hasSubAtribs) {
          const matchesSub = subAtribs.some(sub => {
            const isMainSub = isMatch(sub.eletricista_responsavel, selectedEletricistaFilter);
            const isHelperSub = Array.isArray(sub.co_realizadores) && sub.co_realizadores.some(helper => isMatch(helper, selectedEletricistaFilter));
            return isMainSub || isHelperSub;
          });
          if (!matchesSub) return false;
        } else {
          const isMain = isMatch(d.executor_nome, selectedEletricistaFilter);
          const isHelper = getCoRealizadores(d).some(helper => isMatch(helper, selectedEletricistaFilter));
          if (!isMain && !isHelper) return false;
        }
      }

      return true;
    });
  }, [demandas, startDate, endDate, selectedEletricistaFilter]);

  // Process and group the demands using .reduce()
  const statsByEletricista = React.useMemo(() => {
    // Initialize stats object
    const stats: Record<string, {
      total: number;
      emAndamento: number;
      concluidas: number;
      percentage: number;
      titularTotal: number;
      titularEmAndamento: number;
      titularConcluidas: number;
      apoioTotal: number;
      apoioEmAndamento: number;
      apoioConcluidas: number;
    }> = {};

    listaEletricistas.forEach(eletricista => {
      stats[eletricista] = {
        total: 0,
        emAndamento: 0,
        concluidas: 0,
        percentage: 0,
        titularTotal: 0,
        titularEmAndamento: 0,
        titularConcluidas: 0,
        apoioTotal: 0,
        apoioEmAndamento: 0,
        apoioConcluidas: 0
      };
    });

    // Match name helper to handle lowercase, uppercase, accents, and partial names
    const matchEletricistaName = (nome: string | null | undefined): string | null => {
      if (!nome) return null;
      const normalizedInput = nome
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
      
      for (const el of listaEletricistas) {
        const normalizedEl = el
          .trim()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toUpperCase();
        if (normalizedInput === normalizedEl || normalizedInput.includes(normalizedEl)) {
          return el;
        }
      }
      return null;
    };

    // Populate stats from filtered demands
    demandasFiltradas.forEach(current => {
      const isEmAndamento = isEmAndamentoStatus(current.status);
      const isConcluida = isConcluidaStatus(current.status);

      const subAtribs = current.sub_atribuicoes;
      const hasSubAtribs = Array.isArray(subAtribs) && subAtribs.length > 0;

      if (hasSubAtribs) {
        // Iterate over sub_atribuicoes
        subAtribs.forEach(sub => {
          // 1. Principal Executor for this sub_atribuicao (Titular)
          const titularName = matchEletricistaName(sub.eletricista_responsavel);
          if (titularName && stats[titularName]) {
            stats[titularName].total += 1;
            stats[titularName].titularTotal += 1;
            
            if (isEmAndamento) {
              stats[titularName].emAndamento += 1;
              stats[titularName].titularEmAndamento += 1;
            } else if (isConcluida) {
              stats[titularName].concluidas += 1;
              stats[titularName].titularConcluidas += 1;
            }
          }

          // 2. Co-realizadores for this sub_atribuicao (Apoio)
          const helpers = Array.isArray(sub.co_realizadores) ? sub.co_realizadores : [];
          helpers.forEach(helper => {
            const helperName = matchEletricistaName(helper);
            if (helperName && stats[helperName]) {
              stats[helperName].total += 1;
              stats[helperName].apoioTotal += 1;
              
              if (isEmAndamento) {
                stats[helperName].emAndamento += 1;
                stats[helperName].apoioEmAndamento += 1;
              } else if (isConcluida) {
                stats[helperName].concluidas += 1;
                stats[helperName].apoioConcluidas += 1;
              }
            }
          });
        });
      } else {
        // Direct Assignment: No sub_atribuicoes
        // 1. Primary Executor (Titular)
        const titularName = matchEletricistaName(current.executor_nome);
        if (titularName && stats[titularName]) {
          stats[titularName].total += 1;
          stats[titularName].titularTotal += 1;
          
          if (isEmAndamento) {
            stats[titularName].emAndamento += 1;
            stats[titularName].titularEmAndamento += 1;
          } else if (isConcluida) {
            stats[titularName].concluidas += 1;
            stats[titularName].titularConcluidas += 1;
          }
        }

        // 2. Co-realizadores (Apoio)
        const helpers = getCoRealizadores(current);
        helpers.forEach(helper => {
          const helperName = matchEletricistaName(helper);
          if (helperName && stats[helperName]) {
            stats[helperName].total += 1;
            stats[helperName].apoioTotal += 1;
            
            if (isEmAndamento) {
              stats[helperName].emAndamento += 1;
              stats[helperName].apoioEmAndamento += 1;
            } else if (isConcluida) {
              stats[helperName].concluidas += 1;
              stats[helperName].apoioConcluidas += 1;
            }
          }
        });
      }
    });

    // Calculate percentages
    listaEletricistas.forEach(eletricista => {
      const s = stats[eletricista];
      if (s.titularTotal > 0) {
        s.percentage = Math.round((s.titularConcluidas / s.titularTotal) * 100);
      } else if (s.total > 0) {
        s.percentage = Math.round((s.concluidas / s.total) * 100);
      } else {
        s.percentage = 0;
      }
    });

    return stats;
  }, [demandasFiltradas]);

  // Prepare chronological line chart data for focused individual Mode
  const chartData = React.useMemo(() => {
    if (!selectedEletricistaFilter) return [];

    const isMatch = (nome1: string | null | undefined, nome2: string): boolean => {
      if (!nome1) return false;
      const norm1 = nome1.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      const norm2 = nome2.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      return norm1 === norm2 || norm1.includes(norm2);
    };

    // Group only filtered demands for the chosen electrician by created_at date portion
    const grouped = demandasFiltradas.reduce((acc, curr) => {
      const dateStr = (curr.created_at || new Date().toISOString()).split('T')[0]; // Extract YYYY-MM-DD safely
      if (!acc[dateStr]) {
        acc[dateStr] = { emAndamento: 0, concluidas: 0 };
      }

      const isEmAndamento = isEmAndamentoStatus(curr.status);
      const isConcluida = isConcluidaStatus(curr.status);

      const subAtribs = curr.sub_atribuicoes;
      const hasSubAtribs = Array.isArray(subAtribs) && subAtribs.length > 0;

      let participated = false;
      if (hasSubAtribs) {
        participated = subAtribs.some(sub => {
          const isMainSub = isMatch(sub.eletricista_responsavel, selectedEletricistaFilter);
          const isHelperSub = Array.isArray(sub.co_realizadores) && sub.co_realizadores.some(helper => isMatch(helper, selectedEletricistaFilter));
          return isMainSub || isHelperSub;
        });
      } else {
        const isMain = isMatch(curr.executor_nome, selectedEletricistaFilter);
        const isHelper = getCoRealizadores(curr).some(helper => isMatch(helper, selectedEletricistaFilter));
        participated = isMain || isHelper;
      }
      
      if (participated) {
        if (isEmAndamento) {
          acc[dateStr].emAndamento += 1;
        } else if (isConcluida) {
          acc[dateStr].concluidas += 1;
        }
      }
      return acc;
    }, {} as Record<string, { emAndamento: number; concluidas: number }>);

    // Sort dates chronologically
    const sortedDates = Object.keys(grouped).sort();

    return sortedDates.map(dateStr => {
      const parts = dateStr.split('-');
      const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr; // formats to DD/MM
      return {
        date: formattedDate,
        "Em Andamento": grouped[dateStr].emAndamento,
        "Concluídas": grouped[dateStr].concluidas
      };
    });
  }, [demandasFiltradas, selectedEletricistaFilter]);

  // Prepared data for general team charts (BarChart and PieChart)
  const barChartData = React.useMemo(() => {
    return listaEletricistas.map(eletricista => {
      const stats = statsByEletricista[eletricista] || { 
        total: 0, emAndamento: 0, concluidas: 0, percentage: 0,
        titularTotal: 0, titularEmAndamento: 0, titularConcluidas: 0,
        apoioTotal: 0, apoioEmAndamento: 0, apoioConcluidas: 0
      };
      return {
        name: eletricista,
        "Titular Concluídas": stats.titularConcluidas,
        "Titular Em Progresso": stats.titularEmAndamento,
        "Apoio Concluídas": stats.apoioConcluidas,
        "Apoio Em Progresso": stats.apoioEmAndamento,
        "Total": stats.total,
        "Eficiência (%)": stats.percentage
      };
    });
  }, [statsByEletricista]);

  // Prepared data for volume by category of service
  const categoryChartData = React.useMemo(() => {
    let servicoGeral = 0;
    let fabricacaoGeral = 0;
    let manutencaoPreventiva = 0;
    let manutencaoCorretiva = 0;
    let manutencaoAdaptacao = 0;
    let manutencaoOutras = 0;

    demandasFiltradas.forEach(d => {
      if (d.status === 'Rascunho' || d.status === 'Cancelado') return;

      const cat = d.categoria_atividade ? d.categoria_atividade.toUpperCase().trim() : '';
      if (cat === 'SERVIÇO') {
        servicoGeral++;
      } else if (cat === 'FABRICAÇÃO') {
        fabricacaoGeral++;
      } else if (cat === 'MANUTENÇÃO') {
        const tipoManut = d.tipo_manutencao ? d.tipo_manutencao.trim() : '';
        if (tipoManut === 'Preventiva') {
          manutencaoPreventiva++;
        } else if (tipoManut === 'Corretiva') {
          manutencaoCorretiva++;
        } else if (tipoManut === 'Adaptação') {
          manutencaoAdaptacao++;
        } else {
          manutencaoOutras++;
        }
      }
    });

    return [
      {
        name: 'SERVIÇO',
        'Geral': servicoGeral,
        'Preventiva': 0,
        'Corretiva': 0,
        'Adaptação': 0,
        'Outras': 0,
        'Total': servicoGeral
      },
      {
        name: 'FABRICAÇÃO',
        'Geral': fabricacaoGeral,
        'Preventiva': 0,
        'Corretiva': 0,
        'Adaptação': 0,
        'Outras': 0,
        'Total': fabricacaoGeral
      },
      {
        name: 'MANUTENÇÃO',
        'Geral': 0,
        'Preventiva': manutencaoPreventiva,
        'Corretiva': manutencaoCorretiva,
        'Adaptação': manutencaoAdaptacao,
        'Outras': manutencaoOutras,
        'Total': manutencaoPreventiva + manutencaoCorretiva + manutencaoAdaptacao + manutencaoOutras
      }
    ];
  }, [demandasFiltradas]);

  // Filtered demands for the selected collaborator modal (can be clicked in any view state)
  const colaboradorDemandas = React.useMemo(() => {
    if (!colaboradorSelecionado) return [];
    
    // Helper to match names robustly
    const isMatch = (nome1: string | null | undefined, nome2: string): boolean => {
      if (!nome1) return false;
      const norm1 = nome1.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      const norm2 = nome2.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      return norm1 === norm2 || norm1.includes(norm2);
    };

    return demandasFiltradas.filter(d => {
      const subAtribs = d.sub_atribuicoes;
      const hasSubAtribs = Array.isArray(subAtribs) && subAtribs.length > 0;

      if (hasSubAtribs) {
        return subAtribs.some(sub => {
          const isMainSub = isMatch(sub.eletricista_responsavel, colaboradorSelecionado.nome);
          const isHelperSub = Array.isArray(sub.co_realizadores) && sub.co_realizadores.some(helper => isMatch(helper, colaboradorSelecionado.nome));
          return isMainSub || isHelperSub;
        });
      } else {
        const isMain = isMatch(d.executor_nome, colaboradorSelecionado.nome);
        const isHelper = getCoRealizadores(d).some(helper => isMatch(helper, colaboradorSelecionado.nome));
        return isMain || isHelper;
      }
    });
  }, [demandasFiltradas, colaboradorSelecionado]);

  // Overall indicators based on active filters (derived state via useMemo)
  const metricas = React.useMemo(() => {
    // Total Atribuído: demands assigned to executor, or in progress, or concluded, or all active non-canceled demands
    const totalDemandasAtribuidas = demandasFiltradas.filter(d => {
      const hasDirect = d.executor_nome && d.executor_nome.trim() !== '';
      const hasSub = Array.isArray(d.sub_atribuicoes) && d.sub_atribuicoes.length > 0;
      const isActive = isEmAndamentoStatus(d.status) || isConcluidaStatus(d.status);
      return hasDirect || hasSub || isActive;
    }).length || demandasFiltradas.length;

    // Em Andamento: status matching active/in-progress states (including without assigned executor_nome)
    const totalEmAndamento = demandasFiltradas.filter(d => isEmAndamentoStatus(d.status)).length;

    // Concluídas: status matching concluded states
    const totalConcluidas = demandasFiltradas.filter(d => isConcluidaStatus(d.status)).length;

    const overallPercentage = totalDemandasAtribuidas > 0 
      ? Math.min(100, Math.round((totalConcluidas / totalDemandasAtribuidas) * 100)) 
      : 0;

    return {
      totalDemandasAtribuidas,
      totalEmAndamento,
      totalConcluidas,
      overallPercentage
    };
  }, [demandasFiltradas]);

  return (
    <div className="space-y-6">
      {/* Title & Reload Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
        <div>
          <h3 className="text-sm font-black text-blue-900 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            Painel de Produtividade em Tempo Real
          </h3>
          <p className="text-[10px] text-blue-700 uppercase mt-0.5 font-semibold">
            Workload e taxa de conclusão individual da equipe da oficina elétrica (clique nos cards para detalhar)
          </p>
        </div>
        <button
          onClick={fetchDemandas}
          disabled={loading}
          className="self-start sm:self-auto px-3.5 py-1.5 bg-white hover:bg-slate-50 disabled:opacity-50 text-[10px] font-black uppercase text-slate-700 hover:text-slate-900 rounded-xl flex items-center gap-2 border border-slate-200 shadow-sm transition cursor-pointer animate-fade-in"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar Painel</span>
        </button>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-start gap-3 text-xs text-rose-700 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Erro ao atualizar dados</p>
            <p className="text-[10px] text-rose-500 mt-0.5 uppercase">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Interactive Cross-Filtering Control Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white border border-slate-200 p-4 rounded-3xl shadow-sm">
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider block flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-slate-400" />
            Data Inicial
          </label>
          <input 
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-850 text-xs px-3 py-2 rounded-xl focus:border-blue-500 focus:outline-none transition"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider block flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-slate-400" />
            Data Final
          </label>
          <input 
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-850 text-xs px-3 py-2 rounded-xl focus:border-blue-500 focus:outline-none transition"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider block flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-slate-400" />
            Colaborador em Foco
          </label>
          <div className="relative">
            <select
              value={selectedEletricistaFilter}
              onChange={(e) => setSelectedEletricistaFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-850 text-xs px-3 py-2.5 rounded-xl focus:border-blue-500 focus:outline-none transition cursor-pointer appearance-none uppercase font-bold"
            >
              <option value="" className="text-slate-500">🔍 Todos os Eletricistas</option>
              {equipe.map(colab => (
                <option key={colab.nome} value={colab.nome}>
                  👤 {colab.nome}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400 text-[9px]">
              ▼
            </div>
          </div>
        </div>
      </div>

      {/* General summary cards (micro-indicators) - Dynamic based on active filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Total Atribuído</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-slate-800">{metricas.totalDemandasAtribuidas}</span>
            <span className="text-[9px] text-slate-400 uppercase font-mono">demandas</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
          <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Em Andamento
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-amber-600">{metricas.totalEmAndamento}</span>
            <span className="text-[9px] text-slate-400 uppercase font-mono">ativos</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block flex items-center gap-1">
            Concluídas
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-emerald-600">{metricas.totalConcluidas}</span>
            <span className="text-[9px] text-slate-400 uppercase font-mono">itens</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
          <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block">Eficiência do Período</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-blue-600">{metricas.overallPercentage}%</span>
            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden self-center">
              <div 
                className="h-full bg-blue-500 rounded-full" 
                style={{ width: `${metricas.overallPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Layout Engine: Grid of all vs Focused Hero Mode */}
      {selectedEletricistaFilter ? (
        // Modo "Foco Individual" (Hero Style Card + Line Chart)
        <div className="space-y-6 animate-fade-in">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-3">
              <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1 rounded-full font-black uppercase tracking-widest inline-block">
                Modo Foco Individual Ativo
              </span>
            </div>
            
            {equipe
              .filter(c => c.nome.toUpperCase() === selectedEletricistaFilter.toUpperCase())
              .map((colaborador) => {
                const stats = statsByEletricista[colaborador.nome];
                const hasDemands = stats.total > 0;
                const isHighPerformance = stats.percentage >= 50;
                const progressBarColor = isHighPerformance ? 'bg-emerald-500' : 'bg-amber-500';

                return (
                  <button 
                    key={colaborador.nome} 
                    onClick={() => setColaboradorSelecionado(colaborador)}
                    className="w-full text-left bg-white border border-slate-200 rounded-3xl p-6 shadow-md hover:border-blue-300 transition duration-200 cursor-pointer block group"
                  >
                    <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-5">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 shadow-sm">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-black text-slate-800 uppercase tracking-wide group-hover:text-blue-600 transition">
                            {colaborador.nome}
                          </h4>
                          <span className="text-xs text-slate-500 uppercase font-mono font-semibold tracking-wider">
                            {colaborador.cargo}
                          </span>
                        </div>
                      </div>

                      {hasDemands && stats.percentage === 100 ? (
                        <span className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1.5 animate-bounce">
                          <Award className="w-3.5 h-3.5" />
                          100% OK
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 group-hover:text-blue-600 font-mono flex items-center gap-1 uppercase font-bold transition">
                          Histórico detalhado ➔
                        </span>
                      )}
                    </div>

                    {!hasDemands ? (
                      <div className="py-10 px-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <ClipboardList className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-wider block">
                          Sem demandas no momento
                        </span>
                        <p className="text-[10px] text-slate-400 uppercase mt-1">
                          Nenhuma tarefa de execução atrelada a este colaborador neste período
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Absolute Counters */}
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">Total Atribuído</span>
                            <span className="text-lg font-black text-slate-800 mt-1 block">{stats.total}</span>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <span className="text-[9px] text-amber-650 uppercase font-black tracking-wider block">⏳ Em Progresso</span>
                            <span className="text-lg font-black text-amber-600 mt-1 block">{stats.emAndamento}</span>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <span className="text-[9px] text-emerald-650 uppercase font-black tracking-wider block">✅ Concluídos</span>
                            <span className="text-lg font-black text-emerald-600 mt-1 block">{stats.concluidas}</span>
                          </div>
                        </div>

                        {/* Progress Bar and percentage */}
                        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <div className="flex justify-between items-center text-xs uppercase font-black text-slate-600">
                            <span>Eficiência do Colaborador</span>
                            <span className={`${isHighPerformance ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {stats.percentage}% Concluído
                            </span>
                          </div>
                          
                          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/80">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${progressBarColor}`}
                              style={{ width: `${stats.percentage}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono font-bold">
                            <span>0%</span>
                            <span>50% (Média de entrega)</span>
                            <span>100% (Eficiência Máxima)</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
          </div>

          {/* Line Chart Component Card */}
          <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-800">
                  Histórico de Produção do Colaborador (Evolução Temporal)
                </h4>
              </div>
              <span className="text-[9px] bg-slate-50 border border-slate-200 px-2.5 py-1 rounded text-slate-500 font-mono font-bold">
                EIXO X: DIA DA DEMANDA
              </span>
            </div>

            {chartData.length === 0 ? (
              <div className="py-12 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Activity className="w-8 h-8 text-slate-300 mx-auto mb-3 animate-pulse" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  Nenhum dado de produção neste período
                </p>
                <p className="text-[10px] text-slate-500 uppercase mt-1">
                  Não há registros de atividades em andamento ou concluídas nas datas selecionadas.
                </p>
              </div>
            ) : (
              <div className="w-full h-[300px] pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#475569" 
                      fontSize={10} 
                      fontWeight="bold"
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="#475569" 
                      fontSize={10} 
                      fontWeight="bold"
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', padding: '10px 14px' }}
                      labelStyle={{ color: '#475569', fontWeight: 'black', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}
                      itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                    />
                    <Legend 
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase', color: '#475569', paddingTop: '10px' }} 
                    />
                    <Line 
                      name="Em Andamento"
                      type="monotone" 
                      dataKey="Em Andamento" 
                      stroke="#d97706" 
                      strokeWidth={3.5} 
                      activeDot={{ r: 6 }} 
                      dot={{ stroke: '#ffffff', strokeWidth: 1.5, r: 4 }}
                    />
                    <Line 
                      name="Concluídas"
                      type="monotone" 
                      dataKey="Concluídas" 
                      stroke="#059669" 
                      strokeWidth={3.5} 
                      activeDot={{ r: 6 }} 
                      dot={{ stroke: '#ffffff', strokeWidth: 1.5, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Modo "Todos os Eletricistas" (Grid Mode)
        <div className="space-y-6 animate-fade-in">
          {/* Gráficos de Produtividade em Alto Contraste */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-white border border-slate-200 p-6 rounded-3xl shadow-md">
            {/* Chart 1: BarChart of Completed Tasks by Electrician */}
            <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex flex-col justify-between min-h-[350px]">
              <div>
                <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 border-b border-slate-150 pb-2">
                  📊 Produtividade por Eletricista (Itens Concluídos)
                </h4>
                <p className="text-[10px] text-slate-500 uppercase mt-1 mb-4 font-bold">
                  Quantidade total de demandas finalizadas por cada executor
                </p>
              </div>
              <div className="h-60 w-full pt-2">
                {barChartData.every(item => item["Titular Concluídas"] === 0 && item["Apoio Concluídas"] === 0) ? (
                  <div className="h-full flex items-center justify-center text-center py-10 text-slate-400 text-xs uppercase font-mono">
                    Sem demandas concluídas no período.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#475569" 
                        tick={{ fill: '#475569', fontSize: 11 }} 
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="#475569" 
                        tick={{ fill: '#475569', fontSize: 11 }} 
                        allowDecimals={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px' }}
                        cursor={{ fill: 'transparent' }}
                        itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                        labelStyle={{ color: '#475569', fontWeight: 'bold' }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36} 
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#475569' }}
                      />
                      <Bar dataKey="Titular Concluídas" stackId="a" fill="#2563eb" name="Ativ. Principais" barSize={28} />
                      <Bar dataKey="Apoio Concluídas" stackId="a" fill="#eab308" name="Co-participações" barSize={28} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 2: PieChart of Workload Distribution */}
            <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex flex-col justify-between min-h-[350px]">
              <div>
                <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 border-b border-slate-150 pb-2">
                  🍰 Distribuição do Volume de Trabalho (Atribuído)
                </h4>
                <p className="text-[10px] text-slate-500 uppercase mt-1 mb-4 font-bold">
                  Porcentagem de demandas totais delegadas para cada eletricista
                </p>
              </div>
              <div className="h-60 w-full flex items-center justify-center pt-2">
                {barChartData.every(item => item["Total"] === 0) ? (
                  <div className="h-full flex items-center justify-center text-center py-10 text-slate-400 text-xs uppercase font-mono">
                    Nenhuma demanda atribuída no período.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={barChartData.filter(item => item["Total"] > 0)}
                        cx="50%"
                        cy="45%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="Total"
                      >
                        {barChartData.filter(item => item["Total"] > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px' }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36} 
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#475569' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 3: Volume por Categoria de Serviço */}
            <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex flex-col justify-between min-h-[350px]">
              <div>
                <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 border-b border-slate-150 pb-2">
                  📊 VOLUME POR CATEGORIA DE SERVIÇO
                </h4>
                <p className="text-[10px] text-slate-500 uppercase mt-1 mb-4 font-bold">
                  Quantidade de demandas (concluídas e em andamento) agrupadas por tipo
                </p>
              </div>
              <div className="h-60 w-full pt-2">
                {categoryChartData.every(item => item.Total === 0) ? (
                  <div className="h-full flex items-center justify-center text-center py-10 text-slate-400 text-xs uppercase font-mono">
                    Nenhuma demanda registrada no período.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={categoryChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.5} />
                      <XAxis type="number" stroke="#475569" tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" stroke="#475569" tick={{ fill: '#475569', fontSize: 11, fontWeight: 'bold' }} tickLine={false} width={100} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px' }}
                        itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                        labelStyle={{ color: '#475569', fontWeight: 'bold' }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#475569' }}
                      />
                      <Bar dataKey="Geral" stackId="b" fill="#2563eb" name="Geral" barSize={16} />
                      <Bar dataKey="Preventiva" stackId="b" fill="#10b981" name="M. Preventiva" barSize={16} />
                      <Bar dataKey="Corretiva" stackId="b" fill="#ef4444" name="M. Corretiva" barSize={16} />
                      <Bar dataKey="Adaptação" stackId="b" fill="#f59e0b" name="M. Adaptação" barSize={16} />
                      <Bar dataKey="Outras" stackId="b" fill="#64748b" name="M. Outras" barSize={16} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Lista de Cards da Equipe */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {equipe.map((colaborador) => {
              const stats = statsByEletricista[colaborador.nome];
              const hasDemands = stats.total > 0;
              const isHighPerformance = stats.percentage >= 50;
              const progressBarColor = isHighPerformance ? 'bg-emerald-500' : 'bg-amber-500';

              return (
                <button 
                  key={colaborador.nome} 
                  onClick={() => setColaboradorSelecionado(colaborador)}
                  className={`w-full text-left bg-white border rounded-3xl p-5 shadow-sm transition duration-250 cursor-pointer block hover:scale-[1.015] active:scale-[0.99] group ${
                    hasDemands 
                      ? 'border-slate-200 hover:border-blue-300 hover:shadow-md' 
                      : 'border-slate-200/60 opacity-75 hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl transition group-hover:bg-blue-500 group-hover:text-white ${
                        hasDemands 
                          ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                          : 'bg-slate-50 text-slate-400 border border-slate-200'
                      }`}>
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide group-hover:text-blue-600 transition">
                          {colaborador.nome}
                        </h4>
                        <span className="text-[9px] text-slate-500 uppercase font-mono font-semibold tracking-wider">
                          {colaborador.cargo}
                        </span>
                      </div>
                    </div>

                    {hasDemands && stats.percentage === 100 ? (
                      <span className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 animate-pulse">
                        <Award className="w-3 h-3" />
                        100% OK
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-400 group-hover:text-blue-600 font-mono flex items-center gap-1 uppercase transition">
                        Ver detalhes ➔
                      </span>
                    )}
                  </div>

                  {!hasDemands ? (
                    <div className="py-6 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <ClipboardList className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                        Sem demandas no momento
                      </span>
                      <p className="text-[9px] text-slate-400 uppercase mt-0.5">
                        Nenhuma tarefa de execução atrelada a este eletricista
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Split metrics panel */}
                      <div className="bg-blue-50/20 p-3 rounded-2xl border border-blue-100/30 flex items-center justify-between gap-2 text-center">
                        <div className="flex-1 border-r border-slate-100 pr-1">
                          <span className="text-[8px] text-blue-600 uppercase font-black tracking-wider block mb-0.5">Titular (Ativ. Principal)</span>
                          <span className="text-xs font-black text-slate-800 block">{stats.titularConcluidas} concluídas</span>
                          <span className="text-[8px] text-slate-450 font-semibold block">({stats.titularTotal} atribuídas)</span>
                        </div>
                        <div className="flex-1 pl-1">
                          <span className="text-[8px] text-amber-600 uppercase font-black tracking-wider block mb-0.5">Apoio (Co-participações)</span>
                          <span className="text-xs font-black text-slate-800 block">{stats.apoioConcluidas} participações</span>
                          <span className="text-[8px] text-slate-450 font-semibold block">({stats.apoioTotal} apoios)</span>
                        </div>
                      </div>

                      {/* Absolute Counters */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <span className="text-[8px] text-slate-500 uppercase font-bold tracking-wider block font-black">Total Geral</span>
                          <span className="text-sm font-black text-slate-800 mt-0.5 block">{stats.total}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <span className="text-[8px] text-amber-600 uppercase font-bold tracking-wider block font-black">⏳ Em Progresso</span>
                          <span className="text-sm font-black text-amber-600 mt-0.5 block">{stats.emAndamento}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <span className="text-[8px] text-emerald-600 uppercase font-bold tracking-wider block font-black">✅ Concluídos</span>
                          <span className="text-sm font-black text-emerald-600 mt-0.5 block">{stats.concluidas}</span>
                        </div>
                      </div>

                      {/* Progress Bar and percentage */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500 font-black">
                          <span>Eficiência do Operador (Titular)</span>
                          <span className={`${isHighPerformance ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {stats.percentage}% Concluído
                          </span>
                        </div>
                        
                        <div className={`w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200`}>
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${progressBarColor}`}
                            style={{ width: `${stats.percentage}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[8px] text-slate-400 font-mono">
                          <span>0%</span>
                          <span>50%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal / Drill-Down History Sheet */}
      {colaboradorSelecionado && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col animate-fade-in">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-850 uppercase tracking-wide">
                    {colaboradorSelecionado.nome}
                  </h3>
                  <span className="text-[10px] text-blue-600 uppercase font-black tracking-widest">
                    {colaboradorSelecionado.cargo}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setColaboradorSelecionado(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / History Timeline */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-white">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-blue-600" />
                  Histórico de Serviços Associados
                </h4>
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  {colaboradorDemandas.length} Ordens Filtradas
                </span>
              </div>

              {colaboradorDemandas.length === 0 ? (
                <div className="py-12 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    Nenhum histórico de serviço encontrado no período.
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase mt-1">
                    Este colaborador não possui nenhuma demanda associada atendendo a estes critérios de busca.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {colaboradorDemandas.map((demanda) => {
                    // Status Tag Setup
                    let statusColor = 'bg-slate-50 text-slate-500 border-slate-200';
                    if (isConcluidaStatus(demanda.status)) {
                      statusColor = 'bg-emerald-50 text-emerald-600 border-emerald-200';
                    } else if (isEmAndamentoStatus(demanda.status)) {
                      statusColor = 'bg-amber-50 text-amber-600 border-amber-200';
                    } else if (demanda.status === 'Sem atendimento') {
                      statusColor = 'bg-blue-50 text-blue-600 border-blue-200';
                    } else if (demanda.status === 'Cancelado') {
                      statusColor = 'bg-rose-50 text-rose-600 border-rose-200';
                    }

                    const isMatchHelper = (nome1: string | null | undefined, nome2: string): boolean => {
                      if (!nome1) return false;
                      const norm1 = nome1.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                      const norm2 = nome2.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                      return norm1 === norm2 || norm1.includes(norm2);
                    };

                    const isMainExecutor = isMatchHelper(demanda.executor_nome, colaboradorSelecionado.nome) || 
                      (Array.isArray(demanda.sub_atribuicoes) && demanda.sub_atribuicoes.some(sub => isMatchHelper(sub.eletricista_responsavel, colaboradorSelecionado.nome)));

                    return (
                      <div 
                        key={demanda.id} 
                        className="bg-slate-50 border border-slate-200 hover:border-slate-300 p-4 rounded-2xl transition duration-150 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap gap-1.5 mb-1.5">
                              <span className="text-[8px] font-black uppercase bg-white text-slate-500 border border-slate-200 px-2 py-0.5 rounded tracking-widest inline-block">
                                {demanda.categoria_atividade} • {demanda.tipo_demanda}
                              </span>
                              {isMainExecutor ? (
                                <span className="text-[8px] font-black uppercase bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded tracking-widest inline-block">
                                  👑 Titular (Principal)
                                </span>
                              ) : (
                                <span className="text-[8px] font-black uppercase bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded tracking-widest inline-block">
                                  🤝 Equipe de Apoio
                                </span>
                              )}
                            </div>
                            <h5 className="text-xs font-black text-slate-800 leading-normal uppercase">
                              {demanda.descricao}
                            </h5>
                          </div>
                          
                          <span className={`self-start sm:self-auto px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${statusColor}`}>
                            {isConcluidaStatus(demanda.status) ? '✅ CONCLUÍDO' : isEmAndamentoStatus(demanda.status) ? '⏳ EM ANDAMENTO' : demanda.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-150 text-[10px] font-mono text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>CRIADO EM: <strong className="text-slate-700">{formatDateToBR(demanda.created_at)}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>PRAZO ATUAL: <strong className="text-slate-700">{formatDateToBR(demanda.prazo_atual)}</strong></span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 text-right">
              <button 
                onClick={() => setColaboradorSelecionado(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-[10px] font-black uppercase tracking-wider text-slate-700 rounded-xl transition cursor-pointer border border-slate-300"
              >
                Fechar Detalhes
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
