import React, { useState, useEffect } from 'react';
import { Tv, X, Wrench, RefreshCw, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import DevolucaoAtivos from './DevolucaoAtivos';
import { DashboardAdmissoes } from './DashboardAdmissoes';
import RequisicoesPanel from './RequisicoesPanel';
import ConsultaPedidos from './ConsultaPedidos';
import TVOficinaEletricaDashboard from './TVOficinaEletricaDashboard';

interface TVDashboardCentralProps {
  onExit: () => void;
}

interface TVScreenItem {
  label: string;
  value: number;
  isDraft?: boolean;
}

const SCREENS: TVScreenItem[] = [
  { label: 'Devolução de Ativos', value: 0 },
  { label: 'Admissões & Fardamento', value: 1 },
  { label: 'Diligenciamento de RMs', value: 2 },
  { label: 'Monitoramento de Entradas', value: 3 },
  { label: 'Oficina Elétrica', value: 4 }
];

export default function TVDashboardCentral({ onExit }: TVDashboardCentralProps) {
  const [activeScreen, setActiveScreen] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<string>('');
  
  // Admissions state for Screen 2
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [loadingAdmissions, setLoadingAdmissions] = useState<boolean>(false);

  // Update clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
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

  // Fetch admissions from database on mount
  const fetchAdmissions = async () => {
    setLoadingAdmissions(true);
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
        setAdmissions(parsed);
      }
    } catch (e) {
      console.error("Erro ao buscar atendimentos de fardamento para o Dashboard da TV:", e);
    } finally {
      setLoadingAdmissions(false);
    }
  };

  const [tickerMessage, setTickerMessage] = useState<string>('');

  const fetchTicker = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_tv')
        .select('mensagem_ticker')
        .eq('id', 'ticker')
        .maybeSingle();
      if (!error && data) {
        setTickerMessage(data.mensagem_ticker);
      } else {
        const localVal = localStorage.getItem('tv_ticker_message');
        if (localVal) {
          setTickerMessage(localVal);
        }
      }
    } catch (err) {
      console.error('Error fetching ticker:', err);
      const localVal = localStorage.getItem('tv_ticker_message');
      if (localVal) {
        setTickerMessage(localVal);
      }
    }
  };

  useEffect(() => {
    fetchAdmissions();
    fetchTicker();

    // Subscribe to realtime changes in Supabase
    const channel = supabase
      .channel('tv_ticker_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'configuracoes_tv',
          filter: "id=eq.ticker"
        },
        (payload: any) => {
          if (payload.new && payload.new.mensagem_ticker) {
            setTickerMessage(payload.new.mensagem_ticker);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Carousel transition timer: rotates screens every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveScreen(prev => (prev + 1) % SCREENS.length);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const renderEmConstrucao = () => {
    return (
      <div className="flex-grow flex flex-col justify-center items-center bg-slate-950 p-8 relative overflow-hidden select-none h-full">
        {/* Futuristic Grid Blueprint Background */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none" 
          style={{
            backgroundImage: `
              radial-gradient(circle, rgba(99, 102, 241, 0.15) 1px, transparent 1px),
              linear-gradient(to right, rgba(99, 102, 241, 0.05) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(99, 102, 241, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: '24px 24px, 48px 48px, 48px 48px',
          }}
        />

        {/* Blueprint Circular Accent */}
        <div className="absolute w-[500px] h-[500px] rounded-full border border-dashed border-indigo-500/10 pointer-events-none animate-spin" style={{ animationDuration: '60s' }} />
        <div className="absolute w-[300px] h-[300px] rounded-full border border-indigo-500/5 pointer-events-none" />

        {/* Construction Visual Alert Sign */}
        <div className="relative z-10 flex flex-col items-center max-w-2xl text-center px-4">
          <div className="mb-6 relative">
            <div className="absolute -inset-4 bg-indigo-500/10 rounded-full blur-xl animate-pulse" />
            <div className="w-20 h-20 bg-slate-900 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400 relative shadow-2xl">
              <Wrench className="w-10 h-10 animate-bounce" />
              <span className="absolute -bottom-1 -right-1 text-2xl">🚧</span>
            </div>
          </div>

          <h2 className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-2">
            Módulo Oficina Elétrica
          </h2>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight uppercase mb-4 leading-none">
            EM CONSTRUÇÃO
          </h1>
          
          <div className="w-20 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent mb-6" />

          <p className="text-sm text-slate-300 font-semibold uppercase tracking-wider mb-2">
            Painel de Acompanhamento de Atividades e Checklists
          </p>
          <p className="text-xs text-slate-400 leading-relaxed max-w-lg mb-10">
            A arquitetura da Oficina Elétrica está sendo consolidada para exibir em tempo real o diagnóstico dos ativos, checklist de pré-requisitos técnicos e atribuição direta de eletricistas.
          </p>

          {/* Blueprint Wireframe Dashboard Mockup Preview */}
          <div className="w-full max-w-xl bg-slate-900/40 border border-indigo-500/20 rounded-2xl p-4 opacity-40 blur-[1px] relative select-none">
            {/* Mock Header */}
            <div className="flex justify-between items-center mb-4 border-b border-indigo-500/10 pb-2">
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500/50" />
                <div className="w-16 h-2 rounded bg-indigo-500/20" />
              </div>
              <div className="w-24 h-2 rounded bg-indigo-500/20" />
            </div>

            {/* Mock KPI Row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="border border-indigo-500/10 rounded-lg p-2.5 flex flex-col items-center">
                <div className="w-10 h-2 bg-indigo-500/20 rounded mb-1" />
                <div className="w-6 h-4 bg-indigo-500/40 rounded" />
              </div>
              <div className="border border-indigo-500/10 rounded-lg p-2.5 flex flex-col items-center">
                <div className="w-10 h-2 bg-indigo-500/20 rounded mb-1" />
                <div className="w-6 h-4 bg-indigo-500/40 rounded" />
              </div>
              <div className="border border-indigo-500/10 rounded-lg p-2.5 flex flex-col items-center">
                <div className="w-10 h-2 bg-indigo-500/20 rounded mb-1" />
                <div className="w-6 h-4 bg-indigo-500/40 rounded" />
              </div>
            </div>

            {/* Mock Chart & Table Wireframe */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-indigo-500/10 rounded-lg p-3 h-20 flex items-end justify-between">
                <div className="w-3 h-8 bg-indigo-500/20 rounded-t" />
                <div className="w-3 h-14 bg-indigo-500/30 rounded-t" />
                <div className="w-3 h-10 bg-indigo-500/20 rounded-t" />
                <div className="w-3 h-16 bg-indigo-500/40 rounded-t" />
              </div>
              <div className="border border-indigo-500/10 rounded-lg p-3 h-20 space-y-2">
                <div className="w-full h-1.5 bg-indigo-500/20 rounded" />
                <div className="w-4/5 h-1.5 bg-indigo-500/20 rounded" />
                <div className="w-2/3 h-1.5 bg-indigo-500/20 rounded" />
              </div>
            </div>

            {/* Overlay label */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="px-3 py-1 bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 rounded-md text-[10px] font-mono tracking-widest uppercase font-black shadow-lg">
                WIREFRAME_CONCEPT_V2
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTickerContent = () => {
    return (
      <div className="flex items-center gap-12 pr-12 shrink-0">
        {tickerMessage ? (
          tickerMessage.split(' • ').map((item, idx) => (
            <span key={idx}>{item}</span>
          ))
        ) : (
          <>
            <span>[DEVOLUÇÃO DE ATIVOS] BI operacional atualizado em tempo real.</span>
            <span>[DASHBOARD ADMISSÕES] {admissions.length} registros ativos carregados para a Parada Geral de 2026.</span>
            <span>[DILIGENCIAMENTO RMs] Sincronização automatizada ativa com o robô integrador.</span>
            <span>[MONITORAMENTO DE ENTRADAS] Painel de acompanhamento de recebimentos fiscais e controle de saldos.</span>
            <span>[OFICINA ELÉTRICA] Novo painel de checklists e acompanhamento em fase de modelagem de dados.</span>
            <span>[PARADA GERAL 2026] Planejamento de fardamento e equipes com 100% de consistência.</span>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 h-screen w-screen max-h-screen bg-slate-950 text-white flex flex-col z-50 overflow-hidden select-none font-sans tv-kiosk-container" id="active-tv-mode-flag">
      
      {/* Dynamic Style Block to enforce Kiosk Mode on rendered components */}
      <style>{`
        /* Quiosque overrides to hide headers, navbars, and back buttons inside the children */
        .tv-kiosk-container header,
        .tv-kiosk-container nav,
        .tv-kiosk-container .back-button,
        .tv-kiosk-container button[title*="Voltar"],
        .tv-kiosk-container button[title*="voltar"],
        .tv-kiosk-container button:has(svg.lucide-arrow-left),
        .tv-kiosk-container .h-1.5.w-full.bg-gradient-to-r {
          display: none !important;
        }

        /* Adjusting nested components so they span full-height cleanly */
        .tv-kiosk-container .min-h-screen {
          min-height: unset !important;
          height: 100% !important;
          max-height: 100% !important;
          overflow: hidden !important;
          background: transparent !important;
          padding: 0 !important;
        }

        .tv-kiosk-container .max-w-7xl {
          max-width: 100% !important;
          padding-left: 1rem !important;
          padding-right: 1rem !important;
        }

        @keyframes marquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }

        .animate-marquee {
          display: flex;
          animation: marquee 60s linear infinite;
        }

        @keyframes progress-bar {
          0% { width: 100%; }
          100% { width: 0%; }
        }
        
        .carousel-progress-bar {
          animation: progress-bar 60s linear forwards;
        }
      `}</style>

      {/* Top Header Bar */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0 select-none z-30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/10 border border-indigo-500/30 rounded-xl text-indigo-400">
            <Tv className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-widest text-slate-100 uppercase">
              CMPC OVERHAUL <span className="text-indigo-400 font-bold">TV MONITOR</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-tight uppercase">
              Painel de GESTÃO À VISTA — CMPC 2026
            </p>
          </div>
        </div>

        {/* Carousel Navigation Indicators */}
        <div className="flex items-center gap-2">
          {SCREENS.map((scr) => (
            <button
              key={scr.value}
              onClick={() => setActiveScreen(scr.value)}
              className={`px-3 py-1.5 rounded-lg text-2xs font-bold uppercase transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                activeScreen === scr.value
                  ? 'bg-indigo-600 text-white border border-indigo-500 shadow-lg'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/40'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${activeScreen === scr.value ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              {scr.label}
              {scr.isDraft && <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1 py-0.2 rounded font-mono">🚧</span>}
            </button>
          ))}
        </div>

        {/* Right Side Control: Exit button and current time */}
        <div className="flex items-center gap-4">
          <div className="text-right font-mono">
            <p className="text-2xs text-slate-400 uppercase tracking-wider font-bold">HORÁRIO LOCAL</p>
            <p className="text-xs font-black text-slate-100">{currentTime}</p>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <button
            onClick={onExit}
            className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-black uppercase tracking-wider shadow-md"
            title="Sair do Modo TV"
          >
            <X className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </header>

      {/* Carousel Screen Rotation Progress Indicator */}
      <div 
        key={activeScreen} 
        className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 carousel-progress-bar shrink-0 z-30"
        style={{ width: '100%' }}
      />

      {/* Carousel Screens Wrapper - All screens kept mounted inside DOM to guarantee Egress Protection */}
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden bg-slate-950 z-10">
        
        {/* Screen 0: Devolução de Ativos */}
        <div className={`absolute inset-0 w-full h-full transition-all duration-500 ${activeScreen === 0 ? 'opacity-100 z-10 pointer-events-auto scale-100' : 'opacity-0 z-0 pointer-events-none scale-98'}`}>
          <DevolucaoAtivos onBackToHub={() => {}} isTVMode={true} />
        </div>

        {/* Screen 1: Dashboard de Admissões */}
        <div className={`absolute inset-0 w-full h-full transition-all duration-500 ${activeScreen === 1 ? 'opacity-100 z-10 pointer-events-auto scale-100' : 'opacity-0 z-0 pointer-events-none scale-98'}`}>
          <DashboardAdmissoes admissions={admissions} loading={loadingAdmissions} isTVMode={true} />
        </div>

        {/* Screen 2: Diligenciamento de RMs */}
        <div className={`absolute inset-0 w-full h-full transition-all duration-500 ${activeScreen === 2 ? 'opacity-100 z-10 pointer-events-auto scale-100' : 'opacity-0 z-0 pointer-events-none scale-98'}`}>
          <RequisicoesPanel onBackToHub={() => {}} isTVMode={true} />
        </div>

        {/* Screen 3: Monitoramento de Entradas */}
        <div className={`absolute inset-0 w-full h-full transition-all duration-500 ${activeScreen === 3 ? 'opacity-100 z-10 pointer-events-auto scale-100' : 'opacity-0 z-0 pointer-events-none scale-98'}`}>
          <ConsultaPedidos onBackToHub={() => {}} isTVMode={true} />
        </div>

        {/* Screen 4: Oficina Elétrica */}
        <div className={`absolute inset-0 w-full h-full transition-all duration-500 ${activeScreen === 4 ? 'opacity-100 z-10 pointer-events-auto scale-100' : 'opacity-0 z-0 pointer-events-none scale-98'}`}>
          <TVOficinaEletricaDashboard />
        </div>

      </div>

      {/* FOOTER TICKER */}
      <footer className="h-10 border-t border-slate-800 bg-slate-900 px-8 flex items-center justify-between z-30 text-xs font-mono shrink-0 select-none">
        <div className="flex items-center overflow-hidden w-full relative" style={{ maskImage: 'linear-gradient(to right, black 85%, transparent 98%)', WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 98%)' }}>
          <div className="flex whitespace-nowrap animate-marquee text-[11px] text-indigo-300 font-medium">
            {renderTickerContent()}
            {renderTickerContent()}
          </div>
        </div>
      </footer>
    </div>
  );
}
