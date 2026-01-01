import { useState } from 'react';
import {
  Star,
  Lock,
  TrendingUp,
  Award,
  Calculator,
  ChevronRight,
  Target,
  Zap,
  Trophy,
  Flame,
  ShoppingCart,
  Building2,
  Handshake,
  Shield,
  Calendar
} from 'lucide-react';
import { mockCurrentUser } from './mockData';
import { NIVEIS_CONFIG, BONUS_TABLE } from './types';
import type { PilarEstrelas } from './types';

function CircularProgressLarge({ value, max, color }: { value: number; max: number; color: string }) {
  const percentage = (value / max) * 100;
  const circumference = 2 * Math.PI * 70;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-44 h-44">
      <svg className="w-44 h-44 transform -rotate-90">
        <circle
          cx="88"
          cy="88"
          r="70"
          stroke="rgba(55,65,81,0.3)"
          strokeWidth="12"
          fill="none"
        />
        <circle
          cx="88"
          cy="88"
          r="70"
          stroke={color}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset,
            transition: 'stroke-dashoffset 1s ease',
            filter: `drop-shadow(0 0 8px ${color})`
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Star className="w-8 h-8 text-yellow-400 mb-1" fill="#facc15" />
        <span className="text-4xl font-black text-white">{value}/{max}</span>
        <span className="text-sm text-gray-400">estrelas</span>
      </div>
    </div>
  );
}

function PilarCard({ pilar, index }: { pilar: PilarEstrelas; index: number }) {
  const icons: Record<string, JSX.Element> = {
    'shopping-cart': <ShoppingCart className="w-6 h-6" />,
    'building': <Building2 className="w-6 h-6" />,
    'star': <Star className="w-6 h-6" />,
    'handshake': <Handshake className="w-6 h-6" />,
    'shield': <Shield className="w-6 h-6" />
  };

  const ativo = pilar.estrelas > 0;
  const completo = pilar.estrelas >= pilar.maxEstrelas;

  return (
    <div
      className={`p-4 rounded-xl border transition-all duration-300 ${
        completo
          ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/50'
          : ativo
          ? 'bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/30'
          : 'bg-gray-800/30 border-gray-700'
      }`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${
          completo ? 'bg-green-500/20 text-green-400' : ativo ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-700/50 text-gray-500'
        }`}>
          {icons[pilar.icone] || <Star className="w-6 h-6" />}
        </div>
        {completo && <Trophy className="w-5 h-5 text-yellow-400" />}
      </div>
      <h4 className="text-white font-bold mb-1">{pilar.nome}</h4>
      <div className="flex gap-1 mb-2">
        {Array.from({ length: pilar.maxEstrelas }).map((_, idx) => (
          <Star
            key={idx}
            className={`w-5 h-5 transition-all ${idx < pilar.estrelas ? 'text-yellow-400 scale-110' : 'text-gray-600'}`}
            fill={idx < pilar.estrelas ? '#facc15' : 'none'}
          />
        ))}
      </div>
      <p className="text-xs text-gray-400">{pilar.estrelas} de {pilar.maxEstrelas} conquistadas</p>
    </div>
  );
}

export function MinhaRota() {
  const [colaborador] = useState(mockCurrentUser);
  const [showCalculator, setShowCalculator] = useState(false);
  const [valorVenda, setValorVenda] = useState('');

  const nivelConfig = NIVEIS_CONFIG[colaborador.nivel];
  const proximoNivelConfig = colaborador.proximoNivel ? NIVEIS_CONFIG[colaborador.proximoNivel] : null;
  const pilares = Object.values(colaborador.pilares).filter(Boolean) as PilarEstrelas[];
  const bonus = BONUS_TABLE.find(b => b.nivel === colaborador.nivel && b.perfil === colaborador.perfil);

  const calcularComissao = () => {
    if (!valorVenda || !bonus) return { storePlus: 0, carePlus: 0, total: 0 };
    const valor = parseFloat(valorVenda);
    const storePlus = valor * (bonus.storePlus / 100);
    const carePlus = valor * (bonus.carePlus / 100);
    return { storePlus, carePlus, total: storePlus + carePlus };
  };

  const comissao = calcularComissao();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <CircularProgressLarge
              value={colaborador.estrelasMesAtual}
              max={colaborador.metaEstrelas}
              color={colaborador.estrelasMesAtual >= colaborador.metaEstrelas ? '#22c55e' : '#06b6d4'}
            />

            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                <span
                  className="px-4 py-1.5 rounded-full text-sm font-bold"
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

              <h2 className="text-3xl font-bold text-white mb-2">Ola, {colaborador.nome}!</h2>

              {colaborador.travadoPorCultura ? (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <Lock className="w-5 h-5 text-red-400" />
                  <span className="text-red-400 text-sm font-medium">
                    Travado: {colaborador.motivoTrava}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-400">
                  <Flame className="w-5 h-5 text-orange-400" />
                  <span>{colaborador.mesesConsecutivos} meses consecutivos batendo meta</span>
                </div>
              )}

              <div className="flex gap-2 mt-4 justify-center md:justify-start">
                {colaborador.historicoMeses.slice(0, 5).map((mes, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col items-center p-2 rounded-lg ${
                      mes.metaBatida ? 'bg-green-500/10 border border-green-500/30' : 'bg-gray-800/50 border border-gray-700'
                    }`}
                  >
                    <Calendar className={`w-4 h-4 ${mes.metaBatida ? 'text-green-400' : 'text-gray-500'}`} />
                    <span className="text-xs text-gray-400">{mes.mes}</span>
                    <span className={`text-sm font-bold ${mes.metaBatida ? 'text-green-400' : 'text-gray-500'}`}>
                      {mes.estrelasTotal}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {proximoNivelConfig && (
          <div className="p-6 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-cyan-400" />
              <h3 className="text-white font-bold">Proximo Nivel</h3>
            </div>

            <div
              className="p-4 rounded-xl mb-4"
              style={{
                backgroundColor: `${proximoNivelConfig.cor}10`,
                border: `1px solid ${proximoNivelConfig.cor}30`
              }}
            >
              <p className="text-lg font-bold" style={{ color: proximoNivelConfig.cor }}>
                {proximoNivelConfig.label}
              </p>
              <p className="text-sm text-gray-400">
                {proximoNivelConfig.metaEstrelas} estrelas por {proximoNivelConfig.mesesNecessarios} meses
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Progresso</span>
                <span className="text-cyan-400 font-bold">{colaborador.progressoProximoNivel}%</span>
              </div>
              <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${colaborador.progressoProximoNivel}%`,
                    background: `linear-gradient(90deg, ${proximoNivelConfig.cor}, ${proximoNivelConfig.cor}80)`
                  }}
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <ChevronRight className="w-4 h-4" />
                {colaborador.mesesConsecutivos} de {proximoNivelConfig.mesesNecessarios} meses
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-yellow-400" />
          <h3 className="text-xl font-bold text-white">Seus Pilares</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {pilares.map((pilar, idx) => (
            <PilarCard key={idx} pilar={pilar} index={idx} />
          ))}
        </div>
      </div>

      {bonus && (
        <div className="p-6 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border border-cyan-500/20 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-cyan-400" />
              <h3 className="text-xl font-bold text-white">Calculadora de Comissao</h3>
            </div>
            <button
              onClick={() => setShowCalculator(!showCalculator)}
              className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/50 rounded-lg text-cyan-400 text-sm font-medium hover:bg-cyan-500/30 transition-colors"
            >
              {showCalculator ? 'Ocultar' : 'Calcular'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
              <p className="text-xs text-gray-400 mb-1">Store+</p>
              <p className="text-2xl font-bold text-cyan-400">{bonus.storePlus}%</p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
              <p className="text-xs text-gray-400 mb-1">Care+</p>
              <p className="text-2xl font-bold text-cyan-400">{bonus.carePlus}%</p>
            </div>
            {bonus.seguroInstalacao && (
              <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                <p className="text-xs text-gray-400 mb-1">Seguro/Inst.</p>
                <p className="text-2xl font-bold text-cyan-400">{bonus.seguroInstalacao}%</p>
              </div>
            )}
            <div className="p-4 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-xl border border-yellow-500/30">
              <p className="text-xs text-gray-400 mb-1">Nivel</p>
              <p className="text-2xl font-bold" style={{ color: nivelConfig.cor }}>{nivelConfig.label}</p>
            </div>
          </div>

          {showCalculator && (
            <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-700 space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Valor da Venda (R$)</label>
                <input
                  type="number"
                  value={valorVenda}
                  onChange={(e) => setValorVenda(e.target.value)}
                  placeholder="Ex: 1500"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white text-lg focus:outline-none focus:border-cyan-500"
                />
              </div>

              {valorVenda && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-800/50 rounded-xl text-center">
                    <p className="text-xs text-gray-400 mb-1">Store+ ({bonus.storePlus}%)</p>
                    <p className="text-xl font-bold text-green-400">
                      R$ {comissao.storePlus.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-800/50 rounded-xl text-center">
                    <p className="text-xs text-gray-400 mb-1">Care+ ({bonus.carePlus}%)</p>
                    <p className="text-xl font-bold text-green-400">
                      R$ {comissao.carePlus.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/30 text-center">
                    <p className="text-xs text-gray-400 mb-1">Total</p>
                    <p className="text-2xl font-bold text-green-400">
                      R$ {comissao.total.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="p-6 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-yellow-400" />
          <h3 className="text-xl font-bold text-white">Jornada de Carreira</h3>
        </div>

        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-700 -translate-y-1/2" />

          {Object.entries(NIVEIS_CONFIG).map(([key, config], idx) => {
            const isAtual = key === colaborador.nivel;
            const isPast = Object.keys(NIVEIS_CONFIG).indexOf(key) < Object.keys(NIVEIS_CONFIG).indexOf(colaborador.nivel);

            return (
              <div key={key} className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                    isAtual
                      ? 'scale-125 shadow-lg'
                      : isPast
                      ? 'opacity-100'
                      : 'opacity-50'
                  }`}
                  style={{
                    backgroundColor: isAtual || isPast ? `${config.cor}20` : 'rgb(31 41 55)',
                    borderColor: isAtual || isPast ? config.cor : 'rgb(75 85 99)',
                    boxShadow: isAtual ? `0 0 20px ${config.cor}40` : 'none'
                  }}
                >
                  {isAtual ? (
                    <Flame className="w-6 h-6" style={{ color: config.cor }} />
                  ) : isPast ? (
                    <Star className="w-5 h-5" style={{ color: config.cor }} fill={config.cor} />
                  ) : (
                    <Lock className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-bold ${isAtual ? '' : isPast ? 'text-gray-300' : 'text-gray-500'}`}
                  style={{ color: isAtual ? config.cor : undefined }}
                >
                  {config.label}
                </span>
                <span className="text-[10px] text-gray-500">{config.metaEstrelas} estrelas</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
