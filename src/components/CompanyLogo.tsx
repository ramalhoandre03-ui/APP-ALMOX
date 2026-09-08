import React from 'react';

interface CompanyLogoProps {
  className?: string;
  height?: number; // Kept for API interface compatibility
}

export default function CompanyLogo({ className = '' }: CompanyLogoProps) {
  return (
    <div 
      className={`flex flex-col items-start select-none justify-center ${className}`} 
      id="cmpc-brand-logo-container"
    >
      {/* Top Section: CMPC and INDUSTRIAL */}
      <div className="flex flex-col leading-none" id="cmpc-text-header">
        <span className="font-sans font-extrabold text-slate-950 tracking-tighter text-base leading-none">
          CMPC
        </span>
        <span className="font-sans font-bold text-slate-700 tracking-[1.5px] text-[6px] uppercase leading-none pb-1">
          INDUSTRIAL
        </span>
      </div>
      
      {/* Bottom Section: ALMOX branded frame */}
      <div 
        className="border-[1.5px] border-indigo-900 rounded-sm px-2 py-0.5 bg-white flex items-center justify-center shadow-2xs"
        id="cmpc-almox-frame"
      >
        <span className="font-sans font-black text-indigo-900 tracking-[3px] text-[8px] leading-none uppercase pr-[1px]">
          ALMOX
        </span>
      </div>
    </div>
  );
}
