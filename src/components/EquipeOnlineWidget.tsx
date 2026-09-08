import React, { useState } from 'react';
import { Users, Wifi, Radio, Clock, UserCheck, ChevronUp, X } from 'lucide-react';
import { usePresence } from '../context/PresenceContext';
import { useAuth } from '../context/AuthContext';

export default function EquipeOnlineWidget() {
  const { session } = useAuth();
  const { onlineUsers, isConnecting } = usePresence();
  
  // Estado obrigatório: isExpanded com valor inicial false (100% recolhida por padrão no carregamento/F5)
  const [isExpanded, setIsExpanded] = useState(false);

  if (!session) return null;

  const formatHoraEntrada = (isoDate?: string) => {
    if (!isoDate) return 'Ativo agora';
    try {
      const d = new Date(isoDate);
      return `Conectado às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return 'Ativo agora';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 transition-all duration-300 ease-in-out">
      {!isExpanded ? (
        /* Modo Retraído (isExpanded === false) - Botão Flutuante / Badge Minimalista */
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="bg-slate-900/95 text-white shadow-2xl backdrop-blur-md hover:bg-slate-900 border border-slate-700/80 rounded-full px-4 py-2.5 flex items-center gap-2.5 transition-all duration-300 ease-in-out cursor-pointer group hover:scale-105 active:scale-95 shadow-emerald-500/10 hover:shadow-emerald-500/20"
          title="Clique para expandir a lista da Equipe Online"
        >
          <div className="relative flex items-center justify-center">
            <Users className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <span className="text-xs font-black tracking-tight text-slate-100">Equipe Online:</span>
          <span className="bg-emerald-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-xs">
            <Radio className="w-2.5 h-2.5 text-slate-950 animate-pulse" />
            {onlineUsers.length} ON
          </span>
          <ChevronUp className="w-3 h-3 text-slate-400 group-hover:text-white transition-colors" />
        </button>
      ) : (
        /* Modo Expandido (isExpanded === true) - Card Completo da Equipe Online */
        <div className="w-80 max-w-[calc(100vw-2rem)] shadow-2xl bg-white rounded-2xl border border-slate-200/90 overflow-hidden flex flex-col transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-bottom-4">
          {/* Header do Widget Flutuante */}
          <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-slate-800 text-emerald-400 rounded-lg relative">
                <Users className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                  Equipe Online
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  Operadores ativos em tempo real
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                <span>{onlineUsers.length} ON</span>
              </span>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Recolher / Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Conteúdo: Lista de Utilizadores */}
          <div className="p-3 bg-white">
            {isConnecting ? (
              <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Wifi className="w-4 h-4 animate-pulse text-emerald-500" />
                <span>Sincronizando equipe online...</span>
              </div>
            ) : onlineUsers.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 font-medium">
                Nenhum operador detectado no momento.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {onlineUsers.map((u, idx) => {
                  const isCurrentUser = session?.email && u.email.toLowerCase() === session.email.toLowerCase();
                  const initial = (u.nome || u.email || 'U').charAt(0).toUpperCase();

                  return (
                    <div
                      key={u.email + idx}
                      className={`p-2 rounded-xl border flex items-center justify-between transition-colors text-xs ${
                        isCurrentUser
                          ? 'bg-emerald-50/60 border-emerald-200/80 text-emerald-950'
                          : 'bg-slate-50/80 border-slate-100 hover:bg-slate-100/80 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-1">
                        {/* Avatar com Letra Inicial e Indicador Verde */}
                        <div className="relative shrink-0">
                          <div className="w-7 h-7 rounded-full bg-slate-800 text-white font-black text-xs flex items-center justify-center shadow-2xs">
                            {initial}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 border border-white"></span>
                          </span>
                        </div>

                        {/* Nome, Email */}
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate flex items-center gap-1">
                            <span className="truncate max-w-[110px]">{u.nome || u.email.split('@')[0]}</span>
                            {isCurrentUser && (
                              <span className="bg-emerald-600 text-white text-[8px] font-black px-1 py-0.2 rounded uppercase tracking-wider shrink-0">
                                Você
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate font-mono max-w-[130px]">
                            {u.email}
                          </div>
                        </div>
                      </div>

                      {/* Perfil & Hora Entrada */}
                      <div className="text-right shrink-0">
                        <span className="inline-block px-1.5 py-0.2 rounded text-[8px] font-extrabold bg-slate-200/80 text-slate-700 border border-slate-300/50">
                          {u.perfil || 'Operador'}
                        </span>
                        <div className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-0.5 justify-end">
                          <Clock className="w-2.5 h-2.5 text-slate-400" />
                          <span>{formatHoraEntrada(u.online_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Informativo */}
          <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
            <span className="flex items-center gap-1 text-slate-500">
              <UserCheck className="w-3 h-3 text-emerald-500" />
              <span>Presence Global</span>
            </span>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>Recolher</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
