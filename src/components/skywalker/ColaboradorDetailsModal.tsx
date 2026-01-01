import { X, Star, Lock, AlertTriangle, TrendingUp, Award, Calculator, ChevronRight, User } from 'lucide-react';
import type { Colaborador, PilarEstrelas } from './types';
import { NIVEIS_CONFIG, BONUS_TABLE } from './types';

interface ColaboradorDetailsModalProps {
  colaborador: Colaborador;
  onClose: () => void;
}

function CircularProgress({ value, max, color }: { value: number; max: number; color: string }) {
  const percentage = (value / max) * 100;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-24 h-24">
      <svg className="w-24 h-24 transform -rotate-90">
        <circle
          cx="48"
          cy="48"
          r="40"
          stroke="rgba(55,65,81,0.5)"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx="48"
          cy="48"
          r="40"
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset,
            transition: 'stroke-dashoffset 0.5s ease'
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-white">{value}</span>
        <span className="text-xs text-gray-400">/{max}</span>
      </div>
    </div>
  );
}

function PilarDetail({ pilar }: { pilar: PilarEstrelas }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          pilar.estrelas > 0 ? 'bg-cyan-500/20 border border-cyan-500/50' : 'bg-gray-700/50 border border-gray-600'
        }`}>
          <Star className={`w-5 h-5 ${pilar.estrelas > 0 ? 'text-cyan-400' : 'text-gray-500'}`} />
        </div>
        <div>
          <p className="text-white font-medium">{pilar.nome}</p>
          <p className="text-xs text-gray-400">{pilar.estrelas}/{pilar.maxEstrelas} estrelas</p>
        </div>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: pilar.maxEstrelas }).map((_, idx) => (
          <Star
            key={idx}
            className={`w-5 h-5 ${idx < pilar.estrelas ? 'text-yellow-400' : 'text-gray-600'}`}
            fill={idx < pilar.estrelas ? '#facc15' : 'none'}
          />
        ))}
      </div>
    </div>
  );
}

export function ColaboradorDetailsModal({ colaborador, onClose }: ColaboradorDetailsModalProps) {
  const nivelConfig = NIVEIS_CONFIG[colaborador.nivel];
  const proximoNivelConfig = colaborador.proximoNivel ? NIVEIS_CONFIG[colaborador.proximoNivel] : null;
  const pilares = Object.values(colaborador.pilares).filter(Boolean) as PilarEstrelas[];
  const bonus = BONUS_TABLE.find(b => b.nivel === colaborador.nivel && b.perfil === colaborador.perfil);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 border-2 border-gray-600 flex items-center justify-center">
              <User className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{colaborador.nome}</h2>
              <div className="flex items-center gap-2 mt-1">
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
                <span className="text-gray-400 text-sm">
                  {colaborador.perfil === 'front_office' ? 'Front Office' : 'Inside Sales'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] space-y-6">
          {colaborador.travadoPorCultura && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <Lock className="w-6 h-6 text-red-400 flex-shrink-0" />
              <div>
                <p className="text-red-400 font-bold">Travado por Cultura/Qualidade</p>
                <p className="text-red-300/70 text-sm">{colaborador.motivoTrava}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center p-4 bg-gray-800/50 rounded-xl border border-gray-700">
              <CircularProgress
                value={colaborador.estrelasMesAtual}
                max={colaborador.metaEstrelas}
                color={colaborador.estrelasMesAtual >= colaborador.metaEstrelas ? '#22c55e' : '#06b6d4'}
              />
              <p className="text-gray-400 text-sm mt-2">Estrelas do Mes</p>
            </div>

            <div className="flex flex-col items-center p-4 bg-gray-800/50 rounded-xl border border-gray-700">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-cyan-400">{colaborador.mesesConsecutivos}</span>
                <span className="text-xs text-gray-400">meses</span>
              </div>
              <p className="text-gray-400 text-sm mt-2">Consecutivos</p>
            </div>

            <div className="flex flex-col items-center p-4 bg-gray-800/50 rounded-xl border border-gray-700">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-yellow-400">{colaborador.progressoProximoNivel}%</span>
              </div>
              <p className="text-gray-400 text-sm mt-2">Progresso</p>
            </div>
          </div>

          {proximoNivelConfig && (
            <div className="p-4 bg-gray-800/30 rounded-xl border border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                <h3 className="text-white font-bold">O que falta para {proximoNivelConfig.label}?</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-300">
                    Manter {proximoNivelConfig.metaEstrelas} estrelas por {proximoNivelConfig.mesesNecessarios} meses consecutivos
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-300">
                    Voce tem {colaborador.mesesConsecutivos} de {proximoNivelConfig.mesesNecessarios} meses
                  </span>
                </div>
                {colaborador.travadoPorCultura && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-red-400">Resolver trava de cultura primeiro!</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              Pilares de Desempenho
            </h3>
            <div className="space-y-2">
              {pilares.map((pilar, idx) => (
                <PilarDetail key={idx} pilar={pilar} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-cyan-400" />
              Historico de Meses
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {colaborador.historicoMeses.map((mes, idx) => (
                <div
                  key={idx}
                  className={`flex-shrink-0 p-3 rounded-lg border ${
                    mes.metaBatida
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-gray-800/50 border-gray-700'
                  }`}
                >
                  <p className="text-xs text-gray-400">{mes.mes}/{mes.ano}</p>
                  <p className={`text-lg font-bold ${mes.metaBatida ? 'text-green-400' : 'text-gray-400'}`}>
                    {mes.estrelasTotal}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {bonus && (
            <div className="p-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl border border-cyan-500/30">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-cyan-400" />
                Tabela de Bonus - Nivel {nivelConfig.label}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-xs text-gray-400">Store+</p>
                  <p className="text-xl font-bold text-cyan-400">{bonus.storePlus}%</p>
                </div>
                <div className="p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-xs text-gray-400">Care+</p>
                  <p className="text-xl font-bold text-cyan-400">{bonus.carePlus}%</p>
                </div>
                {bonus.seguroInstalacao && (
                  <div className="p-3 bg-gray-800/50 rounded-lg col-span-2">
                    <p className="text-xs text-gray-400">Seguro/Instalacao</p>
                    <p className="text-xl font-bold text-cyan-400">{bonus.seguroInstalacao}%</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
