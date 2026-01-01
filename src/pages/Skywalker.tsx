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
  const [periodo, setPeriodo] = useState<'mensal' | 'trimestral' | 'anual'>('mensal');
  const [filtroUnidade, setFiltroUnidade] = useState('todas');
  const [filtroTime, setFiltroTime] = useState('todos');

  const rankingFicticio = [
    { posicao: 1, nome: 'Ana Carolina Silva', unidade: 'Feira de Santana', time: 'Front Office', estrelas: 8, nivel: 'Gold', cor: '#FFD700', bonus: 1200, trend: 'up' },
    { posicao: 2, nome: 'Carlos Eduardo Santos', unidade: 'Uberlandia', time: 'Inside Sales', estrelas: 7, nivel: 'Gold', cor: '#FFD700', bonus: 1000, trend: 'up' },
    { posicao: 3, nome: 'Maria Fernanda Costa', unidade: 'Feira de Santana', time: 'Front Office', estrelas: 7, nivel: 'Silver', cor: '#C0C0C0', bonus: 800, trend: 'same' },
    { posicao: 4, nome: 'Pedro Henrique Lima', unidade: 'Uberlandia', time: 'Inside Sales', estrelas: 6, nivel: 'Silver', cor: '#C0C0C0', bonus: 600, trend: 'down' },
    { posicao: 5, nome: 'Julia Oliveira', unidade: 'Feira de Santana', time: 'Front Office', estrelas: 6, nivel: 'Silver', cor: '#C0C0C0', bonus: 600, trend: 'up' },
    { posicao: 6, nome: 'Lucas Almeida', unidade: 'Uberlandia', time: 'Inside Sales', estrelas: 5, nivel: 'Bronze', cor: '#CD7F32', bonus: 400, trend: 'same' },
    { posicao: 7, nome: 'Beatriz Souza', unidade: 'Feira de Santana', time: 'Front Office', estrelas: 5, nivel: 'Bronze', cor: '#CD7F32', bonus: 400, trend: 'up' },
    { posicao: 8, nome: 'Gabriel Martins', unidade: 'Uberlandia', time: 'Inside Sales', estrelas: 4, nivel: 'Starter', cor: '#6B7280', bonus: 200, trend: 'down' },
  ];

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return <span className="text-green-400">▲</span>;
    if (trend === 'down') return <span className="text-red-400">▼</span>;
    return <span className="text-gray-400">-</span>;
  };

  const getPodiumColor = (posicao: number) => {
    if (posicao === 1) return 'from-yellow-500/30 to-yellow-700/30 border-yellow-500';
    if (posicao === 2) return 'from-gray-400/30 to-gray-600/30 border-gray-400';
    if (posicao === 3) return 'from-orange-600/30 to-orange-800/30 border-orange-600';
    return '';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-400" />
          Ranking Geral
        </h2>

        <div className="flex gap-3 flex-wrap">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as any)}
            className="bg-gray-800 border border-cyan-500/30 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="mensal">Mensal</option>
            <option value="trimestral">Trimestral</option>
            <option value="anual">Anual</option>
          </select>

          <select
            value={filtroUnidade}
            onChange={(e) => setFiltroUnidade(e.target.value)}
            className="bg-gray-800 border border-cyan-500/30 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="todas">Todas Unidades</option>
            <option value="feira">Feira de Santana</option>
            <option value="uberlandia">Uberlandia</option>
          </select>

          <select
            value={filtroTime}
            onChange={(e) => setFiltroTime(e.target.value)}
            className="bg-gray-800 border border-cyan-500/30 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="todos">Todos os Times</option>
            <option value="front">Front Office</option>
            <option value="inside">Inside Sales</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {rankingFicticio.slice(0, 3).map((prof, idx) => (
          <div
            key={idx}
            className={`bg-gradient-to-br ${getPodiumColor(prof.posicao)} p-6 rounded-xl border-2 transform hover:scale-105 transition-all`}
          >
            <div className="text-center">
              <div className="text-6xl font-bold mb-2" style={{ color: prof.cor }}>
                {prof.posicao === 1 ? '🥇' : prof.posicao === 2 ? '🥈' : '🥉'}
              </div>
              <h3 className="text-xl font-bold text-white mb-1">{prof.nome}</h3>
              <p className="text-gray-400 text-sm mb-3">{prof.unidade}</p>
              <div className="flex items-center justify-center gap-1 mb-2">
                {Array.from({ length: prof.estrelas }).map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <div
                className="inline-block px-3 py-1 rounded-full text-xs font-bold"
                style={{ backgroundColor: prof.cor + '30', color: prof.cor }}
              >
                {prof.nivel}
              </div>
              <div className="mt-3 text-green-400 font-bold text-lg">
                +R$ {prof.bonus.toLocaleString('pt-BR')}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-900/50 rounded-xl border border-cyan-500/30 overflow-hidden">
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
              <th className="px-6 py-4 text-center text-sm font-bold text-cyan-400">Trend</th>
            </tr>
          </thead>
          <tbody>
            {rankingFicticio.map((prof, idx) => (
              <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-800/30 transition-colors">
                <td className="px-6 py-4">
                  <span className={`font-bold text-lg ${prof.posicao <= 3 ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {prof.posicao}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-white font-medium">{prof.nome}</span>
                </td>
                <td className="px-6 py-4 text-gray-400">{prof.unidade}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${prof.time === 'Front Office' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                    {prof.time}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    {Array.from({ length: prof.estrelas }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{ backgroundColor: prof.cor + '30', color: prof.cor }}
                  >
                    {prof.nivel}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-green-400 font-bold">
                  +R$ {prof.bonus.toLocaleString('pt-BR')}
                </td>
                <td className="px-6 py-4 text-center text-lg">
                  {getTrendIcon(prof.trend)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Profissionais() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroNivel, setFiltroNivel] = useState('todos');
  const [selectedProfissional, setSelectedProfissional] = useState<any>(null);

  const profissionaisFicticios = [
    { id: 1, nome: 'Ana Carolina Silva', email: 'ana.silva@groupglobal.com.br', unidade: 'Feira de Santana', time: 'Front Office', nivel: 'Gold', cor: '#FFD700', estrelasMes: 8, estrelasTotal: 45, mesesConsecutivos: 4, dataEntrada: '2024-03-15', ativo: true },
    { id: 2, nome: 'Carlos Eduardo Santos', email: 'carlos.santos@groupglobal.com.br', unidade: 'Uberlandia', time: 'Inside Sales', nivel: 'Gold', cor: '#FFD700', estrelasMes: 7, estrelasTotal: 38, mesesConsecutivos: 3, dataEntrada: '2024-01-10', ativo: true },
    { id: 3, nome: 'Maria Fernanda Costa', email: 'maria.costa@groupglobal.com.br', unidade: 'Feira de Santana', time: 'Front Office', nivel: 'Silver', cor: '#C0C0C0', estrelasMes: 7, estrelasTotal: 32, mesesConsecutivos: 2, dataEntrada: '2024-05-20', ativo: true },
    { id: 4, nome: 'Pedro Henrique Lima', email: 'pedro.lima@groupglobal.com.br', unidade: 'Uberlandia', time: 'Inside Sales', nivel: 'Silver', cor: '#C0C0C0', estrelasMes: 6, estrelasTotal: 28, mesesConsecutivos: 2, dataEntrada: '2024-04-01', ativo: true },
    { id: 5, nome: 'Julia Oliveira', email: 'julia.oliveira@groupglobal.com.br', unidade: 'Feira de Santana', time: 'Front Office', nivel: 'Silver', cor: '#C0C0C0', estrelasMes: 6, estrelasTotal: 25, mesesConsecutivos: 1, dataEntrada: '2024-06-15', ativo: true },
    { id: 6, nome: 'Lucas Almeida', email: 'lucas.almeida@groupglobal.com.br', unidade: 'Uberlandia', time: 'Inside Sales', nivel: 'Bronze', cor: '#CD7F32', estrelasMes: 5, estrelasTotal: 18, mesesConsecutivos: 1, dataEntrada: '2024-07-01', ativo: true },
    { id: 7, nome: 'Beatriz Souza', email: 'beatriz.souza@groupglobal.com.br', unidade: 'Feira de Santana', time: 'Front Office', nivel: 'Bronze', cor: '#CD7F32', estrelasMes: 5, estrelasTotal: 15, mesesConsecutivos: 0, dataEntrada: '2024-08-10', ativo: true },
    { id: 8, nome: 'Gabriel Martins', email: 'gabriel.martins@groupglobal.com.br', unidade: 'Uberlandia', time: 'Inside Sales', nivel: 'Starter', cor: '#6B7280', estrelasMes: 4, estrelasTotal: 8, mesesConsecutivos: 0, dataEntrada: '2024-09-01', ativo: true },
  ];

  const historicoFicticio = [
    { mes: 'Dez/2025', estrelas: 8, nivel: 'Gold', bonus: 1200 },
    { mes: 'Nov/2025', estrelas: 7, nivel: 'Gold', bonus: 1000 },
    { mes: 'Out/2025', estrelas: 7, nivel: 'Silver', bonus: 800 },
    { mes: 'Set/2025', estrelas: 6, nivel: 'Silver', bonus: 600 },
    { mes: 'Ago/2025', estrelas: 5, nivel: 'Bronze', bonus: 400 },
    { mes: 'Jul/2025', estrelas: 6, nivel: 'Silver', bonus: 600 },
  ];

  const filteredProfissionais = profissionaisFicticios.filter(p => {
    const matchSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       p.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchNivel = filtroNivel === 'todos' || p.nivel.toLowerCase() === filtroNivel;
    return matchSearch && matchNivel;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-cyan-400" />
          Gestao de Profissionais
        </h2>

        <div className="flex gap-3 flex-wrap">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar profissional..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-800 border border-cyan-500/30 rounded-lg px-4 py-2 text-sm text-white pl-10 w-64"
            />
            <Users className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          </div>

          <select
            value={filtroNivel}
            onChange={(e) => setFiltroNivel(e.target.value)}
            className="bg-gray-800 border border-cyan-500/30 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="todos">Todos os Niveis</option>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="bronze">Bronze</option>
            <option value="starter">Starter</option>
          </select>

          <button className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-all flex items-center gap-2">
            <Users className="w-4 h-4" />
            Novo Profissional
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {filteredProfissionais.map((prof) => (
            <div
              key={prof.id}
              onClick={() => setSelectedProfissional(prof)}
              className={`bg-gray-800/50 rounded-xl p-5 border cursor-pointer transition-all hover:border-cyan-500 ${
                selectedProfissional?.id === prof.id ? 'border-cyan-500 ring-2 ring-cyan-500/30' : 'border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold"
                    style={{ backgroundColor: prof.cor + '30', color: prof.cor }}
                  >
                    {prof.nome.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">{prof.nome}</h3>
                    <p className="text-gray-400 text-sm">{prof.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-gray-500 text-xs">{prof.unidade}</span>
                      <span className="text-gray-600">|</span>
                      <span className={`text-xs ${prof.time === 'Front Office' ? 'text-blue-400' : 'text-purple-400'}`}>
                        {prof.time}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className="px-4 py-1.5 rounded-full text-sm font-bold mb-2"
                    style={{ backgroundColor: prof.cor + '30', color: prof.cor }}
                  >
                    {prof.nivel}
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    {Array.from({ length: Math.min(prof.estrelasMes, 8) }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                    ))}
                    <span className="text-gray-400 text-sm ml-1">({prof.estrelasMes})</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-4 pt-4 border-t border-gray-700">
                <div>
                  <div className="text-gray-500 text-xs">Estrelas Mes</div>
                  <div className="text-white font-bold">{prof.estrelasMes}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Total Acumulado</div>
                  <div className="text-white font-bold">{prof.estrelasTotal}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Meses Consec.</div>
                  <div className="text-white font-bold">{prof.mesesConsecutivos}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Status</div>
                  <div className={`font-bold ${prof.ativo ? 'text-green-400' : 'text-red-400'}`}>
                    {prof.ativo ? 'Ativo' : 'Inativo'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          {selectedProfissional ? (
            <div className="bg-gray-800/50 rounded-xl p-5 border border-cyan-500/30 sticky top-4">
              <div className="text-center mb-6">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-3"
                  style={{ backgroundColor: selectedProfissional.cor + '30', color: selectedProfissional.cor }}
                >
                  {selectedProfissional.nome.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                </div>
                <h3 className="text-white font-bold text-xl">{selectedProfissional.nome}</h3>
                <p className="text-gray-400 text-sm">{selectedProfissional.email}</p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-400">Nivel Atual</span>
                  <span className="font-bold" style={{ color: selectedProfissional.cor }}>{selectedProfissional.nivel}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-400">Unidade</span>
                  <span className="text-white">{selectedProfissional.unidade}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-400">Time</span>
                  <span className="text-white">{selectedProfissional.time}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-400">Data de Entrada</span>
                  <span className="text-white">{new Date(selectedProfissional.dataEntrada).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              <h4 className="text-cyan-400 font-bold mb-3">Historico Recente</h4>
              <div className="space-y-2">
                {historicoFicticio.map((h, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 bg-gray-900/50 rounded px-3">
                    <span className="text-gray-400 text-sm">{h.mes}</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: Math.min(h.estrelas, 5) }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 text-yellow-400 fill-current" />
                        ))}
                        {h.estrelas > 5 && <span className="text-yellow-400 text-xs">+{h.estrelas - 5}</span>}
                      </div>
                      <span className="text-green-400 text-sm font-bold">+R${h.bonus}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex gap-2">
                <button className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                  Editar
                </button>
                <button className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                  Historico
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700 text-center">
              <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Selecione um profissional para ver detalhes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Pipelines() {
  const [mesSelecionado, setMesSelecionado] = useState('2025-12');
  const [timeSelecionado, setTimeSelecionado] = useState('todos');

  const pilaresFicticios = [
    {
      id: 1,
      nome: 'Taxa de Conversao',
      descricao: 'Percentual de orcamentos aprovados',
      tipoMetrica: 'percentual',
      meta: 70,
      mediaTimes: { front: 72.5, inside: 68.3 },
      tendencia: 'up',
      regras: [
        { faixa: '80%+', estrelas: 3 },
        { faixa: '70-79%', estrelas: 2 },
        { faixa: '60-69%', estrelas: 1 },
        { faixa: '<60%', estrelas: 0 },
      ]
    },
    {
      id: 2,
      nome: 'Ticket Medio',
      descricao: 'Valor medio por atendimento',
      tipoMetrica: 'valor',
      meta: 350,
      mediaTimes: { front: 385, inside: 420 },
      tendencia: 'up',
      regras: [
        { faixa: 'R$450+', estrelas: 3 },
        { faixa: 'R$350-449', estrelas: 2 },
        { faixa: 'R$250-349', estrelas: 1 },
        { faixa: '<R$250', estrelas: 0 },
      ]
    },
    {
      id: 3,
      nome: 'NPS Cliente',
      descricao: 'Net Promoter Score',
      tipoMetrica: 'percentual',
      meta: 85,
      mediaTimes: { front: 88, inside: 82 },
      tendencia: 'same',
      regras: [
        { faixa: '90%+', estrelas: 3 },
        { faixa: '80-89%', estrelas: 2 },
        { faixa: '70-79%', estrelas: 1 },
        { faixa: '<70%', estrelas: 0 },
      ]
    },
    {
      id: 4,
      nome: 'Tempo de Resposta',
      descricao: 'Tempo medio de atendimento inicial',
      tipoMetrica: 'tempo',
      meta: 15,
      mediaTimes: { front: 12, inside: 18 },
      tendencia: 'down',
      regras: [
        { faixa: '<10min', estrelas: 3 },
        { faixa: '10-15min', estrelas: 2 },
        { faixa: '15-20min', estrelas: 1 },
        { faixa: '>20min', estrelas: 0 },
      ]
    },
    {
      id: 5,
      nome: 'Volume de Atendimentos',
      descricao: 'Quantidade total de atendimentos no mes',
      tipoMetrica: 'quantidade',
      meta: 80,
      mediaTimes: { front: 95, inside: 78 },
      tendencia: 'up',
      regras: [
        { faixa: '100+', estrelas: 3 },
        { faixa: '80-99', estrelas: 2 },
        { faixa: '60-79', estrelas: 1 },
        { faixa: '<60', estrelas: 0 },
      ]
    },
    {
      id: 6,
      nome: 'Recompra/Indicacao',
      descricao: 'Taxa de clientes que retornam ou indicam',
      tipoMetrica: 'percentual',
      meta: 25,
      mediaTimes: { front: 28, inside: 22 },
      tendencia: 'up',
      regras: [
        { faixa: '30%+', estrelas: 3 },
        { faixa: '25-29%', estrelas: 2 },
        { faixa: '20-24%', estrelas: 1 },
        { faixa: '<20%', estrelas: 0 },
      ]
    },
  ];

  const evolucaoMensal = [
    { mes: 'Jul', conversao: 65, ticket: 320, nps: 82 },
    { mes: 'Ago', conversao: 68, ticket: 335, nps: 84 },
    { mes: 'Set', conversao: 70, ticket: 350, nps: 85 },
    { mes: 'Out', conversao: 69, ticket: 360, nps: 86 },
    { mes: 'Nov', conversao: 72, ticket: 380, nps: 87 },
    { mes: 'Dez', conversao: 74, ticket: 395, nps: 88 },
  ];

  const getTendenciaIcon = (tendencia: string) => {
    if (tendencia === 'up') return <span className="text-green-400 text-lg">▲</span>;
    if (tendencia === 'down') return <span className="text-red-400 text-lg">▼</span>;
    return <span className="text-gray-400 text-lg">-</span>;
  };

  const getMetaColor = (valor: number, meta: number, inverso = false) => {
    const atingido = inverso ? valor <= meta : valor >= meta;
    return atingido ? 'text-green-400' : 'text-yellow-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-green-400" />
          Pipeline de Metricas
        </h2>

        <div className="flex gap-3">
          <input
            type="month"
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className="bg-gray-800 border border-cyan-500/30 rounded-lg px-3 py-2 text-sm text-white"
          />
          <select
            value={timeSelecionado}
            onChange={(e) => setTimeSelecionado(e.target.value)}
            className="bg-gray-800 border border-cyan-500/30 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="todos">Todos os Times</option>
            <option value="front">Front Office</option>
            <option value="inside">Inside Sales</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 p-6 rounded-xl border border-green-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-400 text-sm">Taxa Conversao Media</span>
            {getTendenciaIcon('up')}
          </div>
          <div className="text-4xl font-bold text-white">71.2%</div>
          <div className="text-green-400 text-sm mt-1">+3.2% vs mes anterior</div>
        </div>

        <div className="bg-gradient-to-br from-cyan-600/20 to-cyan-800/20 p-6 rounded-xl border border-cyan-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-cyan-400 text-sm">Ticket Medio</span>
            {getTendenciaIcon('up')}
          </div>
          <div className="text-4xl font-bold text-white">R$ 402</div>
          <div className="text-cyan-400 text-sm mt-1">+R$22 vs mes anterior</div>
        </div>

        <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 p-6 rounded-xl border border-yellow-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-yellow-400 text-sm">NPS Medio</span>
            {getTendenciaIcon('same')}
          </div>
          <div className="text-4xl font-bold text-white">85.5</div>
          <div className="text-yellow-400 text-sm mt-1">+0.5 vs mes anterior</div>
        </div>
      </div>

      <div className="bg-gray-900/50 rounded-xl border border-cyan-500/30 p-6">
        <h3 className="text-xl font-bold text-white mb-6">Evolucao Mensal</h3>
        <div className="relative h-64">
          <div className="absolute inset-0 flex items-end justify-between gap-4 pb-8">
            {evolucaoMensal.map((item, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col items-center gap-1">
                  <div
                    className="w-8 bg-gradient-to-t from-green-600 to-green-400 rounded-t"
                    style={{ height: `${item.conversao * 1.5}px` }}
                    title={`Conversao: ${item.conversao}%`}
                  />
                  <div
                    className="w-8 bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t"
                    style={{ height: `${(item.ticket / 5)}px` }}
                    title={`Ticket: R$${item.ticket}`}
                  />
                  <div
                    className="w-8 bg-gradient-to-t from-yellow-600 to-yellow-400 rounded-t"
                    style={{ height: `${item.nps * 1.2}px` }}
                    title={`NPS: ${item.nps}`}
                  />
                </div>
                <span className="text-gray-400 text-sm">{item.mes}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded" />
            <span className="text-gray-400 text-sm">Conversao</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-cyan-500 rounded" />
            <span className="text-gray-400 text-sm">Ticket Medio</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded" />
            <span className="text-gray-400 text-sm">NPS</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pilaresFicticios.map((pilar) => (
          <div key={pilar.id} className="bg-gray-800/50 rounded-xl p-5 border border-gray-700 hover:border-cyan-500/50 transition-all">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-bold text-lg">{pilar.nome}</h4>
              {getTendenciaIcon(pilar.tendencia)}
            </div>

            <p className="text-gray-400 text-sm mb-4">{pilar.descricao}</p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-blue-500/10 rounded-lg p-3">
                <div className="text-blue-400 text-xs mb-1">Front Office</div>
                <div className={`text-xl font-bold ${getMetaColor(pilar.mediaTimes.front, pilar.meta, pilar.tipoMetrica === 'tempo')}`}>
                  {pilar.tipoMetrica === 'valor' && 'R$'}
                  {pilar.mediaTimes.front}
                  {pilar.tipoMetrica === 'percentual' && '%'}
                  {pilar.tipoMetrica === 'tempo' && 'min'}
                </div>
              </div>
              <div className="bg-purple-500/10 rounded-lg p-3">
                <div className="text-purple-400 text-xs mb-1">Inside Sales</div>
                <div className={`text-xl font-bold ${getMetaColor(pilar.mediaTimes.inside, pilar.meta, pilar.tipoMetrica === 'tempo')}`}>
                  {pilar.tipoMetrica === 'valor' && 'R$'}
                  {pilar.mediaTimes.inside}
                  {pilar.tipoMetrica === 'percentual' && '%'}
                  {pilar.tipoMetrica === 'tempo' && 'min'}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <div className="text-gray-500 text-xs mb-2">Regras de Estrelas</div>
              <div className="space-y-1">
                {pilar.regras.map((regra, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">{regra.faixa}</span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: regra.estrelas }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 text-yellow-400 fill-current" />
                      ))}
                      {regra.estrelas === 0 && <span className="text-gray-500 text-xs">0</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
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
  const [abaConfig, setAbaConfig] = useState<'geral' | 'niveis' | 'pilares' | 'regras' | 'integracao'>('geral');
  const [salvando, setSalvando] = useState(false);

  const configGeral = {
    cicloAvaliacao: 'mensal',
    dataFechamento: 25,
    notificacoes: true,
    emailsAutomaticos: true,
    periodoCarencia: 30,
    permitirRecalculo: false,
  };

  const integracoes = [
    { id: 1, nome: 'Supabase Database', status: 'conectado', ultimaSync: '2025-12-31 15:30', icone: '🗄️' },
    { id: 2, nome: 'Sistema de OS', status: 'conectado', ultimaSync: '2025-12-31 15:30', icone: '📋' },
    { id: 3, nome: 'Financeiro', status: 'conectado', ultimaSync: '2025-12-31 14:00', icone: '💰' },
    { id: 4, nome: 'E-mail (SMTP)', status: 'configurado', ultimaSync: '-', icone: '📧' },
    { id: 5, nome: 'WhatsApp Business', status: 'pendente', ultimaSync: '-', icone: '📱' },
  ];

  const handleSalvar = () => {
    setSalvando(true);
    setTimeout(() => setSalvando(false), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-gray-400" />
          Configuracoes Avancadas
        </h2>

        <button
          onClick={handleSalvar}
          disabled={salvando}
          className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {salvando ? (
            <>
              <Star className="w-4 h-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Settings className="w-4 h-4" />
              Salvar Alteracoes
            </>
          )}
        </button>
      </div>

      <div className="flex gap-2 bg-gray-800/50 p-1 rounded-lg">
        {[
          { id: 'geral', nome: 'Geral' },
          { id: 'niveis', nome: 'Niveis' },
          { id: 'pilares', nome: 'Pilares' },
          { id: 'regras', nome: 'Regras' },
          { id: 'integracao', nome: 'Integracoes' },
        ].map((aba) => (
          <button
            key={aba.id}
            onClick={() => setAbaConfig(aba.id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              abaConfig === aba.id
                ? 'bg-cyan-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {aba.nome}
          </button>
        ))}
      </div>

      {abaConfig === 'geral' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-4">Ciclo de Avaliacao</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Periodo</label>
                <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white">
                  <option value="mensal">Mensal</option>
                  <option value="quinzenal">Quinzenal</option>
                  <option value="semanal">Semanal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Dia de Fechamento</label>
                <input
                  type="number"
                  defaultValue={configGeral.dataFechamento}
                  min={1}
                  max={31}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Periodo de Carencia (dias)</label>
                <input
                  type="number"
                  defaultValue={configGeral.periodoCarencia}
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
                <div className="relative">
                  <input type="checkbox" defaultChecked={configGeral.notificacoes} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-cyan-600 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-5 transition-transform"></div>
                </div>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-gray-300">E-mails automaticos</span>
                <div className="relative">
                  <input type="checkbox" defaultChecked={configGeral.emailsAutomaticos} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-cyan-600 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-5 transition-transform"></div>
                </div>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-gray-300">Permitir recalculo retroativo</span>
                <div className="relative">
                  <input type="checkbox" defaultChecked={configGeral.permitirRecalculo} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-cyan-600 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-5 transition-transform"></div>
                </div>
              </label>
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 md:col-span-2">
            <h3 className="text-lg font-bold text-white mb-4">Acoes em Lote</h3>
            <div className="flex flex-wrap gap-3">
              <button className="px-4 py-2 bg-blue-600/20 border border-blue-500/50 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors">
                Recalcular Todas Estrelas
              </button>
              <button className="px-4 py-2 bg-green-600/20 border border-green-500/50 text-green-400 rounded-lg hover:bg-green-600/30 transition-colors">
                Processar Promocoes Pendentes
              </button>
              <button className="px-4 py-2 bg-yellow-600/20 border border-yellow-500/50 text-yellow-400 rounded-lg hover:bg-yellow-600/30 transition-colors">
                Gerar Relatorio Mensal
              </button>
              <button className="px-4 py-2 bg-red-600/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors">
                Resetar Periodo (Cuidado!)
              </button>
            </div>
          </div>
        </div>
      )}

      {abaConfig === 'niveis' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
              + Novo Nivel
            </button>
          </div>

          <div className="bg-gray-900/50 rounded-xl border border-cyan-500/30 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-800/50">
                  <th className="px-6 py-4 text-left text-sm font-bold text-cyan-400">Ordem</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-cyan-400">Nome</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-cyan-400">Cor</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-cyan-400">Estrelas</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-cyan-400">Meses Consec.</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-cyan-400">Bonus</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-cyan-400">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { ordem: 1, nome: 'Starter', cor: '#6B7280', estrelas: 0, meses: 0, bonus: 0 },
                  { ordem: 2, nome: 'Bronze', cor: '#CD7F32', estrelas: 4, meses: 1, bonus: 400 },
                  { ordem: 3, nome: 'Silver', cor: '#C0C0C0', estrelas: 5, meses: 2, bonus: 600 },
                  { ordem: 4, nome: 'Gold', cor: '#FFD700', estrelas: 6, meses: 3, bonus: 1000 },
                  { ordem: 5, nome: 'Platinum', cor: '#E5E4E2', estrelas: 7, meses: 4, bonus: 1500 },
                  { ordem: 6, nome: 'Diamond', cor: '#00D4FF', estrelas: 8, meses: 6, bonus: 2000 },
                ].map((nivel, idx) => (
                  <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-800/30">
                    <td className="px-6 py-4 text-white font-bold">{nivel.ordem}</td>
                    <td className="px-6 py-4">
                      <span style={{ color: nivel.cor }} className="font-bold">{nivel.nome}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: nivel.cor }} />
                        <span className="text-gray-400 text-sm">{nivel.cor}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-white">{nivel.estrelas}</td>
                    <td className="px-6 py-4 text-center text-white">{nivel.meses}</td>
                    <td className="px-6 py-4 text-center text-green-400 font-bold">R$ {nivel.bonus}</td>
                    <td className="px-6 py-4 text-center">
                      <button className="text-cyan-400 hover:text-cyan-300 mr-2">Editar</button>
                      <button className="text-red-400 hover:text-red-300">Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaConfig === 'pilares' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
              + Novo Pilar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { nome: 'Taxa de Conversao', tipo: 'percentual', ativo: true, peso: 20 },
              { nome: 'Ticket Medio', tipo: 'valor', ativo: true, peso: 20 },
              { nome: 'NPS Cliente', tipo: 'percentual', ativo: true, peso: 20 },
              { nome: 'Tempo de Resposta', tipo: 'tempo', ativo: true, peso: 15 },
              { nome: 'Volume Atendimentos', tipo: 'quantidade', ativo: true, peso: 15 },
              { nome: 'Recompra/Indicacao', tipo: 'percentual', ativo: true, peso: 10 },
            ].map((pilar, idx) => (
              <div key={idx} className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-bold">{pilar.nome}</h4>
                  <div className={`w-3 h-3 rounded-full ${pilar.ativo ? 'bg-green-400' : 'bg-gray-500'}`} />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Tipo de Metrica:</span>
                    <span className="text-white capitalize">{pilar.tipo}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Peso no Calculo:</span>
                    <span className="text-cyan-400 font-bold">{pilar.peso}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Status:</span>
                    <span className={pilar.ativo ? 'text-green-400' : 'text-gray-500'}>{pilar.ativo ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-700 flex gap-2">
                  <button className="flex-1 text-cyan-400 text-sm hover:text-cyan-300">Editar</button>
                  <button className="flex-1 text-yellow-400 text-sm hover:text-yellow-300">Regras</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {abaConfig === 'regras' && (
        <div className="space-y-4">
          <div className="bg-yellow-600/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
            <Star className="w-5 h-5 text-yellow-400 mt-0.5" />
            <div>
              <h4 className="text-yellow-400 font-bold">Regras de Promocao e Rebaixamento</h4>
              <p className="text-gray-400 text-sm mt-1">
                Configure as regras que determinam quando um profissional pode subir ou descer de nivel.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800/50 rounded-xl p-6 border border-green-500/30">
              <h3 className="text-lg font-bold text-green-400 mb-4">Regras de Promocao</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-green-500" />
                  <span className="text-gray-300 text-sm">Atingir estrelas minimas do nivel</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-green-500" />
                  <span className="text-gray-300 text-sm">Completar meses consecutivos</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
                  <input type="checkbox" className="w-4 h-4 accent-green-500" />
                  <span className="text-gray-300 text-sm">Nao ter advertencias ativas</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
                  <input type="checkbox" className="w-4 h-4 accent-green-500" />
                  <span className="text-gray-300 text-sm">Aprovacao gerencial obrigatoria</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl p-6 border border-red-500/30">
              <h3 className="text-lg font-bold text-red-400 mb-4">Regras de Rebaixamento</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-red-500" />
                  <span className="text-gray-300 text-sm">Nao atingir minimo de estrelas (2 meses)</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-red-500" />
                  <span className="text-gray-300 text-sm">Advertencia grave registrada</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
                  <input type="checkbox" className="w-4 h-4 accent-red-500" />
                  <span className="text-gray-300 text-sm">Ausencia superior a 30 dias</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
                  <input type="checkbox" className="w-4 h-4 accent-red-500" />
                  <span className="text-gray-300 text-sm">Avaliacao negativa de supervisor</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {abaConfig === 'integracao' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integracoes.map((integracao) => (
              <div key={integracao.id} className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{integracao.icone}</span>
                  <div>
                    <h4 className="text-white font-bold">{integracao.nome}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      integracao.status === 'conectado' ? 'bg-green-500/20 text-green-400' :
                      integracao.status === 'configurado' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {integracao.status}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-gray-400 mb-4">
                  Ultima sync: {integracao.ultimaSync}
                </div>
                <button className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors">
                  Configurar
                </button>
              </div>
            ))}
          </div>

          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-4">Logs de Sincronizacao</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {[
                { hora: '15:30:45', tipo: 'success', msg: 'Sincronizacao com banco concluida - 145 registros' },
                { hora: '15:30:42', tipo: 'info', msg: 'Iniciando sincronizacao de dados...' },
                { hora: '14:00:12', tipo: 'success', msg: 'Dados financeiros importados - R$ 45.230,00' },
                { hora: '13:45:00', tipo: 'warning', msg: 'Timeout na conexao com WhatsApp - tentando novamente' },
                { hora: '12:30:00', tipo: 'success', msg: 'E-mails de ranking enviados - 15 destinatarios' },
                { hora: '10:00:00', tipo: 'info', msg: 'Job de calculo de estrelas agendado' },
              ].map((log, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 bg-gray-900/50 rounded text-sm">
                  <span className="text-gray-500 font-mono">{log.hora}</span>
                  <span className={`w-2 h-2 rounded-full ${
                    log.tipo === 'success' ? 'bg-green-400' :
                    log.tipo === 'warning' ? 'bg-yellow-400' : 'bg-cyan-400'
                  }`} />
                  <span className="text-gray-300">{log.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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
