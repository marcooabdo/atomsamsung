import { useState, useEffect } from 'react';
import { Star, Users, TrendingUp, Award, DollarSign, Target, Calendar, RefreshCw, X, Trophy, Zap, Clock, CheckCircle, AlertCircle, ChevronRight, Sparkles, Crown, Medal, Flame } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Profissional {
  id: string;
  usuario: { nome: string; email: string } | null;
  unidade: { nome: string } | null;
  nivel: { nome: string; cor: string; estrelas_necessarias: number; bonus_valor: number; ordem: number } | null;
  time: string;
  meses_consecutivos_validos: number;
  ativo: boolean;
}

interface EstrelasMes {
  profissional_id: string;
  estrelas_conquistadas: number;
  pilar: { nome: string } | null;
}

interface Nivel {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  estrelas_necessarias: number;
  bonus_valor: number;
}

interface Pilar {
  id: string;
  nome: string;
  descricao: string;
  estrelas_maximas: number;
}

const NIVEL_GRADIENTS: Record<string, { bg: string; border: string; glow: string; icon: typeof Star }> = {
  'Starter': {
    bg: 'from-slate-600/30 via-slate-700/20 to-slate-800/30',
    border: 'border-slate-500/50',
    glow: 'shadow-slate-500/20',
    icon: Star
  },
  'Bronze': {
    bg: 'from-amber-700/30 via-orange-800/20 to-amber-900/30',
    border: 'border-amber-600/50',
    glow: 'shadow-amber-500/30',
    icon: Medal
  },
  'Prata': {
    bg: 'from-gray-400/30 via-slate-500/20 to-gray-600/30',
    border: 'border-gray-400/50',
    glow: 'shadow-gray-400/30',
    icon: Award
  },
  'Ouro': {
    bg: 'from-yellow-500/30 via-amber-500/20 to-yellow-600/30',
    border: 'border-yellow-500/50',
    glow: 'shadow-yellow-500/40',
    icon: Trophy
  },
  'Diamante': {
    bg: 'from-cyan-400/30 via-blue-500/20 to-cyan-600/30',
    border: 'border-cyan-400/50',
    glow: 'shadow-cyan-400/40',
    icon: Sparkles
  },
  'Master': {
    bg: 'from-rose-500/30 via-pink-600/20 to-rose-700/30',
    border: 'border-rose-500/50',
    glow: 'shadow-rose-500/40',
    icon: Crown
  }
};

function getNivelStyle(nivelNome: string | undefined) {
  return NIVEL_GRADIENTS[nivelNome || 'Starter'] || NIVEL_GRADIENTS['Starter'];
}

export function VisaoGeralTab() {
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [estrelasMes, setEstrelasMes] = useState<EstrelasMes[]>([]);
  const [niveis, setNiveis] = useState<Nivel[]>([]);
  const [pilares, setPilares] = useState<Pilar[]>([]);
  const [mesReferencia, setMesReferencia] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [selectedProfissional, setSelectedProfissional] = useState<Profissional | null>(null);

  useEffect(() => {
    loadData();
  }, [mesReferencia]);

  const loadData = async () => {
    setLoading(true);

    const [profRes, estrelasRes, niveisRes, pilaresRes] = await Promise.all([
      supabase
        .from('skywalker_profissionais')
        .select(`
          id,
          time,
          meses_consecutivos_validos,
          ativo,
          usuario:usuarios(nome, email),
          unidade:unidades(nome),
          nivel:skywalker_niveis(nome, cor, estrelas_necessarias, bonus_valor, ordem)
        `)
        .eq('ativo', true),
      supabase
        .from('skywalker_estrelas_mes')
        .select(`
          profissional_id,
          estrelas_conquistadas,
          pilar:skywalker_pilares(nome)
        `)
        .eq('mes_referencia', mesReferencia + '-01'),
      supabase
        .from('skywalker_niveis')
        .select('id, nome, cor, ordem, estrelas_necessarias, bonus_valor')
        .eq('ativo', true)
        .order('ordem'),
      supabase
        .from('skywalker_pilares')
        .select('id, nome, descricao, estrelas_maximas')
        .eq('ativo', true)
    ]);

    if (profRes.data) setProfissionais(profRes.data as unknown as Profissional[]);
    if (estrelasRes.data) setEstrelasMes(estrelasRes.data as unknown as EstrelasMes[]);
    if (niveisRes.data) setNiveis(niveisRes.data);
    if (pilaresRes.data) setPilares(pilaresRes.data);

    setLoading(false);
  };

  const getProfissionalEstrelas = (profId: string) => {
    return estrelasMes
      .filter(e => e.profissional_id === profId)
      .reduce((sum, e) => sum + e.estrelas_conquistadas, 0);
  };

  const getProfissionalEstrelasPorPilar = (profId: string) => {
    return estrelasMes.filter(e => e.profissional_id === profId);
  };

  const profissionaisComEstrelas = profissionais.map(prof => ({
    ...prof,
    estrelas_mes: getProfissionalEstrelas(prof.id),
    estrelas_por_pilar: getProfissionalEstrelasPorPilar(prof.id)
  })).sort((a, b) => b.estrelas_mes - a.estrelas_mes);

  const totalProfissionais = profissionais.length;
  const mediaEstrelas = totalProfissionais > 0
    ? (profissionaisComEstrelas.reduce((sum, p) => sum + p.estrelas_mes, 0) / totalProfissionais).toFixed(1)
    : '0';

  const promoviveis = profissionaisComEstrelas.filter(p =>
    p.estrelas_mes >= (p.nivel?.estrelas_necessarias || 6) &&
    p.meses_consecutivos_validos >= 1
  ).length;

  const bonusTotal = profissionaisComEstrelas
    .filter(p => p.estrelas_mes >= (p.nivel?.estrelas_necessarias || 6))
    .reduce((sum, p) => sum + (p.nivel?.bonus_valor || 0), 0);

  const distribuicaoPorNivel = niveis.map(nivel => ({
    ...nivel,
    quantidade: profissionais.filter(p => p.nivel?.nome === nivel.nome).length
  }));

  const frontOffice = profissionaisComEstrelas.filter(p => p.time === 'front_office');
  const insideSales = profissionaisComEstrelas.filter(p => p.time === 'inside_sales');

  const mediaFront = frontOffice.length > 0
    ? (frontOffice.reduce((sum, p) => sum + p.estrelas_mes, 0) / frontOffice.length).toFixed(1)
    : '0';
  const mediaInside = insideSales.length > 0
    ? (insideSales.reduce((sum, p) => sum + p.estrelas_mes, 0) / insideSales.length).toFixed(1)
    : '0';

  const getProximoNivel = (nivelAtual: Nivel | null | undefined) => {
    if (!nivelAtual) return niveis[0];
    const idx = niveis.findIndex(n => n.nome === nivelAtual.nome);
    if (idx < niveis.length - 1) return niveis[idx + 1];
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Star className="w-6 h-6 text-yellow-400" />
            Visao Geral
          </h2>
          <p className="text-gray-400 text-sm">Acompanhe o desempenho da equipe</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="month"
              value={mesReferencia}
              onChange={(e) => setMesReferencia(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <button
            onClick={loadData}
            className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-cyan-600/20 to-cyan-800/20 p-6 rounded-xl border border-cyan-500/30">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-cyan-400" />
            <span className="text-cyan-400 text-xs">Total</span>
          </div>
          <div className="text-3xl font-bold text-white">{totalProfissionais}</div>
          <div className="text-cyan-400 text-sm">Profissionais ativos</div>
        </div>

        <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 p-6 rounded-xl border border-yellow-500/30">
          <div className="flex items-center justify-between mb-2">
            <Star className="w-8 h-8 text-yellow-400 fill-current" />
            <span className="text-yellow-400 text-xs">Media</span>
          </div>
          <div className="text-3xl font-bold text-white">{mediaEstrelas}</div>
          <div className="text-yellow-400 text-sm">Estrelas por pessoa</div>
        </div>

        <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 p-6 rounded-xl border border-green-500/30">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 text-green-400" />
            <span className="text-green-400 text-xs">Promoviveis</span>
          </div>
          <div className="text-3xl font-bold text-white">{promoviveis}</div>
          <div className="text-green-400 text-sm">Elegiveis para subir</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 p-6 rounded-xl border border-emerald-500/30">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 text-emerald-400" />
            <span className="text-emerald-400 text-xs">Bonus</span>
          </div>
          <div className="text-3xl font-bold text-white">
            R$ {bonusTotal.toLocaleString('pt-BR')}
          </div>
          <div className="text-emerald-400 text-sm">Bonus previsto</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-400" />
            Distribuicao por Nivel
          </h3>
          <div className="space-y-3">
            {distribuicaoPorNivel.map((nivel) => (
              <div key={nivel.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: nivel.cor }}
                  />
                  <span className="text-gray-300">{nivel.nome}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${Math.max(20, (nivel.quantidade / Math.max(totalProfissionais, 1)) * 100)}px`,
                      backgroundColor: nivel.cor
                    }}
                  />
                  <span className="text-white font-bold">{nivel.quantidade}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-cyan-400" />
            Comparativo por Time
          </h3>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-400 font-medium">Front Office</span>
                <span className="text-white font-bold">{frontOffice.length} pessoas</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                    style={{ width: `${(Number(mediaFront) / 12) * 100}%` }}
                  />
                </div>
                <span className="text-white font-bold">{mediaFront}</span>
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-teal-400 font-medium">Inside Sales</span>
                <span className="text-white font-bold">{insideSales.length} pessoas</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-teal-600"
                    style={{ width: `${(Number(mediaInside) / 12) * 100}%` }}
                  />
                </div>
                <span className="text-white font-bold">{mediaInside}</span>
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Top 5 do Mes
          </h3>
          <div className="space-y-3">
            {profissionaisComEstrelas.slice(0, 5).map((prof, idx) => (
              <div
                key={prof.id}
                className="flex items-center justify-between cursor-pointer hover:bg-gray-700/30 p-2 rounded-lg transition-all"
                onClick={() => setSelectedProfissional(prof)}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    idx === 0 ? 'bg-yellow-500 text-black' :
                    idx === 1 ? 'bg-gray-400 text-black' :
                    idx === 2 ? 'bg-orange-600 text-white' :
                    'bg-gray-700 text-gray-300'
                  }`}>
                    {idx + 1}
                  </span>
                  <div>
                    <span className="text-white text-sm">{prof.usuario?.nome || 'Sem nome'}</span>
                    <span className="text-gray-500 text-xs block">{prof.unidade?.nome}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400 font-bold">{prof.estrelas_mes}</span>
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                </div>
              </div>
            ))}
            {profissionaisComEstrelas.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">
                Nenhum dado disponivel
              </p>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan-400" />
          Todos os Profissionais
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profissionaisComEstrelas.map((prof, index) => {
            const metaEstrelas = prof.nivel?.estrelas_necessarias || 6;
            const progresso = Math.min(100, (prof.estrelas_mes / metaEstrelas) * 100);
            const atingiuMeta = prof.estrelas_mes >= metaEstrelas;
            const nivelStyle = getNivelStyle(prof.nivel?.nome);
            const NivelIcon = nivelStyle.icon;
            const ranking = index + 1;
            const proximoNivel = getProximoNivel(prof.nivel);
            const faltamEstrelas = Math.max(0, metaEstrelas - prof.estrelas_mes);

            return (
              <div
                key={prof.id}
                onClick={() => setSelectedProfissional(prof)}
                className={`
                  relative overflow-hidden cursor-pointer group
                  bg-gradient-to-br from-gray-900/90 via-gray-800/80 to-gray-900/90
                  backdrop-blur-sm
                  rounded-2xl p-4 border-3
                  transition-all duration-300
                  hover:scale-[1.02]
                  ${atingiuMeta ? 'ring-2 ring-green-500/50 ring-offset-2 ring-offset-gray-950' : ''}
                `}
                style={{
                  borderWidth: '3px',
                  borderStyle: 'solid',
                  borderColor: prof.nivel?.cor || '#6B7280',
                  boxShadow: `0 0 30px ${prof.nivel?.cor || '#6B7280'}40, 0 0 60px ${prof.nivel?.cor || '#6B7280'}20, inset 0 0 20px rgba(0,0,0,0.3)`,
                }}
              >
                <div
                  className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity"
                  style={{
                    background: `radial-gradient(circle at 50% 0%, ${prof.nivel?.cor || '#6B7280'}40, transparent 70%)`
                  }}
                />

                {atingiuMeta && (
                  <div className="absolute top-0 right-0 z-10">
                    <div className="bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Meta
                    </div>
                  </div>
                )}

                {ranking <= 3 && (
                  <div className="absolute -top-2 -left-2 z-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-gray-950 ${
                      ranking === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-[0_0_20px_rgba(234,179,8,0.6)]' :
                      ranking === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500 shadow-[0_0_20px_rgba(148,163,184,0.6)]' :
                      'bg-gradient-to-br from-orange-500 to-orange-700 shadow-[0_0_20px_rgba(249,115,22,0.6)]'
                    }`}>
                      {ranking === 1 ? <Crown className="w-5 h-5 text-black drop-shadow-lg" /> :
                       ranking === 2 ? <Medal className="w-5 h-5 text-black drop-shadow-lg" /> :
                       <Award className="w-5 h-5 text-white drop-shadow-lg" />}
                    </div>
                  </div>
                )}

                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`flex-1 min-w-0 ${ranking <= 3 ? 'ml-8' : ''}`}>
                      <h4 className="text-white font-bold text-base truncate">{prof.usuario?.nome || 'Sem nome'}</h4>
                      <p className="text-gray-400 text-xs truncate">{prof.unidade?.nome}</p>
                    </div>
                    <div
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold flex-shrink-0 ml-2"
                      style={{
                        backgroundColor: (prof.nivel?.cor || '#6B7280') + '25',
                        color: prof.nivel?.cor || '#6B7280',
                        border: `1.5px solid ${prof.nivel?.cor || '#6B7280'}60`
                      }}
                    >
                      <NivelIcon className="w-3 h-3" />
                      {prof.nivel?.nome || 'Starter'}
                    </div>
                  </div>

                  <div className="flex items-center justify-center mb-3">
                    <div className="text-3xl font-black text-white drop-shadow-lg">
                      {prof.estrelas_mes}
                      <span className="text-gray-500 text-lg font-normal">/{metaEstrelas}</span>
                    </div>
                    <Star className="w-6 h-6 text-yellow-400 fill-current ml-2"
                      style={{ filter: 'drop-shadow(0 0 6px rgba(250, 204, 21, 0.7))' }}
                    />
                  </div>

                  <div className="mb-3">
                    <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-gray-700/50">
                      <div
                        className={`h-full transition-all duration-500 ${
                          atingiuMeta
                            ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                            : 'bg-gradient-to-r from-yellow-400 to-amber-500'
                        }`}
                        style={{
                          width: `${progresso}%`,
                          boxShadow: atingiuMeta
                            ? '0 0 10px rgba(34, 197, 94, 0.5)'
                            : '0 0 10px rgba(251, 191, 36, 0.5)'
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium flex-shrink-0 ${
                      prof.time === 'front_office'
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        : 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
                    }`}>
                      {prof.time === 'front_office' ? 'Front' : 'Inside'}
                    </span>

                    {!atingiuMeta && faltamEstrelas > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center gap-1 flex-shrink-0">
                        <Zap className="w-2.5 h-2.5" />
                        -{faltamEstrelas}
                      </span>
                    )}

                    {atingiuMeta && proximoNivel && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-green-500/15 text-green-400 border border-green-500/30 flex items-center gap-1 flex-shrink-0">
                        <TrendingUp className="w-2.5 h-2.5" />
                        {proximoNivel.nome}
                      </span>
                    )}

                    {prof.meses_consecutivos_validos > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center gap-1 flex-shrink-0">
                        <Flame className="w-2.5 h-2.5" />
                        {prof.meses_consecutivos_validos}x
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {profissionaisComEstrelas.length === 0 && (
          <div className="text-center py-12 bg-gray-800/30 rounded-xl">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhum profissional cadastrado</p>
            <p className="text-gray-500 text-sm">Cadastre profissionais na aba de Profissionais</p>
          </div>
        )}
      </div>

      {selectedProfissional && (
        <ProfissionalDetailsModal
          profissional={selectedProfissional}
          estrelasPorPilar={getProfissionalEstrelasPorPilar(selectedProfissional.id)}
          pilares={pilares}
          niveis={niveis}
          mesReferencia={mesReferencia}
          onClose={() => setSelectedProfissional(null)}
        />
      )}
    </div>
  );
}

interface ProfissionalDetailsModalProps {
  profissional: Profissional & { estrelas_mes: number; estrelas_por_pilar: EstrelasMes[] };
  estrelasPorPilar: EstrelasMes[];
  pilares: Pilar[];
  niveis: Nivel[];
  mesReferencia: string;
  onClose: () => void;
}

function ProfissionalDetailsModal({
  profissional,
  estrelasPorPilar,
  pilares,
  niveis,
  mesReferencia,
  onClose
}: ProfissionalDetailsModalProps) {
  const metaEstrelas = profissional.nivel?.estrelas_necessarias || 6;
  const atingiuMeta = profissional.estrelas_mes >= metaEstrelas;
  const nivelStyle = getNivelStyle(profissional.nivel?.nome);
  const NivelIcon = nivelStyle.icon;

  const proximoNivel = (() => {
    if (!profissional.nivel) return niveis[0];
    const idx = niveis.findIndex(n => n.nome === profissional.nivel?.nome);
    if (idx < niveis.length - 1) return niveis[idx + 1];
    return null;
  })();

  const faltamEstrelas = Math.max(0, metaEstrelas - profissional.estrelas_mes);
  const progressoGeral = Math.min(100, (profissional.estrelas_mes / metaEstrelas) * 100);

  const conquistasPorPilar = pilares.map(pilar => {
    const estrelas = estrelasPorPilar.find(e => e.pilar?.nome === pilar.nome);
    return {
      ...pilar,
      conquistadas: estrelas?.estrelas_conquistadas || 0,
      progresso: ((estrelas?.estrelas_conquistadas || 0) / pilar.estrelas_maximas) * 100
    };
  });

  const pilaresCompletos = conquistasPorPilar.filter(p => p.conquistadas >= p.estrelas_maximas).length;
  const pilaresPendentes = conquistasPorPilar.filter(p => p.conquistadas < p.estrelas_maximas);

  const mesFormatado = new Date(mesReferencia + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-gray-700">
        <div className={`relative p-6 bg-gradient-to-br ${nivelStyle.bg} border-b border-gray-700`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-gray-800/50 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg"
              style={{
                backgroundColor: profissional.nivel?.cor + '30',
                border: `2px solid ${profissional.nivel?.cor}`
              }}
            >
              <NivelIcon className="w-10 h-10" style={{ color: profissional.nivel?.cor }} />
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white">{profissional.usuario?.nome || 'Sem nome'}</h2>
              <p className="text-gray-400">{profissional.usuario?.email}</p>
              <div className="flex items-center gap-3 mt-2">
                <span
                  className="px-3 py-1 rounded-full text-sm font-bold"
                  style={{
                    backgroundColor: profissional.nivel?.cor + '30',
                    color: profissional.nivel?.cor,
                    border: `1px solid ${profissional.nivel?.cor}`
                  }}
                >
                  {profissional.nivel?.nome || 'Starter'}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  profissional.time === 'front_office'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-teal-500/20 text-teal-400'
                }`}>
                  {profissional.time === 'front_office' ? 'Front Office' : 'Inside Sales'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-6">
            {[...Array(12)].map((_, i) => (
              <Star
                key={i}
                className={`w-6 h-6 ${
                  i < profissional.estrelas_mes
                    ? 'text-yellow-400 fill-current'
                    : 'text-gray-600'
                }`}
                style={i < profissional.estrelas_mes ? {
                  filter: 'drop-shadow(0 0 6px rgba(250, 204, 21, 0.6))'
                } : {}}
              />
            ))}
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-280px)] space-y-6">
          <div className="text-center text-gray-400 text-sm">
            Referencia: {mesFormatado}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl border ${
              atingiuMeta
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-gray-800/50 border-gray-700'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {atingiuMeta ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <Target className="w-5 h-5 text-orange-400" />
                )}
                <span className="text-gray-400 text-sm">Meta do Mes</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {profissional.estrelas_mes}/{metaEstrelas}
              </div>
              {!atingiuMeta && (
                <div className="text-orange-400 text-sm mt-1">
                  Faltam {faltamEstrelas} estrela{faltamEstrelas !== 1 ? 's' : ''}
                </div>
              )}
              {atingiuMeta && (
                <div className="text-green-400 text-sm mt-1">Meta atingida!</div>
              )}
            </div>

            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-5 h-5 text-orange-400" />
                <span className="text-gray-400 text-sm">Sequencia</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {profissional.meses_consecutivos_validos}
              </div>
              <div className="text-gray-500 text-sm mt-1">
                mes{profissional.meses_consecutivos_validos !== 1 ? 'es' : ''} consecutivo{profissional.meses_consecutivos_validos !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <span className="text-gray-400 text-sm">Bonus</span>
              </div>
              <div className="text-2xl font-bold text-white">
                R$ {atingiuMeta ? (profissional.nivel?.bonus_valor || 0).toLocaleString('pt-BR') : '0'}
              </div>
              <div className={`text-sm mt-1 ${atingiuMeta ? 'text-emerald-400' : 'text-gray-500'}`}>
                {atingiuMeta ? 'Bonus garantido!' : 'Atinja a meta para ganhar'}
              </div>
            </div>

            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-5 h-5 text-cyan-400" />
                <span className="text-gray-400 text-sm">Pilares</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {pilaresCompletos}/{pilares.length}
              </div>
              <div className="text-gray-500 text-sm mt-1">
                pilares completos
              </div>
            </div>
          </div>

          <div className="mb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Progresso Geral</span>
              <span className="text-white font-bold">{Math.round(progressoGeral)}%</span>
            </div>
            <div className="h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
              <div
                className={`h-full transition-all duration-700 ${
                  atingiuMeta
                    ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                    : 'bg-gradient-to-r from-yellow-400 to-amber-500'
                }`}
                style={{ width: `${progressoGeral}%` }}
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Conquistas por Pilar
            </h3>
            <div className="space-y-3">
              {conquistasPorPilar.map((pilar) => {
                const completo = pilar.conquistadas >= pilar.estrelas_maximas;
                return (
                  <div
                    key={pilar.id}
                    className={`p-4 rounded-xl border ${
                      completo
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-gray-800/50 border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {completo ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <Clock className="w-5 h-5 text-gray-500" />
                        )}
                        <span className={`font-medium ${completo ? 'text-green-400' : 'text-white'}`}>
                          {pilar.nome}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`font-bold ${completo ? 'text-green-400' : 'text-yellow-400'}`}>
                          {pilar.conquistadas}
                        </span>
                        <span className="text-gray-500">/{pilar.estrelas_maximas}</span>
                        <Star className={`w-4 h-4 ${completo ? 'text-green-400' : 'text-yellow-400'} fill-current`} />
                      </div>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          completo ? 'bg-green-500' : 'bg-yellow-500'
                        }`}
                        style={{ width: `${pilar.progresso}%` }}
                      />
                    </div>
                    <p className="text-gray-500 text-xs mt-2">{pilar.descricao}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {pilaresPendentes.length > 0 && !atingiuMeta && (
            <div className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/30">
              <h3 className="text-lg font-bold text-orange-400 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                O Que Falta Para Atingir a Meta
              </h3>
              <ul className="space-y-2">
                {pilaresPendentes.map((pilar) => {
                  const faltam = pilar.estrelas_maximas - pilar.conquistadas;
                  return (
                    <li key={pilar.id} className="flex items-center gap-2 text-gray-300">
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                      <span>
                        <strong>{pilar.nome}:</strong> conquistar mais {faltam} estrela{faltam !== 1 ? 's' : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 pt-4 border-t border-orange-500/20 text-orange-300 text-sm">
                Total de estrelas faltando: <strong>{faltamEstrelas}</strong>
              </div>
            </div>
          )}

          {proximoNivel && atingiuMeta && (
            <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/30">
              <h3 className="text-lg font-bold text-cyan-400 mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Proximo Nivel
              </h3>
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: proximoNivel.cor + '30' }}
                >
                  <Award className="w-6 h-6" style={{ color: proximoNivel.cor }} />
                </div>
                <div>
                  <div className="text-white font-bold">{proximoNivel.nome}</div>
                  <div className="text-gray-400 text-sm">
                    Meta: {proximoNivel.estrelas_necessarias} estrelas | Bonus: R$ {proximoNivel.bonus_valor.toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>
              <p className="text-cyan-300 text-sm mt-3">
                Mantenha {profissional.meses_consecutivos_validos >= 2 ? 'mais 1 mes' : '3 meses'} consecutivos atingindo a meta para subir de nivel!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
