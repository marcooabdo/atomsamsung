import { useState, useEffect, useMemo } from 'react';
import { Users, Star, TrendingUp, Package, ShieldCheck, Briefcase, Heart, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { GLASS, GLASS_INNER, formatCurrency } from './types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface VendedorStats {
  id: string;
  nome: string;
  ow: number;
  lp: number;
  contigo: number;
  store_plus: number;
  smb: number;
  care_plus: number;
  total_os: number;
  total_vendas: number;
}

interface CIVendedoresTabProps {
  usuarioUnidadeId: string | null;
  isGerente: boolean;
  selectedUnidade: string;
  periodoFiltro: string;
}

const CATEGORY_CONFIG = [
  { key: 'ow', label: 'OW', color: '#3B82F6', desc: 'Fora de Garantia', icon: BarChart2, source: 'Pipeline' },
  { key: 'lp', label: 'LP', color: '#06B6D4', desc: 'Garantia', icon: ShieldCheck, source: 'Pipeline' },
  { key: 'contigo', label: 'Contigo', color: '#F59E0B', desc: 'Samsung Contigo', icon: Star, source: 'Pipeline' },
  { key: 'store_plus', label: 'Store+', color: '#10B981', desc: 'Store Plus', icon: Package, source: 'Vendas' },
  { key: 'care_plus', label: 'Care+', color: '#EC4899', desc: 'Seguro Care', icon: Heart, source: 'Vendas' },
  { key: 'smb', label: 'SMB', color: '#8B5CF6', desc: 'SMB', icon: Briefcase, source: 'Vendas' },
];

const PIPELINE_STAGES = [
  'orcamento_aprovado', 'aguardando_peca', 'peca_em_transito', 'peca_disponivel',
  'em_reparo_ci', 'disponivel_ih', 'em_rota_ih', 'saw', 'controle_qualidade',
  'reparo_concluido', 'aguardando_fechamento', 'fechar_os', 'os_fechada',
  'os_nova', 'diagnostico', 'negociacao_em_andamento', 'aguardando_aprovacao',
];

export default function CIVendedoresTab({ usuarioUnidadeId, isGerente, selectedUnidade, periodoFiltro }: CIVendedoresTabProps) {
  const [loading, setLoading] = useState(true);
  const [vendedores, setVendedores] = useState<VendedorStats[]>([]);
  const [sortBy, setSortBy] = useState<keyof VendedorStats>('total_os');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const effectiveUnidade = isGerente ? selectedUnidade : (usuarioUnidadeId || '');

  const getDateStart = () => {
    const now = new Date();
    switch (periodoFiltro) {
      case 'mes': { const d = new Date(now); d.setMonth(now.getMonth() - 1); return d.toISOString(); }
      case 'trimestre': { const d = new Date(now); d.setMonth(now.getMonth() - 3); return d.toISOString(); }
      case 'semestre': { const d = new Date(now); d.setMonth(now.getMonth() - 6); return d.toISOString(); }
      case 'ano': { const d = new Date(now); d.setFullYear(now.getFullYear() - 1); return d.toISOString(); }
      default: return null;
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const dateStart = getDateStart();
        const statsMap = new Map<string, VendedorStats>();
        const usuariosMap = new Map<string, string>();

        const { data: usuarios } = await supabase.from('usuarios').select('id, nome').eq('ativo', true);
        (usuarios || []).forEach((u: any) => usuariosMap.set(u.id, u.nome));

        let osQuery = supabase
          .from('os')
          .select('id, tipo_os, tipo_orcamento, vendedor_responsavel_id, created_at, unidade_id, coluna_kanban')
          .in('coluna_kanban', PIPELINE_STAGES)
          .not('vendedor_responsavel_id', 'is', null);

        if (dateStart) osQuery = osQuery.gte('created_at', dateStart);
        if (effectiveUnidade) osQuery = osQuery.eq('unidade_id', effectiveUnidade);

        const { data: osData } = await osQuery;

        (osData || []).forEach((os: any) => {
          const vid = os.vendedor_responsavel_id;
          if (!vid) return;
          if (!statsMap.has(vid)) {
            statsMap.set(vid, {
              id: vid,
              nome: usuariosMap.get(vid) || 'Vendedor',
              ow: 0, lp: 0, contigo: 0,
              store_plus: 0, smb: 0, care_plus: 0,
              total_os: 0, total_vendas: 0,
            });
          }
          const s = statsMap.get(vid)!;
          s.total_os += 1;
          const tipoOrc = os.tipo_orcamento || 'normal';
          if (tipoOrc === 'samsung_contigo') s.contigo += 1;
          else if (os.tipo_os === 'LP') s.lp += 1;
          else s.ow += 1;
        });

        let vendasQuery = supabase
          .from('vendas')
          .select('vendedor_id, tipo_venda, created_at, unidade_id')
          .eq('status', 'concluido')
          .not('vendedor_id', 'is', null);

        if (dateStart) vendasQuery = vendasQuery.gte('created_at', dateStart);
        if (effectiveUnidade) vendasQuery = vendasQuery.eq('unidade_id', effectiveUnidade);

        const { data: vendasData } = await vendasQuery;

        (vendasData || []).forEach((v: any) => {
          const vid = v.vendedor_id;
          if (!vid) return;
          if (!statsMap.has(vid)) {
            statsMap.set(vid, {
              id: vid,
              nome: usuariosMap.get(vid) || 'Vendedor',
              ow: 0, lp: 0, contigo: 0,
              store_plus: 0, smb: 0, care_plus: 0,
              total_os: 0, total_vendas: 0,
            });
          }
          const s = statsMap.get(vid)!;
          s.total_vendas += 1;
          if (v.tipo_venda === 'store_plus') s.store_plus += 1;
          else if (v.tipo_venda === 'smb') s.smb += 1;
          else if (v.tipo_venda === 'seguro_care') s.care_plus += 1;
        });

        setVendedores(Array.from(statsMap.values()));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [effectiveUnidade, periodoFiltro]);

  const sorted = useMemo(() => {
    return [...vendedores].sort((a, b) => {
      const va = a[sortBy] as number;
      const vb = b[sortBy] as number;
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  }, [vendedores, sortBy, sortDir]);

  const totalRow: VendedorStats = useMemo(() => {
    return vendedores.reduce((acc, v) => ({
      ...acc,
      ow: acc.ow + v.ow,
      lp: acc.lp + v.lp,
      contigo: acc.contigo + v.contigo,
      store_plus: acc.store_plus + v.store_plus,
      smb: acc.smb + v.smb,
      care_plus: acc.care_plus + v.care_plus,
      total_os: acc.total_os + v.total_os,
      total_vendas: acc.total_vendas + v.total_vendas,
    }), { id: 'total', nome: 'Total', ow: 0, lp: 0, contigo: 0, store_plus: 0, smb: 0, care_plus: 0, total_os: 0, total_vendas: 0 });
  }, [vendedores]);

  const chartData = useMemo(() => {
    return sorted.slice(0, 10).map(v => ({
      nome: v.nome.split(' ')[0],
      OW: v.ow,
      LP: v.lp,
      Contigo: v.contigo,
      'Store+': v.store_plus,
      'Care+': v.care_plus,
      SMB: v.smb,
    }));
  }, [sorted]);

  const handleSort = (col: keyof VendedorStats) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const SortIcon = ({ col }: { col: keyof VendedorStats }) => {
    if (sortBy !== col) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'desc' ? <ChevronDown className="w-3 h-3 text-cyan-400" /> : <ChevronUp className="w-3 h-3 text-cyan-400" />;
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {CATEGORY_CONFIG.map(cat => {
          const total = vendedores.reduce((s, v) => s + (v[cat.key as keyof VendedorStats] as number), 0);
          const Icon = cat.icon;
          return (
            <div key={cat.key} className={`${GLASS} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: cat.color }} />
                </div>
                <span className="text-xs font-semibold" style={{ color: cat.color }}>{cat.label}</span>
              </div>
              <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{total}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{cat.source}</p>
            </div>
          );
        })}
      </div>

      <div className={`${GLASS} p-5`}>
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <BarChart2 className="w-4 h-4 text-cyan-400" />
          Distribuicao por Categoria (Top 10)
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" />
            <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#94A3B8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)' }}
            />
            {CATEGORY_CONFIG.map(cat => (
              <Bar key={cat.key} dataKey={cat.label} fill={cat.color} radius={[3, 3, 0, 0]} maxBarSize={18} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className={`${GLASS} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold w-48" style={{ color: 'var(--text-secondary)' }}>
                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    Profissional
                  </div>
                </th>
                {CATEGORY_CONFIG.map(cat => (
                  <th
                    key={cat.key}
                    className="text-center px-3 py-3 text-xs font-semibold cursor-pointer transition-colors select-none"
                    style={{ color: cat.color }}
                    onClick={() => handleSort(cat.key as keyof VendedorStats)}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {cat.label}
                      <SortIcon col={cat.key as keyof VendedorStats} />
                    </div>
                    <p className="font-normal normal-case mt-0.5" style={{ fontSize: 9, color: 'var(--text-secondary)', opacity: 0.7 }}>{cat.source}</p>
                  </th>
                ))}
                <th
                  className="text-center px-3 py-3 text-xs font-semibold cursor-pointer transition-colors select-none" style={{ color: 'var(--text-secondary)' }}
                  onClick={() => handleSort('total_os')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Total OS
                    <SortIcon col="total_os" />
                  </div>
                </th>
                <th
                  className="text-center px-3 py-3 text-xs font-semibold cursor-pointer transition-colors select-none" style={{ color: 'var(--text-secondary)' }}
                  onClick={() => handleSort('total_vendas')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Total Vendas
                    <SortIcon col="total_vendas" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((v, idx) => {
                const isExpanded = expandedId === v.id;
                const totalGeral = v.total_os + v.total_vendas;
                return (
                  <>
                    <tr
                      key={v.id}
                      className="transition-colors cursor-pointer" style={{ borderBottom: '1px solid var(--border-primary)' }}
                      onClick={() => setExpandedId(isExpanded ? null : v.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: 'rgba(6,182,212,0.15)', color: '#06B6D4' }}
                          >
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{v.nome}</p>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{totalGeral} registros</p>
                          </div>
                        </div>
                      </td>
                      {CATEGORY_CONFIG.map(cat => {
                        const val = v[cat.key as keyof VendedorStats] as number;
                        return (
                          <td key={cat.key} className="text-center px-3 py-3">
                            {val > 0 ? (
                              <span
                                className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{ backgroundColor: cat.color + '20', color: cat.color }}
                              >
                                {val}
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.4 }}>-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-center px-3 py-3">
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{v.total_os}</span>
                      </td>
                      <td className="text-center px-3 py-3">
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{v.total_vendas}</span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${v.id}-detail`} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                        <td colSpan={9} className="px-4 py-4" style={{ background: 'var(--bg-card)' }}>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div className={`${GLASS_INNER} p-3`}>
                              <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Pipeline Operacional</p>
                              <div className="space-y-1.5">
                                {[
                                  { label: 'OW', val: v.ow, color: '#3B82F6' },
                                  { label: 'LP', val: v.lp, color: '#06B6D4' },
                                  { label: 'Contigo', val: v.contigo, color: '#F59E0B' },
                                ].map(item => (
                                  <div key={item.label} className="flex items-center justify-between">
                                    <span className="text-xs font-medium" style={{ color: item.color }}>{item.label}</span>
                                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{item.val}</span>
                                  </div>
                                ))}
                                <div className="pt-1.5 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-primary)' }}>
                                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total OS</span>
                                  <span className="text-xs font-bold text-cyan-400">{v.total_os}</span>
                                </div>
                              </div>
                            </div>
                            <div className={`${GLASS_INNER} p-3`}>
                              <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Registro de Vendas</p>
                              <div className="space-y-1.5">
                                {[
                                  { label: 'Store+', val: v.store_plus, color: '#10B981' },
                                  { label: 'Care+', val: v.care_plus, color: '#EC4899' },
                                  { label: 'SMB', val: v.smb, color: '#8B5CF6' },
                                ].map(item => (
                                  <div key={item.label} className="flex items-center justify-between">
                                    <span className="text-xs font-medium" style={{ color: item.color }}>{item.label}</span>
                                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{item.val}</span>
                                  </div>
                                ))}
                                <div className="pt-1.5 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-primary)' }}>
                                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Vendas</span>
                                  <span className="text-xs font-bold text-emerald-400">{v.total_vendas}</span>
                                </div>
                              </div>
                            </div>
                            <div className={`${GLASS_INNER} p-3`}>
                              <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Consolidado</p>
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Geral</span>
                                  <span className="text-xs font-black" style={{ color: 'var(--text-primary)' }}>{totalGeral}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Pipeline</span>
                                  <span className="text-xs font-semibold text-cyan-400">{v.total_os}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Vendas</span>
                                  <span className="text-xs font-semibold text-emerald-400">{v.total_vendas}</span>
                                </div>
                                {totalGeral > 0 && (
                                  <div className="mt-2">
                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(var(--accent-rgb),0.12)' }}>
                                      <div
                                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                        style={{ width: `${(v.total_os / totalGeral) * 100}%` }}
                                      />
                                    </div>
                                    <div className="flex justify-between mt-1">
                                      <span className="text-xs text-cyan-500/60">{Math.round((v.total_os / totalGeral) * 100)}% pipeline</span>
                                      <span className="text-xs text-emerald-500/60">{Math.round((v.total_vendas / totalGeral) * 100)}% vendas</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {vendedores.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
                    <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p>Nenhum dado encontrado para o periodo selecionado</p>
                  </td>
                </tr>
              )}
            </tbody>
            {vendedores.length > 0 && (
              <tfoot>
                <tr className="border-t border-cyan-500/20 bg-cyan-500/5">
                  <td className="px-4 py-3">
                    <p className="text-xs font-bold text-cyan-400">TOTAL GERAL</p>
                  </td>
                  {CATEGORY_CONFIG.map(cat => (
                    <td key={cat.key} className="text-center px-3 py-3">
                      <span className="text-sm font-black" style={{ color: cat.color }}>
                        {totalRow[cat.key as keyof VendedorStats] as number}
                      </span>
                    </td>
                  ))}
                  <td className="text-center px-3 py-3">
                    <span className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{totalRow.total_os}</span>
                  </td>
                  <td className="text-center px-3 py-3">
                    <span className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{totalRow.total_vendas}</span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
