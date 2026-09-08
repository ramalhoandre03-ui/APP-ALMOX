/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Database,
  RefreshCw,
  Clock,
  X,
  Zap,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { useSupabaseNetworkStatus } from '../hooks/useSupabaseNetworkStatus';

interface NetworkStatusIndicatorProps {
  className?: string;
  compact?: boolean;
}

export default function NetworkStatusIndicator({ className = '', compact = false }: NetworkStatusIndicatorProps) {
  const {
    isOnline,
    isSupabaseConnected,
    latencyMs,
    isChecking,
    lastCheckedTime,
    checkConnectivity
  } = useSupabaseNetworkStatus();

  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Fecha o popover ao clicar fora ou pressionar ESC
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleTestConnection = async () => {
    setFeedbackMsg('Testando conexão com Supabase...');
    const ok = await checkConnectivity();
    if (ok) {
      setFeedbackMsg('✅ Conexão com Supabase restabelecida e validada!');
    } else {
      setFeedbackMsg('⚠️ Falha na conexão: Verifique o acesso à internet.');
    }
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'Aguardando verificação';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const isHealthy = isOnline && isSupabaseConnected;

  return (
    <div className={`relative inline-block text-left ${className}`} ref={popoverRef} id="network-status-container">
      {/* Botão de Status Principal no Cabeçalho */}
      <button
        type="button"
        id="network-status-indicator-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title="Clique para ver o status da conexão e latência do Supabase"
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all duration-200 cursor-pointer border shadow-2xs focus:outline-none focus:ring-2 focus:ring-offset-1 select-none ${
          !isHealthy
            ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 focus:ring-rose-400'
            : 'bg-emerald-50 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100/70 focus:ring-emerald-400'
        }`}
      >
        {/* Ponto Pulsante Indicador */}
        <span className="relative flex items-center justify-center shrink-0">
          {!isHealthy ? (
            <WifiOff className="w-3.5 h-3.5 text-rose-600" />
          ) : (
            <>
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </>
          )}
        </span>

        {/* Rótulo de Status e Ping */}
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          {!isHealthy ? (
            <span>Offline</span>
          ) : (
            <span className="flex items-center gap-1">
              <span>Online</span>
              {latencyMs !== null && !compact && (
                <span className="text-[10px] text-emerald-700/80 font-mono">({latencyMs}ms)</span>
              )}
            </span>
          )}
        </div>
      </button>

      {/* Popover / Modal de Diagnóstico da Conectividade & Supabase */}
      {isOpen && (
        <div
          id="network-status-popover-dialog"
          role="dialog"
          aria-label="Painel de Monitoramento de Rede e Supabase"
          className="absolute right-0 mt-2 w-84 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-60 overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Topo do Modal */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-slate-800 rounded-lg text-emerald-400">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold tracking-tight text-white">Status da Conectividade & Supabase</h4>
                <p className="text-[10px] text-slate-400">Monitoramento de latência e conexão com o banco de dados</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Feedback de Teste Temporário */}
          {feedbackMsg && (
            <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 text-xs font-semibold text-indigo-900 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* Corpo do Diagnóstico */}
          <div className="p-4 space-y-3.5 text-xs">
            {/* Bloco 1: Conexão do Navegador */}
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <div
                className={`p-2.5 rounded-lg shrink-0 ${
                  isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}
              >
                {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-800">Conexão do Navegador</h4>
                <p className="text-xs text-slate-500">
                  {isOnline ? 'Rede ativa e respondendo' : 'Sem conexão com a internet'}
                </p>
              </div>
              <div
                className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                  isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </div>
            </div>

            {/* Bloco 2: Status do Banco de Dados (Supabase) */}
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-lg shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-800">Status do Banco de Dados (Supabase)</h4>
                <p className="text-xs text-slate-500">Conexão Realtime e API respondendo corretamente</p>
              </div>
              <div
                className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                  isSupabaseConnected
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {isSupabaseConnected ? '100% OK' : 'OFFLINE'}
              </div>
            </div>

            {/* Aviso quando Offline */}
            {!isHealthy && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2 text-rose-900">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-bold">Atenção:</span> A conexão com a internet ou com os servidores do Supabase
                  está temporariamente indisponível.
                </div>
              </div>
            )}

            {/* Informações Complementares: Latência e Horário da Última Checagem */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Última checagem: <span className="font-semibold text-slate-700">{formatTime(lastCheckedTime)}</span>
              </span>
              {latencyMs !== null && isHealthy && (
                <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  {latencyMs} ms
                </span>
              )}
            </div>
          </div>

          {/* Rodapé com Ações */}
          <div className="p-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-end">
            <button
              type="button"
              id="btn-test-supabase-connection"
              onClick={handleTestConnection}
              disabled={isChecking}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Verificando...' : 'Testar Conexão'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
