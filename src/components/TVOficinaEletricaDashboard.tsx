import React, { useState, useEffect, useMemo } from 'react';
import { Zap, CheckCircle2, Hammer, Activity, Award, TrendingUp, Users, ShieldCheck } from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Cell, 
  Legend,
  LabelList 
} from 'recharts';
import { supabase } from '../lib/supabase';

// Standard Base Electricians list
const BASE_ELETRICISTAS = [
  "JOSÉ PAULO",
  "LEOMAR",
  "SEBASTIÃO",
  "MARCELO"
];

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

export default function TVOficinaEletricaDashboard() {
  const [loading, setLoading] = useState<boolean>(true);
  const [demandas, setDemandas] = useState<any[]>([]);

  const fetchDemandas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('oficina_eletrica')
        .select('*');

      if (error) throw error;
      setDemandas(data || []);
    } catch (err) {
      console.error('Erro ao buscar dados da Oficina Elétrica no TV Monitor:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemandas();

    const channel = supabase
      .channel('tv_oficina_eletrica_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'oficina_eletrica' },
        () => {
          fetchDemandas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Tickle / Force Reset de Atividade para Modo TV a cada 5 minutos (300.000 ms)
  useEffect(() => {
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
  }, []);

  // Macro Metrics
  const metrics = useMemo(() => {
    const totalEmAndamento = demandas.filter(d => isEmAndamentoStatus(d.status)).length;
    const totalConcluidas = demandas.filter(d => isConcluidaStatus(d.status)).length;

    const totalAtribuido = demandas.filter(d => {
      const hasDirect = d.executor_nome && d.executor_nome.trim() !== '';
      const hasSub = Array.isArray(d.sub_atribuicoes) && d.sub_atribuicoes.length > 0;
      const isActive = isEmAndamentoStatus(d.status) || isConcluidaStatus(d.status);
      return hasDirect || hasSub || isActive;
    }).length || demandas.length;

    const totalBase = totalAtribuido > 0 ? totalAtribuido : demandas.length;
    const eficienciaGeral = totalBase > 0 ? Math.min(100, Math.round((totalConcluidas / totalBase) * 100)) : 95;

    return {
      totalAtribuido,
      totalEmAndamento,
      totalConcluidas,
      eficienciaGeral
    };
  }, [demandas]);

  // Per Electrician Statistics (Strictly grouped by the 4 Base Electricians)
  const rankingEletricistas = useMemo(() => {
    const statsMap: Record<string, {
      nome: string;
      total: number;
      concluidas: number;
      emAndamento: number;
      titular: number;
      apoio: number;
      eficiencia: number;
    }> = {};

    BASE_ELETRICISTAS.forEach(nome => {
      statsMap[nome] = {
        nome,
        total: 0,
        concluidas: 0,
        emAndamento: 0,
        titular: 0,
        apoio: 0,
        eficiencia: 0
      };
    });

    // Match raw input (string, array, comma-separated names) against BASE_ELETRICISTAS
    const matchElectricianNames = (rawInput: any): string[] => {
      if (!rawInput) return [];
      const rawStrings: string[] = [];

      if (Array.isArray(rawInput)) {
        rawInput.forEach(item => {
          if (typeof item === 'string') {
            item.split(',').forEach(s => rawStrings.push(s.trim()));
          }
        });
      } else if (typeof rawInput === 'string') {
        rawInput.split(',').forEach(s => rawStrings.push(s.trim()));
      }

      const matchedSet = new Set<string>();

      rawStrings.forEach(str => {
        if (!str) return;
        const normInput = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

        for (const el of BASE_ELETRICISTAS) {
          const normEl = el.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
          if (normInput === normEl || normInput.includes(normEl) || normEl.includes(normInput)) {
            matchedSet.add(el);
          }
        }
      });

      return Array.from(matchedSet);
    };

    demandas.forEach(d => {
      const isAndam = isEmAndamentoStatus(d.status);
      const isConc = isConcluidaStatus(d.status);

      const subAtribs = d.sub_atribuicoes;
      const hasSubAtribs = Array.isArray(subAtribs) && subAtribs.length > 0;

      if (hasSubAtribs) {
        subAtribs.forEach((sub: any) => {
          const respNames = matchElectricianNames(sub.eletricista_responsavel);
          const titular = respNames[0]; // 1st matched name is Titular

          if (titular && statsMap[titular]) {
            statsMap[titular].total += 1;
            statsMap[titular].titular += 1;
            if (isConc) statsMap[titular].concluidas += 1;
            if (isAndam) statsMap[titular].emAndamento += 1;
          }

          // Helpers in co_realizadores + any remaining names in eletricista_responsavel
          const helperCandidates = [
            ...respNames.slice(1),
            ...matchElectricianNames(sub.co_realizadores)
          ];

          const helperSet = new Set(helperCandidates.filter(h => h !== titular));

          helperSet.forEach(hName => {
            if (statsMap[hName]) {
              statsMap[hName].total += 1;
              statsMap[hName].apoio += 1;
              if (isConc) statsMap[hName].concluidas += 1;
              if (isAndam) statsMap[hName].emAndamento += 1;
            }
          });
        });
      } else {
        const executorNames = matchElectricianNames(d.executor_nome);
        const titular = executorNames[0]; // 1st matched name is Titular

        if (titular && statsMap[titular]) {
          statsMap[titular].total += 1;
          statsMap[titular].titular += 1;
          if (isConc) statsMap[titular].concluidas += 1;
          if (isAndam) statsMap[titular].emAndamento += 1;
        }

        // Helpers in co_realizadores / timeline + any extra names in executor_nome
        const coRealsRaw = d.co_realizadores || (
          Array.isArray(d.historico_timeline)
            ? [...d.historico_timeline].reverse().find((e: any) => e.co_realizadores)?.co_realizadores
            : null
        );

        const helperCandidates = [
          ...executorNames.slice(1),
          ...matchElectricianNames(coRealsRaw)
        ];

        const helperSet = new Set(helperCandidates.filter(h => h !== titular));

        helperSet.forEach(hName => {
          if (statsMap[hName]) {
            statsMap[hName].total += 1;
            statsMap[hName].apoio += 1;
            if (isConc) statsMap[hName].concluidas += 1;
            if (isAndam) statsMap[hName].emAndamento += 1;
          }
        });
      }
    });

    // Calculate efficiencies and array format
    const list = Object.values(statsMap).map(item => {
      const ef = item.total > 0 ? Math.min(100, Math.round((item.concluidas / item.total) * 100)) : 0;
      return {
        ...item,
        eficiencia: ef,
        shortName: item.nome.split(' ').slice(0, 2).join(' ')
      };
    });

    // Sort by Concluídas desc, then Eficiência desc, then Total desc
    return list.sort((a, b) => {
      if (b.concluidas !== a.concluidas) return b.concluidas - a.concluidas;
      if (b.eficiencia !== a.eficiencia) return b.eficiencia - a.eficiencia;
      return b.total - a.total;
    });
  }, [demandas]);

  // Chart data formatted for Recharts
  const chartData = useMemo(() => {
    return rankingEletricistas.map(el => ({
      name: el.shortName,
      concluidas: el.concluidas,
      emAndamento: el.emAndamento,
      total: el.total
    }));
  }, [rankingEletricistas]);

  return (
    <div id="active-tv-mode-flag" className="w-full h-full max-h-screen bg-slate-950 text-slate-100 p-4 sm:p-5 flex flex-col justify-between overflow-hidden font-sans min-h-0">
      
      {/* HEADER BAR */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-xl text-amber-400 shadow-lg shadow-amber-900/20">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 font-mono bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-md">
                GESTÃO À VISTA • TEMPO REAL
              </span>
              <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                AO VIVO
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight mt-0.5">
              PRODUTIVIDADE OFICINA ELÉTRICA
            </h1>
          </div>
        </div>

        <div className="text-right hidden sm:block">
          <p className="text-xs text-slate-400 font-mono font-medium">CMPC OVERHAUL 2026</p>
          <p className="text-[9px] text-amber-500/80 font-mono font-bold uppercase tracking-wider">Monitoramento Contínuo de Manutenção</p>
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2.5 shrink-0">
        {/* KPI 1: Total Atribuído */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-mono">
              Total Atribuído
            </span>
            <div className="p-1.5 bg-slate-800 text-blue-400 rounded-lg">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              {loading ? '...' : metrics.totalAtribuido}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Demandas</span>
          </div>
          <div className="mt-1.5 w-full bg-slate-800 h-1 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full w-full" />
          </div>
        </div>

        {/* KPI 2: Em Andamento */}
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3 flex flex-col justify-between relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              Em Andamento
            </span>
            <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
              <Hammer className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight">
              {loading ? '...' : metrics.totalEmAndamento}
            </span>
            <span className="text-[10px] text-amber-200/80 font-semibold uppercase">Ativos</span>
          </div>
          <div className="mt-1.5 w-full bg-slate-800 h-1 rounded-full overflow-hidden">
            <div 
              className="bg-amber-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${metrics.totalAtribuido > 0 ? (metrics.totalEmAndamento / metrics.totalAtribuido) * 100 : 0}%` }} 
            />
          </div>
        </div>

        {/* KPI 3: Concluídas */}
        <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-3 flex flex-col justify-between relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 font-mono">
              Concluídas
            </span>
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
              {loading ? '...' : metrics.totalConcluidas}
            </span>
            <span className="text-[10px] text-emerald-200/80 font-semibold uppercase">Itens</span>
          </div>
          <div className="mt-1.5 w-full bg-slate-800 h-1 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${metrics.totalAtribuido > 0 ? (metrics.totalConcluidas / metrics.totalAtribuido) * 100 : 0}%` }} 
            />
          </div>
        </div>

        {/* KPI 4: Eficiência Geral */}
        <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3 flex flex-col justify-between relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 font-mono">
              Eficiência Geral
            </span>
            <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              {loading ? '...' : `${metrics.eficienciaGeral}%`}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Taxa Conclusão</span>
          </div>
          <div className="mt-1.5 w-full bg-slate-800 h-1 rounded-full overflow-hidden">
            <div 
              className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${metrics.eficienciaGeral}%` }} 
            />
          </div>
        </div>
      </div>

      {/* LOWER AREA: CHART + PODIUM RANKING */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mt-2.5 flex-1 min-h-0">
        
        {/* BAR CHART: PRODUTIVIDADE POR ELETRICISTA */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between shadow-2xl flex-1 min-h-0">
          <div className="flex items-center justify-between mb-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-200">
                PRODUTIVIDADE POR ELETRICISTA (ITENS CONCLUÍDOS)
              </h2>
            </div>
            <div className="flex items-center gap-3 text-[9px] font-mono">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded bg-emerald-500 inline-block" />
                Concluídos
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded bg-amber-500 inline-block" />
                Em Andamento
              </span>
            </div>
          </div>

          <div className="w-full flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 15, right: 10, left: -25, bottom: 45 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#64748b" 
                  fontSize={8} 
                  tickLine={false} 
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={45}
                />
                <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc', fontSize: '11px' }}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                />
                <Bar dataKey="concluidas" name="Concluídas" fill="#10b981" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="concluidas" position="top" fill="#10b981" fontSize={9} fontWeight="bold" formatter={(v: any) => v > 0 ? v : ''} />
                </Bar>
                <Bar dataKey="emAndamento" name="Em Andamento" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="emAndamento" position="top" fill="#f59e0b" fontSize={9} fontWeight="bold" formatter={(v: any) => v > 0 ? v : ''} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RANKING PODIUM / HIGHEST PERFORMERS */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between shadow-2xl overflow-hidden flex-1 min-h-0">
          <div className="flex items-center justify-between mb-2 border-b border-slate-800 pb-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-200">
                RANKING DE EFICIÊNCIA DA EQUIPE
              </h2>
            </div>
            <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
              Titulares & Apoio
            </span>
          </div>

          <div className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-1 scrollbar-none">
            {rankingEletricistas.map((el, idx) => {
              const isTop3 = idx < 3;
              const medalColor = idx === 0 ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 
                                 idx === 1 ? 'text-slate-300 bg-slate-500/10 border-slate-500/30' : 
                                 idx === 2 ? 'text-amber-600 bg-amber-700/10 border-amber-700/30' : 
                                 'text-slate-500 bg-slate-800/40 border-slate-800';

              return (
                <div 
                  key={el.nome} 
                  className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                    isTop3 
                      ? 'bg-slate-800/80 border-slate-700 shadow-md' 
                      : 'bg-slate-950/40 border-slate-850'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-6 h-6 rounded-lg border flex items-center justify-center text-[10px] font-black font-mono shrink-0 ${medalColor}`}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-100 truncate">{el.nome}</p>
                      <p className="text-[9px] text-slate-400 font-mono">
                        Titular: <span className="text-slate-200 font-bold">{el.titular}</span> • Apoio: <span className="text-slate-200 font-bold">{el.apoio}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-xs font-black text-emerald-400 font-mono">{el.concluidas}</span>
                      <span className="text-[9px] text-slate-400 font-mono">/ {el.total}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-[8px] font-bold font-mono text-indigo-400">{el.eficiencia}% ef.</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
