import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Sparkles, Bug, Copy, Check, X, Terminal } from 'lucide-react';

interface BotaoSincronizacaoBIProps {
  /**
   * Callback invocado automaticamente quando o progresso atinge 100%
   * para recarregar os dados na tela.
   */
  onSyncComplete?: () => void;
  /**
   * Classes CSS adicionais
   */
  className?: string;
  /**
   * Texto customizado do botão
   */
  label?: string;
}

export function BotaoSincronizacaoBI({
  onSyncComplete,
  className = '',
  label = 'Forçar Atualização BI'
}: BotaoSincronizacaoBIProps) {
  const [syncing, setSyncing] = useState<boolean>(false);
  const [progresso, setProgresso] = useState<number>(0);
  const [mensagem, setMensagem] = useState<string>('');
  const [lastSuccess, setLastSuccess] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);

  // Estados do Painel de Debug
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(false);
  const [debugJson, setDebugJson] = useState<string | null>(null);
  const [loadingDebug, setLoadingDebug] = useState<boolean>(false);
  const [copiedDebug, setCopiedDebug] = useState<boolean>(false);
  const [debugTimestamp, setDebugTimestamp] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Parar polling
  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Requisitar /api/debug-status para diagnóstico em tempo real
  const handleVerDebug = async () => {
    setLoadingDebug(true);
    try {
      const response = await fetch('/api/debug-status', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição HTTP ${response.status}`);
      }

      const data = await response.json();
      setDebugJson(JSON.stringify(data, null, 2));
      setShowDebugPanel(true);
      setDebugTimestamp(new Date().toLocaleTimeString('pt-BR'));
    } catch (err: any) {
      console.error('Erro ao consultar /api/debug-status:', err);
      setDebugJson(JSON.stringify({ error: err.message || 'Falha ao buscar status de debug' }, null, 2));
      setShowDebugPanel(true);
    } finally {
      setLoadingDebug(false);
    }
  };

  // Iniciar consulta periódica (a cada 1 segundo)
  const startPollingStatus = () => {
    stopPolling();
    intervalRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/status-bi', {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Falha ao obter status de sincronização');
        }

        const data = await response.json();
        const currentProgresso = typeof data.progresso === 'number' ? data.progresso : 0;
        const currentMensagem = data.mensagem || 'Processando dados...';

        setProgresso(currentProgresso);
        setMensagem(currentMensagem);

        // Se o painel de debug estiver visível durante a sincronização, atualiza-o automaticamente também
        if (showDebugPanel) {
          fetch('/api/debug-status')
            .then(res => res.json())
            .then(dData => {
              setDebugJson(JSON.stringify(dData, null, 2));
              setDebugTimestamp(new Date().toLocaleTimeString('pt-BR'));
            })
            .catch(() => {});
        }

        // Quando chega a 100%, finaliza sincronização e aciona reload
        if (currentProgresso >= 100) {
          stopPolling();
          setSyncing(false);
          setLastSuccess(true);

          if (onSyncComplete) {
            onSyncComplete();
          }

          // Reseta a notificação visual de sucesso após 5 segundos
          setTimeout(() => {
            setLastSuccess(false);
          }, 5000);
        }
      } catch (err: any) {
        console.error('Erro na consulta do status BI:', err);
      }
    }, 1000);
  };

  // Aciona a atualização manual via POST /api/forcar-atualizacao-bi
  const handleForcarAtualizacao = async () => {
    if (syncing) return;

    setSyncing(true);
    setProgresso(0);
    setMensagem('Solicitando sincronização...');
    setErro(null);
    setLastSuccess(false);

    try {
      const response = await fetch('/api/forcar-atualizacao-bi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.mensagem || errData.error || 'Erro ao iniciar atualização');
      }

      // Inicia imediatamente o polling a cada 1 segundo
      startPollingStatus();
    } catch (err: any) {
      console.error('Erro ao acionar forçar atualização BI:', err);
      setErro(err.message || 'Falha na requisição com o servidor.');
      setSyncing(false);
      stopPolling();
    }
  };

  // Copia o JSON para a área de transferência
  const handleCopyJson = () => {
    if (!debugJson) return;
    navigator.clipboard.writeText(debugJson);
    setCopiedDebug(true);
    setTimeout(() => setCopiedDebug(false), 2000);
  };

  // Limpeza ao desmontar componente
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  return (
    <div className={`flex flex-col gap-2.5 ${className}`} id="painel-sincronizacao-bi">
      {/* LINHA SUPERIOR: BOTÃO DE ATUALIZAÇÃO E BOTÃO DE DEBUG */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <button
          type="button"
          onClick={handleForcarAtualizacao}
          disabled={syncing}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer border ${
            syncing
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 cursor-not-allowed opacity-80'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 hover:shadow-amber-500/20 active:scale-95'
          }`}
          title="Forçar atualização manual dos dados do BI com o ERP"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-amber-300' : 'text-slate-950'}`} />
          <span>{syncing ? 'Sincronizando BI...' : label}</span>
        </button>

        {/* BOTÃO SECUNDÁRIO "VER DEBUG" */}
        <button
          type="button"
          onClick={handleVerDebug}
          disabled={loadingDebug}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer border ${
            showDebugPanel
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border-slate-700 hover:border-amber-500/30'
          }`}
          title="Consultar endpoint GET /api/debug-status para diagnóstico do robô e servidor"
        >
          <Bug className={`w-3.5 h-3.5 text-amber-400 ${loadingDebug ? 'animate-spin' : ''}`} />
          <span>{loadingDebug ? 'Buscando...' : 'Ver Debug'}</span>
        </button>

        {/* FEEDBACK DE MENSAGEM CURTA OU SUCESSO */}
        {lastSuccess && !syncing && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Dados recarregados com sucesso!</span>
          </span>
        )}

        {erro && !syncing && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 text-xs font-bold animate-in fade-in">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>{erro}</span>
          </span>
        )}
      </div>

      {/* BARRA DE PROGRESSO E STATUS EM TEMPO REAL (EXIBIDA ENQUANTO SINCRONIZA OU EM CONCLUSÃO) */}
      {(syncing || (progresso > 0 && progresso < 100)) && (
        <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-3 space-y-2 shadow-inner transition-all animate-in fade-in slide-in-from-top-1">
          {/* HEADER DO STATUS: MENSAGEM E PORCENTAGEM */}
          <div className="flex items-center justify-between text-xs font-semibold gap-2">
            <div className="flex items-center gap-2 text-slate-200 truncate">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
              <span className="truncate">{mensagem || 'Sincronizando dados com o ERP...'}</span>
            </div>
            <span className="font-mono font-black text-amber-400 shrink-0 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {progresso}%
            </span>
          </div>

          {/* BARRA DE PROGRESSO VISUAL */}
          <div className="w-full bg-slate-800/90 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-700/50">
            <div
              className="bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 h-full rounded-full transition-all duration-300 ease-out shadow-sm"
              style={{ width: `${Math.min(100, Math.max(0, progresso))}%` }}
            />
          </div>
        </div>
      )}

      {/* PAINEL COLAPSÁVEL DE DEBUG (EXIBE O JSON FORMATADO EM TEMPO REAL) */}
      {showDebugPanel && (
        <div className="bg-slate-950/95 border border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-2xl transition-all animate-in fade-in slide-in-from-top-2 w-full mt-1">
          {/* BARRA DE TÍTULO DO DEBUG */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2 text-xs">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-400" />
              <span className="font-mono font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                Diagnóstico BI (<code className="text-amber-400 font-mono">GET /api/debug-status</code>)
              </span>
              {debugTimestamp && (
                <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                  • Atualizado às {debugTimestamp}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleVerDebug}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-[10px] font-mono font-bold transition flex items-center gap-1 cursor-pointer border border-slate-700"
                title="Atualizar JSON do servidor agora"
              >
                <RefreshCw className={`w-3 h-3 ${loadingDebug ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </button>

              <button
                type="button"
                onClick={handleCopyJson}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-mono font-bold transition flex items-center gap-1 cursor-pointer border border-slate-700"
                title="Copiar JSON formatado"
              >
                {copiedDebug ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedDebug ? 'Copiado!' : 'Copiar'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDebugPanel(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                title="Fechar painel de debug"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ÁREA COM CÓDIGO JSON FORMATADO */}
          <pre className="p-3.5 bg-slate-900/90 text-amber-300 font-mono text-[11px] leading-relaxed rounded-xl border border-slate-800 overflow-x-auto max-h-72 select-all shadow-inner custom-scrollbar">
            {debugJson || '// Carregando dados de diagnóstico...'}
          </pre>
        </div>
      )}
    </div>
  );
}

export default BotaoSincronizacaoBI;
