import { useState, useEffect } from 'react';
import { Star, Users, TrendingUp, TrendingDown, Award, DollarSign, Target, Calendar, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Profissional {
  id: string;
  usuario: { nome: string; email: string } | null;
  unidade: { nome: string } | null;
  nivel: { nome: string; cor: string; estrelas_necessarias: number; bonus_valor: number } | null;
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
}

export function VisaoGeralTab() {
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [estrelasMes, setEstrelasMes] = useState<EstrelasMes[]>([]);
  const [niveis, setNiveis] = useState<Nivel[]>([]);
  const [mesReferencia, setMesReferencia] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [mesReferencia]);

  const loadData = async () => {
    setLoading(true);

    const [profRes, estrelasRes, niveisRes] = await Promise.all([
      supabase
        .from('skywalker_profissionais')
        .select(`
          id,
          time,
          meses_consecutivos_validos,
          ativo,
          usuario:usuarios(nome, email),
          unidade:unidades(nome),
          nivel:skywalker_niveis(nome, cor, estrelas_necessarias, bonus_valor)
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
        .select('id, nome, cor, ordem')
        .eq('ativo', true)
        .order('ordem')
    ]);

    if (profRes.data) setProfissionais(profRes.data as unknown as Profissional[]);
    if (estrelasRes.data) setEstrelasMes(estrelasRes.data as unknown as EstrelasMes[]);
    if (niveisRes.data) setNiveis(niveisRes.data);

    setLoading(false);
  };

  const getProfissionalEstrelas = (profId: string) => {
    return estrelasMes
      .filter(e => e.profissional_id === profId)
      .reduce((sum, e) => sum + e.estrelas_conquistadas, 0);
  };

  const profissionaisComEstrelas = profissionais.map(prof => ({
    ...prof,
    estrelas_mes: getProfissionalEstrelas(prof.id)
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
          <div className="text-green-400 text-sm">Elegíveis para subir</div>
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
                <span className="text-purple-400 font-medium">Inside Sales</span>
                <span className="text-white font-bold">{insideSales.length} pessoas</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-600"
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
              <div key={prof.id} className="flex items-center justify-between">
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
          {profissionaisComEstrelas.map((prof) => {
            const metaEstrelas = prof.nivel?.estrelas_necessarias || 6;
            const progresso = Math.min(100, (prof.estrelas_mes / metaEstrelas) * 100);
            const atingiuMeta = prof.estrelas_mes >= metaEstrelas;

            return (
              <div
                key={prof.id}
                className={`bg-gray-800/50 rounded-xl p-4 border transition-all ${
                  atingiuMeta ? 'border-green-500/50' : 'border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-white font-bold">{prof.usuario?.nome || 'Sem nome'}</h4>
                    <p className="text-gray-400 text-sm">{prof.unidade?.nome}</p>
                  </div>
                  <div
                    className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: (prof.nivel?.cor || '#6B7280') + '20',
                      color: prof.nivel?.cor || '#6B7280'
                    }}
                  >
                    {prof.nivel?.nome || 'Starter'}
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-400 text-xs">Progresso</span>
                    <span className="text-yellow-400 text-sm font-bold">
                      {prof.estrelas_mes}/{metaEstrelas}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        atingiuMeta ? 'bg-green-500' : 'bg-gradient-to-r from-yellow-500 to-yellow-600'
                      }`}
                      style={{ width: `${progresso}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    prof.time === 'front_office'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {prof.time === 'front_office' ? 'Front Office' : 'Inside Sales'}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {prof.meses_consecutivos_validos} mes(es) consec.
                  </span>
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
    </div>
  );
}
