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
  const color =
    percent < 60 ? { bar: '#39FF14', shadow: 'rgba(57,255,20,0.5)', text: 'text-[#39FF14]' }
    : percent < 85 ? { bar: '#FFBF00', shadow: 'rgba(255,191,0,0.5)', text: 'text-[#FFBF00]' }
    : { bar: '#FF0064', shadow: 'rgba(255,0,100,0.5)', text: 'text-[#FF0064]' };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-gray-400 uppercase tracking-wider">Consumo do Limite</span>
        <span className={`text-sm font-bold ${color.text}`}>{percent.toFixed(1)}%</span>
      </div>
      <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${percent}%`,
            background: `linear-gradient(90deg, ${color.bar}cc, ${color.bar})`,
            boxShadow: `0 0 12px ${color.shadow}`,
          }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-600">0%</span>
        <span className="text-xs text-gray-600">100%</span>
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
}

const CATEGORIES: CategoryConfig[] = [
  { key: 'disponivel',       icon: Package,       color: '#39FF14', glow: 'rgba(57,255,20,0.2)',    border: 'rgba(57,255,20,0.4)'  },
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
        <Loader2 className="w-10 h-10 text-[#39FF14] animate-spin" />
        <p className="text-sm text-gray-400 uppercase tracking-wider">Calculando crédito GSPN...</p>
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

  return (
    <div className="space-y-6 fade-in">

      {/* Thermometer panel */}
      <div
        className="rounded-2xl border bg-[#0f172a] p-6"
        style={{
          borderColor: 'rgba(57,255,20,0.25)',
          boxShadow: '0 0 30px rgba(57,255,20,0.08), inset 0 1px 0 rgba(57,255,20,0.08)',
        }}
      >
        {/* Title row */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.3)', boxShadow: '0 0 15px rgba(57,255,20,0.2)' }}
          >
            <Zap className="w-5 h-5 text-[#39FF14]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Termômetro Financeiro GSPN</h2>
            <p className="text-xs text-gray-500 mt-0.5">Crédito Samsung GSPN em tempo real</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#39FF14]" />
            <span className="text-xs text-[#39FF14] font-semibold uppercase tracking-wider">LIVE</span>
            <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-pulse" />
          </div>
        </div>

        {noLimit && (
          <div className="mb-5 flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-300">
              Limite de crédito GSPN não configurado para esta unidade. Configure em <strong>Configurações → Unidades</strong>.
            </p>
          </div>
        )}

        {/* 3-column stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Limite Total', value: data.limitTotal, color: '#00D4FF', dim: 'rgba(0,212,255,0.15)', dimBorder: 'rgba(0,212,255,0.3)' },
            { label: 'Crédito Consumido', value: data.consumido, color: data.percentual >= 85 ? '#FF0064' : data.percentual >= 60 ? '#FFBF00' : '#39FF14', dim: 'rgba(57,255,20,0.08)', dimBorder: 'rgba(57,255,20,0.25)' },
            { label: 'Crédito Livre', value: data.livre, color: '#39FF14', dim: 'rgba(57,255,20,0.08)', dimBorder: 'rgba(57,255,20,0.25)' },
          ].map(stat => (
            <div
              key={stat.label}
              className="rounded-xl p-5 flex flex-col gap-1"
              style={{ background: stat.dim, border: `1px solid ${stat.dimBorder}` }}
            >
              <span className="text-xs text-gray-400 uppercase tracking-wider">{stat.label}</span>
              <span
                className="text-2xl font-extrabold tracking-tight"
                style={{ color: stat.color, textShadow: `0 0 20px ${stat.color}99` }}
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
        <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <span className="w-4 h-px bg-[#39FF14]/40" />
          Breakdown por Categoria
          <span className="flex-1 h-px bg-[#39FF14]/10" />
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
                className="group text-left rounded-xl bg-[#1e293b] border border-slate-700 p-5 transition-all duration-200 cursor-pointer"
                style={{
                  outline: 'none',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = cfg.border;
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${cfg.glow}`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(51,65,85,1)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                {/* Card header */}
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200"
                    style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}40` }}
                  >
                    <Icon className="w-5 h-5 transition-colors" style={{ color: cfg.color }} />
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors mt-1" />
                </div>

                {/* Title */}
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{cat.label}</p>

                {/* Value */}
                <p
                  className="text-xl font-extrabold mb-3"
                  style={{ color: cfg.color, textShadow: `0 0 12px ${cfg.color}60` }}
                >
                  {formatCurrency(cat.total)}
                </p>

                {/* Quantity + share */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300 font-semibold">
                    {cat.pecas.length} {cat.pecas.length === 1 ? 'peça' : 'peças'}
                  </span>
                  {data.consumido > 0 && (
                    <span className="text-xs text-gray-500">
                      {pct.toFixed(1)}% do consumo
                    </span>
                  )}
                </div>

                {/* Mini progress */}
                {data.consumido > 0 && (
                  <div className="mt-3 w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: cfg.color,
                        boxShadow: `0 0 6px ${cfg.color}80`,
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
