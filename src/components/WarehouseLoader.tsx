import React, { useState, useEffect } from 'react';
import { Truck, Package, Warehouse } from 'lucide-react';

interface WarehouseLoaderProps {
  customMessage?: string;
  fullScreen?: boolean;
}

const LOGISTICS_PHRASES = [
  "ESTACIONANDO NA DOCA...",
  "DESCARREGANDO MATERIAIS...",
  "ORGANIZANDO ESTOQUE...",
  "VERIFICANDO SALDOS DE ALMOXARIFADO...",
  "PREPARANDO DOCAS E INVENTÁRIO..."
];

export default function WarehouseLoader({ customMessage, fullScreen = true }: WarehouseLoaderProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (customMessage) return;

    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % LOGISTICS_PHRASES.length);
    }, 1500);

    return () => clearInterval(interval);
  }, [customMessage]);

  const currentText = customMessage || LOGISTICS_PHRASES[phraseIndex];

  return (
    <div
      className={`${
        fullScreen ? 'min-h-screen fixed inset-0 z-50' : 'w-full py-12'
      } bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans select-none overflow-hidden`}
    >
      <style>{`
        @keyframes truckDrive {
          0% { transform: translateX(-35px); }
          50% { transform: translateX(35px); }
          100% { transform: translateX(-35px); }
        }
        @keyframes truckBounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2.5px); }
        }
        @keyframes roadMove {
          0% { transform: translateX(0); }
          100% { transform: translateX(-24px); }
        }
        @keyframes packageDrop {
          0% { opacity: 0; transform: translateY(-10px) scale(0.8); }
          50% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(5px) scale(0.9); }
        }
        .animate-truck-drive {
          animation: truckDrive 3s ease-in-out infinite;
        }
        .animate-truck-bounce {
          animation: truckBounce 0.6s ease-in-out infinite;
        }
        .animate-road {
          animation: roadMove 0.8s linear infinite;
        }
      `}</style>

      {/* Container Principal do Animação */}
      <div className="relative flex flex-col items-center justify-center">
        {/* Glow de Fundo */}
        <div className="absolute w-64 h-64 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Ícone de Galpão / Doca de Fundo */}
        <div className="mb-2 text-indigo-500/20">
          <Warehouse className="w-16 h-16" />
        </div>

        {/* Animação do Caminhão na Doca */}
        <div className="relative w-64 h-20 flex flex-col items-center justify-end overflow-hidden mb-6">
          {/* Pacotinho caindo suavemente acima da caçamba */}
          <div className="absolute top-1 text-amber-400 opacity-90 animate-[packageDrop_1.5s_infinite]">
            <Package className="w-4 h-4" />
          </div>

          {/* Caminhão com movimento de deslize e balanço */}
          <div className="animate-truck-drive relative z-10 mb-1">
            <div className="animate-truck-bounce text-indigo-400 drop-shadow-[0_4px_12px_rgba(99,102,241,0.4)] flex items-center gap-1">
              <Truck className="w-12 h-12 stroke-[2]" />
            </div>
          </div>

          {/* Linha do Asfalto / Doca com Traçados Movéis */}
          <div className="w-56 h-1 bg-slate-800 rounded-full relative overflow-hidden flex items-center">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
            <div className="w-[150%] flex gap-3 animate-road">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="w-3 h-0.5 bg-indigo-400/60 rounded-full shrink-0" />
              ))}
            </div>
          </div>
        </div>

        {/* Indicador de Status com Texto Alternável */}
        <div className="text-center space-y-2 max-w-sm px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-800/50 text-indigo-300 text-[10px] font-extrabold uppercase tracking-widest shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>SGI Logistics Engine</span>
          </div>

          <p className="text-xs font-black uppercase tracking-widest text-slate-200 h-6 flex items-center justify-center transition-all duration-300">
            {currentText}
          </p>
        </div>
      </div>
    </div>
  );
}
