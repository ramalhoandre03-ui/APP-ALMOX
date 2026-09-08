import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface DebugContextType {
  debugMode: boolean;
  toggleDebugMode: () => void;
  setDebugMode: (val: boolean) => void;
}

const DebugContext = createContext<DebugContextType>({
  debugMode: false,
  toggleDebugMode: () => {},
  setDebugMode: () => {}
});

export function DebugProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [debugMode, setDebugModeState] = useState<boolean>(() => {
    return localStorage.getItem('sgi_debug_mode') === 'true';
  });

  // Automatically enable debug mode for Admin Master / Administrador / ADMIN
  useEffect(() => {
    if (session?.perfil) {
      const perfilLower = session.perfil.toLowerCase();
      if (
        perfilLower === 'admin master' ||
        perfilLower === 'administrador' ||
        perfilLower === 'admin'
      ) {
        setDebugModeState(true);
      }
    }
  }, [session?.perfil]);

  // Secret keyboard shortcut (Ctrl + Shift + D) to toggle debug mode for devs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setDebugModeState(prev => {
          const next = !prev;
          localStorage.setItem('sgi_debug_mode', String(next));
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleDebugMode = () => {
    setDebugModeState(prev => {
      const next = !prev;
      localStorage.setItem('sgi_debug_mode', String(next));
      return next;
    });
  };

  const setDebugMode = (val: boolean) => {
    setDebugModeState(val);
    localStorage.setItem('sgi_debug_mode', String(val));
  };

  return (
    <DebugContext.Provider value={{ debugMode, toggleDebugMode, setDebugMode }}>
      {children}
    </DebugContext.Provider>
  );
}

export function useDebugMode() {
  return useContext(DebugContext);
}

/**
 * Component that renders its children ONLY if debugMode is active.
 * Otherwise returns null to cleanly hide developer debug elements from end users.
 */
export function DebugOnly({ children }: { children: React.ReactNode }) {
  const { debugMode } = useDebugMode();
  if (!debugMode) return null;
  return <>{children}</>;
}
