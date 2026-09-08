import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface OnlineUserPresence {
  id?: string;
  email: string;
  nome?: string;
  perfil?: string;
  online_at?: string;
}

interface PresenceContextType {
  onlineUsers: OnlineUserPresence[];
  isConnecting: boolean;
}

const PresenceContext = createContext<PresenceContextType>({
  onlineUsers: [],
  isConnecting: true,
});

export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUserPresence[]>([]);
  const [isConnecting, setIsConnecting] = useState(true);

  useEffect(() => {
    if (!session) {
      setOnlineUsers([]);
      setIsConnecting(false);
      return;
    }

    let channel: any = null;

    const setupPresence = async () => {
      try {
        let userEmail = session?.email;
        let userName = session?.nome;
        let userPerfil = session?.perfil;
        let userId = session?.user?.id;

        if (!userEmail) {
          const { data } = await supabase.auth.getUser();
          if (data?.user) {
            userEmail = data.user.email || 'operador@oficina.com';
            userName = data.user.user_metadata?.full_name || userEmail.split('@')[0];
            userId = data.user.id;
          }
        }

        if (!userEmail) {
          userEmail = `operador_${Math.floor(Math.random() * 1000)}@sgi.com`;
          userName = 'Operador Oficina';
        }

        const presenceKey = userEmail;

        channel = supabase.channel('online-users', {
          config: {
            presence: {
              key: presenceKey,
            },
          },
        });

        channel
          .on('presence', { event: 'sync' }, () => {
            const newState = channel.presenceState();
            const usersList: OnlineUserPresence[] = [];

            for (const key in newState) {
              const presences = newState[key] as any[];
              if (presences && presences.length > 0) {
                const latest = presences[presences.length - 1];
                usersList.push({
                  id: latest.id || key,
                  email: latest.email || key,
                  nome: latest.nome || key.split('@')[0],
                  perfil: latest.perfil || 'Operador',
                  online_at: latest.online_at || new Date().toISOString(),
                });
              }
            }

            // Deduplicar por e-mail
            const uniqueUsersMap = new Map<string, OnlineUserPresence>();
            usersList.forEach(u => uniqueUsersMap.set(u.email.toLowerCase(), u));

            // Reordenar colocando o usuário atual primeiro
            const sortedUsers = Array.from(uniqueUsersMap.values()).sort((a, b) => {
              if (a.email.toLowerCase() === userEmail?.toLowerCase()) return -1;
              if (b.email.toLowerCase() === userEmail?.toLowerCase()) return 1;
              return (a.nome || a.email).localeCompare(b.nome || b.email);
            });

            setOnlineUsers(sortedUsers);
            setIsConnecting(false);
          })
          .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            console.log('Utilizador conectado ao canal de presença:', key, newPresences);
          })
          .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            console.log('Utilizador desconectado do canal de presença:', key, leftPresences);
          });

        channel.subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              id: userId || userEmail,
              email: userEmail,
              nome: userName || userEmail?.split('@')[0] || 'Operador',
              perfil: userPerfil || 'Operador',
              online_at: new Date().toISOString(),
            });
          }
        });
      } catch (err) {
        console.error('Erro no Supabase Presence Provider:', err);
        setIsConnecting(false);
      }
    };

    setupPresence();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [session]);

  return (
    <PresenceContext.Provider value={{ onlineUsers, isConnecting }}>
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => useContext(PresenceContext);
