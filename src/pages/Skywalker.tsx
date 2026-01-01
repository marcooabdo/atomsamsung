import { useState, useEffect } from 'react';
import { Star, Users, Trophy, BarChart3, BookOpen, Award, Settings } from 'lucide-react';
import { SkywalkerProvider, useSkywalker } from '../contexts/SkywalkerContext';
import { supabase } from '../lib/supabase';

function SkywalkerContent() {
  const [abaAtiva, setAbaAtiva] = useState('visao-geral');
  const { loadProfissionais, loadNiveis, loadPilares, loadRegrasEstrelas, loading } = useSkywalker();

  useEffect(() => {
    loadProfissionais();
    loadNiveis();
    loadPilares();
    loadRegrasEstrelas();
  }, []);

  const abas = [
    { id: 'visao-geral', nome: 'Visão Geral', icone: Star },
    { id: 'ranking', nome: 'Ranking Geral', icone: Trophy },
    { id: 'profissionais', nome: 'Profissionais', icone: Users },
    { id: 'pipelines', nome: 'Pipelines de Métricas', icone: BarChart3 },
    { id: 'regras', nome: 'Regras do Jogo', icone: BookOpen },
    { id: 'niveis', nome: 'Níveis & Bônus', icone: Award },
    { id: 'config', nome: 'Configurações Avançadas', icone: Settings }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Star className="w-16 h-16 text-cyan-400 animate-spin" />
          <p className="text-cyan-400 text-lg">Carregando Rota Estelar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-4 mb-2">
          <Star className="w-12 h-12 text-yellow-400" />
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-yellow-400 bg-clip-text text-transparent">
              Skywalker
            </h1>
            <p className="text-gray-400">Rota Estelar Group Global</p>
          </div>
        </div>
      </header>

      <nav>
        <div className="flex flex-wrap gap-2 bg-gray-800/50 p-2 rounded-lg border border-cyan-500/30">
          {abas.map((aba) => {
            const Icon = aba.icone;
            return (
              <button
                key={aba.id}
                onClick={() => setAbaAtiva(aba.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                  ${abaAtiva === aba.id
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/50'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium text-sm">{aba.nome}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="bg-gray-800/50 rounded-lg border border-cyan-500/30 p-6">
        {abaAtiva === 'visao-geral' && <VisaoGeral />}
        {abaAtiva === 'ranking' && <RankingGeral />}
        {abaAtiva === 'profissionais' && <Profissionais />}
        {abaAtiva === 'pipelines' && <Pipelines />}
        {abaAtiva === 'regras' && <RegrasJogo />}
        {abaAtiva === 'niveis' && <NiveisBonus />}
        {abaAtiva === 'config' && <ConfiguracoesAvancadas />}
      </div>
    </div>
  );
}

function VisaoGeral() {
  const { profissionais, mesReferencia } = useSkywalker();
  const [kpis, setKpis] = useState({ faturamento: 0, mediaEstrelas: 0, promoviveis: 0, travados: 0 });
  const [profissionaisComEstrelas, setProfissionaisComEstrelas] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [mesReferencia, profissionais]);

  const loadDashboardData = async () => {
    const { data: estrelas } = await supabase
      .from('skywalker_estrelas_mes')
      .select(`
        profissional_id,
        estrelas_conquistadas,
        pilar:skywalker_pilares(nome)
      `)
      .eq('mes_referencia', mesReferencia);

    const profComEstrelas = profissionais.map(prof => {
      const estrelasProf = estrelas?.filter(e => e.profissional_id === prof.id) || [];
      const totalEstrelas = estrelasProf.reduce((sum, e) => sum + e.estrelas_conquistadas, 0);

      return {
        ...prof,
        estrelas_mes: totalEstrelas,
        estrelas_por_pilar: estrelasProf
      };
    });

    setProfissionaisComEstrelas(profComEstrelas);

    const mediaEstrelas = profComEstrelas.length > 0
      ? profComEstrelas.reduce((sum, p) => sum + p.estrelas_mes, 0) / profComEstrelas.length
      : 0;

    setKpis({
      faturamento: 0,
      mediaEstrelas: Number(mediaEstrelas.toFixed(1)),
      promoviveis: profComEstrelas.filter(p => p.estrelas_mes >= (p.nivel?.estrelas_necessarias || 6)).length,
      travados: 0
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 p-6 rounded-lg border border-green-500/30">
          <div className="text-green-400 text-sm mb-2">Faturamento Total</div>
          <div className="text-3xl font-bold text-white">R$ {kpis.faturamento.toLocaleString('pt-BR')}</div>
        </div>

        <div className="bg-gradient-to-br from-cyan-600/20 to-cyan-800/20 p-6 rounded-lg border border-cyan-500/30">
          <div className="text-cyan-400 text-sm mb-2">Média de Estrelas</div>
          <div className="text-3xl font-bold text-white flex items-center gap-2">
            {kpis.mediaEstrelas}
            <Star className="w-6 h-6 text-yellow-400 fill-current" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 p-6 rounded-lg border border-yellow-500/30">
          <div className="text-yellow-400 text-sm mb-2">Profissionais Promovíveis</div>
          <div className="text-3xl font-bold text-white">{kpis.promoviveis}</div>
        </div>

        <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 p-6 rounded-lg border border-red-500/30">
          <div className="text-red-400 text-sm mb-2">Travados por Regra</div>
          <div className="text-3xl font-bold text-white">{kpis.travados}</div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Users className="w-6 h-6 text-cyan-400" />
          Profissionais
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profissionaisComEstrelas.map(prof => (
            <div
              key={prof.id}
              className="bg-gray-800/50 rounded-lg p-4 border border-cyan-500/30 hover:border-cyan-500 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-bold text-white">{prof.usuario?.nome}</div>
                  <div className="text-sm text-gray-400">{prof.unidade?.nome}</div>
                  <div className="text-xs text-gray-500">{prof.time === 'front_office' ? 'Front Office' : 'Inside Sales'}</div>
                </div>
                <div
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: prof.nivel?.cor + '20',
                    color: prof.nivel?.cor,
                    border: `1px solid ${prof.nivel?.cor}50`
                  }}
                >
                  {prof.nivel?.nome || 'Starter'}
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-400">Progresso do Mês</span>
                  <span className="text-sm text-yellow-400 font-bold">
                    {prof.estrelas_mes}/{prof.nivel?.estrelas_necessarias || 6} <Star className="w-4 h-4 inline fill-current" />
                  </span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-yellow-600 transition-all"
                    style={{
                      width: `${Math.min(100, (prof.estrelas_mes / (prof.nivel?.estrelas_necessarias || 6)) * 100)}%`
                    }}
                  />
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Mês {prof.meses_consecutivos_validos}/{prof.nivel?.meses_consecutivos || 2} consecutivo
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RankingGeral() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Trophy className="w-6 h-6 text-yellow-400" />
        Ranking Geral
      </h2>
      <p className="text-gray-400">Em desenvolvimento...</p>
    </div>
  );
}

function Profissionais() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Users className="w-6 h-6 text-cyan-400" />
        Gestão de Profissionais
      </h2>
      <p className="text-gray-400">Em desenvolvimento...</p>
    </div>
  );
}

function Pipelines() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <BarChart3 className="w-6 h-6 text-green-400" />
        Pipelines de Métricas
      </h2>
      <p className="text-gray-400">Em desenvolvimento...</p>
    </div>
  );
}

function RegrasJogo() {
  const { pilares, regrasEstrelas } = useSkywalker();

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <BookOpen className="w-6 h-6 text-blue-400" />
        Regras do Jogo
      </h2>

      <div className="space-y-6">
        {pilares.map(pilar => {
          const regras = regrasEstrelas.filter(r => r.pilar_id === pilar.id);

          return (
            <div key={pilar.id} className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <h3 className="text-xl font-bold mb-2 text-cyan-400">{pilar.nome}</h3>
              <p className="text-gray-400 text-sm mb-4">{pilar.descricao}</p>

              <div className="space-y-2">
                {regras.map(regra => (
                  <div key={regra.id} className="flex items-center justify-between p-3 bg-gray-900/50 rounded">
                    <div className="text-sm">
                      <span className="text-gray-300">
                        {regra.valor_minimo}
                        {regra.valor_maximo && ` - ${regra.valor_maximo}`}
                        {pilar.tipo_metrica === 'percentual' && '%'}
                      </span>
                      <span className="text-gray-500 ml-2">({regra.time === 'front_office' ? 'Front Office' : 'Inside Sales'})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: regra.estrelas }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NiveisBonus() {
  const { niveis } = useSkywalker();

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Award className="w-6 h-6 text-yellow-400" />
        Níveis & Bônus
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {niveis.map(nivel => (
          <div
            key={nivel.id}
            className="rounded-lg p-6 border-2"
            style={{
              backgroundColor: nivel.cor + '10',
              borderColor: nivel.cor + '50'
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold" style={{ color: nivel.cor }}>{nivel.nome}</h3>
              <div className="text-3xl font-bold" style={{ color: nivel.cor }}>#{nivel.ordem}</div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                <span className="text-gray-300">
                  <strong>{nivel.estrelas_necessarias}</strong> estrelas necessárias
                </span>
              </div>

              {nivel.meses_consecutivos > 0 && (
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  <span className="text-gray-300">
                    <strong>{nivel.meses_consecutivos}</strong> meses consecutivos
                  </span>
                </div>
              )}

              <p className="text-gray-400 mt-4">{nivel.descricao}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfiguracoesAvancadas() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Settings className="w-6 h-6 text-gray-400" />
        Configurações Avançadas
      </h2>
      <p className="text-gray-400">Em desenvolvimento...</p>
    </div>
  );
}

export function Skywalker() {
  return (
    <SkywalkerProvider>
      <SkywalkerContent />
    </SkywalkerProvider>
  );
}
