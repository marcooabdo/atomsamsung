import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo: string;
  unidade_id: string | null;
  ativo: boolean;
  numero_tecnico?: string;
  [key: string]: unknown;
}

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
  unidadesAdicionais: string[];
  allUserUnits: string[];
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUsuario: (u: Usuario) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [unidadesAdicionais, setUnidadesAdicionais] = useState<string[]>([]);

  const unidadeAtual = usuario?.unidade_id || null;

  const allUserUnits = unidadeAtual
    ? [unidadeAtual, ...unidadesAdicionais]
    : [...unidadesAdicionais];

  const loadUnidades = async () => {
    const { data } = await supabase
      .from('unidades')
      .select('id, nome')
      .order('nome');
    if (data) setUnidades(data);
  };

  const loadUserData = async (authUser: User) => {
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    setUsuario(data);
    await loadUnidades();

    const { data: extras } = await supabase
      .from('usuario_unidades')
      .select('unidade_id')
      .eq('usuario_id', authUser.id);
    setUnidadesAdicionais(extras?.map(r => r.unidade_id) || []);
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!mounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        loadUserData(currentSession.user).then(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        loadUserData(newSession.user);
      } else {
        setUsuario(null);
        setUnidades([]);
        setUnidadesAdicionais([]);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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
    setUnidadesAdicionais([]);
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
    unidadesAdicionais,
    allUserUnits,
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
