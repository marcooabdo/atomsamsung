import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Star,
  ShoppingCart,
  Building2,
  Shield,
  Handshake,
  TrendingUp,
  Lock,
  ChevronRight,
  Users,
  Award,
  Target,
  Filter,
  X,
  User,
  Rocket,
  Crown,
  Zap,
  CheckCircle,
  AlertTriangle,
  ArrowUp,
  Calendar,
  BadgeCheck
} from 'lucide-react';

type PerfilType = 'front_office' | 'inside_sales';
type NivelType = 'starter' | 'avancado' | 'elite' | 'lider_global';

interface Colaborador {
  id: string;
  usuario_id: string;
  unidade_id: string | null;
  perfil: PerfilType;
  nivel_atual: NivelType;
  meses_consecutivos: number;
  ativo: boolean;
  usuario?: {
    nome: string;
    email: string;
  };
  unidade?: {
    nome: string;
  };
  kpi_atual?: KPIMensal | null;
  historico_meses?: boolean[];
}

interface KPIMensal {
  id: string;
  colaborador_id: string;
  mes: number;
  ano: number;
  store_plus_vendas: number;
  store_plus_estrelas: number;
  care_plus_vendas: number;
  care_plus_estrelas: number;
  lp_ow_percentual: number;
  lp_ow_estrelas: number;
  google_reviews_meta_batida: boolean;
  google_reviews_bonus: number;
  google_reviews_estrelas: number;
  cultura_faltas: number;
  cultura_proativo: boolean;
  cultura_exemplar: boolean;
  cultura_estrelas: number;
  conversao_percentual: number;
  conversao_estrelas: number;
  seguro_instalacao_vendas: number;
  seguro_instalacao_estrelas: number;
  total_estrelas: number;
  travado_cultura: boolean;
  meta_atingida: boolean;
}

interface MetaNivel {
  nivel: NivelType;
  estrelas_necessarias: number;
  meses_consecutivos: number;
}

interface Unidade {
  id: string;
  nome: string;
}

const NIVEL_CONFIG: Record<NivelType, { label: string; color: string; icon: typeof Star; bgGlow: string }> = {
  starter: { label: 'Starter', color: '#00D4FF', icon: Rocket, bgGlow: 'shadow-[0_0_20px_rgba(0,212,255,0.3)]' },
  avancado: { label: 'Avancado', color: '#FFD700', icon: Zap, bgGlow: 'shadow-[0_0_20px_rgba(255,215,0,0.3)]' },
  elite: { label: 'Elite', color: '#FF6B00', icon: Crown, bgGlow: 'shadow-[0_0_20px_rgba(255,107,0,0.3)]' },
  lider_global: { label: 'Lider Global', color: '#FF00FF', icon: Award, bgGlow: 'shadow-[0_0_20px_rgba(255,0,255,0.3)]' }
};

const PERFIL_LABELS: Record<PerfilType, string> = {
  front_office: 'Front Office',
  inside_sales: 'Inside Sales'
};

export default function Skywalker() {
  const { usuario } = useAuth();
  const [view, setView] = useState<'minha_rota' | 'visao_diretoria'>('minha_rota');
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [meuColaborador, setMeuColaborador] = useState<Colaborador | null>(null);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [metas, setMetas] = useState<MetaNivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnidade, setSelectedUnidade] = useState<string>('todas');
  const [selectedPerfil, setSelectedPerfil] = useState<PerfilType | 'todos'>('todos');
  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const isGerente = usuario?.tipo === 'master' || usuario?.tipo === 'gerente';
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (isGerente) {
      setView('visao_diretoria');
    }
  }, [isGerente]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [unidadesRes, metasRes] = await Promise.all([
        supabase.from('unidades').select('id, nome').order('nome'),
        supabase.from('skywalker_metas_nivel').select('*')
      ]);

      setUnidades(unidadesRes.data || []);
      setMetas(metasRes.data || []);

      await loadColaboradores();
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadColaboradores = async () => {
    const { data: colaboradoresData, error } = await supabase
      .from('skywalker_colaboradores')
      .select(`
        *,
        usuario:usuarios(nome, email),
        unidade:unidades(nome)
      `)
      .eq('ativo', true);

    if (error) {
      console.error('Erro ao carregar colaboradores:', error);
      return;
    }

    const colaboradoresComKPIs = await Promise.all(
      (colaboradoresData || []).map(async (colab) => {
        const { data: kpiAtual } = await supabase
          .from('skywalker_kpis_mensais')
          .select('*')
          .eq('colaborador_id', colab.id)
          .eq('mes', mesAtual)
          .eq('ano', anoAtual)
          .maybeSingle();

        const { data: historicoKPIs } = await supabase
          .from('skywalker_kpis_mensais')
          .select('meta_atingida, mes, ano')
          .eq('colaborador_id', colab.id)
          .order('ano', { ascending: false })
          .order('mes', { ascending: false })
          .limit(6);

        const historicoMeses = (historicoKPIs || []).map(k => k.meta_atingida);

        return {
          ...colab,
          kpi_atual: kpiAtual,
          historico_meses: historicoMeses
        };
      })
    );

    setColaboradores(colaboradoresComKPIs);

    const meuColab = colaboradoresComKPIs.find(c => c.usuario_id === usuario?.id);
    setMeuColaborador(meuColab || null);
  };

  const getMetaNivel = (nivel: NivelType) => {
    return metas.find(m => m.nivel === nivel);
  };

  const filteredColaboradores = colaboradores.filter(c => {
    if (selectedUnidade !== 'todas' && c.unidade_id !== selectedUnidade) return false;
    if (selectedPerfil !== 'todos' && c.perfil !== selectedPerfil) return false;
    return true;
  });

  const stats = {
    totalColaboradores: filteredColaboradores.length,
    mediaEstrelas: filteredColaboradores.length > 0
      ? (filteredColaboradores.reduce((acc, c) => acc + (c.kpi_atual?.total_estrelas || 0), 0) / filteredColaboradores.length).toFixed(1)
      : '0',
    promoviveis: filteredColaboradores.filter(c => {
      const meta = getMetaNivel(c.nivel_atual);
      return meta && (c.kpi_atual?.total_estrelas || 0) >= meta.estrelas_necessarias && !c.kpi_atual?.travado_cultura;
    }).length,
    travados: filteredColaboradores.filter(c => c.kpi_atual?.travado_cultura).length
  };

  const openDetailModal = (colab: Colaborador) => {
    setSelectedColaborador(colab);
    setShowDetailModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#00D4FF]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-[#00D4FF]/20 to-[#00D4FF]/5 border border-[#00D4FF]/30">
            <Rocket className="h-8 w-8 text-[#00D4FF]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Skywalker</h1>
            <p className="text-sm text-gray-400">Sistema de Gamificacao de Carreira</p>
          </div>
        </div>

        {isGerente && (
          <div className="flex gap-2">
            <button
              onClick={() => setView('minha_rota')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                view === 'minha_rota'
                  ? 'bg-[#00D4FF] text-black'
                  : 'bg-[#1a1a2e] text-gray-400 hover:text-white border border-gray-700'
              }`}
            >
              Minha Rota
            </button>
            <button
              onClick={() => setView('visao_diretoria')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                view === 'visao_diretoria'
                  ? 'bg-[#00D4FF] text-black'
                  : 'bg-[#1a1a2e] text-gray-400 hover:text-white border border-gray-700'
              }`}
            >
              Visao Diretoria
            </button>
          </div>
        )}
      </div>

      {view === 'visao_diretoria' && isGerente ? (
        <VisaoDiretoria
          colaboradores={filteredColaboradores}
          unidades={unidades}
          selectedUnidade={selectedUnidade}
          setSelectedUnidade={setSelectedUnidade}
          selectedPerfil={selectedPerfil}
          setSelectedPerfil={setSelectedPerfil}
          stats={stats}
          metas={metas}
          openDetailModal={openDetailModal}
        />
      ) : (
        <MinhaRota
          colaborador={meuColaborador}
          metas={metas}
          mesAtual={mesAtual}
          anoAtual={anoAtual}
        />
      )}

      {showDetailModal && selectedColaborador && (
        <DetailModal
          colaborador={selectedColaborador}
          metas={metas}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedColaborador(null);
          }}
        />
      )}
    </div>
  );
}

interface VisaoDiretoriaProps {
  colaboradores: Colaborador[];
  unidades: Unidade[];
  selectedUnidade: string;
  setSelectedUnidade: (value: string) => void;
  selectedPerfil: PerfilType | 'todos';
  setSelectedPerfil: (value: PerfilType | 'todos') => void;
  stats: {
    totalColaboradores: number;
    mediaEstrelas: string;
    promoviveis: number;
    travados: number;
  };
  metas: MetaNivel[];
  openDetailModal: (colab: Colaborador) => void;
}

function VisaoDiretoria({
  colaboradores,
  unidades,
  selectedUnidade,
  setSelectedUnidade,
  selectedPerfil,
  setSelectedPerfil,
  stats,
  metas,
  openDetailModal
}: VisaoDiretoriaProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-400">Filtros:</span>
        </div>

        <select
          value={selectedUnidade}
          onChange={(e) => setSelectedUnidade(e.target.value)}
          className="px-4 py-2 bg-[#1a1a2e] border border-gray-700 rounded-lg text-white focus:border-[#00D4FF] focus:outline-none"
        >
          <option value="todas">Todas Unidades</option>
          {unidades.map(u => (
            <option key={u.id} value={u.id}>{u.nome}</option>
          ))}
        </select>

        <select
          value={selectedPerfil}
          onChange={(e) => setSelectedPerfil(e.target.value as PerfilType | 'todos')}
          className="px-4 py-2 bg-[#1a1a2e] border border-gray-700 rounded-lg text-white focus:border-[#00D4FF] focus:outline-none"
        >
          <option value="todos">Todos Perfis</option>
          <option value="front_office">Front Office</option>
          <option value="inside_sales">Inside Sales</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Colaboradores"
          value={stats.totalColaboradores.toString()}
          color="#00D4FF"
        />
        <StatCard
          icon={Star}
          label="Media Estrelas"
          value={stats.mediaEstrelas}
          color="#FFD700"
        />
        <StatCard
          icon={ArrowUp}
          label="Promoviveis"
          value={stats.promoviveis.toString()}
          color="#00FF88"
        />
        <StatCard
          icon={Lock}
          label="Travados Cultura"
          value={stats.travados.toString()}
          color="#FF4444"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {colaboradores.map(colab => (
          <ColaboradorCard
            key={colab.id}
            colaborador={colab}
            metas={metas}
            onClick={() => openDetailModal(colab)}
          />
        ))}

        {colaboradores.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Users className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhum colaborador encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: typeof Star;
  label: string;
  value: string;
  color: string;
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  return (
    <div className="premium-card p-4" style={{ borderColor: `${color}30` }}>
      <div className="flex items-center gap-3">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div>
          <p className="text-xs text-gray-400">{label}</p>
          <p className="text-xl font-bold" style={{ color }}>{value}</p>
        </div>
      </div>
    </div>
  );
}

interface ColaboradorCardProps {
  colaborador: Colaborador;
  metas: MetaNivel[];
  onClick: () => void;
}

function ColaboradorCard({ colaborador, metas, onClick }: ColaboradorCardProps) {
  const nivelConfig = NIVEL_CONFIG[colaborador.nivel_atual];
  const meta = metas.find(m => m.nivel === colaborador.nivel_atual);
  const kpi = colaborador.kpi_atual;
  const totalEstrelas = kpi?.total_estrelas || 0;
  const metaEstrelas = meta?.estrelas_necessarias || 6;
  const progressPercent = Math.min((totalEstrelas / metaEstrelas) * 100, 100);
  const isTravado = kpi?.travado_cultura;
  const NivelIcon = nivelConfig.icon;

  const getPilares = () => {
    if (colaborador.perfil === 'front_office') {
      return [
        { icon: ShoppingCart, label: 'Store+', active: (kpi?.store_plus_estrelas || 0) > 0 },
        { icon: TrendingUp, label: 'LP/OW', active: (kpi?.lp_ow_estrelas || 0) > 0 },
        { icon: BadgeCheck, label: 'Google', active: (kpi?.google_reviews_estrelas || 0) > 0 },
        { icon: Handshake, label: 'Cultura', active: (kpi?.cultura_estrelas || 0) > 0 },
        { icon: Shield, label: 'Care+', active: (kpi?.care_plus_estrelas || 0) > 0 }
      ];
    } else {
      return [
        { icon: TrendingUp, label: 'LP/OW', active: (kpi?.lp_ow_estrelas || 0) > 0 },
        { icon: BadgeCheck, label: 'Google', active: (kpi?.google_reviews_estrelas || 0) > 0 },
        { icon: Handshake, label: 'Cultura', active: (kpi?.cultura_estrelas || 0) > 0 },
        { icon: Target, label: 'Conversao', active: (kpi?.conversao_estrelas || 0) > 0 },
        { icon: Shield, label: 'Seguro', active: (kpi?.seguro_instalacao_estrelas || 0) > 0 }
      ];
    }
  };

  const pilares = getPilares();

  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
        isTravado
          ? 'bg-gradient-to-br from-[#1a1a2e] to-[#2a1a1a] border-2 border-red-500/50'
          : 'bg-gradient-to-br from-[#1a1a2e] to-[#0d0d1a] border border-gray-800 hover:border-[#00D4FF]/50'
      }`}
      style={{
        boxShadow: isTravado
          ? '0 0 30px rgba(255,0,0,0.2), inset 0 0 30px rgba(255,0,0,0.05)'
          : `0 0 30px ${nivelConfig.color}10`
      }}
    >
      {isTravado && (
        <div className="absolute top-3 right-3">
          <div className="p-1.5 rounded-full bg-red-500/20 border border-red-500/50">
            <Lock className="h-4 w-4 text-red-500" />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center border-2"
          style={{
            backgroundColor: `${nivelConfig.color}20`,
            borderColor: nivelConfig.color
          }}
        >
          <User className="h-6 w-6" style={{ color: nivelConfig.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white truncate">{colaborador.usuario?.nome || 'Colaborador'}</h3>
          <div className="flex items-center gap-1.5">
            <NivelIcon className="h-3.5 w-3.5" style={{ color: nivelConfig.color }} />
            <span className="text-xs font-medium" style={{ color: nivelConfig.color }}>
              {nivelConfig.label}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 mb-4">
        <span className="text-4xl font-black text-white">{totalEstrelas}</span>
        <span className="text-2xl text-gray-500">/</span>
        <span className="text-2xl text-gray-400">{metaEstrelas}</span>
        <Star className="h-8 w-8 text-yellow-400 fill-yellow-400" />
      </div>

      <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden mb-4">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{
            width: `${progressPercent}%`,
            background: isTravado
              ? 'linear-gradient(90deg, #FF4444, #FF6666)'
              : `linear-gradient(90deg, ${nivelConfig.color}, ${nivelConfig.color}88)`
          }}
        />
      </div>

      <div className="flex justify-between">
        {pilares.map((pilar, idx) => {
          const PilarIcon = pilar.icon;
          return (
            <div
              key={idx}
              className={`flex flex-col items-center gap-1 ${
                pilar.active ? 'opacity-100' : 'opacity-30'
              }`}
              title={pilar.label}
            >
              <PilarIcon
                className="h-4 w-4"
                style={{ color: pilar.active ? '#00D4FF' : '#666' }}
              />
              <span className="text-[10px] text-gray-500">{pilar.active ? 'Ciano' : 'Cinza'}</span>
            </div>
          );
        })}
      </div>

      {colaborador.historico_meses && colaborador.historico_meses.length > 0 && (
        <div className="flex justify-center gap-1 mt-4 pt-3 border-t border-gray-800">
          {colaborador.historico_meses.slice(0, meta?.meses_consecutivos || 3).map((bateu, idx) => (
            <div
              key={idx}
              className={`w-2 h-2 rounded-full ${
                bateu ? 'bg-green-500' : 'bg-gray-600'
              }`}
              title={bateu ? 'Meta batida' : 'Meta nao batida'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MinhaRotaProps {
  colaborador: Colaborador | null;
  metas: MetaNivel[];
  mesAtual: number;
  anoAtual: number;
}

function MinhaRota({ colaborador, metas, mesAtual, anoAtual }: MinhaRotaProps) {
  if (!colaborador) {
    return (
      <div className="premium-card p-12 text-center">
        <Rocket className="h-16 w-16 text-gray-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Voce ainda nao esta cadastrado</h2>
        <p className="text-gray-400">
          Solicite ao seu gerente para cadastrar voce no sistema Skywalker.
        </p>
      </div>
    );
  }

  const nivelConfig = NIVEL_CONFIG[colaborador.nivel_atual];
  const meta = metas.find(m => m.nivel === colaborador.nivel_atual);
  const kpi = colaborador.kpi_atual;
  const totalEstrelas = kpi?.total_estrelas || 0;
  const metaEstrelas = meta?.estrelas_necessarias || 6;
  const progressPercent = Math.min((totalEstrelas / metaEstrelas) * 100, 100);
  const NivelIcon = nivelConfig.icon;
  const isTravado = kpi?.travado_cultura;

  const getKPIDetails = () => {
    if (colaborador.perfil === 'front_office') {
      return [
        {
          label: 'Store+',
          icon: ShoppingCart,
          value: kpi?.store_plus_vendas || 0,
          estrelas: kpi?.store_plus_estrelas || 0,
          maxEstrelas: 3,
          desc: '0-3 vds: 0, 4-7: 1, 8-11: 2, 12+: 3'
        },
        {
          label: 'LP/OW (Meta Unidade)',
          icon: Building2,
          value: `${kpi?.lp_ow_percentual || 0}%`,
          estrelas: kpi?.lp_ow_estrelas || 0,
          maxEstrelas: 3,
          desc: '<80%: 0, 80-89%: 1, 90-99%: 2, 100%+: 3'
        },
        {
          label: 'Google Reviews',
          icon: BadgeCheck,
          value: kpi?.google_reviews_meta_batida ? `Meta + ${kpi?.google_reviews_bonus || 0}` : 'Meta nao batida',
          estrelas: kpi?.google_reviews_estrelas || 0,
          maxEstrelas: 2,
          desc: 'Nao batida: 0, Batida: 1, Batida+12: 2',
          critical: (kpi?.google_reviews_estrelas || 0) === 0
        },
        {
          label: 'Cultura/Participacao',
          icon: Handshake,
          value: kpi?.cultura_exemplar ? 'Exemplar' : kpi?.cultura_proativo ? 'Proativo' : `${kpi?.cultura_faltas || 0} faltas`,
          estrelas: kpi?.cultura_estrelas || 0,
          maxEstrelas: 3,
          desc: 'Faltas: 0, Sem faltas: 1, Proativo: 2, Exemplar: 3',
          critical: (kpi?.cultura_estrelas || 0) === 0
        },
        {
          label: 'Care+',
          icon: Shield,
          value: kpi?.care_plus_vendas || 0,
          estrelas: kpi?.care_plus_estrelas || 0,
          maxEstrelas: 2,
          desc: '0 vds: 0, Meta: 1, Meta+3: 2'
        }
      ];
    } else {
      return [
        {
          label: 'LP/OW (Meta Unidade)',
          icon: Building2,
          value: `${kpi?.lp_ow_percentual || 0}%`,
          estrelas: kpi?.lp_ow_estrelas || 0,
          maxEstrelas: 3,
          desc: '<80%: 0, 80-89%: 1, 90-99%: 2, 100%+: 3'
        },
        {
          label: 'Google Reviews',
          icon: BadgeCheck,
          value: kpi?.google_reviews_meta_batida ? `Meta + ${kpi?.google_reviews_bonus || 0}` : 'Meta nao batida',
          estrelas: kpi?.google_reviews_estrelas || 0,
          maxEstrelas: 2,
          desc: 'Nao batida: 0, Batida: 1, Batida+12: 2',
          critical: (kpi?.google_reviews_estrelas || 0) === 0
        },
        {
          label: 'Cultura/Participacao',
          icon: Handshake,
          value: kpi?.cultura_exemplar ? 'Exemplar' : kpi?.cultura_proativo ? 'Proativo' : `${kpi?.cultura_faltas || 0} faltas`,
          estrelas: kpi?.cultura_estrelas || 0,
          maxEstrelas: 3,
          desc: 'Faltas: 0, Sem faltas: 1, Proativo: 2, Exemplar: 3',
          critical: (kpi?.cultura_estrelas || 0) === 0
        },
        {
          label: 'Conversao',
          icon: Target,
          value: `${kpi?.conversao_percentual || 0}%`,
          estrelas: kpi?.conversao_estrelas || 0,
          maxEstrelas: 5,
          desc: '30%: 1, 40%: 3, 50%: 4, 60%: 5'
        },
        {
          label: 'Seguro/Instalacao',
          icon: Shield,
          value: kpi?.seguro_instalacao_vendas || 0,
          estrelas: kpi?.seguro_instalacao_estrelas || 0,
          maxEstrelas: 2,
          desc: '0 vds: 0, Meta: 1, Meta+3: 2'
        }
      ];
    }
  };

  const kpiDetails = getKPIDetails();

  return (
    <div className="space-y-6">
      <div
        className={`premium-card p-6 ${isTravado ? 'border-red-500/50' : ''}`}
        style={{ borderColor: isTravado ? undefined : nivelConfig.color + '30' }}
      >
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center border-4"
            style={{
              backgroundColor: `${nivelConfig.color}20`,
              borderColor: nivelConfig.color,
              boxShadow: `0 0 30px ${nivelConfig.color}40`
            }}
          >
            <NivelIcon className="h-12 w-12" style={{ color: nivelConfig.color }} />
          </div>

          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-bold text-white">{colaborador.usuario?.nome}</h2>
            <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
              <span
                className="px-3 py-1 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: `${nivelConfig.color}20`,
                  color: nivelConfig.color
                }}
              >
                {nivelConfig.label}
              </span>
              <span className="text-sm text-gray-400">
                {PERFIL_LABELS[colaborador.perfil]}
              </span>
            </div>

            {isTravado && (
              <div className="flex items-center justify-center md:justify-start gap-2 mt-3 text-red-400">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Travado por Cultura/Qualidade</span>
              </div>
            )}
          </div>

          <div className="text-center">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-5xl font-black text-white">{totalEstrelas}</span>
              <span className="text-3xl text-gray-500">/</span>
              <span className="text-3xl text-gray-400">{metaEstrelas}</span>
              <Star className="h-10 w-10 text-yellow-400 fill-yellow-400" />
            </div>
            <div className="relative h-3 w-48 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{
                  width: `${progressPercent}%`,
                  background: isTravado
                    ? 'linear-gradient(90deg, #FF4444, #FF6666)'
                    : `linear-gradient(90deg, ${nivelConfig.color}, ${nivelConfig.color}88)`
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {meta?.meses_consecutivos ? `${colaborador.meses_consecutivos}/${meta.meses_consecutivos} meses consecutivos` : 'Nivel maximo'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiDetails.map((kpi, idx) => {
          const KPIIcon = kpi.icon;
          return (
            <div
              key={idx}
              className={`premium-card p-4 ${kpi.critical ? 'border-red-500/50 bg-red-500/5' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <KPIIcon className={`h-5 w-5 ${kpi.critical ? 'text-red-400' : 'text-[#00D4FF]'}`} />
                  <span className="font-medium text-white">{kpi.label}</span>
                </div>
                {kpi.critical && <Lock className="h-4 w-4 text-red-400" />}
              </div>

              <div className="flex items-center gap-1 mb-2">
                {Array.from({ length: kpi.maxEstrelas }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < kpi.estrelas ? 'text-yellow-400 fill-yellow-400' : 'text-gray-700'
                    }`}
                  />
                ))}
              </div>

              <p className="text-lg font-bold text-white">{kpi.value}</p>
              <p className="text-xs text-gray-500 mt-1">{kpi.desc}</p>
            </div>
          );
        })}
      </div>

      {colaborador.historico_meses && colaborador.historico_meses.length > 0 && (
        <div className="premium-card p-6">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#00D4FF]" />
            Historico de Metas
          </h3>
          <div className="flex items-center gap-3">
            {colaborador.historico_meses.slice(0, 6).map((bateu, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    bateu ? 'bg-green-500/20 border border-green-500' : 'bg-gray-800 border border-gray-700'
                  }`}
                >
                  {bateu ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <X className="h-4 w-4 text-gray-500" />
                  )}
                </div>
                <span className="text-xs text-gray-500">M{6 - idx}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface DetailModalProps {
  colaborador: Colaborador;
  metas: MetaNivel[];
  onClose: () => void;
}

function DetailModal({ colaborador, metas, onClose }: DetailModalProps) {
  const nivelConfig = NIVEL_CONFIG[colaborador.nivel_atual];
  const meta = metas.find(m => m.nivel === colaborador.nivel_atual);
  const kpi = colaborador.kpi_atual;
  const totalEstrelas = kpi?.total_estrelas || 0;
  const metaEstrelas = meta?.estrelas_necessarias || 6;
  const faltam = Math.max(0, metaEstrelas - totalEstrelas);
  const NivelIcon = nivelConfig.icon;
  const isTravado = kpi?.travado_cultura;

  const proximoNivel = meta?.meses_consecutivos
    ? metas.find(m => m.estrelas_necessarias > metaEstrelas)
    : null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="premium-card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center border-2"
              style={{
                backgroundColor: `${nivelConfig.color}20`,
                borderColor: nivelConfig.color
              }}
            >
              <NivelIcon className="h-6 w-6" style={{ color: nivelConfig.color }} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{colaborador.usuario?.nome}</h2>
              <p className="text-sm text-gray-400">{colaborador.unidade?.nome || 'Sem unidade'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="flex items-center gap-2 justify-center mb-1">
                <span className="text-4xl font-black text-white">{totalEstrelas}</span>
                <span className="text-2xl text-gray-500">/</span>
                <span className="text-2xl text-gray-400">{metaEstrelas}</span>
                <Star className="h-8 w-8 text-yellow-400 fill-yellow-400" />
              </div>
              <p className="text-sm text-gray-400">
                {faltam > 0 ? `Faltam ${faltam} estrelas` : 'Meta atingida!'}
              </p>
            </div>
          </div>

          {isTravado && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
              <Lock className="h-6 w-6 text-red-400" />
              <div>
                <p className="font-bold text-red-400">Travado por Cultura/Qualidade</p>
                <p className="text-sm text-red-300/70">
                  Mesmo atingindo a meta de estrelas, a promocao esta bloqueada por ter 0 estrelas em Google Reviews ou Participacao.
                </p>
              </div>
            </div>
          )}

          <div>
            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
              <Target className="h-5 w-5 text-[#00D4FF]" />
              O que falta para o proximo nivel
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-[#1a1a2e] rounded-lg">
                <span className="text-gray-400">Estrelas necessarias</span>
                <span className="font-bold text-white">{metaEstrelas}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#1a1a2e] rounded-lg">
                <span className="text-gray-400">Meses consecutivos</span>
                <span className="font-bold text-white">
                  {colaborador.meses_consecutivos}/{meta?.meses_consecutivos || 0}
                </span>
              </div>
              {proximoNivel && (
                <div className="flex items-center justify-between p-3 bg-[#1a1a2e] rounded-lg">
                  <span className="text-gray-400">Proximo nivel</span>
                  <span className="font-bold" style={{ color: NIVEL_CONFIG[proximoNivel.nivel as NivelType]?.color }}>
                    {NIVEL_CONFIG[proximoNivel.nivel as NivelType]?.label}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-400" />
              Detalhamento KPIs
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {colaborador.perfil === 'front_office' ? (
                <>
                  <KPIDetailItem label="Store+" value={kpi?.store_plus_vendas || 0} estrelas={kpi?.store_plus_estrelas || 0} max={3} />
                  <KPIDetailItem label="Care+" value={kpi?.care_plus_vendas || 0} estrelas={kpi?.care_plus_estrelas || 0} max={2} />
                  <KPIDetailItem label="LP/OW" value={`${kpi?.lp_ow_percentual || 0}%`} estrelas={kpi?.lp_ow_estrelas || 0} max={3} />
                  <KPIDetailItem label="Google" value={kpi?.google_reviews_meta_batida ? 'Sim' : 'Nao'} estrelas={kpi?.google_reviews_estrelas || 0} max={2} critical={(kpi?.google_reviews_estrelas || 0) === 0} />
                  <KPIDetailItem label="Cultura" value={`${kpi?.cultura_faltas || 0} faltas`} estrelas={kpi?.cultura_estrelas || 0} max={3} critical={(kpi?.cultura_estrelas || 0) === 0} />
                </>
              ) : (
                <>
                  <KPIDetailItem label="LP/OW" value={`${kpi?.lp_ow_percentual || 0}%`} estrelas={kpi?.lp_ow_estrelas || 0} max={3} />
                  <KPIDetailItem label="Google" value={kpi?.google_reviews_meta_batida ? 'Sim' : 'Nao'} estrelas={kpi?.google_reviews_estrelas || 0} max={2} critical={(kpi?.google_reviews_estrelas || 0) === 0} />
                  <KPIDetailItem label="Cultura" value={`${kpi?.cultura_faltas || 0} faltas`} estrelas={kpi?.cultura_estrelas || 0} max={3} critical={(kpi?.cultura_estrelas || 0) === 0} />
                  <KPIDetailItem label="Conversao" value={`${kpi?.conversao_percentual || 0}%`} estrelas={kpi?.conversao_estrelas || 0} max={5} />
                  <KPIDetailItem label="Seguro" value={kpi?.seguro_instalacao_vendas || 0} estrelas={kpi?.seguro_instalacao_estrelas || 0} max={2} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface KPIDetailItemProps {
  label: string;
  value: string | number;
  estrelas: number;
  max: number;
  critical?: boolean;
}

function KPIDetailItem({ label, value, estrelas, max, critical }: KPIDetailItemProps) {
  return (
    <div className={`p-3 rounded-lg ${critical ? 'bg-red-500/10 border border-red-500/30' : 'bg-[#1a1a2e]'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-sm ${critical ? 'text-red-400' : 'text-gray-400'}`}>{label}</span>
        <span className="font-bold text-white">{value}</span>
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: max }).map((_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${i < estrelas ? 'text-yellow-400 fill-yellow-400' : 'text-gray-700'}`}
          />
        ))}
      </div>
    </div>
  );
}
