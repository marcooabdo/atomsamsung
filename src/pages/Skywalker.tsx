import { useState, useEffect } from 'react';
import { Star, Users, Trophy, BarChart3, BookOpen, Award, Settings, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { VisaoGeralTab } from '../components/skywalker/VisaoGeralTab';
import { RegrasJogoTab } from '../components/skywalker/RegrasJogoTab';
import { NiveisBonusTab } from '../components/skywalker/NiveisBonusTab';
import { TimesTab } from '../components/skywalker/TimesTab';

interface Profissional {
  id: string;
  usuario: { nome: string } | null;
  unidade: { nome: string } | null;
  nivel: { nome: string; cor: string; estrelas_necessarias: number } | null;
  time: string;
  meses_consecutivos_validos: number;
}

interface EstrelasMes {
  profissional_id: string;
  estrelas_conquistadas: number;
}

export function Skywalker() {
  const [abaAtiva, setAbaAtiva] = useState('visao-geral');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const abas = [
    { id: 'visao-geral', nome: 'Visao Geral', icone: Star },
    { id: 'ranking', nome: 'Ranking', icone: Trophy },
    { id: 'profissionais', nome: 'Profissionais', icone: Users },
    { id: 'pipelines', nome: 'Metricas', icone: BarChart3 },
    { id: 'regras', nome: 'Regras do Jogo', icone: BookOpen },
    { id: 'niveis', nome: 'Niveis e Bonus', icone: Award },
    { id: 'times', nome: 'Times', icone: Layers },
    { id: 'config', nome: 'Configuracoes', icone: Settings }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Star className="w-16 h-16 text-cyan-400 animate-spin" />
          <p className="text-cyan-400 text-lg">Carregando Skywalker...</p>
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
            <p className="text-gray-400">Sistema de Gamificacao - Rota Estelar</p>
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
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
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
        {abaAtiva === 'visao-geral' && <VisaoGeralTab />}
        {abaAtiva === 'ranking' && <RankingGeral />}
        {abaAtiva === 'profissionais' && <ProfissionaisTab />}
        {abaAtiva === 'pipelines' && <PipelinesTab />}
        {abaAtiva === 'regras' && <RegrasJogoTab />}
        {abaAtiva === 'niveis' && <NiveisBonusTab />}
        {abaAtiva === 'times' && <TimesTab />}
        {abaAtiva === 'config' && <ConfiguracoesTab />}
      </div>
    </div>
  );
}

function RankingGeral() {
  const [periodo, setPeriodo] = useState<'mensal' | 'trimestral' | 'anual'>('mensal');
  const [mesReferencia, setMesReferencia] = useState(new Date().toISOString().slice(0, 7));
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRanking();
  }, [mesReferencia]);

  const loadRanking = async () => {
    setLoading(true);

    const { data: profissionais } = await supabase
      .from('skywalker_profissionais')
      .select(`
        id,
        time,
        usuario:usuarios(nome),
        unidade:unidades(nome),
        nivel:skywalker_niveis(nome, cor, bonus_valor)
      `)
      .eq('ativo', true);

    const { data: estrelas } = await supabase
      .from('skywalker_estrelas_mes')
      .select('profissional_id, estrelas_conquistadas')
      .eq('mes_referencia', mesReferencia + '-01');

    if (profissionais && estrelas) {
      const rankingData = profissionais.map(prof => {
        const estrelasProf = estrelas
          .filter(e => e.profissional_id === prof.id)
          .reduce((sum, e) => sum + e.estrelas_conquistadas, 0);

        return {
          ...prof,
          estrelas: estrelasProf,
          bonus: (prof.nivel as any)?.bonus_valor || 0
        };
      }).sort((a, b) => b.estrelas - a.estrelas);

      setRanking(rankingData);
    }

    setLoading(false);
  };

  const getPodiumColor = (posicao: number) => {
    if (posicao === 1) return 'from-yellow-500/30 to-yellow-700/30 border-yellow-500';
    if (posicao === 2) return 'from-gray-400/30 to-gray-600/30 border-gray-400';
    if (posicao === 3) return 'from-orange-600/30 to-orange-800/30 border-orange-600';
    return '';
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-400" />
          Ranking Geral
        </h2>

        <div className="flex gap-3">
          <input
            type="month"
            value={mesReferencia}
            onChange={(e) => setMesReferencia(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          />
        </div>
      </div>

      {ranking.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {ranking.slice(0, 3).map((prof, idx) => (
            <div
              key={prof.id}
              className={`bg-gradient-to-br ${getPodiumColor(idx + 1)} p-6 rounded-xl border-2 transform hover:scale-105 transition-all`}
            >
              <div className="text-center">
                <div className="text-6xl mb-2">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                </div>
                <h3 className="text-xl font-bold text-white mb-1">
                  {(prof.usuario as any)?.nome || 'Sem nome'}
                </h3>
                <p className="text-gray-400 text-sm mb-3">{(prof.unidade as any)?.nome}</p>
                <div className="flex items-center justify-center gap-1 mb-2">
                  {Array.from({ length: Math.min(prof.estrelas, 8) }).map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                  {prof.estrelas > 8 && <span className="text-yellow-400 ml-1">+{prof.estrelas - 8}</span>}
                </div>
                <div
                  className="inline-block px-3 py-1 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: ((prof.nivel as any)?.cor || '#6B7280') + '30',
                    color: (prof.nivel as any)?.cor || '#6B7280'
                  }}
                >
                  {(prof.nivel as any)?.nome || 'Starter'}
                </div>
                {prof.bonus > 0 && (
                  <div className="mt-3 text-green-400 font-bold text-lg">
                    +R$ {prof.bonus.toLocaleString('pt-BR')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-gray-900/50 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/50">
              <th className="px-6 py-4 text-left text-sm font-bold text-cyan-400">#</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-cyan-400">Profissional</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-cyan-400">Unidade</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-cyan-400">Time</th>
              <th className="px-6 py-4 text-center text-sm font-bold text-cyan-400">Estrelas</th>
              <th className="px-6 py-4 text-center text-sm font-bold text-cyan-400">Nivel</th>
              <th className="px-6 py-4 text-right text-sm font-bold text-cyan-400">Bonus</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((prof, idx) => (
              <tr key={prof.id} className="border-b border-gray-700/50 hover:bg-gray-800/30">
                <td className="px-6 py-4">
                  <span className={`font-bold text-lg ${idx < 3 ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {idx + 1}
                  </span>
                </td>
                <td className="px-6 py-4 text-white font-medium">
                  {(prof.usuario as any)?.nome || 'Sem nome'}
                </td>
                <td className="px-6 py-4 text-gray-400">
                  {(prof.unidade as any)?.nome || '-'}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${
                    prof.time === 'front_office'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {prof.time === 'front_office' ? 'Front Office' : 'Inside Sales'}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    {Array.from({ length: Math.min(prof.estrelas, 5) }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                    ))}
                    {prof.estrelas > 5 && <span className="text-yellow-400 ml-1">+{prof.estrelas - 5}</span>}
                    {prof.estrelas === 0 && <span className="text-gray-500">0</span>}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: ((prof.nivel as any)?.cor || '#6B7280') + '30',
                      color: (prof.nivel as any)?.cor || '#6B7280'
                    }}
                  >
                    {(prof.nivel as any)?.nome || 'Starter'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-green-400 font-bold">
                  {prof.bonus > 0 ? `+R$ ${prof.bonus.toLocaleString('pt-BR')}` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {ranking.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhum profissional no ranking</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfissionaisTab() {
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [niveis, setNiveis] = useState<any[]>([]);
  const [times, setTimes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNovo, setShowNovo] = useState(false);

  const [novoProfissional, setNovoProfissional] = useState({
    usuario_id: '',
    unidade_id: '',
    time: 'front_office',
    nivel_atual_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const [profRes, userRes, unidRes, nivRes, timesRes] = await Promise.all([
      supabase.from('skywalker_profissionais').select(`
        id, time, meses_consecutivos_validos, ativo,
        usuario:usuarios(id, nome, email),
        unidade:unidades(id, nome),
        nivel:skywalker_niveis(id, nome, cor)
      `).order('created_at'),
      supabase.from('usuarios').select('id, nome, email').eq('ativo', true),
      supabase.from('unidades').select('id, nome'),
      supabase.from('skywalker_niveis').select('id, nome, cor, ordem').order('ordem'),
      supabase.from('skywalker_times').select('*').eq('ativo', true).order('ordem')
    ]);

    if (profRes.data) setProfissionais(profRes.data);
    if (userRes.data) setUsuarios(userRes.data);
    if (unidRes.data) setUnidades(unidRes.data);
    if (nivRes.data) setNiveis(nivRes.data);
    if (timesRes.data) setTimes(timesRes.data);

    setLoading(false);
  };

  const handleSaveProfissional = async () => {
    if (!novoProfissional.usuario_id || !novoProfissional.unidade_id) return;

    const { error } = await supabase.from('skywalker_profissionais').insert({
      ...novoProfissional,
      nivel_atual_id: novoProfissional.nivel_atual_id || (niveis[0]?.id || null),
      meses_consecutivos_validos: 0,
      ativo: true
    });

    if (!error) {
      setShowNovo(false);
      setNovoProfissional({ usuario_id: '', unidade_id: '', time: 'front_office', nivel_atual_id: '' });
      loadData();
    }
  };

  const handleDeleteProfissional = async (id: string) => {
    if (!confirm('Remover este profissional do programa?')) return;
    await supabase.from('skywalker_profissionais').delete().eq('id', id);
    loadData();
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
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-cyan-400" />
          Profissionais
        </h2>
        <button
          onClick={() => setShowNovo(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg"
        >
          <Users className="w-4 h-4" />
          Adicionar Profissional
        </button>
      </div>

      {showNovo && (
        <div className="bg-gray-800/80 rounded-xl p-6 border border-cyan-500/50">
          <h4 className="text-lg font-bold text-white mb-4">Adicionar ao Programa</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Usuario</label>
              <select
                value={novoProfissional.usuario_id}
                onChange={(e) => setNovoProfissional({ ...novoProfissional, usuario_id: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
              >
                <option value="">Selecione...</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Unidade</label>
              <select
                value={novoProfissional.unidade_id}
                onChange={(e) => setNovoProfissional({ ...novoProfissional, unidade_id: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
              >
                <option value="">Selecione...</option>
                {unidades.map(u => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Time</label>
              <select
                value={novoProfissional.time}
                onChange={(e) => setNovoProfissional({ ...novoProfissional, time: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
              >
                {times.map(t => (
                  <option key={t.codigo} value={t.codigo}>{t.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nivel Inicial</label>
              <select
                value={novoProfissional.nivel_atual_id}
                onChange={(e) => setNovoProfissional({ ...novoProfissional, nivel_atual_id: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
              >
                <option value="">Starter</option>
                {niveis.map(n => (
                  <option key={n.id} value={n.id}>{n.nome}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowNovo(false)} className="px-4 py-2 bg-gray-700 text-white rounded-lg">
              Cancelar
            </button>
            <button onClick={handleSaveProfissional} className="px-4 py-2 bg-cyan-600 text-white rounded-lg">
              Adicionar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profissionais.map(prof => (
          <div
            key={prof.id}
            className="bg-gray-800/50 rounded-xl p-5 border border-gray-700 hover:border-cyan-500/50 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                  style={{
                    backgroundColor: (prof.nivel?.cor || '#6B7280') + '30',
                    color: prof.nivel?.cor || '#6B7280'
                  }}
                >
                  {prof.usuario?.nome?.split(' ').map((n: string) => n[0]).join('').substring(0, 2) || '??'}
                </div>
                <div>
                  <h4 className="text-white font-bold">{prof.usuario?.nome || 'Sem nome'}</h4>
                  <p className="text-gray-400 text-sm">{prof.unidade?.nome}</p>
                </div>
              </div>
              <button
                onClick={() => handleDeleteProfissional(prof.id)}
                className="p-1.5 text-gray-400 hover:text-red-400"
              >
                <Users className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className={`px-2 py-1 rounded text-xs ${
                prof.time === 'front_office'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-purple-500/20 text-purple-400'
              }`}>
                {prof.time === 'front_office' ? 'Front Office' : 'Inside Sales'}
              </span>
              <span
                className="px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: (prof.nivel?.cor || '#6B7280') + '20',
                  color: prof.nivel?.cor || '#6B7280'
                }}
              >
                {prof.nivel?.nome || 'Starter'}
              </span>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-700 text-sm text-gray-400">
              {prof.meses_consecutivos_validos} mes(es) consecutivos
            </div>
          </div>
        ))}
      </div>

      {profissionais.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhum profissional cadastrado</p>
        </div>
      )}
    </div>
  );
}

function PipelinesTab() {
  const [pilares, setPilares] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPilares();
  }, []);

  const loadPilares = async () => {
    const { data } = await supabase
      .from('skywalker_pilares')
      .select('*')
      .eq('ativo', true)
      .order('ordem');

    if (data) setPilares(data);
    setLoading(false);
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
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <BarChart3 className="w-6 h-6 text-green-400" />
        Pipeline de Metricas
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pilares.map(pilar => (
          <div key={pilar.id} className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
            <h4 className="text-white font-bold text-lg mb-2">{pilar.nome}</h4>
            <p className="text-gray-400 text-sm mb-4">{pilar.descricao}</p>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tipo:</span>
                <span className="text-white capitalize">{pilar.tipo_metrica}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Max Estrelas:</span>
                <span className="text-yellow-400 font-bold">{pilar.max_estrelas}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Meta Front:</span>
                <span className="text-blue-400">{pilar.meta_front_office}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Meta Inside:</span>
                <span className="text-purple-400">{pilar.meta_inside_sales}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex gap-2">
                {pilar.time_aplicavel?.map((time: string) => (
                  <span
                    key={time}
                    className={`px-2 py-1 rounded text-xs ${
                      time === 'front_office'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}
                  >
                    {time === 'front_office' ? 'Front' : 'Inside'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {pilares.length === 0 && (
        <div className="text-center py-12">
          <BarChart3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Configure os pilares na aba "Regras do Jogo"</p>
        </div>
      )}
    </div>
  );
}

function ConfiguracoesTab() {
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = () => {
    setSalvando(true);
    setTimeout(() => setSalvando(false), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-gray-400" />
          Configuracoes
        </h2>
        <button
          onClick={handleSalvar}
          disabled={salvando}
          className="px-6 py-2 bg-cyan-600 text-white rounded-lg disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-4">Ciclo de Avaliacao</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Periodo</label>
              <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white">
                <option value="mensal">Mensal</option>
                <option value="quinzenal">Quinzenal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Dia de Fechamento</label>
              <input
                type="number"
                defaultValue={25}
                min={1}
                max={31}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-4">Notificacoes</h3>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-gray-300">Notificacoes push</span>
              <input type="checkbox" defaultChecked className="w-5 h-5 accent-cyan-500" />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-gray-300">E-mails automaticos</span>
              <input type="checkbox" defaultChecked className="w-5 h-5 accent-cyan-500" />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-gray-300">Resumo semanal</span>
              <input type="checkbox" className="w-5 h-5 accent-cyan-500" />
            </label>
          </div>
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-bold text-white mb-4">Acoes</h3>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-blue-600/20 border border-blue-500/50 text-blue-400 rounded-lg hover:bg-blue-600/30">
            Recalcular Estrelas
          </button>
          <button className="px-4 py-2 bg-green-600/20 border border-green-500/50 text-green-400 rounded-lg hover:bg-green-600/30">
            Processar Promocoes
          </button>
          <button className="px-4 py-2 bg-yellow-600/20 border border-yellow-500/50 text-yellow-400 rounded-lg hover:bg-yellow-600/30">
            Gerar Relatorio
          </button>
        </div>
      </div>
    </div>
  );
}
