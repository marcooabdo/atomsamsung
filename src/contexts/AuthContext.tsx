import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Usuario = Database['public']['Tables']['usuarios']['Row'];

interface Unidade {
  id: string;
  nome: string;
}

interface AuthContextType {
  user: User | null;
  usuario: Usuario | null;
  session: Session | null;
  loading: boolean;
  unidadeAtual: string | null;
  unidades: Unidade[];
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUsuario?: (updatedUsuario: Usuario) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [unidades, setUnidades] = useState<Unidade[]>([]);

  const unidadeAtual = usuario?.unidade_id || null;

  const loadUnidades = async () => {
    const { data } = await supabase
      .from('unidades')
      .select('id, nome')
      .order('nome');
    if (data) setUnidades(data);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const { data } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          setUsuario(data);
          await loadUnidades();
        }

        setLoading(false);
      })();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const { data } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          setUsuario(data);
          await loadUnidades();
        } else {
          setUsuario(null);
          setUnidades([]);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
    }
    setUser(null);
    setSession(null);
    setUsuario(null);
    setUnidades([]);
  };

  const updateUsuario = (updatedUsuario: Usuario) => {
    setUsuario(updatedUsuario);
  };

  const value = {
    user,
    usuario,
    session,
    loading,
    unidadeAtual,
    unidades,
    signIn,
    signOut,
    updateUsuario,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
