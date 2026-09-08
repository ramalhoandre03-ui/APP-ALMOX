import React from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import { Clock, ShieldAlert, LogOut, CheckCircle, Shield } from 'lucide-react';
import CompanyLogo from './CompanyLogo';

export default function TelaEspera() {
  const { session, logout } = useAuth();

  if (!session) return null;

  const isPending = session.status === 'Pendente';

  return (
    <div className="min-h-screen bg-[#fafafb] flex flex-col justify-between p-6 relative font-sans overflow-hidden">
      {/* Top corporate thin line */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#3a2573] via-violet-600 to-[#3a2573]" />

      {/* Subtle grid pattern background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />

      {/* Header section with CMPC branding */}
      <header className="w-full max-w-7xl mx-auto flex justify-between items-center relative z-10 pt-4">
        <div className="flex items-center space-x-3.5">
          <CompanyLogo height={48} />
          <div className="border-l border-slate-200 pl-3.5">
            <h1 className="text-sm font-black text-slate-900 tracking-tight uppercase leading-none">
              CMPC Industrial
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Portal de Sistemas
            </p>
          </div>
        </div>
        
        <div className="text-[10px] font-mono text-slate-400 font-bold bg-white border border-slate-200/80 px-3 py-1.5 rounded-full shadow-3xs">
          SISTEMA DE SEGURANÇA SGI
        </div>
      </header>

      {/* Main waiting room card */}
      <main className="flex-grow flex items-center justify-center py-12 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-lg w-full bg-white border border-slate-200 rounded-[32px] p-8 md:p-10 text-center space-y-8 shadow-xl shadow-slate-100/70 relative"
          id="waiting-room-card"
        >
          {/* Status Icon */}
          <div className="flex justify-center">
            {isPending ? (
              <div className="relative">
                <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-xl scale-125 animate-pulse" />
                <div className="relative bg-amber-50 text-amber-500 border border-amber-200/60 p-5 rounded-[24px] shadow-3xs">
                  <Clock className="w-10 h-10 animate-pulse" />
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute inset-0 bg-rose-500/10 rounded-full blur-xl scale-125 animate-pulse" />
                <div className="relative bg-rose-50 text-rose-500 border border-rose-200/60 p-5 rounded-[24px] shadow-3xs">
                  <ShieldAlert className="w-10 h-10" />
                </div>
              </div>
            )}
          </div>

          {/* Texts */}
          <div className="space-y-3.5">
            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
              isPending 
                ? 'bg-amber-50 text-amber-700 border-amber-200/60' 
                : 'bg-rose-50 text-rose-700 border-rose-200/60'
            }`}>
              {isPending ? 'Cadastro em Análise' : 'Acesso Revogado'}
            </span>
            
            <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight pt-1">
              {isPending ? 'Solicitação Sob Análise Técnica' : 'Acesso Bloqueado ou Revogado'}
            </h2>

            <p className="text-slate-500 text-xs md:text-sm leading-relaxed max-w-md mx-auto font-medium">
              {isPending ? (
                <span>
                  Sua solicitação de acesso ao <strong>Ecossistema CMPC Industrial</strong> foi recebida com sucesso. Por questões de segurança, aguarde a liberação do seu perfil pelo Administrador do Almoxarifado.
                </span>
              ) : (
                <span>
                  O seu acesso ao <strong>Ecossistema CMPC Industrial</strong> foi temporariamente revogado ou bloqueado pelo Administrador do Almoxarifado por motivos de conformidade de segurança SGI.
                </span>
              )}
            </p>
          </div>

          {/* User metadata table */}
          <div className="bg-slate-50 border border-slate-150/80 rounded-2xl p-4 text-left">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2.5">
              Identidade Registrada
            </span>
            <div className="space-y-1.5 font-mono text-[11px] text-slate-600">
              <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                <span className="text-slate-400">Nome:</span>
                <span className="font-bold text-slate-850 font-sans">{session.nome}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                <span className="text-slate-400">E-mail:</span>
                <span className="font-bold text-slate-850">{session.email}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                <span className="text-slate-400">Perfil Inicial:</span>
                <span className="font-bold text-violet-600 font-sans">{session.perfil || 'Operação'}</span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span className="text-slate-400">Status atual:</span>
                <span className={`font-black font-sans uppercase tracking-wider text-[10px] ${isPending ? 'text-amber-600' : 'text-rose-600'}`}>
                  {session.status}
                </span>
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="pt-2">
            <button
              onClick={logout}
              className="w-full py-4 bg-slate-900 hover:bg-slate-850 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition duration-150 flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-slate-900/10 border border-slate-800"
            >
              <LogOut className="w-4 h-4 text-rose-500" />
              <span>Sair / Voltar para o Login</span>
            </button>
          </div>
        </motion.div>
      </main>

      {/* Footer credits */}
      <footer className="w-full max-w-7xl mx-auto text-center py-4 border-t border-slate-200/50 relative z-10">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
          CMPC Industrial © {new Date().getFullYear()} • Todos os direitos reservados
        </p>
      </footer>
    </div>
  );
}
