import React, { useState, useEffect } from 'react';
import { ChevronLeft, ExternalLink, BarChart3, ShieldCheck, Wrench } from 'lucide-react';

interface MobilizacaoPanelProps {
  onBackToHub: () => void;
  initialReport?: 'mobilizacao' | 'oficina';
}

export default function MobilizacaoPanel({ onBackToHub, initialReport = 'mobilizacao' }: MobilizacaoPanelProps) {
  const [activeReport, setActiveReport] = useState<'mobilizacao' | 'oficina'>(initialReport);

  useEffect(() => {
    if (initialReport) {
      setActiveReport(initialReport);
    }
  }, [initialReport]);

  const powerBiUrl = "https://app.powerbi.com/view?r=eyJrIjoiNGVmZDQxYjEtOWIyNS00Zjk1LTlmYTMtM2IzYWFmYTgzZDNkIiwidCI6IjEzNzRhYzcwLTEyNGYtNGU3NS1hMTFmLWYzOGI1ZTBmZDM2ZSJ9";
  const oficinaUrl = "https://equipdash-gmeldxdu.manus.space/dashboard";

  const currentUrl = activeReport === 'mobilizacao' ? powerBiUrl : oficinaUrl;

  const handleOpenNewTab = () => {
    window.open(currentUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans" id="mobilizacao-panel">
      {/* Upper Navigation Bar */}
      <div className="bg-slate-900 text-white py-4 px-6 md:px-8 border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Back button, category, and report switcher */}
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <button
              onClick={onBackToHub}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 rounded-xl hover:bg-slate-750 transition-colors cursor-pointer shrink-0"
              id="mobi-back-btn"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar ao Portal</span>
            </button>
            
            <div className="border-l border-slate-700 pl-4 flex flex-col justify-center">
              <span className="text-[10px] uppercase font-black tracking-widest text-[#a3b8cc] block leading-none mb-2">
                BI Corporativo • Overhaul 2026
              </span>

              {/* Large, High-Contrast Segmented Switcher exactly in the title zone of the header */}
              <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800/80 shadow-2xl relative z-10 self-start">
                <button
                  type="button"
                  onClick={() => setActiveReport('mobilizacao')}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-200 cursor-pointer ${
                    activeReport === 'mobilizacao'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold transform scale-[1.03]'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                  }`}
                  id="header-switch-btn-mobi-v3"
                >
                  <BarChart3 className="w-4 h-4 shrink-0 animate-pulse text-current" />
                  <span>Mobilização & Headcount</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReport('oficina')}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-200 cursor-pointer ${
                    activeReport === 'oficina'
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold transform scale-[1.03]'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                  }`}
                  id="header-switch-btn-oficina-v3"
                >
                  <Wrench className="w-4 h-4 shrink-0 animate-pulse text-current" />
                  <span>Fluxo de Oficina</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick interactive parameters */}
          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            <div className="hidden lg:flex items-center space-x-1 text-[11px] font-mono text-slate-400 mr-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Ambiente de Produção Homologado</span>
            </div>
            
            <button
              onClick={handleOpenNewTab}
              className={`flex items-center justify-center space-x-2 bg-gradient-to-r ${
                activeReport === 'mobilizacao'
                  ? 'from-amber-500 to-amber-600 text-slate-950 hover:from-amber-400 hover:to-amber-500'
                  : 'from-emerald-500 to-emerald-600 text-white hover:from-emerald-450 hover:to-emerald-555'
              } font-black text-xs px-4.5 py-2.5 rounded-xl active:scale-95 transition-all shadow-md cursor-pointer`}
              id="mobi-external-btn"
            >
              <span>Abrir em Nova Aba</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>

      {/* Main Board Space */}
      <div className="flex-grow p-4 md:p-6 flex flex-col">
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-md flex-grow flex flex-col overflow-hidden relative min-h-[600px]">
          
          {/* Info Ribbon of powerbi */}
          <div className="bg-slate-50 border-b border-slate-150 py-2.5 px-5 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${
                activeReport === 'mobilizacao' ? 'bg-amber-500' : 'bg-emerald-500'
              } animate-pulse`} />
              <span className="font-medium text-[10px] uppercase tracking-wider text-slate-450">
                {activeReport === 'mobilizacao'
                  ? 'Iframe Integrado PowerBI (Overhaul 2026)'
                  : 'Iframe Integrado Equips (Overhaul 2026)'}
              </span>
            </div>
            <div className="text-[10px]">
              Se o painel abaixo não carregar, clique em <strong className={`font-bold cursor-pointer transition-colors ${
                activeReport === 'mobilizacao' ? 'text-amber-605 hover:text-amber-700' : 'text-emerald-605 hover:text-emerald-700'
              }`} onClick={handleOpenNewTab}>"Abrir em Nova Aba"</strong>
            </div>
          </div>

          {/* Embedded Iframe */}
          <div className="flex-grow w-full h-full relative" id="mobi-iframe-wrapper">
            <iframe
              key={activeReport}
              title={activeReport === 'mobilizacao' ? "Dashboard Mobilização" : "Dashboard Oficina Central"}
              src={currentUrl}
              className="absolute inset-0 w-full h-full border-0 rounded-b-[24px]"
              allowFullScreen={true}
              referrerPolicy="no-referrer"
            />
          </div>

        </div>
      </div>
    </div>
  );
}
