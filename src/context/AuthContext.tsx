import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { useLocation, rotasImunesInatividade, checkIsRotaOuModuloImune } from '../hooks/useLocation';
import { AlertTriangle, X } from 'lucide-react';

export interface UserSession {
  user: any | null;
  perfil: 'Operação' | 'Almoxarifado' | 'Administrador' | 'RH' | 'ALMOXARIFADO' | 'ADMIN' | 'OPERADOR/MOTORISTA' | 'ELETRICISTA' | null;
  status: 'Aprovado' | 'Pendente' | 'Bloqueado' | null;
  nome: string;
  email: string;
}

interface AuthContextType {
  session: UserSession | null;
  isLoading: boolean;
  sessionExpiredNotice: string | null;
  clearExpiredNotice: () => void;
  login: (email: string, pass: string) => Promise<UserSession>;
  loginBiometric: (userData: any) => Promise<UserSession>;
  register: (email: string, pass: string, nome: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null);

  const clearExpiredNotice = () => setSessionExpiredNotice(null);

  const fetchUserPermissions = async (userId: string, userEmail: string): Promise<UserSession> => {
    try {
      // Try to fetch by user id
      let data: any = null;
      try {
        const res = await supabase
          .from('usuarios_permissoes')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (res.data) data = res.data;
      } catch (e) {
        console.warn('Could not query permission by id:', e);
      }

      // Fallback: fetch by email
      if (!data) {
        try {
          const { data: emailData } = await supabase
            .from('usuarios_permissoes')
            .select('*')
            .eq('email', userEmail.trim().toLowerCase())
            .maybeSingle();
          if (emailData) data = emailData;
        } catch (e) {
          console.warn('Could not query permission by email:', e);
        }
      }

      // Fallback: If no record exists, create a default one
      if (!data) {
        const defaultRecord = {
          id: userId,
          nome: userEmail.split('@')[0],
          email: userEmail.trim().toLowerCase(),
          perfil: 'Operação',
          status_acesso: 'Pendente'
        };

        try {
          const { data: upsertedData } = await supabase
            .from('usuarios_permissoes')
            .upsert(defaultRecord, { onConflict: 'email' })
            .select()
            .maybeSingle();
          data = upsertedData || defaultRecord;
        } catch (upsertError) {
          try {
            const { data: retryData } = await supabase
              .from('usuarios_permissoes')
              .upsert(defaultRecord)
              .select()
              .maybeSingle();
            data = retryData || defaultRecord;
          } catch (retryError) {
            data = defaultRecord;
          }
        }
      }

      const perfil = (data.perfil || 'Operação') as 'Operação' | 'Almoxarifado' | 'Administrador' | 'RH' | 'ALMOXARIFADO' | 'ADMIN' | 'OPERADOR/MOTORISTA' | 'ELETRICISTA';
      const status = (data.status_acesso || 'Pendente') as 'Aprovado' | 'Pendente' | 'Bloqueado';
      const nome = data.nome || userEmail.split('@')[0];

      return {
        user: { id: userId },
        perfil,
        status,
        nome,
        email: userEmail
      };
    } catch (err) {
      console.warn('Failed to load user permissions (using default fallback):', err);
      return {
        user: { id: userId },
        perfil: 'Operação',
        status: 'Pendente',
        nome: userEmail.split('@')[0],
        email: userEmail
      };
    }
  };

  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('Supabase getSession warning:', error.message);
      }
      const authSession = data?.session;
      if (authSession?.user) {
        const fullSession = await fetchUserPermissions(authSession.user.id, authSession.user.email || '');
        setSession(fullSession);
        return;
      }

      // Check biometric local session
      const cachedBio = localStorage.getItem('cmpc_biometric_session');
      if (cachedBio) {
        try {
          const parsed = JSON.parse(cachedBio);
          if (parsed && parsed.nome) {
            setSession(parsed);
            return;
          }
        } catch {}
      }

      setSession(null);
    } catch (e) {
      console.warn('Supabase getSession network failure:', e);
      const cachedBio = localStorage.getItem('cmpc_biometric_session');
      if (cachedBio) {
        try {
          setSession(JSON.parse(cachedBio));
        } catch {}
      } else {
        setSession(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ORDEM 1: Obter a localização da rota atual
  const location = useLocation();

  // ORDEM 2: Checagem de rota imune
  const isRotaImune = rotasImunesInatividade.some(rota => location.pathname.startsWith(rota)) || checkIsRotaOuModuloImune(location.pathname);

  // Callback acionado quando estoura os 15 minutos de inatividade
  const handleIdleTimeout = async () => {
    // ORDEM 3: INTERCEPTAR A LÓGICA DE LOGOUT
    // Se estiver em uma tela operacional, ignora a inatividade e cancela o logout
    if (isRotaImune || checkIsRotaOuModuloImune()) {
      console.log("Inatividade ignorada: Usuário em tela operacional imune.");
      return; 
    }

    // Verificação de segurança: se o Modo TV estiver ativo no DOM, cancela o logout
    if (typeof document !== 'undefined' && document.getElementById('active-tv-mode-flag') !== null) {
      console.info('[SEGURANÇA] Logout por inatividade cancelado: Modo TV (#active-tv-mode-flag) ativo.');
      return;
    }

    console.warn('[INATIVIDADE] 15 minutos sem interações detectadas. Executando logout automático...');
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Erro ao efetuar signOut por inatividade:', err);
    }

    // Limpa estado local e tokens de sessão
    try {
      localStorage.removeItem('sb-access-token');
      localStorage.removeItem('sb-refresh-token');
    } catch {}

    setSession(null);
    const msg = 'Sua sessão expirou por inatividade. Faça login novamente.';
    setSessionExpiredNotice(msg);

    // Redireciona o usuário para a tela de login (/login)
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState({}, '', '/login');
      } catch {}
      // Alerta imediato
      alert(msg);
    }
  };

  // Instancia o hook de inatividade de 15 min (900.000 ms)
  useIdleTimeout({
    onTimeout: handleIdleTimeout,
    timeoutMs: 15 * 60 * 1000, // 15 minutos
    enabled: !!session?.user,  // Ativo apenas com usuário logado
  });

  useEffect(() => {
    refreshSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, authSession) => {
      try {
        if (authSession?.user) {
          const fullSession = await fetchUserPermissions(authSession.user.id, authSession.user.email || '');
          setSession(fullSession);
        } else {
          setSession(null);
        }
      } catch (err) {
        console.warn('Error on auth state change:', err);
      } finally {
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string): Promise<UserSession> => {
    setSessionExpiredNotice(null);
    let authRes: any = null;
    try {
      authRes = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: pass
      });
    } catch (fetchErr: any) {
      console.warn('signInWithPassword network error:', fetchErr);
      throw new Error('Falha de conexão com o servidor. Verifique sua conexão com a internet e tente novamente.');
    }

    const { data, error } = authRes || {};

    if (error) {
      throw error;
    }

    if (!data?.user) {
      throw new Error('Usuário inválido ou não autenticado.');
    }

    const fullSession = await fetchUserPermissions(data.user.id, data.user.email || '');
    setSession(fullSession);
    return fullSession;
  };

  const loginBiometric = async (userData: any): Promise<UserSession> => {
    setSessionExpiredNotice(null);
    const userId = String(userData.id || Date.now());
    const userEmail = userData.email || (userData.nome ? `${userData.nome.toLowerCase().replace(/\s+/g, '.')}@cmpc.com.br` : 'operador@cmpc.com.br');
    
    let fullSession: UserSession;
    try {
      fullSession = await fetchUserPermissions(userId, userEmail);
    } catch {
      fullSession = {
        user: { id: userId },
        perfil: 'Almoxarifado',
        status: 'Aprovado',
        nome: userData.nome || 'Colaborador',
        email: userEmail
      };
    }

    if (userData.perfil) {
      fullSession.perfil = userData.perfil;
    }
    if (userData.nome) {
      fullSession.nome = userData.nome;
    }
    // Garante status Aprovado para login facial homologado
    fullSession.status = 'Aprovado';

    try {
      localStorage.setItem('cmpc_biometric_session', JSON.stringify(fullSession));
    } catch {}

    setSession(fullSession);
    return fullSession;
  };

  const register = async (email: string, pass: string, nome: string): Promise<void> => {
    setSessionExpiredNotice(null);
    const cleanEmail = email.trim().toLowerCase();
    
    let authRes: any = null;
    try {
      authRes = await supabase.auth.signUp({
        email: cleanEmail,
        password: pass
      });
    } catch (fetchErr: any) {
      console.warn('signUp network error:', fetchErr);
      throw new Error('Falha de conexão com o servidor. Verifique sua conexão com a internet e tente novamente.');
    }

    const { data, error } = authRes || {};

    if (error) {
      throw error;
    }

    if (data?.user) {
      // Write user permissions immediately
      try {
        await supabase
          .from('usuarios_permissoes')
          .upsert({
            id: data.user.id,
            nome: nome.trim(),
            email: cleanEmail,
            perfil: 'Operação',
            status_acesso: 'Pendente'
          }, { onConflict: 'email' });
      } catch (insertError) {
        console.warn('Notice writing to usuarios_permissoes table inside AuthContext:', insertError);
      }
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      localStorage.removeItem('cmpc_biometric_session');
      localStorage.removeItem('sb-access-token');
      localStorage.removeItem('sb-refresh-token');
    } catch {}
    setSession(null);
    setSessionExpiredNotice(null);
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, sessionExpiredNotice, clearExpiredNotice, login, loginBiometric, register, logout, refreshSession }}>
      {/* Toast flutuante global para aviso de inatividade expirada */}
      {sessionExpiredNotice && (
        <div className="fixed top-5 right-5 z-[99999] max-w-md bg-amber-500 text-slate-950 p-4 rounded-2xl shadow-2xl border-2 border-amber-300 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-slate-950 shrink-0 animate-bounce" />
            <div>
              <p className="font-extrabold text-xs uppercase tracking-wider text-slate-950">Sessão Expirada</p>
              <p className="text-xs font-semibold text-slate-900 mt-0.5">{sessionExpiredNotice}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSessionExpiredNotice(null)}
            className="p-1 hover:bg-amber-600/30 rounded-lg transition-colors cursor-pointer text-slate-950"
            title="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

