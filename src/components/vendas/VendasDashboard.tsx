import { useMemo, useState } from 'react';
import { Trophy, Package, TrendingUp, ArrowLeft, ShoppingCart, Users, Building2, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

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

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];
const TIPO_LABELS: Record<string, string> = { store_plus: 'Store+', smb: 'SMB', seguro_care: 'Seguro Care+' };
const TIPO_COLORS: Record<string, string> = { store_plus: '#3B82F6', smb: '#F59E0B', seguro_care: '#10B981' };

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

  const formatCurrency = (val: number) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg p-3 shadow-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-xs" style={{ color: p.color }}>
            {p.name === 'valor' ? formatCurrency(p.value) : `${p.value} vendas`}
          </p>
        ))}
      </div>
    );
  };

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
            <option value="all">Todo Periodo</option>
            <option value="semana">Ultima Semana</option>
            <option value="mes">Este Mes</option>
            <option value="trimestre">Ultimo Trimestre</option>
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

          {topVendedores.length > 0 ? (
            <>
              <div className="h-[280px] mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topVendedores.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="nome" width={100} tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="valor" radius={[0, 6, 6, 0]} barSize={24}>
                      {topVendedores.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {topVendedores.map((v, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-lg transition-colors"
                    style={{ backgroundColor: i < 3 ? `${CHART_COLORS[i]}08` : 'transparent', border: `1px solid ${i < 3 ? CHART_COLORS[i] + '30' : 'var(--border-primary)'}` }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{
                        backgroundColor: i < 3 ? `${CHART_COLORS[i]}20` : '#37415120',
                        color: i < 3 ? CHART_COLORS[i] : '#6B7280'
                      }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{v.nome}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{v.qtd} {v.qtd === 1 ? 'venda' : 'vendas'}</p>
                    </div>
                    <p className="text-sm font-bold shrink-0" style={{ color: i < 3 ? CHART_COLORS[i] : '#10B981' }}>
                      {formatCurrency(v.valor)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 opacity-50">
              <Users className="w-12 h-12 mb-3" style={{ color: 'var(--text-secondary)' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Nenhuma venda no periodo</p>
            </div>
          )}
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

          {topProdutos.length > 0 ? (
            <>
              <div className="h-[280px] mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProdutos.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="nome" width={120} tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="qtd" name="qtd" radius={[0, 6, 6, 0]} barSize={24}>
                      {topProdutos.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {topProdutos.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-lg transition-colors"
                    style={{ backgroundColor: i < 3 ? `${CHART_COLORS[i]}08` : 'transparent', border: `1px solid ${i < 3 ? CHART_COLORS[i] + '30' : 'var(--border-primary)'}` }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{
                        backgroundColor: i < 3 ? `${CHART_COLORS[i]}20` : '#37415120',
                        color: i < 3 ? CHART_COLORS[i] : '#6B7280'
                      }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.nome}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(p.valor)} total</p>
                    </div>
                    <div className="px-3 py-1 rounded-full text-xs font-bold shrink-0" style={{ backgroundColor: `${CHART_COLORS[i % CHART_COLORS.length]}20`, color: CHART_COLORS[i % CHART_COLORS.length] }}>
                      {p.qtd}x
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 opacity-50">
              <Package className="w-12 h-12 mb-3" style={{ color: 'var(--text-secondary)' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Nenhum produto no periodo</p>
            </div>
          )}
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
