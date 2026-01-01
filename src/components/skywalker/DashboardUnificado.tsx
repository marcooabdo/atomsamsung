import { useState, useMemo } from 'react';
import { Trophy, Star, TrendingUp, User, ShoppingCart, Calendar, CheckCircle, Package, Award, Target } from 'lucide-react';
import { useSkywalker } from '../../contexts/SkywalkerContext';
import { NIVEIS_CONFIG } from './types';
import type { Nivel } from './types';

export function DashboardUnificado() {
  const { colaboradores, calcularEstrelas, loading } = useSkywalker();
  const [selectedColaborador, setSelectedColaborador] = useState<string | null>(null);

  const ranking = useMemo(() => {
    return colaboradores
      .map(colab => {
        const estrelas = calcularEstrelas(colab.id);
        const nivelConfig = NIVEIS_CONFIG[colab.nivel_atual as Nivel];
        const metaNivel = nivelConfig.metaEstrelas;
        const progresso = metaNivel > 0 ? Math.min((estrelas.total / metaNivel) * 100, 100) : 0;

        return {
          ...colab,
          estrelas,
          metaNivel,
          progresso
        };
      })
      .sort((a, b) => b.estrelas.total - a.estrelas.total);
  }, [colaboradores, calcularEstrelas]);

  const top3 = ranking.slice(0, 3);
  const selectedData = selectedColaborador
    ? ranking.find(r => r.id === selectedColaborador)
    : ranking[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-400" />
                Podio do Mes
              </h3>
            </div>

            <div className="flex items-end justify-center gap-4 mb-8">
              {top3[1] && (
                <div className="flex-1 max-w-[140px]">
                  <div className="bg-gradient-to-br from-gray-700 to-gray-800 border-2 border-gray-400 rounded-xl p-4 text-center">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-2xl font-black text-white shadow-lg">
                      2
                    </div>
                    <p className="text-white font-bold text-sm mb-1 truncate">{top3[1].usuario?.nome}</p>
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <Star className="w-4 h-4 text-yellow-400" fill="#facc15" />
                      <span className="text-yellow-400 font-bold">{top3[1].estrelas.total}</span>
                    </div>
                    <span
                      className="px-2 py-1 rounded-full text-xs font-bold"
                      style={{
                        backgroundColor: `${NIVEIS_CONFIG[top3[1].nivel_atual as Nivel].cor}20`,
                        color: NIVEIS_CONFIG[top3[1].nivel_atual as Nivel].cor
                      }}
                    >
                      {NIVEIS_CONFIG[top3[1].nivel_atual as Nivel].label}
                    </span>
                  </div>
                </div>
              )}

              {top3[0] && (
                <div className="flex-1 max-w-[160px]">
                  <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500 rounded-xl p-5 text-center transform scale-110 shadow-2xl shadow-yellow-500/20">
                    <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-3xl font-black text-white shadow-lg">
                      1
                    </div>
                    <p className="text-white font-bold mb-1 truncate">{top3[0].usuario?.nome}</p>
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <Star className="w-5 h-5 text-yellow-400" fill="#facc15" />
                      <span className="text-yellow-400 font-bold text-lg">{top3[0].estrelas.total}</span>
                    </div>
                    <span
                      className="px-2 py-1 rounded-full text-xs font-bold"
                      style={{
                        backgroundColor: `${NIVEIS_CONFIG[top3[0].nivel_atual as Nivel].cor}20`,
                        color: NIVEIS_CONFIG[top3[0].nivel_atual as Nivel].cor
                      }}
                    >
                      {NIVEIS_CONFIG[top3[0].nivel_atual as Nivel].label}
                    </span>
                  </div>
                </div>
              )}

              {top3[2] && (
                <div className="flex-1 max-w-[140px]">
                  <div className="bg-gradient-to-br from-orange-700 to-orange-800 border-2 border-orange-500 rounded-xl p-4 text-center">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-2xl font-black text-white shadow-lg">
                      3
                    </div>
                    <p className="text-white font-bold text-sm mb-1 truncate">{top3[2].usuario?.nome}</p>
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <Star className="w-4 h-4 text-yellow-400" fill="#facc15" />
                      <span className="text-yellow-400 font-bold">{top3[2].estrelas.total}</span>
                    </div>
                    <span
                      className="px-2 py-1 rounded-full text-xs font-bold"
                      style={{
                        backgroundColor: `${NIVEIS_CONFIG[top3[2].nivel_atual as Nivel].cor}20`,
                        color: NIVEIS_CONFIG[top3[2].nivel_atual as Nivel].cor
                      }}
                    >
                      {NIVEIS_CONFIG[top3[2].nivel_atual as Nivel].label}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {ranking.slice(3).map((colab, index) => {
                const nivelConfig = NIVEIS_CONFIG[colab.nivel_atual as Nivel];
                return (
                  <div
                    key={colab.id}
                    className="flex items-center gap-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-cyan-500/50 transition-all cursor-pointer"
                    onClick={() => setSelectedColaborador(colab.id)}
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-400">
                      {index + 4}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{colab.usuario?.nome}</p>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: `${nivelConfig.cor}20`, color: nivelConfig.cor }}
                      >
                        {nivelConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400" fill="#facc15" />
                      <span className="text-white font-bold">{colab.estrelas.total}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 border border-gray-600 flex items-center justify-center">
                <User className="w-6 h-6 text-gray-400" />
              </div>
              <div className="flex-1">
                <select
                  value={selectedColaborador || ranking[0]?.id || ''}
                  onChange={(e) => setSelectedColaborador(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                >
                  {ranking.map(r => (
                    <option key={r.id} value={r.id}>{r.usuario?.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedData && (
              <>
                <div className="text-center mb-6">
                  <div
                    className="inline-block px-4 py-2 rounded-full font-bold mb-3"
                    style={{
                      backgroundColor: `${NIVEIS_CONFIG[selectedData.nivel_atual as Nivel].cor}20`,
                      color: NIVEIS_CONFIG[selectedData.nivel_atual as Nivel].cor,
                      border: `2px solid ${NIVEIS_CONFIG[selectedData.nivel_atual as Nivel].cor}50`
                    }}
                  >
                    {NIVEIS_CONFIG[selectedData.nivel_atual as Nivel].label}
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Star className="w-8 h-8 text-yellow-400" fill="#facc15" />
                    <span className="text-4xl font-black text-white">{selectedData.estrelas.total}</span>
                    <span className="text-gray-500">/ {selectedData.metaNivel}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                      style={{ width: `${selectedData.progresso}%` }}
                    />
                  </div>
                  <p className="text-gray-400 text-sm mt-2">{Math.round(selectedData.progresso)}% para o proximo nivel</p>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-400 text-sm flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        Vendas
                      </span>
                      <span className="text-cyan-400 font-bold">{selectedData.estrelas.vendas}★</span>
                    </div>
                  </div>

                  <div className="p-3 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-400 text-sm flex items-center gap-2">
                        <Star className="w-4 h-4" />
                        Reviews Google
                      </span>
                      <span className="text-green-400 font-bold">{selectedData.estrelas.reviews}★</span>
                    </div>
                  </div>

                  <div className="p-3 bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-400 text-sm flex items-center gap-2">
                        <Award className="w-4 h-4" />
                        Cultura
                      </span>
                      <span className="text-pink-400 font-bold">{selectedData.estrelas.cultura}★</span>
                    </div>
                  </div>

                  <div className="p-3 bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-400 text-sm flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        OS Finalizadas
                      </span>
                      <span className="text-purple-400 font-bold">{selectedData.estrelas.os_finalizadas || 0}★</span>
                    </div>
                  </div>

                  <div className="p-3 bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-400 text-sm flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Agendamentos
                      </span>
                      <span className="text-orange-400 font-bold">{selectedData.estrelas.agendamentos || 0}★</span>
                    </div>
                  </div>

                  <div className="p-3 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-400 text-sm flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Pecas Requisitadas
                      </span>
                      <span className="text-blue-400 font-bold">{selectedData.estrelas.pecas || 0}★</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-gray-400 text-sm">Maior Pontuacao</span>
          </div>
          <p className="text-2xl font-bold text-white">{ranking[0]?.estrelas.total || 0}★</p>
          <p className="text-yellow-400 text-xs">{ranking[0]?.usuario?.nome}</p>
        </div>

        <div className="p-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <span className="text-gray-400 text-sm">Media Geral</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {ranking.length > 0
              ? (ranking.reduce((sum, c) => sum + c.estrelas.total, 0) / ranking.length).toFixed(1)
              : '0'
            }★
          </p>
        </div>

        <div className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-green-400" />
            <span className="text-gray-400 text-sm">Atingiram Meta</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {ranking.filter(r => r.progresso >= 100).length}
          </p>
          <p className="text-green-400 text-xs">colaboradores</p>
        </div>

        <div className="p-4 bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/30 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-5 h-5 text-purple-400" />
            <span className="text-gray-400 text-sm">Total Ativo</span>
          </div>
          <p className="text-2xl font-bold text-white">{ranking.length}</p>
          <p className="text-purple-400 text-xs">colaboradores</p>
        </div>
      </div>
    </div>
  );
}
