/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ClipboardList, BarChart3, ChevronLeft, Database } from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import NetworkStatusIndicator from './NetworkStatusIndicator';

interface HeaderProps {
  activeView: 'storekeeper' | 'central';
  setActiveView: (view: 'storekeeper' | 'central') => void;
  reportCount: number;
  onBackToHub?: () => void;
}

export default function Header({ activeView, setActiveView, reportCount, onBackToHub }: HeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs" id="app-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center gap-4">
          
          {/* Logo / Title Block */}
          <div className="flex items-center space-x-3 sm:space-x-4 shrink-0">
            {onBackToHub && (
              <button
                onClick={onBackToHub}
                className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold text-slate-500 hover:text-cmpc-purple bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer transition-all mr-1"
                id="header-back-hub-btn"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden md:inline">Portal</span>
              </button>
            )}
            <CompanyLogo height={42} />
            <div className="border-l border-slate-250 pl-4 py-1 hidden sm:block">
              <h1 className="font-sans font-bold text-sm text-slate-800 tracking-tight leading-tight">
                Painel de Campo
              </h1>
              <p className="text-[9px] font-bold text-slate-450 uppercase tracking-wider leading-none mt-0.5">
                Almoxarifado Central
              </p>
            </div>
          </div>

          {/* Central Status Indicators: Network / Firestore Sync & Database Counts */}
          <div className="flex items-center gap-2.5">
            {/* Realtime Network & Firestore Pending Writes Indicator */}
            <NetworkStatusIndicator />

            {/* Quick Realtime Synchronized Badge */}
            <div className="hidden lg:flex items-center space-x-2 bg-slate-100 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-full border border-slate-200/80">
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span>{reportCount} Lançamentos</span>
            </div>
          </div>

          {/* View Toggle Controller */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/50 shrink-0">
            <button
              id="toggle-storekeeper"
              onClick={() => setActiveView('storekeeper')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeView === 'storekeeper'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Painel do Agente</span>
              <span className="sm:hidden">Agente</span>
            </button>
            <button
              id="toggle-central"
              onClick={() => setActiveView('central')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeView === 'central'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard Central</span>
              <span className="sm:hidden">Central</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
