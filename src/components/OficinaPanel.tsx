import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ExternalLink, Wrench, ShieldAlert, MonitorCheck } from 'lucide-react';

interface OficinaPanelProps {
  onBackToHub: () => void;
}

export default function OficinaPanel({ onBackToHub }: OficinaPanelProps) {
  const oficinaUrl = "https://equipdash-gmeldxdu.manus.space/dashboard";

  const handleOpenNewTab = () => {
    window.open(oficinaUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans" id="oficina-panel">
      {/* Upper Navigation Bar */}
      <div className="bg-slate-900 text-white py-4 px-6 md:px-8 border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Back button and title */}
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={onBackToHub}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 rounded-xl hover:bg-slate-750 transition-colors cursor-pointer"
              id="oficina-back-btn"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar ao Portal</span>
            </button>
            <div className="border-l border-slate-700 pl-3">
              <span className="text-[10px] uppercase font-black tracking-widest text-[#a3b8cc] block leading-none">Oficina Central</span>
              <h1 className="text-sm font-bold tracking-tight text-white mt-0.5 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-emerald-400" />
                <span>Fluxo de Oficina</span>
              </h1>
            </div>
          </div>

          {/* Quick interactive parameters */}
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <div className="hidden lg:flex items-center space-x-1 text-[11px] font-mono text-slate-400 mr-2">
              <MonitorCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Painel Corretivo Ativo</span>
            </div>
            
            <button
              onClick={handleOpenNewTab}
              className="flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black text-xs px-4.5 py-2.5 rounded-xl hover:from-emerald-400 hover:to-emerald-500 active:scale-95 transition-all shadow-md cursor-pointer"
              id="oficina-external-btn"
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
          
          {/* Info Ribbon */}
          <div className="bg-slate-50 border-b border-slate-150 py-2.5 px-5 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-[10px] uppercase tracking-wider text-slate-450">Iframe Integrado Equips</span>
            </div>
            <div className="text-[10px]">
              Se o painel abaixo não carregar, clique em <strong className="text-emerald-600 font-bold cursor-pointer" onClick={handleOpenNewTab}>"Abrir em Nova Aba"</strong>
            </div>
          </div>

          {/* Embedded Oficina Iframe */}
          <div className="flex-grow w-full h-full relative" id="oficina-iframe-wrapper">
            <iframe
              title="Dashboard Oficina Central"
              src={oficinaUrl}
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
