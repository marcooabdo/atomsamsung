import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface Profissional {
  id: string;
  usuario_id: string;
  unidade_id: string;
  time: 'front_office' | 'inside_sales';
  nivel_atual_id: string | null;
  data_inicio_nivel: string | null;
  meses_consecutivos_validos: number;
  ativo: boolean;
  observacoes: string | null;
  nivel?: {
    nome: string;
    ordem: number;
    estrelas_necessarias: number;
    meses_consecutivos: number;
    cor: string;
  };
  usuario?: {
    nome: string;
    email: string;
  };
  unidade?: {
    nome: string;
  };
}

export interface Nivel {
  id: string;
  nome: string;
  ordem: number;
  estrelas_necessarias: number;
  meses_consecutivos: number;
  cor: string;
  descricao: string | null;
  ativo: boolean;
}

export interface Pilar {
  id: string;
  nome: string;
  descricao: string | null;
  time_aplicavel: string[];
  tipo_metrica: 'quantidade' | 'percentual' | 'binario';
  ordem: number;
  ativo: boolean;
}

export interface RegraEstrela {
  id: string;
  pilar_id: string;
  time: 'front_office' | 'inside_sales';
  valor_minimo: number;
  valor_maximo: number | null;
  estrelas: number;
  ativo: boolean;
  pilar?: Pilar;
}

export interface EstrelaMes {
  profissional_id: string;
  mes_referencia: string;
  pilar_id: string;
  valor_metrica: number;
  estrelas_conquistadas: number;
  pilar?: Pilar;
}

interface SkywalkerContextType {
  profissionais: Profissional[];
  niveis: Nivel[];
  pilares: Pilar[];
  regrasEstrelas: RegraEstrela[];
  loading: boolean;
  mesReferencia: string;
  setMesReferencia: (mes: string) => void;
  loadProfissionais: () => Promise<void>;
  loadNiveis: () => Promise<void>;
  loadPilares: () => Promise<void>;
  loadRegrasEstrelas: () => Promise<void>;
  calcularEstrelasMes: (profissionalId: string, mesRef: string) => Promise<void>;
  recalcularTodasEstrelasMes: (mesRef: string) => Promise<void>;
  verificarElegibilidade: (profissionalId: string) => Promise<any>;
}

const SkywalkerContext = createContext<SkywalkerContextType | null>(null);

export function SkywalkerProvider({ children }: { children: ReactNode }) {
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [niveis, setNiveis] = useState<Nivel[]>([]);
  const [pilares, setPilares] = useState<Pilar[]>([]);
  const [regrasEstrelas, setRegrasEstrelas] = useState<RegraEstrela[]>([]);
  const [loading, setLoading] = useState(false);
  const [mesReferencia, setMesReferencia] = useState(
    new Date().toISOString().slice(0, 7) + '-01'
  );

  const loadProfissionais = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('skywalker_profissionais')
      .select(`
        *,
        nivel:skywalker_niveis(nome, ordem, estrelas_necessarias, meses_consecutivos, cor),
        usuario:usuarios(nome, email),
        unidade:unidades(nome)
      `)
      .eq('ativo', true)
      .order('usuario(nome)');

    if (!error && data) {
      setProfissionais(data);
    }
    setLoading(false);
  }, []);

  const loadNiveis = useCallback(async () => {
    const { data, error } = await supabase
      .from('skywalker_niveis')
      .select('*')
      .eq('ativo', true)
      .order('ordem');

    if (!error && data) {
      setNiveis(data);
    }
  }, []);

  const loadPilares = useCallback(async () => {
    const { data, error } = await supabase
      .from('skywalker_pilares')
      .select('*')
      .eq('ativo', true)
      .order('ordem');

    if (!error && data) {
      setPilares(data);
    }
  }, []);

  const loadRegrasEstrelas = useCallback(async () => {
    const { data, error } = await supabase
      .from('skywalker_regras_estrelas')
      .select(`
        *,
        pilar:skywalker_pilares(nome, tipo_metrica)
      `)
      .eq('ativo', true)
      .order('pilar_id, valor_minimo');

    if (!error && data) {
      setRegrasEstrelas(data);
    }
  }, []);

  const calcularEstrelasMes = useCallback(async (profissionalId: string, mesRef: string) => {
    const { error } = await supabase.rpc('calcular_estrelas_profissional', {
      p_profissional_id: profissionalId,
      p_mes_referencia: mesRef
    });

    if (error) {
    }
  }, []);

  const recalcularTodasEstrelasMes = useCallback(async (mesRef: string) => {
    const { error } = await supabase.rpc('recalcular_estrelas_mes', {
      p_mes_referencia: mesRef
    });

    if (error) {
    }
  }, []);

  const verificarElegibilidade = useCallback(async (profissionalId: string) => {
    const { data, error } = await supabase.rpc('verificar_elegibilidade_promocao', {
      p_profissional_id: profissionalId
    });

    if (error) {
      return null;
    }

    return data;
  }, []);

  return (
    <SkywalkerContext.Provider
      value={{
        profissionais,
        niveis,
        pilares,
        regrasEstrelas,
        loading,
        mesReferencia,
        setMesReferencia,
        loadProfissionais,
        loadNiveis,
        loadPilares,
        loadRegrasEstrelas,
        calcularEstrelasMes,
        recalcularTodasEstrelasMes,
        verificarElegibilidade
      }}
    >
      {children}
    </SkywalkerContext.Provider>
  );
}

export function useSkywalker() {
  const context = useContext(SkywalkerContext);
  if (!context) {
    throw new Error('useSkywalker must be used within a SkywalkerProvider');
  }
  return context;
}
