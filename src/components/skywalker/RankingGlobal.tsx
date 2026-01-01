import { useState, useMemo } from 'react';
import { Trophy, Star, AlertTriangle, User, TrendingUp, ShoppingCart, MessageSquare, Heart, Filter, RefreshCw } from 'lucide-react';
import { useSkywalker } from '../../contexts/SkywalkerContext';
import { NIVEIS_CONFIG } from './types';
import type { Nivel } from './types';

export function RankingGlobal() {
  const { colaboradores, vendas, reviews, culturas, calcularEstrelas, loading, refreshAll, getRegra } = useSkywalker();
  const [filterNivel, setFilterNivel] = useState<Nivel | 'all'>('all');

  const ranking = useMemo(() => {
    return colaboradores
      .map(colab => {
        const estrelas = calcularEstrelas(colab.id);
        const vendasCount = vendas.filter(v => v.colaborador_id === colab.id).length;
        const reviewsCount = reviews.filter(r => r.colaborador_id === colab.id && r.status === 'aprovado').length;
        const cultura = culturas.find(c => c.colaborador_id === colab.id);

        const travadoPorCultura = estrelas.reviews === 0 || estrelas.cultura === 0;
        const metaNivel = getRegra(`meta_estrelas_${colab.nivel}`);
        const progresso = metaNivel > 0 ? Math.min((estrelas.total / metaNivel) * 100, 100) : 0;

        return {
          ...colab,
          estrelas,
          vendasCount,
          reviewsCount,
          cultura,
          travadoPorCultura,
          progresso
        };
      })
      .filter(c => filterNivel === 'all' || c.nivel === filterNivel)
      .sort((a, b) => b.estrelas.total - a.estrelas.total);
  }, [colaboradores, vendas, reviews, culturas, calcularEstrelas, filterNivel, getRegra]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl border border-yellow-500/30">
            <Trophy className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Ranking Global</h2>
            <p className="text-gray-400 text-sm">Leaderboard do mes atual</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterNivel}
            onChange={(e) => setFilterNivel(e.target.value as Nivel | 'all')}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Todos os Niveis</option>
            {Object.entries(NIVEIS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>

          <button
            onClick={refreshAll}
            disabled={loading}
            className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-cyan-400 hover:border-cyan-500 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Colaborador</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Nivel</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <ShoppingCart className="w-4 h-4" />
                    Vendas
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <MessageSquare className="w-4 h-4" />
                    Reviews
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <Heart className="w-4 h-4" />
                    Cultura
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-4 h-4" />
                    Total
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Progresso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {ranking.map((colab, index) => {
                const nivelConfig = NIVEIS_CONFIG[colab.nivel as Nivel];
                const isTop3 = index < 3;

                return (
                  <tr
                    key={colab.id}
                    className={`transition-colors hover:bg-gray-800/50 ${
                      colab.travadoPorCultura ? 'bg-red-500/5' : ''
                    }`}
                  >
                    <td className="px-4 py-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        index === 0 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' :
                        index === 1 ? 'bg-gray-400/20 text-gray-300 border border-gray-400/50' :
                        index === 2 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' :
                        'bg-gray-800 text-gray-500'
                      }`}>
                        {index + 1}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 border border-gray-600 flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{colab.usuario?.nome || 'Colaborador'}</p>
                          <p className="text-xs text-gray-500">{colab.unidade?.nome}</p>
                        </div>
                        {colab.travadoPorCultura && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <AlertTriangle className="w-3 h-3 text-red-400" />
                            <span className="text-xs text-red-400">Travado</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-center">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-bold"
                        style={{
                          backgroundColor: `${nivelConfig.cor}20`,
                          color: nivelConfig.cor,
                          border: `1px solid ${nivelConfig.cor}50`
                        }}
                      >
                        {nivelConfig.label}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-bold text-cyan-400">{colab.estrelas.vendas}</span>
                        <span className="text-xs text-gray-500">({colab.vendasCount} vds)</span>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-lg font-bold ${colab.estrelas.reviews === 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {colab.estrelas.reviews}
                        </span>
                        <span className="text-xs text-gray-500">({colab.reviewsCount})</span>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-center">
                      <span className={`text-lg font-bold ${colab.estrelas.cultura === 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {colab.estrelas.cultura}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Star className="w-5 h-5 text-yellow-400" fill="#facc15" />
                        <span className="text-xl font-black text-white">{colab.estrelas.total}</span>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="w-full max-w-[150px]">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">Progresso</span>
                          <span className="text-cyan-400">{Math.round(colab.progresso)}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${colab.progresso}%`,
                              background: colab.progresso >= 100
                                ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                                : `linear-gradient(90deg, ${nivelConfig.cor}, ${nivelConfig.cor}80)`
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {ranking.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">Nenhum colaborador cadastrado ainda.</p>
                    <p className="text-gray-500 text-sm">Adicione colaboradores no sistema para ver o ranking.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-gray-400 text-sm">Top Performer</span>
          </div>
          <p className="text-xl font-bold text-white">
            {ranking[0]?.usuario?.nome || '-'}
          </p>
          <p className="text-yellow-400 text-sm">
            {ranking[0]?.estrelas.total || 0} estrelas
          </p>
        </div>

        <div className="p-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-5 h-5 text-cyan-400" />
            <span className="text-gray-400 text-sm">Media de Estrelas</span>
          </div>
          <p className="text-xl font-bold text-white">
            {ranking.length > 0
              ? (ranking.reduce((sum, c) => sum + c.estrelas.total, 0) / ranking.length).toFixed(1)
              : '0'
            }
          </p>
        </div>

        <div className="p-4 bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/30 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-gray-400 text-sm">Travados por Cultura</span>
          </div>
          <p className="text-xl font-bold text-white">
            {ranking.filter(c => c.travadoPorCultura).length}
          </p>
          <p className="text-red-400 text-sm">colaboradores</p>
        </div>
      </div>
    </div>
  );
}
