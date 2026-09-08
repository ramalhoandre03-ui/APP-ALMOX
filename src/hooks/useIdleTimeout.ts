import { useEffect, useRef, useCallback } from 'react';
import { useLocation, rotasImunesInatividade, checkIsRotaOuModuloImune } from './useLocation';

interface UseIdleTimeoutOptions {
  onTimeout: () => void | Promise<void>;
  timeoutMs?: number; // Padrão: 15 minutos (900.000 ms)
  enabled?: boolean;  // Ativo apenas quando o usuário está logado
}

/**
 * Hook customizado de segurança para deslogar usuários inativos após N milissegundos.
 * Monitora interações do usuário (mousemove, mousedown, keydown, touchstart, scroll)
 * com throttling de 1 segundo para evitar sobrecarga de CPU.
 * 
 * Contém bloqueio cirúrgico de inatividade quando detecta o marcador DOM 'active-tv-mode-flag'
 * ou telas operacionais imunes (Previsão de Horas, Inventário, Expedição, Fardamento, Oficina Elétrica, Inspeções).
 */
export function useIdleTimeout({
  onTimeout,
  timeoutMs = 15 * 60 * 1000, // 15 minutos = 900.000ms
  enabled = true,
}: UseIdleTimeoutOptions) {
  const timerRef = useRef<NodeJS.Timeout | number | null>(null);
  const lastResetRef = useRef<number>(Date.now());
  const onTimeoutRef = useRef(onTimeout);

  // ORDEM 1: IMPORTAR O HOOK DE ROTA
  const location = useLocation();

  // ORDEM 2: CRIAR A LISTA DE ROTAS IMUNES E VERIFICAÇÃO
  // Verifica se a rota atual começa com alguma das rotas imunes
  const isRotaImune = rotasImunesInatividade.some(rota => location.pathname.startsWith(rota)) || checkIsRotaOuModuloImune(location.pathname);

  // Mantém a referência da função onTimeout atualizada
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  // Função para resetar o temporizador de inatividade
  const resetTimer = useCallback(() => {
    // Se estiver em tela operacional imune ou Modo TV, limpa o timer e aborta a contagem de inatividade
    const isImune = isRotaImune || checkIsRotaOuModuloImune();
    if (isImune) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Throttle de 1 segundo para não sobrecarregar a thread principal em eventos frequentes como mousemove/scroll
    const now = Date.now();
    if (now - lastResetRef.current < 1000) {
      return;
    }
    lastResetRef.current = now;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = setTimeout(async () => {
      // ORDEM 3: INTERCEPTAR A LÓGICA DE LOGOUT
      // Se estiver em uma tela operacional, ignora a inatividade e cancela o logout
      if (isRotaImune || checkIsRotaOuModuloImune()) {
        console.log("Inatividade ignorada: Usuário em tela operacional imune.");
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        return;
      }

      console.warn('[SEGURANÇA] Sessão expirada por inatividade de 15 minutos.');
      if (onTimeoutRef.current) {
        await onTimeoutRef.current();
      }
    }, timeoutMs);
  }, [timeoutMs, isRotaImune]);

  // ORDEM 4: Adiciona isRotaImune na matriz de dependências e pausa/limpa o timer se isRotaImune
  useEffect(() => {
    if (!enabled || isRotaImune) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Inicializa o primeiro timer
    lastResetRef.current = 0; // Força execução imediata no primeiro reset
    resetTimer();

    // Eventos de interação na janela a serem monitorados
    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll'
    ];

    const handleUserActivity = () => {
      // Verifica se está em rota ou tela operacional imune
      if (isRotaImune || checkIsRotaOuModuloImune()) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        return;
      }

      // Caso contrário, roda a lógica normal de reiniciar o timer de inatividade
      resetTimer();
    };

    // Adiciona os event listeners
    events.forEach((eventType) => {
      window.addEventListener(eventType, handleUserActivity, { passive: true });
    });

    // Cleanup de memória ao desmontar ou quando desabilitado/imune
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      events.forEach((eventType) => {
        window.removeEventListener(eventType, handleUserActivity);
      });
    };
  }, [enabled, resetTimer, isRotaImune]);
}
