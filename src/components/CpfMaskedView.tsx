import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Copy, Check, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface CpfMaskedViewProps {
  cpf?: string;
  alvoNome?: string;
  colaboradorId?: string;
  modulo?: string;
  className?: string;
  userEmail?: string;
  onToastError?: (msg: string) => void;
}

export function maskCpf(cpfRaw?: string): string {
  if (!cpfRaw || cpfRaw.trim() === '' || cpfRaw.trim() === 'N/A') return '***.***.***-**';
  const clean = cpfRaw.replace(/\D/g, '');
  if (clean.length === 11) {
    return `***.${clean.slice(3, 6)}.${clean.slice(6, 9)}-**`;
  }
  return '***.***.***-**';
}

export function formatCpf(cpfRaw?: string): string {
  if (!cpfRaw || cpfRaw.trim() === '' || cpfRaw.trim() === 'N/A') return 'N/A';
  const clean = cpfRaw.replace(/\D/g, '');
  if (clean.length === 11) {
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
  }
  return cpfRaw;
}

export default function CpfMaskedView({
  cpf = '',
  alvoNome = '',
  colaboradorId = '',
  modulo = 'Fardamento/Admissões',
  className = '',
  userEmail,
  onToastError
}: CpfMaskedViewProps) {
  const { session } = useAuth();

  // 1. Estado Local de Visibilidade (Valor Inicial: FALSE)
  const [isCpfVisible, setIsCpfVisible] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [localToastError, setLocalToastError] = useState<string | null>(null);

  // Timer para Auto-Hide após 10 segundos
  const autoHideTimerRef = useRef<NodeJS.Timeout | number | null>(null);

  // Limpeza na desmontagem do componente
  useEffect(() => {
    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
    };
  }, []);

  // 2. Lógica de Revelação com Log de Auditoria e Trava de Segurança
  const handleViewCpf = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Se já estiver visível, apenas oculta e limpa o timer
    if (isCpfVisible) {
      setIsCpfVisible(false);
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
      return;
    }

    const activeEmail = userEmail || session?.email || session?.user?.email || 'operador@cmpc.com.br';
    const targetName = alvoNome || colaboradorId || 'NÃO INFORMADO';

    try {
      // Tenta gravar o log no Supabase ANTES de alterar o estado de visibilidade
      const { error } = await supabase.from('logs_acesso_sensivel').insert([
        {
          usuario_email: activeEmail,
          acao: 'VISUALIZACAO_CPF_SENSIVEL',
          alvo_nome: targetName,
          modulo: modulo,
          created_at: new Date().toISOString()
        }
      ]);

      // 3. Trava de Segurança (Fail-safe): se o insert falhar, o CPF NÃO é revelado
      if (error) {
        console.error('Falha ao registrar log de auditoria no Supabase:', error);
        const errMsg = "Erro ao registrar auditoria. Visualização bloqueada.";
        setLocalToastError(errMsg);
        if (onToastError) onToastError(errMsg);
        setTimeout(() => setLocalToastError(null), 4500);
        return; // Retorna sem revelar!
      }

      // Sucesso na auditoria -> revela o CPF
      setIsCpfVisible(true);

      // 4. Limpeza (Auto-Hide de 10 segundos)
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
      autoHideTimerRef.current = setTimeout(() => {
        setIsCpfVisible(false);
        autoHideTimerRef.current = null;
      }, 10000);

    } catch (err: any) {
      console.error('Erro na auditoria LGPD ao revelar CPF:', err);
      const errMsg = "Erro ao registrar auditoria. Visualização bloqueada.";
      setLocalToastError(errMsg);
      if (onToastError) onToastError(errMsg);
      setTimeout(() => setLocalToastError(null), 4500);
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const realCpf = formatCpf(cpf);
    if (!realCpf || realCpf === 'N/A') return;

    try {
      const activeEmail = userEmail || session?.email || session?.user?.email || 'operador@cmpc.com.br';
      const targetName = alvoNome || colaboradorId || 'NÃO INFORMADO';

      await supabase.from('logs_acesso_sensivel').insert([
        {
          usuario_email: activeEmail,
          acao: 'COPIOU_CPF',
          alvo_nome: targetName,
          modulo: modulo,
          created_at: new Date().toISOString()
        }
      ]);

      await navigator.clipboard.writeText(realCpf);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar CPF:', err);
    }
  };

  const formattedUnmasked = formatCpf(cpf);
  const formattedMasked = maskCpf(cpf);

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono relative ${className}`}>
      {/* Exibição condicional do CPF */}
      <span className={isCpfVisible ? "text-amber-300 font-bold" : "text-slate-400"}>
        {isCpfVisible ? formattedUnmasked : formattedMasked}
      </span>

      <span className="inline-flex items-center gap-0.5 relative shrink-0">
        {/* Ícone do Olho (EyeOff se mascarado, Eye se visível) */}
        <button
          type="button"
          onClick={handleViewCpf}
          title={isCpfVisible ? "Ocultar CPF (Oculta automaticamente em 10s)" : "Revelar CPF (Ação auditada)"}
          className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-indigo-400 cursor-pointer"
        >
          {isCpfVisible ? (
            <Eye className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          ) : (
            <EyeOff className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>

        {isCpfVisible && (
          <button
            type="button"
            onClick={handleCopy}
            title="Copiar CPF real (Ação auditada)"
            className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-emerald-400 cursor-pointer relative"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}

        {copied && (
          <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap animate-fade-in z-30">
            Copiado!
          </span>
        )}
      </span>

      {/* Fail-safe Error Toast */}
      {localToastError && (
        <span className="fixed bottom-6 right-6 z-[99999] bg-rose-950 text-rose-200 border border-rose-800 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-3">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{localToastError}</span>
        </span>
      )}
    </span>
  );
}

