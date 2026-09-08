import React, { useMemo, useState } from 'react';
import { 
  X, 
  PackageCheck, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  ArrowLeft, 
  Table as TableIcon, 
  Wrench, 
  ShieldCheck, 
  Activity, 
  TrendingUp, 
  AlertCircle, 
  Sparkles,
  Truck,
  Building2,
  Calendar
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
  Tooltip 
} from 'recharts';
import { FluxoOficinaItem } from './FluxoOficina';
import EquipeOnlineWidget from './EquipeOnlineWidget';

interface FluxoOficinaDashboardProps {
  items: FluxoOficinaItem[];
  loading: boolean;
  onRefresh: () => void;
  onSwitchToTable: () => void;
  onBackToHub: () => void;
}

export default function FluxoOficinaDashboard({
  items,
  loading,
  onRefresh,
  onSwitchToTable,
  onBackToHub
}: FluxoOficinaDashboardProps) {
  // Estado para o Drill-down por Obra
  const [obraSelecionada, setObraSelecionada] = useState<string | null>(null);
  const [searchTermObra, setSearchTermObra] = useState<string>('');

  // Itens filtrados para o Modal da Obra Selecionada
  const itemsObraSelecionada = useMemo(() => {
    if (!obraSelecionada) return [];
    
    const itemsObra = items.filter(item => {
      if (obraSelecionada === 'Não Informado / Sem Depósito') {
        return (!item.deposito_destino || item.deposito_destino.trim() === '');
      }
      return item.deposito_destino && item.deposito_destino.trim() === obraSelecionada;
    });

    if (!searchTermObra.trim()) return itemsObra;

    const query = searchTermObra.toLowerCase().trim();
    return itemsObra.filter(i => 
      (i.tag && i.tag.toLowerCase().includes(query)) ||
      (i.st && i.st.toLowerCase().includes(query)) ||
      (i.nm && i.nm.toLowerCase().includes(query)) ||
      (i.descricao && i.descricao.toLowerCase().includes(query))
    );
  }, [items, obraSelecionada, searchTermObra]);

  const totalItemsObra = useMemo(() => {
    if (!obraSelecionada) return 0;
    return items.filter(item => {
      if (obraSelecionada === 'Não Informado / Sem Depósito') {
        return (!item.deposito_destino || item.deposito_destino.trim() === '');
      }
      return item.deposito_destino && item.deposito_destino.trim() === obraSelecionada;
    }).length;
  }, [items, obraSelecionada]);

  // 1. CÁLCULO DAS MÉTRICAS E KPIS MEMORIZADOS
  const metrics = useMemo(() => {
    const sumQty = (arr: FluxoOficinaItem[]) => arr.reduce((acc, i) => acc + (Number(i.quantidade) || 1), 0);
    const total = sumQty(items);
    const now = new Date();

    // Counts por status
    const emInspecao = items.filter(i => i.status === 'Em Inspeção');
    const disponiveis = items.filter(i => i.status && (i.status.toLowerCase().includes('disponív') || i.status.toLowerCase().includes('disponiv')));
    const reprovados = items.filter(i => i.status && i.status.toLowerCase().includes('reprovad'));
    const mobilizados = items.filter(i => i.status && (i.status.toLowerCase().includes('mobiliz') || i.status === 'MOBILIZADO'));

    const countEmInspecao = sumQty(emInspecao);
    const countDisponiveis = sumQty(disponiveis);
    const countReprovados = sumQty(reprovados);
    const countMobilizados = sumQty(mobilizados);

    // Equipamentos em inspeção sem ST
    const countPendenciaSt = items.filter(
      i => i.status === 'Em Inspeção' && (!i.st || i.st.trim() === '' || /^0+$/.test(i.st.trim()))
    ).length;

    // Porcentagens em relação ao total
    const pctEmInspecao = total > 0 ? ((countEmInspecao / total) * 100).toFixed(1) : '0.0';
    const pctDisponiveis = total > 0 ? ((countDisponiveis / total) * 100).toFixed(1) : '0.0';
    const pctReprovados = total > 0 ? ((countReprovados / total) * 100).toFixed(1) : '0.0';
    const pctMobilizados = total > 0 ? ((countMobilizados / total) * 100).toFixed(1) : '0.0';

    // Helper para calcular dias em oficina de um item
    const getDiasEmOficina = (item: FluxoOficinaItem): number => {
      if (!item.data_entrada_oficina) return 0;
      const start = new Date(item.data_entrada_oficina);
      let end = now;
      if (item.status !== 'Em Inspeção') {
        if (item.data_inspecao) {
          end = new Date(item.data_inspecao);
        } else if (item.data_saida_oficial) {
          end = new Date(item.data_saida_oficial);
        }
      }
      const diffTime = end.getTime() - start.getTime();
      return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    };

    // Tempo Médio em Oficina (Geral)
    const itemsComData = items.filter(i => i.data_entrada_oficina);
    const somaDiasGeral = itemsComData.reduce((acc, item) => acc + getDiasEmOficina(item), 0);
    const tempoMedioGeral = itemsComData.length > 0 ? Math.round(somaDiasGeral / itemsComData.length) : 0;

    // Tempo Médio por Oficina
    const oficinasMap: Record<string, { somaDias: number; count: number }> = {
      'Eletrônica': { somaDias: 0, count: 0 },
      'Mecânica': { somaDias: 0, count: 0 },
      '112Y': { somaDias: 0, count: 0 }
    };

    items.forEach(item => {
      const ofic = item.oficina_destino || 'Não Informado';
      if (!oficinasMap[ofic]) {
        oficinasMap[ofic] = { somaDias: 0, count: 0 };
      }
      oficinasMap[ofic].somaDias += getDiasEmOficina(item);
      oficinasMap[ofic].count += 1;
    });

    const tempoPorOficina = Object.keys(oficinasMap).map(oficina => {
      const data = oficinasMap[oficina];
      const diasMedios = data.count > 0 ? Math.round(data.somaDias / data.count) : 0;
      return {
        oficina,
        diasMedios,
        qtd: data.count
      };
    });

    // Encontrar oficina com maior tempo médio
    const oficinasComDados = tempoPorOficina.filter(o => o.qtd > 0);
    const oficinaMaisLenta = oficinasComDados.length > 0 
      ? oficinasComDados.reduce((prev, curr) => (curr.diasMedios > prev.diasMedios ? curr : prev), oficinasComDados[0])
      : null;

    // Índice de Disponibilidade
    // Fórmula: (Disponíveis / (Disponíveis + Em Inspeção + Reprovados)) * 100
    const denominadorDisp = countDisponiveis + countEmInspecao + countReprovados;
    const indiceDisponibilidade = denominadorDisp > 0 ? (countDisponiveis / denominadorDisp) * 100 : 0;

    // Classificação da Disponibilidade
    let statusDispLabel = 'Saudável';
    let statusDispColor = '#10b981'; // Emerald
    let statusBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';

    if (indiceDisponibilidade < 60) {
      statusDispLabel = 'Crítico';
      statusDispColor = '#ef4444'; // Red
      statusBadgeClass = 'bg-rose-100 text-rose-800 border-rose-300';
    } else if (indiceDisponibilidade <= 85) {
      statusDispLabel = 'Atenção Operacional';
      statusDispColor = '#f59e0b'; // Amber
      statusBadgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
    }

    // Top 10 Equipamentos Pendentes/Em Inspeção
    const naoDisponiveis = items.filter(
      i => i.status !== 'Disponível para atendimento' && i.status !== 'Mobilizado para Obra'
    );

    const equipCountMap: Record<string, number> = {};
    naoDisponiveis.forEach(item => {
      let desc = item.descricao || 'EQUIPAMENTO S/ DESCRIÇÃO';
      desc = desc
        .toUpperCase()
        .replace(/[\r\n]+/g, ' ')
        .replace(/\b\d{6,8}\b/g, '')
        .replace(/TAG:.*$/i, '')
        .replace(/RM:.*$/i, '')
        .trim();
      
      const nomeBase = desc.slice(0, 24) || 'EQUIPAMENTO';
      equipCountMap[nomeBase] = (equipCountMap[nomeBase] || 0) + 1;
    });

    const topEquipamentos = Object.entries(equipCountMap)
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);

    // Equipamentos Mobilizados por Obra
    const mobilizadosItens = items.filter(
      i => i.status === 'Mobilizado para Obra' || (i.deposito_destino && i.deposito_destino.trim() !== '')
    );

    const obrasMap: Record<string, number> = {};
    mobilizadosItens.forEach(item => {
      const obra = item.deposito_destino && item.deposito_destino.trim() !== '' 
        ? item.deposito_destino.trim() 
        : 'Não Informado / Sem Depósito';
      obrasMap[obra] = (obrasMap[obra] || 0) + 1;
    });

    const dadosObras = Object.entries(obrasMap)
      .map(([obra, quantidade]) => ({ obra, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);

    return {
      total,
      countEmInspecao,
      countPendenciaSt,
      pctEmInspecao,
      countDisponiveis,
      pctDisponiveis,
      countReprovados,
      pctReprovados,
      countMobilizados,
      pctMobilizados,
      tempoMedioGeral,
      tempoPorOficina,
      oficinaMaisLenta,
      indiceDisponibilidade,
      statusDispLabel,
      statusDispColor,
      statusBadgeClass,
      topEquipamentos,
      dadosObras
    };
  }, [items]);

  // Dados para o Gráfico de Rosca (Donut Chart de Status)
  const pieChartData = useMemo(() => [
    { name: 'Disponíveis', value: metrics.countDisponiveis, color: '#10b981' },
    { name: 'Em Inspeção', value: metrics.countEmInspecao, color: '#f59e0b' },
    { name: 'Pendentes/Reprovados', value: metrics.countReprovados, color: '#ef4444' },
    { name: 'Mobilizados', value: metrics.countMobilizados, color: '#3b82f6' }
  ].filter(d => d.value > 0), [metrics]);

  // Dados para o Semi-círculo de Disponibilidade (Gauge)
  const gaugeChartData = useMemo(() => {
    const val = Math.min(100, Math.max(0, metrics.indiceDisponibilidade));
    return [
      { name: 'Disponibilidade', value: val, color: metrics.statusDispColor },
      { name: 'Indisponível', value: 100 - val, color: '#e2e8f0' }
    ];
  }, [metrics]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* HEADER PRINCIPAL DO DASHBOARD */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToHub}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Voltar ao HUB"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Dashboard Gerencial - Oficina Central
              </h1>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Indicadores em tempo real, tempo de permanência e análise de disponibilidade dos equipamentos
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-colors flex items-center gap-2 text-xs"
            title="Atualizar Dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            onClick={onSwitchToTable}
            className="px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2 text-xs"
          >
            <TableIcon className="w-4 h-4" />
            <span>Gestão de RTDs & Tabela</span>
          </button>
        </div>
      </div>

      {/* LINHA 1: CARDS DE KPI PRINCIPAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        
        {/* CARD 1: TOTAL DE EQUIPAMENTOS */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Equipamentos
              </span>
              <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                <PackageCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {metrics.total}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-700 font-semibold">
              <Building2 className="w-3.5 h-3.5" />
              <span>Base total de itens no fluxo</span>
            </div>
          </div>
        </div>

        {/* CARD 2: EM INSPEÇÃO */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-200/80 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                Em Inspeção
              </span>
              <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                <Search className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {metrics.countEmInspecao}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-semibold">
              <span className="text-amber-700">{metrics.pctEmInspecao}% do total</span>
              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px]">Aguardando</span>
            </div>
          </div>
        </div>

        {/* CARD 3: PENDÊNCIA DE ST */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-orange-300 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-800">
                Pendência de ST
              </span>
              <div className="p-2 bg-orange-100 text-orange-700 rounded-xl">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-orange-950 tracking-tight">
              {metrics.countPendenciaSt}
            </div>
            <div className="mt-2 text-xs font-medium text-orange-800 leading-snug">
              Equipamentos em oficina sem número de ST
            </div>
          </div>
        </div>

        {/* CARD 4: DISPONÍVEIS */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-200/80 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Disponíveis
              </span>
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {metrics.countDisponiveis}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-semibold">
              <span className="text-emerald-700">{metrics.pctDisponiveis}% do total</span>
              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px]">Pronto P/ Atendimento</span>
            </div>
          </div>
        </div>

        {/* CARD 5: PENDENTES / REPROVADOS */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-rose-200/80 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
                Pendentes / Reprovados
              </span>
              <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {metrics.countReprovados}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-semibold">
              <span className="text-rose-700">{metrics.pctReprovados}% do total</span>
              <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full text-[10px]">Ação Necessária</span>
            </div>
          </div>
        </div>

      </div>

      {/* LINHA 2: CARDS DE KPI SECUNDÁRIOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* CARD SECUNDÁRIO 1: TEMPO MÉDIO GERAL */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Tempo Médio em Oficina
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-indigo-900">
                {metrics.tempoMedioGeral}d
              </span>
              <span className="text-xs text-slate-500 font-medium">dias por equipamento</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Permanência calculada desde a entrada na oficina
            </p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Clock className="w-7 h-7" />
          </div>
        </div>

        {/* CARD SECUNDÁRIO 2: LIBERADOS / MOBILIZADOS */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Mobilizados para Obra
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">
                {metrics.countMobilizados}
              </span>
              <span className="text-xs text-emerald-600 font-bold">
                ({metrics.pctMobilizados}%)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Itens já liberados via RTD de Saída
            </p>
          </div>
          <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl">
            <Truck className="w-7 h-7" />
          </div>
        </div>

        {/* CARD SECUNDÁRIO 3: ÍNDICE DE DISPONIBILIDADE */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Índice de Disponibilidade
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">
                {metrics.indiceDisponibilidade.toFixed(1)}%
              </span>
            </div>
            <div className="mt-1">
              <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${metrics.statusBadgeClass}`}>
                Status: {metrics.statusDispLabel}
              </span>
            </div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <ShieldCheck className="w-7 h-7" />
          </div>
        </div>

      </div>

      {/* SEÇÃO DE GRÁFICOS (COMPLEX GRID) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* GRÁFICO 1: DISTRIBUIÇÃO DE STATUS (DONUT CHART) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-indigo-600" />
                  Distribuição de Status dos Equipamentos
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Proporção geral da frota por situação operacional
                </p>
              </div>
            </div>

            <div className="h-64 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(val: number) => [`${val} item(ns)`, 'Quantidade']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Texto central dentro do Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-slate-900">{metrics.total}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Itens</span>
              </div>
            </div>
          </div>

          {/* Legenda do Gráfico de Rosca */}
          <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-100 mt-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-slate-600 truncate">
                Disponíveis: <strong>{metrics.countDisponiveis}</strong> ({metrics.pctDisponiveis}%)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
              <span className="text-slate-600 truncate">
                Em Inspeção: <strong>{metrics.countEmInspecao}</strong> ({metrics.pctEmInspecao}%)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
              <span className="text-slate-600 truncate">
                Pendentes: <strong>{metrics.countReprovados}</strong> ({metrics.pctReprovados}%)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
              <span className="text-slate-600 truncate">
                Mobilizados: <strong>{metrics.countMobilizados}</strong> ({metrics.pctMobilizados}%)
              </span>
            </div>
          </div>
        </div>

        {/* GRÁFICO 2: SEMI-CÍRCULO ÍNDICE DE DISPONIBILIDADE (GAUGE) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  Índice de Disponibilidade Operacional
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Taxa de equipamentos prontos vs. retidos na oficina
                </p>
              </div>
            </div>

            <div className="h-56 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gaugeChartData}
                    cx="50%"
                    cy="70%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={75}
                    outerRadius={105}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {gaugeChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: number) => [`${val.toFixed(1)}%`, 'Proporção']} />
                </PieChart>
              </ResponsiveContainer>

              {/* Texto central no semi-círculo */}
              <div className="absolute top-[52%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <span className="text-4xl font-black text-slate-900 block tracking-tight">
                  {metrics.indiceDisponibilidade.toFixed(1)}%
                </span>
                <span className={`inline-block mt-1 text-[11px] font-bold px-3 py-0.5 rounded-full border ${metrics.statusBadgeClass}`}>
                  {metrics.statusDispLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 text-xs space-y-1 text-slate-600 mt-2">
            <div className="flex justify-between items-center font-medium">
              <span>Escala de Saúde Operacional:</span>
              <span className="font-bold">Metas do SGI</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-emerald-700 font-bold">&gt; 86%: Saudável</span>
              <span className="text-amber-700 font-bold">61 - 85%: Atenção</span>
              <span className="text-rose-700 font-bold">&lt; 60%: Crítico</span>
            </div>
          </div>
        </div>

        {/* GRÁFICO 3: TEMPO MÉDIO POR OFICINA (BARCHART HORIZONTAL + TABELA) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-indigo-600" />
              Tempo Médio por Oficina (Dias)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Permanência média agrupada pela oficina de destino (Eletrônica, Mecânica, 112Y)
            </p>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={metrics.tempoPorOficina}
                margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis type="number" unit="d" />
                <YAxis type="category" dataKey="oficina" width={90} tick={{ fontSize: 12, fontWeight: 600 }} />
                <Tooltip 
                  formatter={(value: number) => [`${value} dias`, 'Tempo Médio']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="diasMedios" fill="#6366f1" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela de Apoio do Tempo por Oficina */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-2">Oficina</th>
                  <th className="px-3.5 py-2 text-center">Dias Médios</th>
                  <th className="px-3.5 py-2 text-right">Qtd. Processada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.tempoPorOficina.map((item) => (
                  <tr key={item.oficina} className="hover:bg-slate-50/50">
                    <td className="px-3.5 py-2 font-bold text-slate-900">{item.oficina}</td>
                    <td className="px-3.5 py-2 text-center">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded">
                        {item.diasMedios}d
                      </span>
                    </td>
                    <td className="px-3.5 py-2 text-right font-medium text-slate-600">
                      {item.qtd} item(ns)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* GRÁFICO 4: TOP EQUIPAMENTOS PENDENTES / EM INSPEÇÃO */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-rose-600" />
              Top Equipamentos Retidos (Pendentes/Em Inspeção)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tipos de equipamentos com maior quantidade acumulada na oficina
            </p>

            <div className="h-64 w-full mt-2">
              {metrics.topEquipamentos.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Nenhum equipamento retido no momento.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={metrics.topEquipamentos}
                    margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
                  >
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis 
                      type="category" 
                      dataKey="nome" 
                      width={120} 
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#334155' }} 
                    />
                    <Tooltip 
                      formatter={(val: number) => [`${val} unidade(s)`, 'Quantidade']}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="qtd" fill="#f43f5e" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center">
            Mapeamento gerado a partir da extração limpa das descrições das RTDs
          </p>
        </div>

        {/* GRÁFICO 5: EQUIPAMENTOS MOBILIZADOS POR OBRA (DRILL-DOWN INTERATIVO) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4 col-span-1 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600" />
                Equipamentos Mobilizados por Obra (Clique na barra para detalhar)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Distribuição de itens alocados por depósito/obra destino — Clique em qualquer barra para abrir o Drill-down
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-200 self-start sm:self-auto shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
              Drill-down Ativo
            </span>
          </div>

          <div className="h-72 w-full mt-2">
            {metrics.dadosObras.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum equipamento mobilizado para obra registrado até o momento.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={metrics.dadosObras}
                  margin={{ top: 10, right: 30, left: 60, bottom: 5 }}
                >
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis 
                    type="category" 
                    dataKey="obra" 
                    width={200} 
                    tickFormatter={(value) => value.length > 25 ? value.substring(0, 25) + '...' : value}
                    tick={{ fontSize: 11, fontWeight: 600, fill: '#334155' }} 
                  />
                  <Tooltip 
                    formatter={(val: number) => [`${val} equipamento(s)`, 'Quantidade Total']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  />
                  <Bar 
                    dataKey="quantidade" 
                    fill="#3b82f6" 
                    radius={[0, 8, 8, 0]} 
                    cursor="pointer"
                    onClick={(data: any) => {
                      if (data && data.obra) {
                        setObraSelecionada(data.obra);
                        setSearchTermObra('');
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <p className="text-[11px] text-slate-400 text-center italic">
            💡 Dica: Ao clicar em uma das barras azuis acima, um modal gerencial exclusivo daquela Obra será exibido.
          </p>
        </div>

      </div>

      {/* SESSÃO: ANÁLISE AUTOMÁTICA DEDUZIDA */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
          <h3 className="text-base font-bold text-slate-900">
            Análise Operacional Automática
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          
          {/* FRASE 1: REPROVADOS */}
          {metrics.countReprovados > 0 ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-900">
                <strong>Alerta de Reprovação:</strong> Existem <span className="font-bold text-rose-700 underline">{metrics.countReprovados}</span> equipamento(s) reprovado(s) na inspeção aguardando destinação ou manutenção corretiva.
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900">
                <strong>Sem Reprovações:</strong> Nenhum equipamento reprovado no fluxo atual de inspeção.
              </div>
            </div>
          )}

          {/* FRASE 2: DISPONÍVEIS */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900">
              <strong>Prontos para Mobilização:</strong> Existem <span className="font-bold text-emerald-700 underline">{metrics.countDisponiveis}</span> equipamento(s) totalmente disponível(is) para retorno à operação.
            </div>
          </div>

          {/* FRASE 3: TEMPO MÉDIO GERAL */}
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start gap-3">
            <Clock className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-900">
              <strong>Tempo Médio Geral:</strong> Os equipamentos permanecem em média <span className="font-bold text-indigo-700">{metrics.tempoMedioGeral} dia(s)</span> na oficina.
            </div>
          </div>

          {/* FRASE 4: OFICINA MAIS LENTA */}
          {metrics.oficinaMaisLenta ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <Wrench className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900">
                <strong>Gargalo Identificado:</strong> A oficina <span className="font-bold text-amber-800">{metrics.oficinaMaisLenta.oficina}</span> apresenta o maior tempo médio de permanência (<span className="font-bold">{metrics.oficinaMaisLenta.diasMedios}d</span> com {metrics.oficinaMaisLenta.qtd} item(ns)).
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
              <Activity className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700">
                <strong>Distribuição Homogênea:</strong> O fluxo de trabalho entre oficinas permanece equilibrado.
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL DE DRILL-DOWN / DETALHAMENTO DA OBRA */}
      {obraSelecionada && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header do Modal */}
            <div className="p-5 border-b border-slate-200/80 bg-slate-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 break-words whitespace-normal">
                    Gestão de Equipamentos - Obra: <span className="text-indigo-600">{obraSelecionada}</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Listagem dos equipamentos atualmente mobilizados para esta destinação
                  </p>
                </div>
              </div>
              <button
                onClick={() => setObraSelecionada(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Barra de Busca e Filtro Interno */}
            <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTermObra}
                  onChange={(e) => setSearchTermObra(e.target.value)}
                  placeholder="Buscar por TAG, ST, NM ou Descrição..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                />
              </div>
              <div className="text-xs font-semibold text-slate-500 self-end sm:self-center">
                Total Mobilizado na Obra: <span className="text-slate-900 font-bold">{totalItemsObra} item(ns)</span>
              </div>
            </div>

            {/* Tabela de Equipamentos da Obra */}
            <div className="p-4 overflow-y-auto flex-grow space-y-3">
              {itemsObraSelecionada.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Nenhum equipamento encontrado para esta busca na obra "{obraSelecionada}".
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left text-slate-700">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-3.5 py-2.5">TAG</th>
                        <th className="px-3.5 py-2.5">NM / ST</th>
                        <th className="px-3.5 py-2.5">Descrição</th>
                        <th className="px-3.5 py-2.5">Oficina Origem</th>
                        <th className="px-3.5 py-2.5 text-center">Data Mobilização</th>
                        <th className="px-3.5 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {itemsObraSelecionada.map((item) => {
                        const dataMob = item.data_saida_oficial || item.data_inspecao || item.data_entrada_oficina;
                        const dataFormatada = dataMob 
                          ? new Date(dataMob).toLocaleDateString('pt-BR') 
                          : '-';

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-3.5 py-2.5 font-bold text-slate-900">
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-mono border border-indigo-100">
                                {item.tag}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 space-y-0.5">
                              <div className="font-semibold text-slate-800">NM: {item.nm || 'N/A'}</div>
                              <div className="text-[10px] text-slate-400">ST: {item.st || '-'}</div>
                            </td>
                            <td className="px-3.5 py-2.5 max-w-xs truncate text-slate-700" title={item.descricao}>
                              {item.descricao || 'EQUIPAMENTO S/ DESCRIÇÃO'}
                            </td>
                            <td className="px-3.5 py-2.5">
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {item.oficina_destino || 'Eletrônica'}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 text-center font-mono text-slate-600">
                              {dataFormatada}
                            </td>
                            <td className="px-3.5 py-2.5 text-right">
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                {item.status || 'Mobilizado para Obra'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="p-4 border-t border-slate-200/80 bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                Mostrando <strong>{itemsObraSelecionada.length}</strong> de <strong>{totalItemsObra}</strong> equipamentos mobilizados
              </span>
              <button
                onClick={() => setObraSelecionada(null)}
                className="px-4 py-2 bg-slate-800 text-white font-bold text-xs rounded-xl hover:bg-slate-900 transition-colors"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
