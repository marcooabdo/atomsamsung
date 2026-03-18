import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface SkywalkerTime {
  id: string;
  nome: string;
  codigo: string;
  descricao: string | null;
  cor: string;
  icone: string | null;
  ativo: boolean;
  ordem: number;
  unidade_id: string | null;
}

export interface Profissional {
  id: string;
  usuario_id: string;
  unidade_id: string;
  time: string;
  time_id: string | null;
  nivel_atual_id: string | null;
  data_inicio_nivel: string | null;
  meses_consecutivos_validos: number;
  ativo: boolean;
  observacoes: string | null;
  nivel?: {
    id: string;
    nome: string;
    ordem: number;
    estrelas_necessarias: number;
    meses_consecutivos: number;
    cor: string;
    bonus_valor: number;
  };
  usuario?: {
    nome: string;
    email: string;
    foto_url: string | null;
  };
  unidade?: {
    nome: string;
  };
  skywalker_time?: SkywalkerTime;
  estrelas_mes?: number;
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
  bonus_valor: number;
  unidade_id: string | null;
}

export interface Pilar {
  id: string;
  nome: string;
  descricao: string | null;
  time_aplicavel: string[];
  tipo_metrica: 'quantidade' | 'percentual' | 'binario' | 'valor';
  ordem: number;
  ativo: boolean;
  meta_front_office: number;
  meta_inside_sales: number;
  max_estrelas: number;
  unidade_id: string | null;
}

export interface RegraEstrela {
  id: string;
  pilar_id: string;
  time: string;
  valor_minimo: number;
  valor_maximo: number | null;
  estrelas: number;
  ativo: boolean;
  unidade_id: string | null;
  pilar?: Pilar;
}

export interface EstrelaMes {
  id: string;
  profissional_id: string;
  mes_referencia: string;
  pilar_id: string;
  valor_metrica: number;
  estrelas_conquistadas: number;
  pilar?: Pilar;
}

export interface OrcamentoAprovado {
  id: string;
  usuario_id: string;
  os_id: string | null;
  unidade_id: string | null;
  mes_referencia: string;
  valor_orcamento: number;
  created_at: string;
}

export interface RankingEntry {
  profissional_id: string;
  usuario_id: string;
  nome: string;
  foto_url: string | null;
  time: string;
  time_nome: string;
  time_cor: string;
  unidade_nome: string;
  nivel_nome: string;
  nivel_cor: string;
  nivel_ordem: number;
  estrelas_total: number;
  estrelas_necessarias: number;
  meses_consecutivos: number;
  bonus_valor: number;
  orcamentos_aprovados: number;
  valor_orcamentos: number;
}

export interface RegraPromocao {
  id: string;
  tipo: 'promocao' | 'rebaixamento';
  nome: string;
  descricao: string | null;
  condicao: string;
  ativo: boolean;
  obrigatorio: boolean;
  ordem: number;
  unidade_id: string | null;
  time_id: string | null;
}

export interface Bonificacao {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: 'valor_fixo' | 'percentual' | 'estrelas_bonus';
  valor: number;
  condicao: string;
  ativo: boolean;
  unidade_id: string | null;
}

interface SkywalkerContextType {
  myProfissional: Profissional | null;
  profissionais: Profissional[];
  niveis: Nivel[];
  pilares: Pilar[];
  regrasEstrelas: RegraEstrela[];
  regrasPromocao: RegraPromocao[];
  bonificacoes: Bonificacao[];
  times: SkywalkerTime[];
  ranking: RankingEntry[];
  estrelasDoMes: EstrelaMes[];
  orcamentosRanking: { usuario_id: string; nome: string; foto_url: string | null; total: number; valor: number }[];
  loading: boolean;
  mesReferencia: string;
  setMesReferencia: (mes: string) => void;
  loadAll: () => Promise<void>;
  loadProfissionais: () => Promise<void>;
  loadNiveis: () => Promise<void>;
  loadPilares: () => Promise<void>;
  loadRegrasEstrelas: () => Promise<void>;
  loadRegrasPromocao: () => Promise<void>;
  loadBonificacoes: () => Promise<void>;
  loadTimes: () => Promise<void>;
  loadRanking: (mesInicio: string, mesFim?: string) => Promise<void>;
  loadEstrelasDoMes: (profissionalId: string, mes: string) => Promise<void>;
  loadOrcamentosRanking: (mes: string) => Promise<void>;
  isAdmin: boolean;
}

const SkywalkerContext = createContext<SkywalkerContextType | null>(null);

export function SkywalkerProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [myProfissional, setMyProfissional] = useState<Profissional | null>(null);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [niveis, setNiveis] = useState<Nivel[]>([]);
  const [pilares, setPilares] = useState<Pilar[]>([]);
  const [regrasEstrelas, setRegrasEstrelas] = useState<RegraEstrela[]>([]);
  const [regrasPromocao, setRegrasPromocao] = useState<RegraPromocao[]>([]);
  const [bonificacoes, setBonificacoes] = useState<Bonificacao[]>([]);
  const [times, setTimes] = useState<SkywalkerTime[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [estrelasDoMes, setEstrelasDoMes] = useState<EstrelaMes[]>([]);
  const [orcamentosRanking, setOrcamentosRanking] = useState<{ usuario_id: string; nome: string; foto_url: string | null; total: number; valor: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [mesReferencia, setMesReferencia] = useState(
    new Date().toISOString().slice(0, 7) + '-01'
  );

  const isAdmin = usuario?.tipo === 'master' || usuario?.tipo === 'diretor' || usuario?.tipo === 'gerente' || usuario?.tipo === 'administrador';
  const canSeeAllUnits = (usuario?.tipo === 'master' || usuario?.tipo === 'diretoria') && !usuario?.unidade_id;

  const loadProfissionais = useCallback(async () => {
    let query = supabase
      .from('skywalker_profissionais')
      .select(`
        *,
        nivel:skywalker_niveis(id, nome, ordem, estrelas_necessarias, meses_consecutivos, cor, bonus_valor),
        usuario:usuarios(nome, email, foto_url),
        unidade:unidades(nome),
        skywalker_time:skywalker_times(*)
      `)
      .eq('ativo', true);

    if (!canSeeAllUnits && usuario?.unidade_id) {
      query = query.eq('unidade_id', usuario.unidade_id);
    }

    const { data } = await query;

    if (data) {
      setProfissionais(data as any);
      if (usuario) {
        const mine = data.find((p: any) => p.usuario_id === usuario.id);
        setMyProfissional(mine as any || null);
      }
    }
  }, [usuario, canSeeAllUnits]);

  const loadNiveis = useCallback(async () => {
    const { data } = await supabase
      .from('skywalker_niveis')
      .select('*')
      .eq('ativo', true)
      .order('ordem');
    if (data) setNiveis(data as any);
  }, []);

  const loadPilares = useCallback(async () => {
    const { data } = await supabase
      .from('skywalker_pilares')
      .select('*')
      .eq('ativo', true)
      .order('ordem');
    if (data) setPilares(data as any);
  }, []);

  const loadRegrasEstrelas = useCallback(async () => {
    const { data } = await supabase
      .from('skywalker_regras_estrelas')
      .select(`*, pilar:skywalker_pilares(nome, tipo_metrica)`)
      .eq('ativo', true)
      .order('pilar_id, valor_minimo');
    if (data) setRegrasEstrelas(data as any);
  }, []);

  const loadRegrasPromocao = useCallback(async () => {
    const { data } = await supabase
      .from('skywalker_regras_promocao')
      .select('*')
      .order('ordem');
    if (data) setRegrasPromocao(data as any);
  }, []);

  const loadBonificacoes = useCallback(async () => {
    const { data } = await supabase
      .from('skywalker_bonificacoes')
      .select('*')
      .eq('ativo', true);
    if (data) setBonificacoes(data as any);
  }, []);

  const loadTimes = useCallback(async () => {
    const { data } = await supabase
      .from('skywalker_times')
      .select('*')
      .eq('ativo', true)
      .order('ordem');
    if (data) setTimes(data as any);
  }, []);

  const loadRanking = useCallback(async (mesInicio: string, mesFim?: string) => {
    const mesFimEfetivo = mesFim || mesInicio;

    let profsQuery = supabase
      .from('skywalker_profissionais')
      .select(`
        id, usuario_id, time, time_id, meses_consecutivos_validos,
        nivel:skywalker_niveis(id, nome, ordem, estrelas_necessarias, meses_consecutivos, cor, bonus_valor),
        usuario:usuarios(nome, foto_url),
        unidade:unidades(nome),
        skywalker_time:skywalker_times(nome, cor)
      `)
      .eq('ativo', true);

    if (!canSeeAllUnits && usuario?.unidade_id) {
      profsQuery = profsQuery.eq('unidade_id', usuario.unidade_id);
    }

    const { data: profs } = await profsQuery;

    if (!profs) return;

    let estrelasQuery = supabase
      .from('skywalker_estrelas_mes')
      .select('profissional_id, estrelas_conquistadas')
      .gte('mes_referencia', mesInicio)
      .lte('mes_referencia', mesFimEfetivo);

    const { data: estrelas } = await estrelasQuery;

    const estrelasMap: Record<string, number> = {};
    (estrelas || []).forEach((e: any) => {
      estrelasMap[e.profissional_id] = (estrelasMap[e.profissional_id] || 0) + e.estrelas_conquistadas;
    });

    const { data: orcamentos } = await supabase
      .from('skywalker_orcamentos_aprovados')
      .select('usuario_id')
      .gte('mes_referencia', mesInicio)
      .lte('mes_referencia', mesFimEfetivo);

    const orcMap: Record<string, number> = {};
    (orcamentos || []).forEach((o: any) => {
      orcMap[o.usuario_id] = (orcMap[o.usuario_id] || 0) + 1;
    });

    const entries: RankingEntry[] = profs.map((p: any) => ({
      profissional_id: p.id,
      usuario_id: p.usuario_id,
      nome: p.usuario?.nome || 'Sem nome',
      foto_url: p.usuario?.foto_url || null,
      time: p.time,
      time_nome: p.skywalker_time?.nome || p.time,
      time_cor: p.skywalker_time?.cor || '#6B7280',
      unidade_nome: p.unidade?.nome || '',
      nivel_nome: p.nivel?.nome || 'Sem nivel',
      nivel_cor: p.nivel?.cor || '#6B7280',
      nivel_ordem: p.nivel?.ordem || 0,
      estrelas_total: estrelasMap[p.id] || 0,
      estrelas_necessarias: p.nivel?.estrelas_necessarias || 0,
      meses_consecutivos: p.meses_consecutivos_validos || 0,
      bonus_valor: p.nivel?.bonus_valor || 0,
      orcamentos_aprovados: orcMap[p.usuario_id] || 0,
      valor_orcamentos: 0,
    }));

    entries.sort((a, b) => b.estrelas_total - a.estrelas_total || b.nivel_ordem - a.nivel_ordem);
    setRanking(entries);
  }, [canSeeAllUnits, usuario?.unidade_id]);

  const loadEstrelasDoMes = useCallback(async (profissionalId: string, mes: string) => {
    const { data } = await supabase
      .from('skywalker_estrelas_mes')
      .select(`*, pilar:skywalker_pilares(nome, descricao, tipo_metrica, max_estrelas)`)
      .eq('profissional_id', profissionalId)
      .eq('mes_referencia', mes);
    if (data) setEstrelasDoMes(data as any);
  }, []);

  const loadOrcamentosRanking = useCallback(async (mes: string) => {
    const { data } = await supabase
      .from('skywalker_orcamentos_aprovados')
      .select('usuario_id, valor_orcamento, usuario:usuarios(nome, foto_url)')
      .eq('mes_referencia', mes);

    if (data) {
      const map: Record<string, { nome: string; foto_url: string | null; total: number; valor: number }> = {};
      data.forEach((d: any) => {
        const uid = d.usuario_id;
        if (!map[uid]) {
          map[uid] = { nome: d.usuario?.nome || '', foto_url: d.usuario?.foto_url || null, total: 0, valor: 0 };
        }
        map[uid].total += 1;
        map[uid].valor += Number(d.valor_orcamento) || 0;
      });
      const arr = Object.entries(map).map(([usuario_id, v]) => ({ usuario_id, ...v }));
      arr.sort((a, b) => b.total - a.total);
      setOrcamentosRanking(arr);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadProfissionais(),
      loadNiveis(),
      loadPilares(),
      loadRegrasEstrelas(),
      loadRegrasPromocao(),
      loadBonificacoes(),
      loadTimes(),
      loadRanking(mesReferencia),
      loadOrcamentosRanking(mesReferencia),
    ]);
    setLoading(false);
  }, [loadProfissionais, loadNiveis, loadPilares, loadRegrasEstrelas, loadRegrasPromocao, loadBonificacoes, loadTimes, loadRanking, loadOrcamentosRanking, mesReferencia]);

  useEffect(() => {
    if (usuario) {
      loadAll();
    }
  }, [usuario]);

  // Subscription em tempo real para skywalker_estrelas_mes
  useEffect(() => {
    if (!myProfissional) return;

    const channel = supabase
      .channel('skywalker_estrelas_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'skywalker_estrelas_mes',
          filter: `profissional_id=eq.${myProfissional.id}`,
        },
        (payload) => {
          loadEstrelasDoMes(myProfissional.id, mesReferencia);
          // Recarregar ranking também
          loadRanking(mesReferencia);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myProfissional, mesReferencia, loadEstrelasDoMes, loadRanking]);

  return (
    <SkywalkerContext.Provider
      value={{
        myProfissional,
        profissionais,
        niveis,
        pilares,
        regrasEstrelas,
        regrasPromocao,
        bonificacoes,
        times,
        ranking,
        estrelasDoMes,
        orcamentosRanking,
        loading,
        mesReferencia,
        setMesReferencia,
        loadAll,
        loadProfissionais,
        loadNiveis,
        loadPilares,
        loadRegrasEstrelas,
        loadRegrasPromocao,
        loadBonificacoes,
        loadTimes,
        loadRanking,
        loadEstrelasDoMes,
        loadOrcamentosRanking,
        isAdmin,
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
