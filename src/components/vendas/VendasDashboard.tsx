import { useMemo, useState } from 'react';
import { Trophy, Package, TrendingUp, ArrowLeft, ShoppingCart, Users, DollarSign, Medal } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface Venda {
  id: string;
  numero_venda: string;
  cliente_nome: string;
  produto_nome: string;
  produto_tipo: string | null;
  vendedor_id: string;
  preco: number;
  tipo_venda: 'store_plus' | 'smb' | 'seguro_care';
  status: 'pendente' | 'concluido' | 'cancelado';
  unidade_id: string;
  enviado_skywalker: boolean;
  created_at: string;
  vendedor?: { nome: string; email: string };
  unidade?: { nome: string };
}

interface Unidade {
  id: string;
  nome: string;
}

interface Props {
  vendas: Venda[];
  unidades: Unidade[];
  canSeeAllUnits: boolean;
  userUnidadeId?: string;
  onBack: () => void;
}

const PODIUM_COLORS = ['#F59E0B', '#94A3B8', '#CD7F32'];
const BAR_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#06B6D4', '#EC4899', '#EF4444', '#14B8A6', '#F97316'];
const TIPO_LABELS: Record<string, string> = { store_plus: 'Store+', smb: 'SMB', seguro_care: 'Seguro Care+' };
const TIPO_COLORS: Record<string, string> = { store_plus: '#3B82F6', smb: '#F59E0B', seguro_care: '#10B981' };

const formatCurrency = (val: number) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

function RankingList({ items, valueKey, valueFormatter, emptyIcon: EmptyIcon, emptyText }: {
  items: { nome: string; qtd: number; valor: number }[];
  valueKey: 'valor' | 'qtd';
  valueFormatter: (item: { nome: string; qtd: number; valor: number }) => string;
  emptyIcon: React.ElementType;
  emptyText: string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 opacity-50">
        <EmptyIcon className="w-12 h-12 mb-3" style={{ color: 'var(--text-secondary)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>{emptyText}</p>
      </div>
    );
  }

  const maxVal = Math.max(...items.map(i => i[valueKey]));

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const pct = maxVal > 0 ? (item[valueKey] / maxVal) * 100 : 0;
        const color = i < 3 ? PODIUM_COLORS[i] : BAR_COLORS[i % BAR_COLORS.length];

        return (
          <div key={i} className="group">
            <div className="flex items-center gap-3 mb-1.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {i < 3 ? <Medal className="w-4 h-4" /> : i + 1}
              </div>
              <p className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {item.nome}
              </p>
              <p className="text-sm font-bold shrink-0 tabular-nums" style={{ color }}>
                {valueFormatter(item)}
              </p>
            </div>
            <div className="ml-10 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-primary)' }}>
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.85 }}
              />
            </div>
            <p className="ml-10 text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              {item.qtd} {item.qtd === 1 ? 'venda' : 'vendas'} &middot; {formatCurrency(item.valor)} total
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function VendasDashboard({ vendas, unidades, canSeeAllUnits, userUnidadeId, onBack }: Props) {
  const [filtroUnidade, setFiltroUnidade] = useState(canSeeAllUnits ? 'all' : (userUnidadeId || 'all'));
  const [filtroPeriodo, setFiltroPeriodo] = useState('all');

  const vendasFiltradas = useMemo(() => {
    return vendas.filter(v => {
      if (v.status === 'cancelado') return false;
      if (filtroUnidade !== 'all' && v.unidade_id !== filtroUnidade) return false;
      if (filtroPeriodo !== 'all') {
        const dataVenda = new Date(v.created_at);
        const agora = new Date();
        if (filtroPeriodo === 'mes') {
          if (dataVenda.getMonth() !== agora.getMonth() || dataVenda.getFullYear() !== agora.getFullYear()) return false;
        } else if (filtroPeriodo === 'semana') {
          const umaSemanaAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (dataVenda < umaSemanaAtras) return false;
        } else if (filtroPeriodo === 'trimestre') {
          const tresMesesAtras = new Date(agora.getTime() - 90 * 24 * 60 * 60 * 1000);
          if (dataVenda < tresMesesAtras) return false;
        }
      }
      return true;
    });
  }, [vendas, filtroUnidade, filtroPeriodo]);

  const topVendedores = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; valor: number }>();
    vendasFiltradas.forEach(v => {
      const nome = v.vendedor?.nome || 'Desconhecido';
      const current = map.get(v.vendedor_id) || { nome, qtd: 0, valor: 0 };
      current.qtd += 1;
      current.valor += v.preco;
      map.set(v.vendedor_id, current);
    });
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
  }, [vendasFiltradas]);

  const topProdutos = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; valor: number }>();
    vendasFiltradas.forEach(v => {
      const key = v.produto_nome;
      const current = map.get(key) || { nome: key, qtd: 0, valor: 0 };
      current.qtd += 1;
      current.valor += v.preco;
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd);
  }, [vendasFiltradas]);

  const tipoDistribution = useMemo(() => {
    const map = new Map<string, number>();
    vendasFiltradas.forEach(v => {
      map.set(v.tipo_venda, (map.get(v.tipo_venda) || 0) + 1);
    });
    return Array.from(map.entries()).map(([tipo, qtd]) => ({
      name: TIPO_LABELS[tipo] || tipo,
      value: qtd,
      color: TIPO_COLORS[tipo] || '#6B7280'
    }));
  }, [vendasFiltradas]);

  const resumo = useMemo(() => ({
    totalVendas: vendasFiltradas.length,
    valorTotal: vendasFiltradas.reduce((s, v) => s + v.preco, 0),
    ticketMedio: vendasFiltradas.length > 0 ? vendasFiltradas.reduce((s, v) => s + v.preco, 0) / vendasFiltradas.length : 0,
    vendedoresAtivos: new Set(vendasFiltradas.map(v => v.vendedor_id)).size
  }), [vendasFiltradas]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg transition-colors hover:scale-105"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}>
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-tech)', color: 'var(--text-primary)' }}>
                Dashboard de Vendas
              </h1>
              <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
                Analise performance de vendedores e produtos
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canSeeAllUnits && (
            <select
              value={filtroUnidade}
              onChange={(e) => setFiltroUnidade(e.target.value)}
              className="neon-input text-sm"
              style={{ minWidth: '160px' }}
            >
              <option value="all">Todas as Unidades</option>
              {unidades.map(u => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          )}
          <select
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(e.target.value)}
            className="neon-input text-sm"
            style={{ minWidth: '140px' }}
          >
            <option value="all">Todo Período</option>
            <option value="semana">Última Semana</option>
            <option value="mes">Este Mês</option>
            <option value="trimestre">Último Trimestre</option>
          </select>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total de Vendas', value: resumo.totalVendas.toString(), icon: ShoppingCart, color: '#3B82F6' },
          { label: 'Valor Total', value: formatCurrency(resumo.valorTotal), icon: DollarSign, color: '#10B981' },
          { label: 'Ticket Medio', value: formatCurrency(resumo.ticketMedio), icon: TrendingUp, color: '#F59E0B' },
          { label: 'Vendedores Ativos', value: resumo.vendedoresAtivos.toString(), icon: Users, color: '#06B6D4' }
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl p-5 transition-all hover:scale-[1.02]"
            style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${card.color}40` }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{card.label}</p>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${card.color}15` }}>
                <card.icon className="w-5 h-5" style={{ color: card.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F59E0B15' }}>
              <Trophy className="w-5 h-5" style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Top Vendedores</h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Ranking por valor total vendido</p>
            </div>
          </div>
          <RankingList
            items={topVendedores}
            valueKey="valor"
            valueFormatter={(item) => formatCurrency(item.valor)}
            emptyIcon={Users}
            emptyText="Nenhuma venda no periodo"
          />
        </div>

        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3B82F615' }}>
              <Package className="w-5 h-5" style={{ color: '#3B82F6' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Produtos Mais Vendidos</h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Ranking por quantidade vendida</p>
            </div>
          </div>
          <RankingList
            items={topProdutos}
            valueKey="qtd"
            valueFormatter={(item) => `${item.qtd}x`}
            emptyIcon={Package}
            emptyText="Nenhum produto no periodo"
          />
        </div>
      </div>

      {tipoDistribution.length > 0 && (
        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#06B6D415' }}>
              <ShoppingCart className="w-5 h-5" style={{ color: '#06B6D4' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Distribuicao por Tipo</h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Store+, SMB e Seguro Care+</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="h-[200px] w-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tipoDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    dataKey="value"
                    stroke="none"
                  >
                    {tipoDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value} vendas`, '']}
                    contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '8px' }}
                    labelStyle={{ color: 'var(--text-primary)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {tipoDistribution.map((tipo) => {
                const pct = vendasFiltradas.length > 0 ? ((tipo.value / vendasFiltradas.length) * 100).toFixed(1) : '0';
                return (
                  <div
                    key={tipo.name}
                    className="p-4 rounded-xl text-center"
                    style={{ backgroundColor: `${tipo.color}10`, border: `1px solid ${tipo.color}30` }}
                  >
                    <p className="text-3xl font-bold mb-1" style={{ color: tipo.color }}>{tipo.value}</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{tipo.name}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{pct}% do total</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
