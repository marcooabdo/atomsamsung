import { useState } from 'react';
import {
  Package, Wrench, AlertTriangle, RefreshCw,
  RotateCcw, ClipboardList, TrendingUp, Zap,
  ChevronRight, AlertCircle, Loader2
} from 'lucide-react';
import { useCreditoGSPN, CategoriaCredito } from './useCreditoGSPN';
import { CreditoDetailsModal } from './CreditoDetailsModal';

interface Props {
  selectedUnidade: string;
  user: any;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function ProgressBar({ percent }: { percent: number }) {
  const isOk = percent < 60;
  const isWarn = percent >= 60 && percent < 85;

  const barColor = isOk
    ? 'var(--neon-green)'
    : isWarn
    ? '#FFBF00'
    : '#FF0064';

  const textColor = isOk
    ? 'var(--neon-green)'
    : isWarn
    ? '#FFBF00'
    : '#FF0064';

  const shadowColor = isOk
    ? 'rgba(var(--neon-green-rgb), 0.4)'
    : isWarn
    ? 'rgba(255,191,0,0.4)'
    : 'rgba(255,0,100,0.4)';

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Consumo do Limite</span>
        <span className="text-sm font-bold" style={{ color: textColor }}>{percent.toFixed(1)}%</span>
      </div>
      <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--progress-track)', border: '1px solid var(--border-primary)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${percent}%`,
            background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
            boxShadow: `0 0 12px ${shadowColor}`,
          }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>0%</span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>100%</span>
      </div>
    </div>
  );
}

interface CategoryConfig {
  key: keyof ReturnType<typeof useCreditoGSPN>['categorias'];
  icon: React.ElementType;
  color: string;
  glow: string;
  border: string;
  isGreen?: boolean;
}

const CATEGORIES: CategoryConfig[] = [
  { key: 'disponivel',       icon: Package,       color: 'var(--neon-green)', glow: 'rgba(var(--neon-green-rgb),0.18)', border: 'rgba(var(--neon-green-rgb),0.4)', isGreen: true },
  { key: 'comTecnico',       icon: Wrench,         color: '#00D4FF', glow: 'rgba(0,212,255,0.2)',    border: 'rgba(0,212,255,0.4)'  },
  { key: 'comDefeito',       icon: AlertTriangle,  color: '#FFBF00', glow: 'rgba(255,191,0,0.2)',    border: 'rgba(255,191,0,0.4)'  },
  { key: 'devolvidaSamsung', icon: RefreshCw,      color: '#FF6B35', glow: 'rgba(255,107,53,0.2)',   border: 'rgba(255,107,53,0.4)' },
  { key: 'usadaOsAberta',    icon: RotateCcw,      color: '#A855F7', glow: 'rgba(168,85,247,0.2)',   border: 'rgba(168,85,247,0.4)' },
  { key: 'pedidosAtivos',    icon: ClipboardList,  color: '#EC4899', glow: 'rgba(236,72,153,0.2)',   border: 'rgba(236,72,153,0.4)' },
];

export function EstoqueCreditoGSPN({ selectedUnidade, user: _user }: Props) {
  const data = useCreditoGSPN(selectedUnidade);
  const [selectedCategoria, setSelectedCategoria] = useState<CategoriaCredito | null>(null);

  if (data.loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: 'var(--neon-green)' }} />
        <p className="text-sm uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Calculando crédito GSPN...</p>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-red-400">{data.error}</p>
      </div>
    );
  }

  const noLimit = data.limitTotal === 0;

  const consumidoColor = data.percentual >= 85
    ? '#FF0064'
    : data.percentual >= 60
    ? '#FFBF00'
    : 'var(--neon-green)';

  return (
    <div className="space-y-6 fade-in">

      {/* Thermometer panel */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(var(--neon-green-rgb),0.22)',
          boxShadow: '0 0 30px rgba(var(--neon-green-rgb),0.04), var(--card-shadow)',
        }}
      >
        {/* Title row */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'rgba(var(--neon-green-rgb),0.1)',
              border: '1px solid rgba(var(--neon-green-rgb),0.3)',
              boxShadow: '0 0 12px rgba(var(--neon-green-rgb),0.1)',
            }}
          >
            <Zap className="w-5 h-5" style={{ color: 'var(--neon-green)' }} />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>Termômetro Financeiro GSPN</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Crédito Samsung GSPN em tempo real</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: 'var(--neon-green)' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--neon-green)' }}>LIVE</span>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--neon-green)' }} />
          </div>
        </div>

        {noLimit && (
          <div className="mb-5 flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-500">
              Limite de crédito GSPN não configurado para esta unidade. Configure em <strong>Configurações → Unidades</strong>.
            </p>
          </div>
        )}

        {/* 3-column stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            {
              label: 'Limite Total',
              value: data.limitTotal,
              color: '#00D4FF',
              dim: 'rgba(0,212,255,0.07)',
              dimBorder: 'rgba(0,212,255,0.22)',
            },
            {
              label: 'Crédito Consumido',
              value: data.consumido,
              color: consumidoColor,
              dim: 'rgba(var(--neon-green-rgb),0.05)',
              dimBorder: 'rgba(var(--neon-green-rgb),0.18)',
            },
            {
              label: 'Crédito Livre',
              value: data.livre,
              color: 'var(--neon-green)',
              dim: 'rgba(var(--neon-green-rgb),0.05)',
              dimBorder: 'rgba(var(--neon-green-rgb),0.18)',
            },
          ].map(stat => (
            <div
              key={stat.label}
              className="rounded-xl p-5 flex flex-col gap-1"
              style={{ background: stat.dim, border: `1px solid ${stat.dimBorder}` }}
            >
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{stat.label}</span>
              <span
                className="text-2xl font-extrabold tracking-tight"
                style={{ color: stat.color }}
              >
                {formatCurrency(stat.value)}
              </span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <ProgressBar percent={data.percentual} />
      </div>

      {/* Category grid */}
      <div>
        <h3 className="text-xs uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <span className="w-4 h-px" style={{ background: 'rgba(var(--neon-green-rgb),0.4)' }} />
          Breakdown por Categoria
          <span className="flex-1 h-px" style={{ background: 'rgba(var(--neon-green-rgb),0.1)' }} />
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map(cfg => {
            const cat = data.categorias[cfg.key];
            const Icon = cfg.icon;
            const pct = data.consumido > 0 ? (cat.total / data.consumido) * 100 : 0;

            return (
              <button
                key={cfg.key}
                onClick={() => setSelectedCategoria(cat)}
                className="group text-left rounded-xl p-5 transition-all duration-200 cursor-pointer"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-primary)',
                  outline: 'none',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = cfg.border;
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${cfg.glow}`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-primary)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                {/* Card header */}
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200"
                    style={{
                      background: cfg.isGreen ? 'rgba(var(--neon-green-rgb),0.1)' : `${cfg.color}15`,
                      border: cfg.isGreen ? '1px solid rgba(var(--neon-green-rgb),0.35)' : `1px solid ${cfg.color}40`,
                    }}
                  >
                    <Icon
                      className="w-5 h-5 transition-colors"
                      style={{ color: cfg.isGreen ? 'var(--neon-green)' : cfg.color }}
                    />
                  </div>
                  <ChevronRight className="w-4 h-4 transition-colors mt-1" style={{ color: 'var(--text-secondary)' }} />
                </div>

                {/* Title */}
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>{cat.label}</p>

                {/* Value */}
                <p
                  className="text-xl font-extrabold mb-3"
                  style={{ color: cfg.isGreen ? 'var(--neon-green)' : cfg.color }}
                >
                  {formatCurrency(cat.total)}
                </p>

                {/* Quantity + share */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {cat.pecas.length} {cat.pecas.length === 1 ? 'peça' : 'peças'}
                  </span>
                  {data.consumido > 0 && (
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {pct.toFixed(1)}% do consumo
                    </span>
                  )}
                </div>

                {/* Mini progress */}
                {data.consumido > 0 && (
                  <div className="mt-3 w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--progress-track)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: cfg.isGreen ? 'var(--neon-green)' : cfg.color,
                      }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Details modal */}
      {selectedCategoria && (
        <CreditoDetailsModal
          categoria={selectedCategoria}
          onClose={() => setSelectedCategoria(null)}
        />
      )}
    </div>
  );
}
