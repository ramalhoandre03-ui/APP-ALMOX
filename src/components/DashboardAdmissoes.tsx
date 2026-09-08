import React, { useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
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
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  Shirt, 
  Building2, 
  TrendingUp, 
  ClipboardList, 
  Flame, 
  Package,
  Activity
} from 'lucide-react';

interface AdmissionRecord {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  obra: string;
  data_agendamento: string;
  data_previsao?: string;
  tamanhos?: {
    camisa: string;
    calca: string;
    bota: string;
  };
  tamanho_camisa?: string;
  tamanho_calca?: string;
  tamanho_bota?: string;
  especificacoes?: {
    cor_tecido?: string;
    arco_eletrico?: string;
    tipo_calca?: string;
    tipo_bota?: string;
  };
  tipo_requisicao?: string;
  status: string;
}

interface DashboardAdmissoesProps {
  admissions: AdmissionRecord[];
  loading?: boolean;
  isTVMode?: boolean;
}

// Fixed sizes lists
const SIZES_CAMISA = ["2", "3", "4", "5", "6", "7", "8", "9"];
const SIZES_CALCA = ["36", "38", "40", "42", "44", "46", "48", "50", "52", "54", "56", "60"];
const SIZES_BOTA = ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"];

export const DashboardAdmissoes: React.FC<DashboardAdmissoesProps> = ({ admissions, loading = false, isTVMode = false }) => {
  const baseDateStr = '2026-07-18';
  const baseDate = useMemo(() => new Date(baseDateStr), []);

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

  // Safe date parser helper
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

  // Helper size extractors
  const getCamisaSize = (item: AdmissionRecord) => {
    return (item.tamanhos?.camisa || item.tamanho_camisa || "").trim();
  };
  const getCalcaSize = (item: AdmissionRecord) => {
    return (item.tamanhos?.calca || item.tamanho_calca || "").trim();
  };
  const getBotaSize = (item: AdmissionRecord) => {
    return (item.tamanhos?.bota || item.tamanho_bota || "").trim();
  };

  // 1. KPIs Superiores (Funil de Operação em Tempo Real)
  const kpis = useMemo(() => {
    let rmsAprovacao = 0;
    let emSeparacao = 0;
    let fardamentosAtrasados = 0;
    let programadosHojeFuturo = 0;
    let jaFardados = 0;

    const today = new Date();
    const todayClean = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    admissions.forEach(item => {
      const statusUpper = String(item.status || "").trim().toUpperCase();
      const schedDateStr = item.data_previsao || item.data_agendamento;
      const itemDate = parseDateToObj(schedDateStr);

      // Check status-based categories
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

      // Process dates for Prazos / Schedules (excluding successfully delivered workers for delay/future counters)
      // Fardamentos Atrasados: Validar a data_previsao contra a data atual (new Date())
      if (itemDate) {
        const itemDateClean = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());

        if (itemDateClean < todayClean) {
          if (!isDelivered && statusUpper !== 'CONCLUIDO COM RESSALVA - DESISTENTE') {
            fardamentosAtrasados++;
          }
        } else {
          programadosHojeFuturo++;
        }
      } else {
        // If no scheduled date, default to programmed as future buffer if not completed
        if (!isDelivered) {
          programadosHojeFuturo++;
        }
      }
    });

    return {
      rmsAprovacao,
      emSeparacao,
      fardamentosAtrasados,
      programadosHojeFuturo,
      jaFardados
    };
  }, [admissions]);

  // 2. Gráficos de Trocas por Centro de Custo (Visão Secundária)
  const trocasPorCC = useMemo(() => {
    const groups: { [key: string]: number } = {};
    admissions.forEach(item => {
      const isTroca = String(item.tipo_requisicao || "").trim().toUpperCase() === 'TROCA' || 
                      String(item.status || "").trim().toUpperCase().includes('TROCA');
      if (isTroca) {
        const cc = (item.obra || (item as any).especificacoes?.email_tecnico || (item as any).email_tecnico || "Setor Não Especificado").trim();
        groups[cc] = (groups[cc] || 0) + 1;
      }
    });

    return Object.keys(groups)
      .map(cc => ({
        centroCusto: cc,
        quantidade: groups[cc]
      }))
      .sort((a, b) => b.quantidade - a.quantidade);
  }, [admissions]);

  // 3. Gráficos de Taxa de Atendimento (%) por Grade de Tamanho (Fill Rate)
  const calculateFillRate = (extractor: (item: AdmissionRecord) => string, sizesList: string[]) => {
    return sizesList.map(size => {
      const matching = admissions.filter(item => extractor(item) === size);
      const solicitados = matching.length;
      
      const entregues = matching.filter(item => {
        const statusUpper = String(item.status || "").trim().toUpperCase();
        return ['FARDADO', 'CONCLUIDO', 'CONCLUÍDO', 'FINALIZADO'].includes(statusUpper);
      }).length;

      // Handle Division by zero & Rounding
      const taxa = solicitados > 0 ? Math.round((entregues / solicitados) * 100) : 0;

      return {
        tamanho: size,
        solicitados,
        entregues,
        taxa,
        hasRequests: solicitados > 0
      };
    });
  };

  const fillRateCamisas = useMemo(() => calculateFillRate(getCamisaSize, SIZES_CAMISA), [admissions]);
  const fillRateCalcas = useMemo(() => calculateFillRate(getCalcaSize, SIZES_CALCA), [admissions]);
  const fillRateBotas = useMemo(() => calculateFillRate(getBotaSize, SIZES_BOTA), [admissions]);

  // Dynamic Custom Tooltip for Fill Rate Charts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-xl text-xs font-sans">
          <p className="text-white font-black uppercase text-[10px] tracking-wider mb-1.5">Tamanho: {data.tamanho}</p>
          <div className="space-y-1 text-slate-300">
            <p className="flex justify-between gap-4">
              <span>Solicitados:</span> 
              <span className="font-extrabold text-white font-mono">{data.solicitados} un</span>
            </p>
            <p className="flex justify-between gap-4">
              <span>Entregues:</span> 
              <span className="font-extrabold text-emerald-400 font-mono">{data.entregues} un</span>
            </p>
            <div className="border-t border-slate-800 pt-1.5 mt-1.5 flex justify-between gap-4">
              <span className="font-bold">Taxa Atendimento:</span> 
              <span className={`font-mono font-black ${data.taxa < 70 ? 'text-rose-500' : 'text-emerald-400'}`}>
                {data.taxa}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div 
      className={`${
        isTVMode 
          ? 'w-full h-full max-h-screen px-6 md:px-8 py-3 bg-slate-950 text-white flex flex-col justify-between overflow-hidden gap-3 md:gap-4' 
          : 'space-y-8 animate-fadeIn'
      }`} 
      id={isTVMode ? "active-tv-mode-flag" : "dashboard-admissoes-panel"}
    >
      {/* TV Mode Header */}
      {isTVMode && (
        <div className="text-center pt-0 shrink-0">
          <span className="text-violet-400 text-2xs md:text-xs font-black tracking-widest uppercase font-mono bg-violet-950/80 border border-violet-800/80 px-3 py-1 rounded-full shadow-[0_0_16px_rgba(139,92,246,0.25)]">
            COCKPIT GERENCIAL • TEMPO REAL
          </span>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase mt-1">
            Admissões & Fardamentos
          </h2>
        </div>
      )}

      {/* Dashboard Sub Header (Standard Mode) */}
      {!isTVMode && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-lg">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-violet-400 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-violet-400 font-mono">Cockpit Gerencial de Planejamento</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight mt-1 font-display">Admissões & Fardamentos</h2>
            <p className="text-slate-400 text-xs mt-1 max-w-2xl">
              Análise em tempo real do nível de serviço de fardamentos, gargalos operacionais no funil de admissão e rupturas de grade de estoque.
            </p>
          </div>
          <div className="flex items-center gap-2.5 bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 self-start md:self-auto font-mono text-xs">
            <Calendar className="w-4 h-4 text-violet-400" />
            <span className="text-slate-400">Data Base:</span>
            <span className="font-extrabold text-white">18/07/2026</span>
          </div>
        </div>
      )}

      {/* 1. KPIs Superiores (Funil de Operação) */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 ${isTVMode ? 'gap-3 md:gap-4 shrink-0' : 'gap-4'}`}>
        {/* KPI: RMs para Aprovação */}
        <div className={`${isTVMode ? 'bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 md:p-4 shadow-2xl' : 'bg-white border border-slate-200 rounded-2xl p-4 shadow-xs'} flex flex-col justify-between hover:border-slate-700 transition-colors`}>
          <div className="flex items-center justify-between">
            <span className={`${isTVMode ? 'text-2xs text-slate-400 font-bold' : 'text-[9px] text-slate-400'} font-black uppercase tracking-wider font-mono`}>RMs p/ Aprovação</span>
            <div className={`p-2 rounded-xl ${isTVMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
              <ClipboardList className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
          <div className={`${isTVMode ? 'mt-2' : 'mt-4'}`}>
            <span className={`${isTVMode ? 'text-3xl md:text-4xl lg:text-5xl text-white' : 'text-3xl text-slate-900'} font-black font-mono tracking-tight block`}>
              {kpis.rmsAprovacao}
            </span>
            <span className={`${isTVMode ? 'text-2xs text-slate-400' : 'text-[9px] text-slate-400'} mt-0.5 font-bold block uppercase font-sans`}>Aguardando Liberação</span>
          </div>
        </div>

        {/* KPI: Em Separação */}
        <div className={`${isTVMode ? 'bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 md:p-4 shadow-2xl' : 'bg-white border border-slate-200 rounded-2xl p-4 shadow-xs'} flex flex-col justify-between hover:border-slate-700 transition-colors`}>
          <div className="flex items-center justify-between">
            <span className={`${isTVMode ? 'text-2xs text-slate-400 font-bold' : 'text-[9px] text-slate-400'} font-black uppercase tracking-wider font-mono`}>Em Separação</span>
            <div className={`p-2 rounded-xl ${isTVMode ? 'bg-indigo-950/80 text-indigo-400 border border-indigo-800/80' : 'bg-indigo-50 text-indigo-600'}`}>
              <Package className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
          <div className={`${isTVMode ? 'mt-2' : 'mt-4'}`}>
            <span className={`${isTVMode ? 'text-3xl md:text-4xl lg:text-5xl text-indigo-400' : 'text-3xl text-slate-900'} font-black font-mono tracking-tight block`}>
              {kpis.emSeparacao}
            </span>
            <span className={`${isTVMode ? 'text-2xs text-slate-400' : 'text-[9px] text-slate-400'} mt-0.5 font-bold block uppercase font-sans`}>No Almoxarifado</span>
          </div>
        </div>

        {/* KPI: Fardamentos Atrasados (ALERT) */}
        <div className={`${isTVMode ? 'bg-rose-950/40 border-2 border-rose-900/80 rounded-2xl p-3.5 md:p-4 shadow-2xl' : 'bg-white border-2 border-rose-100 bg-rose-50/20 rounded-2xl p-4 shadow-xs'} flex flex-col justify-between transition-colors`}>
          <div className="flex items-center justify-between">
            <span className={`${isTVMode ? 'text-2xs text-rose-400 font-bold max-w-[180px]' : 'text-[9px] text-rose-500 tracking-wider'} font-black uppercase font-mono block`} title="Colaboradores que não vieram buscar fardamento">
              Colaboradores sem retirada
            </span>
            <div className="p-2 bg-rose-500 text-white rounded-xl animate-pulse shrink-0">
              <AlertTriangle className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
          <div className={`${isTVMode ? 'mt-2' : 'mt-4'}`}>
            <span className={`${isTVMode ? 'text-3xl md:text-4xl lg:text-5xl text-rose-400' : 'text-3xl text-rose-600'} font-black font-mono tracking-tight block`}>
              {kpis.fardamentosAtrasados}
            </span>
            <span className={`${isTVMode ? 'text-2xs text-rose-400 font-bold' : 'text-[9px] text-rose-500 font-extrabold'} mt-0.5 block uppercase font-sans`}>Sem Retirada</span>
          </div>
        </div>

        {/* KPI: Programados */}
        <div className={`${isTVMode ? 'bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 md:p-4 shadow-2xl' : 'bg-white border border-slate-200 rounded-2xl p-4 shadow-xs'} flex flex-col justify-between hover:border-slate-700 transition-colors`}>
          <div className="flex items-center justify-between">
            <span className={`${isTVMode ? 'text-2xs text-slate-400 font-bold' : 'text-[9px] text-slate-400'} font-black uppercase tracking-wider font-mono`}>Programados (Hoje+)</span>
            <div className={`p-2 rounded-xl ${isTVMode ? 'bg-amber-950/80 text-amber-400 border border-amber-800/80' : 'bg-amber-50 text-amber-600'}`}>
              <Calendar className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
          <div className={`${isTVMode ? 'mt-2' : 'mt-4'}`}>
            <span className={`${isTVMode ? 'text-3xl md:text-4xl lg:text-5xl text-amber-400' : 'text-3xl text-slate-900'} font-black font-mono tracking-tight block`}>
              {kpis.programadosHojeFuturo}
            </span>
            <span className={`${isTVMode ? 'text-2xs text-slate-400' : 'text-[9px] text-slate-400'} mt-0.5 font-bold block uppercase font-sans`}>Fila de Atendimento</span>
          </div>
        </div>

        {/* KPI: Já Fardados */}
        <div className={`${isTVMode ? 'bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 md:p-4 shadow-2xl' : 'bg-white border border-slate-200 rounded-2xl p-4 shadow-xs'} flex flex-col justify-between hover:border-slate-700 transition-colors`}>
          <div className="flex items-center justify-between">
            <span className={`${isTVMode ? 'text-2xs text-slate-400 font-bold' : 'text-[9px] text-slate-400'} font-black uppercase tracking-wider font-mono`}>Já Fardados</span>
            <div className={`p-2 rounded-xl ${isTVMode ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80' : 'bg-emerald-50 text-emerald-600'}`}>
              <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
          <div className={`${isTVMode ? 'mt-2' : 'mt-4'}`}>
            <span className={`${isTVMode ? 'text-3xl md:text-4xl lg:text-5xl text-emerald-400' : 'text-3xl text-emerald-600'} font-black font-mono tracking-tight block`}>
              {kpis.jaFardados}
            </span>
            <span className={`${isTVMode ? 'text-2xs text-slate-400' : 'text-[9px] text-slate-400'} mt-0.5 font-bold block uppercase font-sans`}>Atendidos c/ Sucesso</span>
          </div>
        </div>
      </div>

      {/* 2. Gráficos de Trocas e Devoluções */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 ${isTVMode ? 'flex-1 min-h-0 w-full overflow-hidden' : ''}`}>
        {/* Chart Card */}
        <div className={`${isTVMode ? 'bg-slate-900/90 border border-slate-800 p-4 md:p-5 lg:col-span-12 flex-1 min-h-0 overflow-hidden' : 'bg-white border border-slate-200 p-6 lg:col-span-7 min-h-[420px]'} rounded-3xl shadow-2xl flex flex-col justify-between`}>
          <div>
            <div className="flex justify-between items-center">
              <div>
                <span className={`text-xs font-black uppercase tracking-wider block font-mono ${isTVMode ? 'text-violet-400' : 'text-violet-600'}`}>Pedidos de Troca de Tamanho</span>
                <h3 className={`text-lg md:text-xl font-black tracking-tight font-display mt-0.5 ${isTVMode ? 'text-white' : 'text-slate-800'}`}>Erros de Pedido por Centro de Custo</h3>
              </div>
              <span className={`text-2xs md:text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full font-mono ${isTVMode ? 'bg-violet-950/80 text-violet-300 border border-violet-800/80 shadow-[0_0_12px_rgba(139,92,246,0.2)]' : 'bg-indigo-50 text-indigo-600'}`}>Trocas Ativas</span>
            </div>
            <p className={`text-2xs md:text-xs mt-1 ${isTVMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Quantidade de solicitações de troca registradas no almoxarifado agrupadas por centro de custo da obra.
            </p>
          </div>

          <div className={`${isTVMode ? 'flex-1 min-h-0' : 'h-64'} w-full mt-2 flex flex-col justify-center overflow-hidden`}>
            {trocasPorCC.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
                <Shirt className="w-10 h-10 opacity-40 mb-2" />
                <span>Nenhuma troca de tamanho registrada até o momento.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trocasPorCC.slice(0, isTVMode ? 10 : 8)} margin={{ top: 25, right: 20, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isTVMode ? '#1e293b' : '#f1f5f9'} vertical={false} />
                  <XAxis 
                    dataKey="centroCusto" 
                    stroke={isTVMode ? '#cbd5e1' : '#94a3b8'} 
                    fontSize={isTVMode ? 11 : 10} 
                    fontWeight={isTVMode ? 'bold' : 'normal'}
                    tickLine={false}
                    fontFamily="Inter"
                    tickFormatter={(value) => value.length > 22 ? `${value.slice(0, 22)}...` : value}
                  />
                  <YAxis 
                    stroke={isTVMode ? '#cbd5e1' : '#94a3b8'} 
                    fontSize={isTVMode ? 11 : 10} 
                    fontWeight={isTVMode ? 'bold' : 'normal'}
                    tickLine={false}
                    fontFamily="Inter"
                    allowDecimals={false}
                  />
                  {!isTVMode && (
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }}
                      labelStyle={{ color: '#ffffff', fontWeight: 'bold', fontSize: '11px' }}
                      itemStyle={{ color: '#a5b4fc', fontSize: '11px' }}
                    />
                  )}
                  <Bar dataKey="quantidade" fill="#6366f1" radius={[8, 8, 0, 0]}>
                    <LabelList 
                      dataKey="quantidade" 
                      fill={isTVMode ? '#ffffff' : '#000000'} 
                      fontSize={isTVMode ? 15 : 12} 
                      fontWeight="bold" 
                      position="top" 
                    />
                    {trocasPorCC.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#4f46e5' : index === 1 ? '#6366f1' : '#818cf8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Tabela de Classificação CC */}
        {!isTVMode && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs lg:col-span-5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider block font-mono">Análise de Rupturas Operacionais</span>
              <h3 className="text-lg font-black text-slate-800 tracking-tight font-display mt-0.5">Ranking de Trocas</h3>
              <p className="text-xs text-slate-500 mt-1">Ranking das obras e frentes que mais geraram retrabalho de troca de kit físico.</p>
            </div>

            <div className="mt-4 flex-grow overflow-y-auto max-h-[260px] pr-1">
              {trocasPorCC.length === 0 ? (
                <div className="h-full flex items-center justify-center py-12 text-slate-400 text-xs">
                  <span>Sem dados para classificação.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {trocasPorCC.map((cc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black ${
                          idx === 0 ? 'bg-rose-100 text-rose-700' : idx === 1 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {idx + 1}
                        </div>
                        <span className="text-xs font-bold text-slate-700 truncate block max-w-[200px]" title={cc.centroCusto}>
                          {cc.centroCusto}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-black text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-2xs">
                          {cc.quantidade} un
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[9px] text-slate-400 mt-4 block font-mono text-center">
              * Alinhamento preventivo de tamanhos com a liderança é sugerido para as áreas de topo.
            </span>
          </div>
        )}
      </div>

      {/* 3. Gráficos de Taxa de Atendimento (%) por Grade de Tamanho (Fill Rate) */}
      {!isTVMode && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-xs">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block font-mono">Nível de Serviço do Estoque (Fill Rate)</span>
                <h3 className="text-xl font-black text-slate-800 tracking-tight font-display mt-0.5">Taxa de Atendimento (%) por Grade de Tamanho</h3>
              </div>
              {/* Visual Guide Badge */}
              <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-bold font-mono text-slate-600">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-xs"></div>
                  <span>Atendido &gt;= 70% (Saudável)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-rose-500 rounded-xs"></div>
                  <span>Abaixo de 70% (Alerta de Ruptura)</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Mapeamento preciso de gargalos de estoque. Mede o percentual de atendimento real (Quantidade Entregue / Quantidade Solicitada) para cada tamanho de vestimenta.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* CAMISAS CHART (Horizontal) */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between min-h-[380px]">
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-1 bg-violet-100 text-violet-700 rounded-lg">
                      <Shirt className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">Grade de Camisas</span>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-violet-100 text-violet-700 px-2 py-0.5 rounded-sm font-mono">Fill Rate %</span>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={fillRateCamisas}
                    margin={{ top: 0, right: 15, left: -25, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" fontSize={9} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="tamanho" stroke="#64748b" fontSize={10} fontWeight="bold" tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                    <Bar dataKey="taxa" radius={[0, 4, 4, 0]} barSize={12}>
                      {fillRateCamisas.map((entry, index) => {
                        const color = !entry.hasRequests ? '#cbd5e1' : entry.taxa < 70 ? '#f43f5e' : '#10b981';
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="text-[10px] text-slate-400 font-mono mt-3 text-center">
                Eixo Y: Tamanhos de Camisas (2 a 9)
              </div>
            </div>

            {/* CALÇAS CHART (Horizontal) */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between min-h-[380px]">
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-1 bg-indigo-100 text-indigo-700 rounded-lg">
                      <Shirt className="w-3.5 h-3.5 rotate-180" />
                    </div>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">Grade de Calças</span>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-sm font-mono">Fill Rate %</span>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={fillRateCalcas}
                    margin={{ top: 0, right: 15, left: -25, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" fontSize={9} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="tamanho" stroke="#64748b" fontSize={10} fontWeight="bold" tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                    <Bar dataKey="taxa" radius={[0, 4, 4, 0]} barSize={12}>
                      {fillRateCalcas.map((entry, index) => {
                        const color = !entry.hasRequests ? '#cbd5e1' : entry.taxa < 70 ? '#f43f5e' : '#10b981';
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="text-[10px] text-slate-400 font-mono mt-3 text-center">
                Eixo Y: Manequins de Calças (36 a 60)
              </div>
            </div>

            {/* BOTAS CHART (Horizontal) */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between min-h-[380px]">
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-1 bg-amber-100 text-amber-700 rounded-lg">
                      <Package className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">Grade de Botas</span>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-sm font-mono">Fill Rate %</span>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={fillRateBotas}
                    margin={{ top: 0, right: 15, left: -25, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" fontSize={9} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="tamanho" stroke="#64748b" fontSize={10} fontWeight="bold" tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                    <Bar dataKey="taxa" radius={[0, 4, 4, 0]} barSize={12}>
                      {fillRateBotas.map((entry, index) => {
                        const color = !entry.hasRequests ? '#cbd5e1' : entry.taxa < 70 ? '#f43f5e' : '#10b981';
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="text-[10px] text-slate-400 font-mono mt-3 text-center">
                Eixo Y: Tamanhos de Calçados (35 a 46)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
