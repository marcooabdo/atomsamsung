import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, Plus, TrendingUp, AlertCircle, CheckCircle2, DollarSign, Search, Users } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ComplianceWizard } from '../components/compliance/ComplianceWizard';
import { ComplianceDrawer } from '../components/compliance/ComplianceDrawer';
import {
  CATEGORIAS,
  STATUS_CONFIG,
  formatBRL,
  type OcorrenciaComDetalhes,
  type StatusOcorrencia,
  type CategoriaOcorrencia,
} from '../components/compliance/types';

export function Compliance() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaComDetalhes[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selected, setSelected] = useState<OcorrenciaComDetalhes | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusOcorrencia | 'all'>('all');
  const [catFilter, setCatFilter] = useState<CategoriaOcorrencia | 'all'>('all');

  const loadData = async () => {
    if (!usuario) return;
    setLoading(true);
    try {
      const { data: ocs } = await supabase
        .from('compliance_ocorrencias')
        .select('*')
        .order('created_at', { ascending: false });
      if (!ocs) { setOcorrencias([]); return; }

      const ocIds = ocs.map(o => o.id);
      if (ocIds.length === 0) { setOcorrencias([]); return; }

      const { data: resps } = await supabase
        .from('compliance_responsaveis')
        .select('*')
        .in('ocorrencia_id', ocIds);

      const respIds = (resps || []).map(r => r.id);
      const { data: parcs } = respIds.length > 0
        ? await supabase.from('compliance_parcelas').select('*').in('responsavel_id', respIds).order('numero_parcela')
        : { data: [] };

      const userIds = [...new Set((resps || []).map(r => r.usuario_id))];
      const { data: users } = userIds.length > 0
        ? await supabase.from('usuarios').select('id, nome, foto_url').in('id', userIds)
        : { data: [] };
      const userMap = new Map((users || []).map(u => [u.id, u]));

      const enriched: OcorrenciaComDetalhes[] = ocs.map(oc => {
        const rs = (resps || [])
          .filter(r => r.ocorrencia_id === oc.id)
          .map(r => {
            const u = userMap.get(r.usuario_id);
            return {
              ...r,
              usuario_nome: u?.nome || 'Desconhecido',
              usuario_foto: u?.foto_url || null,
              parcelas: (parcs || []).filter(p => p.responsavel_id === r.id),
            };
          });
        const valor_pago_total = rs.reduce((s, r) => s + Number(r.valor_pago || 0), 0);
        const percentual_pago = oc.valor_total > 0 ? (valor_pago_total / Number(oc.valor_total)) * 100 : 0;
        return {
          ...oc,
          responsaveis: rs,
          valor_pago_total,
          percentual_pago,
        } as OcorrenciaComDetalhes;
      });
      setOcorrencias(enriched);

      if (selected) {
        const updated = enriched.find(o => o.id === selected.id);
        if (updated) setSelected(updated);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [usuario?.id]);

  const kpis = useMemo(() => {
    const totalPrejuizo = ocorrencias.reduce((s, o) => s + Number(o.valor_total), 0);
    const totalRecuperado = ocorrencias.reduce((s, o) => s + o.valor_pago_total, 0);
    const abertas = ocorrencias.filter(o => o.status !== 'quitado').length;
    const colaboradoresEnvolvidos = new Set(ocorrencias.flatMap(o => o.responsaveis.map(r => r.usuario_id))).size;
    return { totalPrejuizo, totalRecuperado, abertas, colaboradoresEnvolvidos };
  }, [ocorrencias]);

  const donutData = useMemo(() => {
    return CATEGORIAS.map(cat => ({
      name: cat.label,
      value: ocorrencias.filter(o => o.categoria === cat.value).reduce((s, o) => s + Number(o.valor_total), 0),
      color: cat.color,
    })).filter(d => d.value > 0);
  }, [ocorrencias]);

  const barData = useMemo(() => {
    const map = new Map<string, { nome: string; valor: number }>();
    ocorrencias.forEach(o => {
      o.responsaveis.forEach(r => {
        const existing = map.get(r.usuario_id);
        const add = Number(r.valor_devido);
        if (existing) existing.valor += add;
        else map.set(r.usuario_id, { nome: r.usuario_nome || '', valor: add });
      });
    });
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor).slice(0, 6);
  }, [ocorrencias]);

  const filtered = useMemo(() => {
    return ocorrencias.filter(o => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (catFilter !== 'all' && o.categoria !== catFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!o.titulo.toLowerCase().includes(s) &&
            !o.responsaveis.some(r => r.usuario_nome?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [ocorrencias, search, statusFilter, catFilter]);

  return (
    <div className="min-h-screen cyber-grid" style={{ background: '#0A0A0D' }}>
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.15), rgba(var(--accent-rgb),0.05))',
                border: '1px solid rgba(var(--accent-rgb),0.3)',
                boxShadow: '0 0 30px rgba(var(--accent-rgb),0.2)',
              }}>
              <ShieldAlert className="w-6 h-6" style={{ color: '#00D4FF' }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-wide" style={{ color: '#E0E0E0' }}>ATOM Compliance</h1>
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: '#8899AA' }}>Gestão de Perdas e Descontos</p>
            </div>
          </div>
          <button onClick={() => setWizardOpen(true)}
            className="px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.8), rgba(var(--accent-rgb),1))',
              color: '#0A0A0D',
              boxShadow: '0 0 25px rgba(var(--accent-rgb),0.4)',
            }}>
            <Plus className="w-4 h-4" /> Nova Ocorrência
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={DollarSign} label="Prejuízo Total" value={formatBRL(kpis.totalPrejuizo)} color="#FF6B6B" />
          <KpiCard icon={CheckCircle2} label="Recuperado" value={formatBRL(kpis.totalRecuperado)}
            color="#4ADE80"
            progress={kpis.totalPrejuizo > 0 ? (kpis.totalRecuperado / kpis.totalPrejuizo) * 100 : 0} />
          <KpiCard icon={AlertCircle} label="Ocorrências Abertas" value={kpis.abertas.toString()} color="#FFD93D" />
          <KpiCard icon={Users} label="Colaboradores" value={kpis.colaboradoresEnvolvidos.toString()} color="#00D4FF" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="premium-card p-5 rounded-xl" style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#E0E0E0' }}>Distribuição por Categoria</h3>
              <TrendingUp className="w-4 h-4" style={{ color: '#00D4FF' }} />
            </div>
            <div className="h-64">
              {donutData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#E0E0E0' }}
                      formatter={(v: number) => formatBRL(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {donutData.map(d => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color, boxShadow: `0 0 8px ${d.color}` }} />
                  <span style={{ color: '#8899AA' }}>{d.name}</span>
                  <span className="ml-auto font-mono font-bold" style={{ color: '#E0E0E0' }}>{formatBRL(d.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="premium-card p-5 rounded-xl" style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#E0E0E0' }}>Top Colaboradores</h3>
              <Users className="w-4 h-4" style={{ color: '#00D4FF' }} />
            </div>
            <div className="h-64">
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" stroke="#8899AA" tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} style={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="nome" stroke="#8899AA" width={100} style={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
                      formatter={(v: number) => formatBRL(v)} />
                    <Bar dataKey="valor" fill="url(#gradBar)" radius={[0, 6, 6, 0]} />
                    <defs>
                      <linearGradient id="gradBar" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(0,212,255,0.3)" />
                        <stop offset="100%" stopColor="rgba(0,212,255,1)" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </div>
          </div>
        </div>

        <div className="premium-card rounded-xl overflow-hidden" style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-5 py-4 border-b flex items-center gap-3 flex-wrap" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <h3 className="text-sm font-bold uppercase tracking-wider flex-shrink-0" style={{ color: '#E0E0E0' }}>Ocorrências</h3>
            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8899AA' }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por título ou colaborador..."
                className="w-full pl-10 pr-4 py-2 rounded-lg text-sm"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#E0E0E0' }} />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusOcorrencia | 'all')}
              className="px-3 py-2 rounded-lg text-xs uppercase tracking-wider font-bold"
              style={{ background: '#15151A', border: '1px solid rgba(255,255,255,0.08)', color: '#E0E0E0', colorScheme: 'dark' }}>
              <option value="all">Todos Status</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value as CategoriaOcorrencia | 'all')}
              className="px-3 py-2 rounded-lg text-xs uppercase tracking-wider font-bold"
              style={{ background: '#15151A', border: '1px solid rgba(255,255,255,0.08)', color: '#E0E0E0', colorScheme: 'dark' }}>
              <option value="all">Todas Categorias</option>
              {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-16 text-center text-xs" style={{ color: '#8899AA' }}>Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-40" style={{ color: '#8899AA' }} />
                <p className="text-sm" style={{ color: '#8899AA' }}>Nenhuma ocorrência encontrada</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th className="text-left px-5 py-3 uppercase tracking-wider font-bold" style={{ color: '#8899AA' }}>Ocorrência</th>
                    <th className="text-left px-5 py-3 uppercase tracking-wider font-bold" style={{ color: '#8899AA' }}>Categoria</th>
                    <th className="text-left px-5 py-3 uppercase tracking-wider font-bold" style={{ color: '#8899AA' }}>Responsáveis</th>
                    <th className="text-right px-5 py-3 uppercase tracking-wider font-bold" style={{ color: '#8899AA' }}>Valor</th>
                    <th className="text-left px-5 py-3 uppercase tracking-wider font-bold" style={{ color: '#8899AA' }}>Progresso</th>
                    <th className="text-center px-5 py-3 uppercase tracking-wider font-bold" style={{ color: '#8899AA' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => {
                    const statusCfg = STATUS_CONFIG[o.status];
                    const catCfg = CATEGORIAS.find(c => c.value === o.categoria);
                    return (
                      <tr key={o.id} onClick={() => setSelected(o)}
                        className="border-t cursor-pointer transition hover:bg-white/[0.03]"
                        style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                        <td className="px-5 py-3">
                          <div className="font-bold" style={{ color: '#E0E0E0' }}>{o.titulo}</div>
                          <div className="text-[10px] mt-0.5" style={{ color: '#8899AA' }}>
                            {new Date(o.data_ocorrencia + 'T00:00').toLocaleDateString('pt-BR')}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {catCfg && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                              style={{ background: `${catCfg.color}15`, border: `1px solid ${catCfg.color}40`, color: catCfg.color }}>
                              {catCfg.label}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex -space-x-2">
                            {o.responsaveis.slice(0, 4).map(r => (
                              <div key={r.id} title={r.usuario_nome}
                                className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center"
                                style={{ background: 'rgba(var(--accent-rgb),0.15)', border: '2px solid var(--bg-secondary)' }}>
                                {r.usuario_foto ? <img src={r.usuario_foto} alt="" className="w-full h-full object-cover" /> :
                                  <span className="text-[10px] font-bold" style={{ color: '#00D4FF' }}>{r.usuario_nome?.charAt(0)}</span>}
                              </div>
                            ))}
                            {o.responsaveis.length > 4 && (
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                                style={{ background: 'rgba(255,255,255,0.05)', border: '2px solid var(--bg-secondary)', color: '#8899AA' }}>
                                +{o.responsaveis.length - 4}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-bold" style={{ color: '#E0E0E0' }}>
                          {formatBRL(Number(o.valor_total))}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2 min-w-[140px]">
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                              <div className="h-full" style={{
                                width: `${o.percentual_pago}%`,
                                background: 'linear-gradient(90deg, rgba(0,212,255,0.8), rgba(74,222,128,1))',
                              }} />
                            </div>
                            <span className="text-[10px] font-mono w-10 text-right" style={{ color: '#00D4FF' }}>
                              {o.percentual_pago.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                            style={{ background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, color: statusCfg.color }}>
                            {statusCfg.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <ComplianceWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onCreated={loadData} />
      <ComplianceDrawer ocorrencia={selected} open={!!selected} onClose={() => setSelected(null)} onUpdate={loadData} />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color, progress }: {
  icon: typeof ShieldAlert; label: string; value: string; color: string; progress?: number;
}) {
  return (
    <div className="premium-card p-5 rounded-xl relative overflow-hidden"
      style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-20 blur-2xl" style={{ background: color, transform: 'translate(40%,-40%)' }} />
      <div className="flex items-start justify-between mb-3 relative">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1" style={{ color: '#8899AA' }}>{label}</div>
          <div className="text-xl font-bold font-mono" style={{ color: '#E0E0E0' }}>{value}</div>
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${color}15`, border: `1px solid ${color}40` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      {progress !== undefined && (
        <div className="relative">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="h-full transition-all duration-700"
              style={{ width: `${Math.min(progress, 100)}%`, background: color, boxShadow: `0 0 10px ${color}80` }} />
          </div>
          <div className="text-[10px] mt-1 font-mono" style={{ color }}>{progress.toFixed(1)}% recuperado</div>
        </div>
      )}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center text-xs" style={{ color: '#8899AA' }}>
      Sem dados para exibir
    </div>
  );
}
