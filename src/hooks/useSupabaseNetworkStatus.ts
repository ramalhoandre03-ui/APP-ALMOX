/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface SupabaseNetworkStatusState {
  isOnline: boolean;
  isSupabaseConnected: boolean;
  latencyMs: number | null;
  isChecking: boolean;
  lastCheckedTime: string | null;
  checkConnectivity: () => Promise<boolean>;
}

export function useSupabaseNetworkStatus(): SupabaseNetworkStatusState {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(true);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [lastCheckedTime, setLastCheckedTime] = useState<string | null>(() => new Date().toISOString());

  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      setIsSupabaseConnected(false);
      return false;
    }

    setIsChecking(true);
    const start = performance.now();

    try {
      // 1. Testa conectividade real com a API do Supabase
      const { error } = await supabase
        .from('requisicoes')
        .select('id', { count: 'exact', head: true })
        .limit(1);

      const end = performance.now();
      const measuredLatency = Math.max(1, Math.round(end - start));

      if (!error) {
        setIsOnline(true);
        setIsSupabaseConnected(true);
        setLatencyMs(measuredLatency);
        setLastCheckedTime(new Date().toISOString());
        setIsChecking(false);
        return true;
      } else {
        // Fallback para endpoint de health caso tabela esteja inacessível
        const healthRes = await fetch(`/api/health?t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store'
        });
        const fallbackEnd = performance.now();
        const fallbackLatency = Math.max(1, Math.round(fallbackEnd - start));

        if (healthRes.ok) {
          setIsOnline(true);
          setIsSupabaseConnected(true);
          setLatencyMs(fallbackLatency);
          setLastCheckedTime(new Date().toISOString());
          setIsChecking(false);
          return true;
        } else {
          setIsSupabaseConnected(false);
          setIsChecking(false);
          return false;
        }
      }
    } catch (error) {
      console.warn('[Supabase Network] Falha ao verificar conexão:', error);
      setIsSupabaseConnected(false);
      setIsChecking(false);
      return false;
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkConnectivity();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsSupabaseConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificação inicial
    checkConnectivity();

    // Verificação periódica a cada 25 segundos
    const intervalId = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        checkConnectivity();
      }
    }, 25000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, [checkConnectivity]);

  return {
    isOnline,
    isSupabaseConnected,
    latencyMs,
    isChecking,
    lastCheckedTime,
    checkConnectivity
  };
}
