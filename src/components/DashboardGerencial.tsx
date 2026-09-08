import React, { useState, useMemo, useRef } from 'react';
import { 
  TrendingUp, 
  Clock, 
  ClipboardList, 
  Users, 
  Filter, 
  BarChart3, 
  AlertCircle,
  Package,
  CheckCircle2,
  Calendar,
  FileDown
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
  Legend, 
  LineChart, 
  Line,
  AreaChart,
  Area
} from 'recharts';
import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Requisition } from './RequisicoesPanel';

interface DashboardGerencialProps {
  requisitions: Requisition[];
}

// Color Palette following the system's professional executive theme (purple, slate, amber, emerald)
const COLORS_CENTRO_CUSTO = [
  '#3a2573', // Deep purple
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#64748b'  // Slate
];

const COLORS_TIPO_RM = {
  'Estoque': '#3a2573',
  'CC99': '#ef4444',
  'Pré-cotação': '#f59e0b',
  'Outros': '#64748b'
};

export const DashboardGerencial: React.FC<DashboardGerencialProps> = ({ requisitions }) => {
  const [dateFilter, setDateFilter] = useState<'7d' | '30d' | 'month' | 'all'>('30d');
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    const element = document.getElementById('dashboard-export-area');
    if (!element) return;
    setIsExporting(true);
    try {
      const canvas = await toCanvas(element, {
        pixelRatio: 2, // 2x resolution for crisp graphics
        backgroundColor: '#ffffff', // Clean white background for the PDF print
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
      
      pdf.save('Dashboard_Gerencial_Almoxarifado.pdf');
    } catch (err) {
      console.error('Erro ao gerar relatório em PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Parse a date string into a Date object safely
  const parseRequisitionDate = (r: Requisition): Date | null => {
    if (r.createdTimestamp) {
      const d = new Date(r.createdTimestamp);
      if (!isNaN(d.getTime())) return d;
    }
    if (r.dataSolicitacao) {
      const parts = r.dataSolicitacao.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          if (year < 100) year += 2000;
          const d = new Date(year, month, day);
          if (!isNaN(d.getTime())) return d;
        }
      }
    }
    return null;
  };

  // Filter requisitions based on global date filter
  const filteredRequisitions = useMemo(() => {
    const now = new Date();
    // Normalize to start of today for clean comparison
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    return requisitions.filter(r => {
      const rDate = parseRequisitionDate(r);
      if (!rDate) return false;

      if (dateFilter === '7d') {
        const sevenDaysAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
        return rDate >= sevenDaysAgo;
      } else if (dateFilter === '30d') {
        const thirtyDaysAgo = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);
        return rDate >= thirtyDaysAgo;
      } else if (dateFilter === 'month') {
        return rDate.getMonth() === now.getMonth() && rDate.getFullYear() === now.getFullYear();
      }
      return true; // 'all'
    });
  }, [requisitions, dateFilter]);

  // TOP KPIs calculation
  const kpis = useMemo(() => {
    // 1. Total RMs Ativas (any active items/documents with status === 'Pendente' or group status Pending)
    const activeItems = filteredRequisitions.filter(r => r.status === 'Pendente');
    const uniqueActiveRMs = new Set(activeItems.map(r => r.rmNumber));

    // 2. Lead Time Médio Geral:
    // Average days between dataSolicitacao and concluidoTimestamp (or now, if pending)
    let totalLeadTimeDays = 0;
    let itemsWithLeadTime = 0;
    const now = new Date();

    filteredRequisitions.forEach(r => {
      const startDate = parseRequisitionDate(r);
      if (!startDate) return;

      let endDate = now;
      if (r.status === 'Concluida' && r.concluidoTimestamp) {
        const conclDate = new Date(r.concluidoTimestamp);
        if (!isNaN(conclDate.getTime())) {
          endDate = conclDate;
        }
      }

      const diffMs = endDate.getTime() - startDate.getTime();
      // Ensure positive diff
      const diffDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
      totalLeadTimeDays += diffDays;
      itemsWithLeadTime++;
    });

    const avgLeadTimeDays = itemsWithLeadTime > 0 ? (totalLeadTimeDays / itemsWithLeadTime) : 0;

    // Helper KPIs
    const totalItems = filteredRequisitions.length;
    const uniqueTotalRMs = new Set(filteredRequisitions.map(r => r.rmNumber)).size;

    // Calculate percentage of inventory reuse (reaproveitamento)
    let totalReaproveitados = 0;
    filteredRequisitions.forEach(r => {
      if (r.reaproveitamento && r.reaproveitamento > 0) {
        totalReaproveitados += r.reaproveitamento;
      }
    });

    return {
      activeRMsCount: uniqueActiveRMs.size,
      activeItemsCount: activeItems.length,
      avgLeadTime: avgLeadTimeDays.toFixed(1),
      totalItems,
      uniqueTotalRMs,
      totalReaproveitados
    };
  }, [filteredRequisitions]);

  // Chart 1: RMs by Centro de Custo
  const centroCustoData = useMemo(() => {
    const counts: { [key: string]: number } = {};
    filteredRequisitions.forEach(r => {
      const cc = r.centroCusto?.trim() || 'Não Informado';
      counts[cc] = (counts[cc] || 0) + 1;
    });

    const sorted = Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Limit to top 5 and group the rest into 'Outros'
    if (sorted.length > 5) {
      const top5 = sorted.slice(0, 5);
      const othersValue = sorted.slice(5).reduce((acc, curr) => acc + curr.value, 0);
      top5.push({ name: 'Outros CCs', value: othersValue });
      return top5;
    }

    return sorted;
  }, [filteredRequisitions]);

  // Chart 2: Top Solicitantes (ranking)
  const topSolicitantesData = useMemo(() => {
    const counts: { [key: string]: number } = {};
    filteredRequisitions.forEach(r => {
      const sol = r.solicitante?.trim() || 'Desconhecido';
      counts[sol] = (counts[sol] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // top 5
  }, [filteredRequisitions]);

  // Chart 3: Volume por Tipo de Item/RM (tipoRM)
  const tipoRMData = useMemo(() => {
    const counts = {
      'Estoque': 0,
      'CC99': 0,
      'Pré-cotação': 0,
      'Outros': 0
    };

    filteredRequisitions.forEach(r => {
      const rawTipo = String(r.tipoRM || '').toLowerCase();
      if (rawTipo.includes('estoque')) {
        counts['Estoque']++;
      } else if (rawTipo.includes('cc99')) {
        counts['CC99']++;
      } else if (rawTipo === 'precotacao' || rawTipo === 'pre-cotação' || r.id.startsWith('approvo-precotacao-') || !r.tipoRM) {
        counts['Pré-cotação']++;
      } else {
        counts['Outros']++;
      }
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  }, [filteredRequisitions]);

  // Chart 4: Análise de Lead Time (Semanas)
  const leadTimeOverTimeData = useMemo(() => {
    // Group items by week of request date
    const groups: { [key: string]: { totalDays: number; count: number; orderDate: Date } } = {};

    filteredRequisitions.forEach(r => {
      const startDate = parseRequisitionDate(r);
      if (!startDate) return;

      // Week identifier: Start date of that week (Monday)
      const d = new Date(startDate);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setDate(diff));
      const weekLabel = `${monday.getDate().toString().padStart(2, '0')}/${(monday.getMonth() + 1).toString().padStart(2, '0')}`;

      let endDate = new Date();
      if (r.status === 'Concluida' && r.concluidoTimestamp) {
        const conclDate = new Date(r.concluidoTimestamp);
        if (!isNaN(conclDate.getTime())) {
          endDate = conclDate;
        }
      }

      const diffMs = endDate.getTime() - startDate.getTime();
      const diffDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));

      if (!groups[weekLabel]) {
        groups[weekLabel] = { totalDays: 0, count: 0, orderDate: monday };
      }
      groups[weekLabel].totalDays += diffDays;
      groups[weekLabel].count++;
    });

    return Object.entries(groups)
      .map(([week, info]) => ({
        week,
        avgDays: parseFloat((info.totalDays / info.count).toFixed(1)),
        count: info.count,
        orderDate: info.orderDate
      }))
      .sort((a, b) => a.orderDate.getTime() - b.orderDate.getTime())
      .slice(-6); // Last 6 weeks for clean display
  }, [filteredRequisitions]);

  return (
    <div className="space-y-6 font-sans">
      
      {/* Executive Header & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-base font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <span className="w-3 h-3 bg-indigo-600 rounded-full animate-ping"></span>
            📊 Painel Executivo e Métricas Analíticas
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
            Métricas de desempenho, lead times e análises volumétricas das Requisições de Materiais SGI
          </p>
        </div>

        {/* Global Date Filter Controls and PDF Export Button */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Export PDF Button */}
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className={`flex items-center gap-2 px-4 py-2.5 text-[10px] uppercase font-black tracking-wider rounded-2xl transition-all shadow-xs border cursor-pointer ${
              isExporting
                ? 'bg-slate-100 text-slate-400 border-slate-200 animate-pulse'
                : 'bg-white hover:bg-slate-50 text-[#3a2573] border-purple-200 hover:border-purple-300'
            }`}
          >
            <FileDown className="w-4 h-4 text-purple-700" />
            {isExporting ? 'Gerando...' : 'Exportar PDF'}
          </button>

          {/* Date Filter Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <span className="text-[9px] uppercase font-bold text-slate-500 px-2 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" /> Filtro:
            </span>
            {[
              { id: '7d', label: 'Últimos 7 dias' },
              { id: '30d', label: 'Últimos 30 dias' },
              { id: 'month', label: 'Este Mês' },
              { id: 'all', label: 'Histórico Total' }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setDateFilter(opt.id as any)}
                className={`px-3 py-1.5 text-[9px] uppercase font-extrabold rounded-xl transition-all cursor-pointer ${
                  dateFilter === opt.id
                    ? 'bg-purple-900 text-white shadow-3xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Capture Area for PDF Export */}
      <div id="dashboard-export-area" className="space-y-6 bg-white p-2 rounded-2xl">

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* KPI 1: Active RMs */}
          <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-3xl p-5 shadow-[0_4px_20px_rgba(99,102,241,0.04)] flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-extrabold tracking-wider text-indigo-500 block">Total de RMs Ativas</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black font-mono text-indigo-950">{kpis.activeRMsCount}</span>
                <span className="text-[10px] font-bold text-slate-400">RMs</span>
              </div>
              <span className="text-[9.5px] font-semibold text-slate-500 block">
                Contendo <strong className="text-indigo-700 font-bold">{kpis.activeItemsCount}</strong> itens pendentes
              </span>
            </div>
            <div className="p-4 bg-indigo-500/10 text-indigo-600 rounded-2xl border border-indigo-100">
              <ClipboardList className="w-6 h-6" />
            </div>
          </div>

          {/* KPI 2: Avg Lead Time */}
          <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-100 rounded-3xl p-5 shadow-[0_4px_20px_rgba(245,158,11,0.04)] flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-extrabold tracking-wider text-amber-600 block">Lead Time Médio Geral</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black font-mono text-amber-950">{kpis.avgLeadTime}</span>
                <span className="text-[10px] font-bold text-slate-400">dias</span>
              </div>
              <span className="text-[9.5px] font-semibold text-slate-500 block">
                Média de ciclo de atendimento
              </span>
            </div>
            <div className="p-4 bg-amber-500/10 text-amber-600 rounded-2xl border border-amber-100">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          {/* KPI 3: Volume de Itens Analisados */}
          <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-100 rounded-3xl p-5 shadow-[0_4px_20px_rgba(168,85,247,0.04)] flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-extrabold tracking-wider text-purple-600 block">Itens Processados</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black font-mono text-purple-950">{kpis.totalItems}</span>
                <span className="text-[10px] font-bold text-slate-400">itens</span>
              </div>
              <span className="text-[9.5px] font-semibold text-slate-500 block">
                Distribuídos em <strong className="text-purple-700 font-bold">{kpis.uniqueTotalRMs}</strong> RMs
              </span>
            </div>
            <div className="p-4 bg-purple-500/10 text-purple-600 rounded-2xl border border-purple-100">
              <Package className="w-6 h-6" />
            </div>
          </div>

          {/* KPI 4: Reaproveitamento Consolidado */}
          <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-3xl p-5 shadow-[0_4px_20px_rgba(16,185,129,0.04)] flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-extrabold tracking-wider text-emerald-600 block">Estoque Reaproveitado</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black font-mono text-emerald-950">{kpis.totalReaproveitados}</span>
                <span className="text-[10px] font-bold text-slate-400">unid</span>
              </div>
              <span className="text-[9.5px] font-semibold text-slate-500 block uppercase">
                solicitações atendidas via sistema de REAPROVEITAMENTO
              </span>
            </div>
            <div className="p-4 bg-emerald-500/10 text-emerald-600 rounded-2xl border border-emerald-100">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

        </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Chart 1: RMs por Centro de Custo */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-3xs flex flex-col justify-between min-h-[350px]">
          <div>
            <h4 className="text-[11px] font-black uppercase text-[#3a2573] tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              📌 Volumetria por Centro de Custo
            </h4>
            <p className="text-[9.5px] text-slate-400 font-bold uppercase mt-1 mb-4">
              Distribuição de requisições por centro de custo (Top 5 + Outros)
            </p>
          </div>
          <div className="h-60 w-full flex items-center justify-center">
            {centroCustoData.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">Sem dados suficientes no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={centroCustoData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {centroCustoData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS_CENTRO_CUSTO[index % COLORS_CENTRO_CUSTO.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', fontSize: '11px', fontFamily: 'sans-serif' }}
                    formatter={(value) => [`${value} itens`, 'Volume']}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Top Solicitantes */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-3xs flex flex-col justify-between min-h-[350px]">
          <div>
            <h4 className="text-[11px] font-black uppercase text-[#3a2573] tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              🏆 Top 5 Solicitantes Ativos
            </h4>
            <p className="text-[9.5px] text-slate-400 font-bold uppercase mt-1 mb-4">
              Inscritos que mais solicitaram RMs no sistema
            </p>
          </div>
          <div className="h-60 w-full">
            {topSolicitantesData.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">Sem dados suficientes no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topSolicitantesData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={9} />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={9} width={90} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', fontSize: '11px' }}
                    formatter={(value) => [`${value} itens`, 'Total Requisitado']}
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={16}>
                    {topSolicitantesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#3a2573' : '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3: Volume por Tipo de Item/RM */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-3xs flex flex-col justify-between min-h-[350px]">
          <div>
            <h4 className="text-[11px] font-black uppercase text-[#3a2573] tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              🏷️ Volume por Tipo de Requisição (RM)
            </h4>
            <p className="text-[9.5px] text-slate-400 font-bold uppercase mt-1 mb-4">
              Agrupamento conforme tipo cadastrado (Estoque, CC99, Pré-Cotação)
            </p>
          </div>
          <div className="h-60 w-full">
            {tipoRMData.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">Sem dados suficientes no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={tipoRMData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={9} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', fontSize: '11px' }}
                    formatter={(value) => [`${value} itens`, 'Volume']}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={28}>
                    {tipoRMData.map((entry, index) => {
                      const color = COLORS_TIPO_RM[entry.name as keyof typeof COLORS_TIPO_RM] || '#64748b';
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 4: Análise de Lead Time */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-3xs flex flex-col justify-between min-h-[350px]">
          <div>
            <h4 className="text-[11px] font-black uppercase text-[#3a2573] tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              📈 Histórico de Tempo de Resposta (Lead Time)
            </h4>
            <p className="text-[9.5px] text-slate-400 font-bold uppercase mt-1 mb-4">
              Evolução da média de dias que as RMs levaram para sair do painel (por semana)
            </p>
          </div>
          <div className="h-60 w-full">
            {leadTimeOverTimeData.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">Sem dados suficientes no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={leadTimeOverTimeData}
                  margin={{ top: 10, right: 20, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorAvgDays" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="week" stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={9} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', fontSize: '11px' }}
                    formatter={(value) => [`${value} dias`, 'Lead Time Médio']}
                  />
                  <Area type="monotone" dataKey="avgDays" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAvgDays)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Footer / Nota do Dashboard */}
      <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 flex items-center gap-3 text-slate-500 font-sans">
        <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0" />
        <p className="text-[10px] leading-relaxed">
          <strong>Aviso de Atualização:</strong> As informações contidas neste painel de Business Intelligence são derivadas diretamente do Firestore e sincronizadas via Robô Python de forma 100% autônoma. O ciclo de atualização dos dados reflete as movimentações efetuadas pelos operadores na triagem e no atendimento de materiais.
        </p>
      </div>

      </div> {/* Close capture area for PDF export */}

    </div>
  );
};
