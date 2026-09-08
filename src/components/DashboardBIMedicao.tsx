import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { 
  TrendingUp, PieChart as PieIcon, BarChart3, Award, Calendar, 
  Filter, RefreshCw, Building2, Layers, DollarSign
} from 'lucide-react';
import { consolidarMedicaoMensal, formatCurrencyBRL, generateMonthOptions } from '../utils/medicaoUtils';
import { ObraMedicao, MovimentacaoAtivo, ValorLocacao } from '../types';

interface DashboardBIMedicaoProps {
  obras: ObraMedicao[];
  movimentacoes: MovimentacaoAtivo[];
  valoresLocacao: ValorLocacao[];
  mesAnoRef: string;
  onMesAnoRefChange: (mes: string) => void;
  onBackToObras?: () => void;
  onRefreshData?: () => void;
  isLoading?: boolean;
}

const COLORS_CLASSES = [
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#64748b'  // Slate
];

export default function DashboardBIMedicao({ 
  obras, 
  movimentacoes, 
  valoresLocacao, 
  mesAnoRef, 
  onMesAnoRefChange, 
  onBackToObras,
  onRefreshData,
  isLoading = false
}: DashboardBIMedicaoProps) {

  // Filter selected class (optional)
  const [selectedClasseFilter, setSelectedClasseFilter] = useState<string>('ALL');

  // Month options generator
  const monthOptions = useMemo(() => generateMonthOptions(), []);

  // Map obra id to name
  const mapaObras = useMemo(() => {
    const map = new Map<string, string>();
    obras.forEach(o => {
      const label = o.numero_cc ? `${o.numero_cc} - ${o.nome_obra}` : o.nome_obra;
      map.set(o.id, label);
    });
    return map;
  }, [obras]);

  // Consolidado do Mês Selecionado - SINGLE SOURCE OF TRUTH (Apenas obras ativas e itens medidos)
  const consolidadoMesAtual = useMemo(() => {
    if (movimentacoes.length === 0 || obras.length === 0) return [];
    
    // Apenas obras ativas (status === true)
    const obrasAtivasSet = new Set(obras.filter(o => o.status === true).map(o => o.id));
    const movsAtivas = movimentacoes.filter(m => obrasAtivasSet.has(m.obra_id));
    
    // Consolidar usando a utilidade oficial
    const consolidado = consolidarMedicaoMensal(movsAtivas, valoresLocacao, mesAnoRef);
    
    // Retorna apenas os itens que efetivamente possuem medição no mês (inicio_medicao !== null)
    return consolidado.filter(item => item.inicio_medicao !== null);
  }, [movimentacoes, valoresLocacao, obras, mesAnoRef]);

  // Faturamento Total do Mês Selecionado (Bate ao centavo com a Torre de Controle)
  const totalFaturamentoMes = useMemo(() => {
    return consolidadoMesAtual.reduce((acc, curr) => acc + (curr.valor_total_item || 0), 0);
  }, [consolidadoMesAtual]);

  // Total Equipamentos Medidos
  const totalEquipamentosMedidos = useMemo(() => {
    return consolidadoMesAtual.length;
  }, [consolidadoMesAtual]);

  // Contagem de Obras Ativas com Equipamentos Medidos
  const obrasAtivasComMedicaoCount = useMemo(() => {
    const setObras = new Set(consolidadoMesAtual.map(i => i.obra_id));
    return setObras.size;
  }, [consolidadoMesAtual]);

  const totalObrasCadastradasAtivas = useMemo(() => {
    return obras.filter(o => o.status === true).length;
  }, [obras]);

  // List of unique classes for filter dropdown
  const listClasses = useMemo(() => {
    const classesSet = new Set<string>();
    consolidadoMesAtual.forEach(item => {
      const cl = item.classe && item.classe.trim() ? item.classe.trim().toUpperCase() : 'SEM CLASSE';
      classesSet.add(cl);
    });
    return Array.from(classesSet).sort();
  }, [consolidadoMesAtual]);

  // Filtered Consolidado by Class (if filter selected)
  const filteredConsolidado = useMemo(() => {
    if (selectedClasseFilter === 'ALL') return consolidadoMesAtual;
    return consolidadoMesAtual.filter(item => {
      const cl = item.classe && item.classe.trim() ? item.classe.trim().toUpperCase() : 'SEM CLASSE';
      return cl === selectedClasseFilter;
    });
  }, [consolidadoMesAtual, selectedClasseFilter]);

  // 1. DATA FOR DONUT CHART (Faturamento por Classe de Equipamento)
  const dataDonutClasse = useMemo(() => {
    const mapClasse = new Map<string, number>();
    consolidadoMesAtual.forEach(item => {
      const cl = item.classe && item.classe.trim() ? item.classe.trim().toUpperCase() : 'SEM CLASSE';
      const val = item.valor_total_item || 0;
      mapClasse.set(cl, (mapClasse.get(cl) || 0) + val);
    });

    const list = Array.from(mapClasse.entries()).map(([name, value]) => ({
      name,
      value,
      percentage: totalFaturamentoMes > 0 ? (value / totalFaturamentoMes) * 100 : 0
    }));

    return list.sort((a, b) => b.value - a.value);
  }, [consolidadoMesAtual, totalFaturamentoMes]);

  // 2. DATA FOR HORIZONTAL BAR CHART (Faturamento por Obra)
  const dataBarObras = useMemo(() => {
    const mapObra = new Map<string, number>();
    filteredConsolidado.forEach(item => {
      const obraNome = mapaObras.get(item.obra_id) || 'Outras Obras';
      const val = item.valor_total_item || 0;
      mapObra.set(obraNome, (mapObra.get(obraNome) || 0) + val);
    });

    const list = Array.from(mapObra.entries()).map(([nome, total]) => ({
      nome,
      nomeCurto: nome.length > 20 ? nome.substring(0, 18) + '...' : nome,
      total
    }));

    return list.sort((a, b) => b.total - a.total);
  }, [filteredConsolidado, mapaObras]);

  // 3. DATA FOR VERTICAL BAR CHART (Evolução de Faturamento por Mês - Últimos 6 Meses)
  const dataEvolucaoMensal = useMemo(() => {
    if (obras.length === 0 || movimentacoes.length === 0) return [];

    const obrasAtivasSet = new Set(obras.filter(o => o.status === true).map(o => o.id));
    const movsAtivas = movimentacoes.filter(m => obrasAtivasSet.has(m.obra_id));

    const monthsToProcess = [];
    const monthShortNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const parts = mesAnoRef.split('-');
    const selYear = parseInt(parts[0] || '2026', 10);
    const selMonth = parseInt(parts[1] || '8', 10);
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(selYear, selMonth - 1 - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const val = `${y}-${m}`;
      const label = `${monthShortNames[d.getMonth()]}/${String(y).substring(2)}`;
      monthsToProcess.push({ val, label });
    }

    return monthsToProcess.map(mObj => {
      const cons = consolidarMedicaoMensal(movsAtivas, valoresLocacao, mObj.val);
      const consAtivos = cons.filter(i => i.inicio_medicao !== null);
      const total = consAtivos.reduce((acc, curr) => acc + (curr.valor_total_item || 0), 0);
      return {
        mesLabel: mObj.label,
        mesAnoRef: mObj.val,
        faturamento: total,
        equipamentosCount: consAtivos.length
      };
    });
  }, [obras, movimentacoes, valoresLocacao, mesAnoRef]);

  // 4. TOP 10 EQUIPAMENTOS MAIS RENTÁVEIS
  const top10Equipamentos = useMemo(() => {
    const sorted = [...filteredConsolidado].sort((a, b) => (b.valor_total_item || 0) - (a.valor_total_item || 0));
    
    return sorted.slice(0, 10).map((item, idx) => ({
      rank: idx + 1,
      tag: item.tag || 'N/A',
      cod_material: item.cod_material || '-',
      descricao: item.descricao || 'Ativo sem descrição',
      classe: item.classe && item.classe.trim() ? item.classe.trim().toUpperCase() : 'SEM CLASSE',
      obraNome: mapaObras.get(item.obra_id) || 'N/A',
      diasMedidos: item.dias_medidos || 0,
      valorDiario: item.valor_diario || 0,
      valorTotalItem: item.valor_total_item || 0
    }));
  }, [filteredConsolidado, mapaObras]);

  return (
    <div className="space-y-6">
      {/* HEADER / CONTROLES DE FILTRO */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">
                Executive BI & Analytics
              </span>
              {onBackToObras && (
                <button
                  type="button"
                  onClick={onBackToObras}
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                >
                  ← Voltar para Lista de Obras
                </button>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1.5 flex items-center gap-2.5">
              <BarChart3 className="w-7 h-7 text-amber-400" />
              <span>Business Intelligence — Medição de Equipamentos Próprios</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Análise estratégica de rentabilidade, faturamento por obra e distribuição por classe de ativos.
            </p>
          </div>

          {/* FILTROS DE MÊS E CLASSE */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor Mês/Ano */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 shadow-inner">
              <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Período</span>
                <select
                  value={mesAnoRef}
                  onChange={(e) => onMesAnoRefChange(e.target.value)}
                  className="bg-transparent text-xs font-black text-amber-400 focus:outline-none cursor-pointer font-mono"
                >
                  {monthOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-100 font-sans">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Seletor de Classe */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 shadow-inner">
              <Filter className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Filtrar Classe</span>
                <select
                  value={selectedClasseFilter}
                  onChange={(e) => setSelectedClasseFilter(e.target.value)}
                  className="bg-transparent text-xs font-black text-emerald-400 focus:outline-none cursor-pointer font-mono max-w-[160px] truncate"
                >
                  <option value="ALL" className="bg-slate-900 text-slate-100 font-sans">
                    Todas as Classes ({listClasses.length})
                  </option>
                  {listClasses.map((cl) => (
                    <option key={cl} value={cl} className="bg-slate-900 text-slate-100 font-sans">
                      {cl}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {onRefreshData && (
              <button
                type="button"
                onClick={onRefreshData}
                disabled={isLoading}
                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl border border-slate-700 transition-all cursor-pointer active:scale-95 shadow-md"
                title="Atualizar Dados do BI"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* SUMMARY CARDS IN BI HEADER */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          {/* CARD 1: FATURAMENTO TOTAL DO MÊS */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-500 font-mono tracking-wider">
                Faturamento Total Consolidado
              </span>
              <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 font-mono tracking-tight">
                {formatCurrencyBRL(totalFaturamentoMes)}
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          {/* CARD 2: EQUIPAMENTOS MEDIDOS */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-500 font-mono tracking-wider">
                Ativos Medidos no Período
              </span>
              <p className="text-xl sm:text-2xl font-black text-amber-400 mt-1 font-mono tracking-tight">
                {totalEquipamentosMedidos} <span className="text-xs text-slate-400 font-normal">itens</span>
              </p>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          {/* CARD 3: OBRAS ATIVAS COM MEDIÇÃO */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-500 font-mono tracking-wider">
                Obras Ativas em Operação
              </span>
              <p className="text-xl sm:text-2xl font-black text-cyan-400 mt-1 font-mono tracking-tight">
                {obrasAtivasComMedicaoCount} <span className="text-sm text-slate-400 font-sans font-normal">/ {totalObrasCadastradasAtivas}</span>
              </p>
            </div>
            <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO DE GRÁFICOS ANALÍTICOS (RECHARTS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GRÁFICO 1: DONUT CHART - FATURAMENTO POR CLASSE */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <PieIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white tracking-tight">
                    Faturamento por Classe de Equipamento
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Representatividade percentual de cada categoria no faturamento total
                  </p>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="h-64 flex items-center justify-center text-slate-500 font-mono text-xs">
                Carregando gráfico de classes...
              </div>
            ) : dataDonutClasse.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-500 font-mono text-xs">
                Nenhum dado de medição para este período.
              </div>
            ) : (
              <div className="h-72 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataDonutClasse}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {dataDonutClasse.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS_CLASSES[index % COLORS_CLASSES.length]} 
                          stroke="#0f172a"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => [formatCurrencyBRL(Number(value)), 'Faturamento']}
                      contentStyle={{
                        backgroundColor: '#020617',
                        borderColor: '#334155',
                        borderRadius: '16px',
                        color: '#f8fafc',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* LEGENDA DETALHADA COM VALOR E % */}
          {!isLoading && dataDonutClasse.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
              {dataDonutClasse.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs bg-slate-950/60 p-2 rounded-xl border border-slate-800/60">
                  <div className="flex items-center gap-2 truncate max-w-[130px]">
                    <span 
                      className="w-3 h-3 rounded-full shrink-0" 
                      style={{ backgroundColor: COLORS_CLASSES[idx % COLORS_CLASSES.length] }} 
                    />
                    <span className="text-slate-300 font-bold truncate text-[11px]" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-white font-bold text-[11px] block">{formatCurrencyBRL(item.value)}</span>
                    <span className="text-[10px] text-amber-400 font-black">{item.percentage.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* GRÁFICO 2: BAR CHART HORIZONTAL - FATURAMENTO POR OBRA */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white tracking-tight">
                    Faturamento por Obra (Ranking)
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Total faturado no mês por centro de custo de cada obra
                  </p>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="h-64 flex items-center justify-center text-slate-500 font-mono text-xs">
                Carregando faturamento por obras...
              </div>
            ) : dataBarObras.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-500 font-mono text-xs">
                Nenhuma obra com medição para este filtro.
              </div>
            ) : (
              <div className="h-80 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={dataBarObras}
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis 
                      type="number" 
                      tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                      stroke="#64748b" 
                      fontSize={11} 
                      fontFamily="monospace"
                    />
                    <YAxis 
                      type="category" 
                      dataKey="nomeCurto" 
                      stroke="#94a3b8" 
                      fontSize={11} 
                      width={120} 
                      fontFamily="monospace"
                    />
                    <Tooltip
                      formatter={(value: any) => [formatCurrencyBRL(Number(value)), 'Faturamento Obra']}
                      labelFormatter={(label) => `Obra: ${label}`}
                      contentStyle={{
                        backgroundColor: '#020617',
                        borderColor: '#334155',
                        borderRadius: '16px',
                        color: '#f8fafc',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
                      }}
                    />
                    <Bar dataKey="total" fill="#10b981" radius={[0, 8, 8, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* GRÁFICO 3: BAR CHART VERTICAL - EVOLUÇÃO TEMPORAL HISTÓRICA */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight">
                Evolução de Faturamento por Mês (Histórico de Tendência)
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Tendência de crescimento ou retração da medição consolidada nos últimos 6 meses
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-slate-500 font-mono text-xs">
            Carregando evolução histórica de faturamento...
          </div>
        ) : dataEvolucaoMensal.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-500 font-mono text-xs">
            Dados insuficientes para evolução mensal.
          </div>
        ) : (
          <div className="h-72 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataEvolucaoMensal} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="mesLabel" 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  fontFamily="monospace" 
                  fontWeight="bold"
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={11} 
                  fontFamily="monospace"
                  tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrencyBRL(Number(value)), 'Faturamento Mensal']}
                  labelFormatter={(label) => `Mês: ${label}`}
                  contentStyle={{
                    backgroundColor: '#020617',
                    borderColor: '#334155',
                    borderRadius: '16px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
                  }}
                />
                <Bar dataKey="faturamento" fill="#f59e0b" radius={[8, 8, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* TABELA DE TOP PERFORMERS: TOP 10 EQUIPAMENTOS MAIS RENTÁVEIS */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                <span>Top 10 Equipamentos Mais Rentáveis</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  RANKING EXECUTIVO
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Ativos com maior valor acumulado de diárias faturadas no período selecionado
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-500 font-mono text-xs">
            Carregando tabela de top performers...
          </div>
        ) : top10Equipamentos.length === 0 ? (
          <div className="py-12 text-center text-slate-500 font-mono text-xs">
            Nenhum ativo faturado no período.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-mono tracking-wider bg-slate-950/60">
                  <th className="py-3 px-3 text-center">#</th>
                  <th className="py-3 px-3">Tag / Patrimônio</th>
                  <th className="py-3 px-3">Descrição do Ativo</th>
                  <th className="py-3 px-3">Classe</th>
                  <th className="py-3 px-3">Obra Alocada</th>
                  <th className="py-3 px-3 text-center">Dias Medidos</th>
                  <th className="py-3 px-3 text-right">Diária (R$)</th>
                  <th className="py-3 px-3 text-right">Total Faturado (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {top10Equipamentos.map((item) => (
                  <tr key={`${item.rank}-${item.tag}-${item.cod_material}`} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 text-center font-mono">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-xs ${
                        item.rank === 1 ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' :
                        item.rank === 2 ? 'bg-slate-300 text-slate-950' :
                        item.rank === 3 ? 'bg-amber-700/80 text-white' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {item.rank}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-amber-400">
                      {item.tag}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-200 max-w-xs truncate" title={item.descricao}>
                      {item.descricao}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px]">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {item.classe}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-mono text-[11px] max-w-xs truncate" title={item.obraNome}>
                      {item.obraNome}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-300">
                      {item.diasMedidos} dias
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-400">
                      {formatCurrencyBRL(item.valorDiario)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-emerald-400 text-sm">
                      {formatCurrencyBRL(item.valorTotalItem)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
