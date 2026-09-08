import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, RefreshCw } from 'lucide-react';

interface SincronizacaoInfo {
  ultima_atualizacion?: string; // ISO format
  ultima_atualizacao?: string;  // Formatted string
}

export const StatusRobo: React.FC = () => {
  const [data, setData] = useState<SincronizacaoInfo | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [diffMinutos, setDiffMinutos] = useState<number | null>(null);

  const fetchStatus = async () => {
    try {
      const { data: result, error: supabaseError } = await supabase
        .from('configuracao_sistema')
        .select('ultima_atualizacion, ultima_atualizacao')
        .eq('id', 'geral')
        .maybeSingle();

      if (supabaseError) {
        console.error('Erro ao buscar status do robô:', supabaseError);
        setError(true);
        return;
      }

      if (result) {
        setData(result);
        setError(false);
        calculateStatus(result.ultima_atualizacion);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error('Erro na requisição de status:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const calculateStatus = (isoString?: string) => {
    if (!isoString) {
      setIsOnline(false);
      setDiffMinutos(null);
      return;
    }

    const lastUpdate = new Date(isoString);
    const now = new Date();
    
    if (isNaN(lastUpdate.getTime())) {
      setIsOnline(false);
      setDiffMinutos(null);
      return;
    }

    const diffMs = now.getTime() - lastUpdate.getTime();
    const diffMins = diffMs / 1000 / 60;
    
    setDiffMinutos(Math.round(diffMins));
    
    // Se a diferença for menor ou igual a 10 minutos (e positiva, ou ligeiramente negativa por drift de relógio)
    if (diffMins <= 10) {
      setIsOnline(true);
    } else {
      setIsOnline(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Recalcula o status a cada 30 segundos usando os dados já carregados para que o contador de minutos/tempo real flua
  useEffect(() => {
    if (!data?.ultima_atualizacion) return;

    const interval = setInterval(() => {
      calculateStatus(data.ultima_atualizacion);
    }, 30000);

    return () => clearInterval(interval);
  }, [data]);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-inner text-slate-400">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Verificando Robô...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full flex items-start gap-2.5 bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-inner">
        <span className="relative flex h-2 w-2 mt-1 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-[0_0_8px_#f43f5e]"></span>
        </span>
        <div className="flex flex-col text-left min-w-0">
          <span className="text-rose-400 font-extrabold uppercase text-[10px] tracking-wide">ROBÔ FORA DO AR</span>
          <span className="text-[9px] text-slate-400 font-medium">Sem comunicação com Supabase</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex items-start gap-2.5 bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-inner select-none">
      <div className="relative flex h-2.5 w-2.5 mt-0.5 shrink-0">
        {isOnline ? (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
          </>
        ) : (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-70"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 shadow-[0_0_10px_#f43f5e]"></span>
          </>
        )}
      </div>

      <div className="flex flex-col text-left leading-snug min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className={`font-black uppercase text-[10px] tracking-wide ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isOnline ? 'SISTEMA ATUALIZADO' : 'ATUALIZAÇÃO ATRASADA'}
          </span>
          <Activity className={`w-3 h-3 shrink-0 ${isOnline ? 'text-emerald-400/80' : 'text-rose-400/80 animate-pulse'}`} />
        </div>
        <span className="text-[9px] text-slate-400 font-medium mt-0.5 break-words">
          Última sincronização: <strong className="text-slate-200 font-bold">{data.ultima_atualizacao || 'Indisponível'}</strong>
          {diffMinutos !== null && (
            <span className="text-slate-400 block sm:inline"> ({diffMinutos <= 0 ? 'agora há pouco' : `há ${diffMinutos} min`})</span>
          )}
        </span>
      </div>
    </div>
  );
};
