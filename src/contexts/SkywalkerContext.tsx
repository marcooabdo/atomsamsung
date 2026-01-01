import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface Colaborador {
  id: string;
  usuario_id: string;
  unidade_id: string;
  perfil: 'front_office' | 'inside_sales';
  nivel_atual: 'starter' | 'avancado' | 'elite' | 'lider_global';
  meses_consecutivos: number;
  ativo: boolean;
  usuario?: {
    nome: string;
    email: string;
  };
  unidade?: {
    nome: string;
  };
  vendas_count?: number;
  reviews_count?: number;
  cultura_estrelas?: number;
  estrelas_total?: number;
}

export interface Venda {
  id: string;
  colaborador_id: string;
  tipo: 'store_plus' | 'care_plus' | 'smb' | 'seguro' | 'instalacao';
  valor: number;
  data_venda: string;
  mes_referencia: string;
  observacoes?: string;
  colaborador?: Colaborador;
}

export interface Review {
  id: string;
  colaborador_id: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  url_print?: string;
  mes_referencia: string;
  observacoes?: string;
  colaborador?: Colaborador;
}

export interface Cultura {
  id: string;
  colaborador_id: string;
  mes_referencia: string;
  presenca_reuniao: boolean;
  sem_atrasos: boolean;
  proativo: boolean;
  exemplar: boolean;
  observacoes?: string;
}

export interface Regra {
  id: string;
  unidade_id?: string;
  chave: string;
  valor: number;
  descricao?: string;
  ativo: boolean;
}

interface SkywalkerContextType {
  colaboradores: Colaborador[];
  vendas: Venda[];
  reviews: Review[];
  culturas: Cultura[];
  regras: Regra[];
  mesAtual: string;
  loading: boolean;
  loadColaboradores: () => Promise<void>;
  loadVendas: () => Promise<void>;
  loadReviews: () => Promise<void>;
  loadCulturas: () => Promise<void>;
  loadRegras: () => Promise<void>;
  addVenda: (venda: Omit<Venda, 'id'>) => Promise<boolean>;
  addReview: (review: Omit<Review, 'id'>) => Promise<boolean>;
  updateReviewStatus: (id: string, status: 'aprovado' | 'rejeitado') => Promise<boolean>;
  updateCultura: (colaboradorId: string, data: Partial<Cultura>) => Promise<boolean>;
  updateRegra: (id: string, valor: number) => Promise<boolean>;
  calcularEstrelas: (colaboradorId: string) => { vendas: number; reviews: number; cultura: number; total: number };
  getRegra: (chave: string) => number;
  refreshAll: () => Promise<void>;
}

const SkywalkerContext = createContext<SkywalkerContextType | null>(null);

export function SkywalkerProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [culturas, setCulturas] = useState<Cultura[]>([]);
  const [regras, setRegras] = useState<Regra[]>([]);
  const [loading, setLoading] = useState(true);

  const mesAtual = new Date().toISOString().slice(0, 7);

  const loadColaboradores = useCallback(async () => {
    const { data, error } = await supabase
      .from('skywalker_colaboradores')
      .select(`
        *,
        usuario:usuarios(nome, email),
        unidade:unidades(nome)
      `)
      .eq('ativo', true)
      .order('created_at');

    if (!error && data) {
      setColaboradores(data);
    }
  }, []);

  const loadVendas = useCallback(async () => {
    const { data, error } = await supabase
      .from('skywalker_vendas')
      .select('*')
      .eq('mes_referencia', mesAtual)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setVendas(data);
    }
  }, [mesAtual]);

  const loadReviews = useCallback(async () => {
    const { data, error } = await supabase
      .from('skywalker_reviews')
      .select('*')
      .eq('mes_referencia', mesAtual)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setReviews(data);
    }
  }, [mesAtual]);

  const loadCulturas = useCallback(async () => {
    const { data, error } = await supabase
      .from('skywalker_cultura')
      .select('*')
      .eq('mes_referencia', mesAtual);

    if (!error && data) {
      setCulturas(data);
    }
  }, [mesAtual]);

  const loadRegras = useCallback(async () => {
    const { data, error } = await supabase
      .from('skywalker_regras')
      .select('*')
      .eq('ativo', true);

    if (!error && data) {
      setRegras(data);
    }
  }, []);

  const getRegra = useCallback((chave: string): number => {
    const regra = regras.find(r => r.chave === chave);
    return regra?.valor ?? 0;
  }, [regras]);

  const calcularEstrelas = useCallback((colaboradorId: string) => {
    const vendasColaborador = vendas.filter(v => v.colaborador_id === colaboradorId);
    const reviewsColaborador = reviews.filter(r => r.colaborador_id === colaboradorId && r.status === 'aprovado');
    const culturaColaborador = culturas.find(c => c.colaborador_id === colaboradorId);

    const countStorePlus = vendasColaborador.filter(v => v.tipo === 'store_plus').length;
    const countCarePlus = vendasColaborador.filter(v => v.tipo === 'care_plus').length;

    let estrelasVendas = 0;
    if (countStorePlus >= getRegra('vendas_store_3_estrelas')) estrelasVendas += 3;
    else if (countStorePlus >= getRegra('vendas_store_2_estrelas')) estrelasVendas += 2;
    else if (countStorePlus >= getRegra('vendas_store_1_estrela')) estrelasVendas += 1;

    if (countCarePlus >= getRegra('vendas_care_2_estrelas')) estrelasVendas += 2;
    else if (countCarePlus >= getRegra('vendas_care_1_estrela')) estrelasVendas += 1;

    let estrelasReviews = 0;
    const reviewCount = reviewsColaborador.length;
    if (reviewCount >= getRegra('reviews_1_estrela') + getRegra('reviews_2_estrelas')) estrelasReviews = 2;
    else if (reviewCount >= getRegra('reviews_1_estrela')) estrelasReviews = 1;

    let estrelasCultura = 0;
    if (culturaColaborador) {
      if (culturaColaborador.exemplar) estrelasCultura = 3;
      else if (culturaColaborador.proativo && culturaColaborador.sem_atrasos) estrelasCultura = 2;
      else if (culturaColaborador.sem_atrasos && culturaColaborador.presenca_reuniao) estrelasCultura = 1;
    }

    return {
      vendas: estrelasVendas,
      reviews: estrelasReviews,
      cultura: estrelasCultura,
      os_finalizadas: 0,
      agendamentos: 0,
      pecas: 0,
      total: estrelasVendas + estrelasReviews + estrelasCultura
    };
  }, [vendas, reviews, culturas, getRegra]);

  const addVenda = async (venda: Omit<Venda, 'id'>): Promise<boolean> => {
    const { error } = await supabase
      .from('skywalker_vendas')
      .insert({
        ...venda,
        created_by: usuario?.id
      });

    if (!error) {
      await loadVendas();
      return true;
    }
    return false;
  };

  const addReview = async (review: Omit<Review, 'id'>): Promise<boolean> => {
    const { error } = await supabase
      .from('skywalker_reviews')
      .insert(review);

    if (!error) {
      await loadReviews();
      return true;
    }
    return false;
  };

  const updateReviewStatus = async (id: string, status: 'aprovado' | 'rejeitado'): Promise<boolean> => {
    const { error } = await supabase
      .from('skywalker_reviews')
      .update({
        status,
        aprovado_por: usuario?.id,
        aprovado_em: status === 'aprovado' ? new Date().toISOString() : null
      })
      .eq('id', id);

    if (!error) {
      await loadReviews();
      return true;
    }
    return false;
  };

  const updateCultura = async (colaboradorId: string, data: Partial<Cultura>): Promise<boolean> => {
    const existing = culturas.find(c => c.colaborador_id === colaboradorId);

    if (existing) {
      const { error } = await supabase
        .from('skywalker_cultura')
        .update({
          ...data,
          updated_by: usuario?.id
        })
        .eq('id', existing.id);

      if (!error) {
        await loadCulturas();
        return true;
      }
    } else {
      const { error } = await supabase
        .from('skywalker_cultura')
        .insert({
          colaborador_id: colaboradorId,
          mes_referencia: mesAtual,
          presenca_reuniao: false,
          sem_atrasos: false,
          proativo: false,
          exemplar: false,
          ...data,
          updated_by: usuario?.id
        });

      if (!error) {
        await loadCulturas();
        return true;
      }
    }
    return false;
  };

  const updateRegra = async (id: string, valor: number): Promise<boolean> => {
    const { error } = await supabase
      .from('skywalker_regras')
      .update({ valor })
      .eq('id', id);

    if (!error) {
      await loadRegras();
      return true;
    }
    return false;
  };

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadColaboradores(),
      loadVendas(),
      loadReviews(),
      loadCulturas(),
      loadRegras()
    ]);
    setLoading(false);
  }, [loadColaboradores, loadVendas, loadReviews, loadCulturas, loadRegras]);

  useEffect(() => {
    if (usuario) {
      refreshAll();
    }
  }, [usuario, refreshAll]);

  useEffect(() => {
    const channel = supabase
      .channel('skywalker-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'skywalker_vendas' }, () => loadVendas())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'skywalker_reviews' }, () => loadReviews())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'skywalker_cultura' }, () => loadCulturas())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadVendas, loadReviews, loadCulturas]);

  return (
    <SkywalkerContext.Provider
      value={{
        colaboradores,
        vendas,
        reviews,
        culturas,
        regras,
        mesAtual,
        loading,
        loadColaboradores,
        loadVendas,
        loadReviews,
        loadCulturas,
        loadRegras,
        addVenda,
        addReview,
        updateReviewStatus,
        updateCultura,
        updateRegra,
        calcularEstrelas,
        getRegra,
        refreshAll
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
