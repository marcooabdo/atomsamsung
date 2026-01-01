import {
  Star,
  Lock,
  ShoppingCart,
  Building2,
  Handshake,
  Shield,
  TrendingUp,
  ShieldCheck,
  User
} from 'lucide-react';
import type { Colaborador, PilarEstrelas } from './types';
import { NIVEIS_CONFIG } from './types';

interface ColaboradorCardProps {
  colaborador: Colaborador;
  onClick: () => void;
}

function getPilarIcon(icone: string, ativo: boolean) {
  const className = `w-4 h-4 ${ativo ? 'text-cyan-400' : 'text-gray-600'}`;
  const icons: Record<string, JSX.Element> = {
    'shopping-cart': <ShoppingCart className={className} />,
    'building': <Building2 className={className} />,
    'star': <Star className={className} />,
    'handshake': <Handshake className={className} />,
    'shield': <Shield className={className} />,
    'trending-up': <TrendingUp className={className} />,
    'shield-check': <ShieldCheck className={className} />
  };
  return icons[icone] || <Star className={className} />;
}

function PilarBadge({ pilar }: { pilar: PilarEstrelas }) {
  const ativo = pilar.estrelas > 0;
  const corTexto = ativo ? 'text-cyan-400' : 'text-gray-500';

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 rounded-md ${
        ativo ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-gray-800/50 border border-gray-700'
      }`}
      title={`${pilar.nome}: ${pilar.estrelas}/${pilar.maxEstrelas} estrelas`}
    >
      {getPilarIcon(pilar.icone, ativo)}
      <span className={`text-[10px] font-medium ${corTexto}`}>
        {ativo ? 'Ciano' : 'Cinza'}
      </span>
    </div>
  );
}

export function ColaboradorCard({ colaborador, onClick }: ColaboradorCardProps) {
  const nivelConfig = NIVEIS_CONFIG[colaborador.nivel];
  const porcentagem = (colaborador.estrelasMesAtual / colaborador.metaEstrelas) * 100;
  const pilares = Object.values(colaborador.pilares).filter(Boolean) as PilarEstrelas[];

  return (
    <div
      onClick={onClick}
      className={`relative cursor-pointer rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${
        colaborador.travadoPorCultura
          ? 'border-2 border-red-500/70 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
          : 'border border-gray-700/50 hover:border-cyan-500/50 hover:shadow-cyan-500/10'
      }`}
      style={{
        background: 'linear-gradient(145deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))'
      }}
    >
      {colaborador.travadoPorCultura && (
        <div className="absolute top-3 right-3 z-10">
          <div className="p-1.5 bg-red-500/20 rounded-lg border border-red-500/50">
            <Lock className="w-4 h-4 text-red-400" />
          </div>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 border-2 border-gray-600 flex items-center justify-center">
            <User className="w-6 h-6 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-lg truncate">{colaborador.nome}</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">NIVEL:</span>
              <span
                className="text-xs font-bold"
                style={{ color: nivelConfig.cor }}
              >
                {nivelConfig.label}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mb-4">
          <span
            className="text-5xl font-black"
            style={{
              background: `linear-gradient(135deg, ${colaborador.estrelasMesAtual >= colaborador.metaEstrelas ? '#22c55e' : '#fbbf24'}, ${colaborador.estrelasMesAtual >= colaborador.metaEstrelas ? '#16a34a' : '#f59e0b'})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            {colaborador.estrelasMesAtual}/{colaborador.metaEstrelas}
          </span>
          <Star
            className="w-10 h-10"
            fill={colaborador.estrelasMesAtual >= colaborador.metaEstrelas ? '#fbbf24' : '#fbbf24'}
            style={{ color: '#fbbf24' }}
          />
        </div>

        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-4">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(porcentagem, 100)}%`,
              background: colaborador.estrelasMesAtual >= colaborador.metaEstrelas
                ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                : 'linear-gradient(90deg, #06b6d4, #3b82f6)'
            }}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {pilares.slice(0, 5).map((pilar, idx) => (
            <PilarBadge key={idx} pilar={pilar} />
          ))}
        </div>

        <div className="flex gap-1 mt-4 justify-center">
          {colaborador.historicoMeses.slice(0, 3).map((mes, idx) => (
            <div
              key={idx}
              className={`w-2.5 h-2.5 rounded-full ${
                mes.metaBatida ? 'bg-green-500' : 'bg-gray-600'
              }`}
              title={`${mes.mes}/${mes.ano}: ${mes.estrelasTotal} estrelas`}
            />
          ))}
        </div>
      </div>

      <div
        className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, transparent 60%, rgba(6,182,212,0.05) 100%)'
        }}
      />
    </div>
  );
}
