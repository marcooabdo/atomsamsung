import { Activity, AlertTriangle, CheckCircle, Clock, TrendingUp, Package, Calendar, MapPin } from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function DashboardExecutivo() {
  const { selectedUnidade, refreshKey } = useOtimizador();
  const [kpis, setKpis] = useState({ osDoDia: 0, emAndamento: 0, concluidas: 0, atrasadas: 0, checkoutsPendentes: 0, gisPendentes: 0 });
  const [dataInicio, setDataInicio] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
  const [chartCriadas, setChartCriadas] = useState<any[]>([]);
  const [chartTecnicos, setChartTecnicos] = useState<any[]>([]);
  const [chartTipos, setChartTipos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedUnidade) { loadKPIs(); loadCharts(); }
  }, [selectedUnidade, refreshKey, dataInicio, dataFim]);

  const loadKPIs = async () => {
    if (!selectedUnidade) return;
    const hoje = new Date().toISOString().split('T')[0];

    const [osHoje, agendHoje, giRes] = await Promise.all([
      supabase.from('os').select('id, coluna_kanban, data_agendamento').eq('unidade_id', selectedUnidade).or(`data_agendamento.eq.${hoje},coluna_kanban.in.(em_atendimento,em_rota_ih)`),
      supabase.from('agendamentos').select('id, status, checkout_realizado, data_agendamento').eq('unidade_id', selectedUnidade).eq('data_agendamento', hoje),
      supabase.from('requisicoes_pecas').select('id, status').eq('status', 'aprovada').limit(500),
    ]);

    const osToday = osHoje.data || [];
    const agend = agendHoje.data || [];

    const emAndamento = osToday.filter(os => ['em_atendimento', 'em_rota_ih'].includes(os.coluna_kanban)).length;
    const concluidas = agend.filter(a => a.status === 'concluido').length;
    const checkoutsPend = agend.filter(a => a.status === 'em_atendimento' && !a.checkout_realizado).length;

    const { count: atrasadas } = await supabase.from('os').select('id', { count: 'exact', head: true }).eq('unidade_id', selectedUnidade).in('coluna_kanban', ['em_aberto', 'aguardando_peca', 'orcamento_pendente']).lt('created_at', new Date(Date.now() - 7 * 86400000).toISOString());

    setKpis({
      osDoDia: osToday.filter(os => os.data_agendamento === hoje).length,
      emAndamento,
      concluidas,
      atrasadas: atrasadas || 0,
      checkoutsPendentes: checkoutsPend,
      gisPendentes: giRes.data?.length || 0,
    });
  };

  const loadCharts = async () => {
    if (!selectedUnidade) return;
    setLoading(true);
    const { data: osData } = await supabase
      .from('os')
      .select('created_at, coluna_kanban, tipo_atendimento, tecnico_agendado_id, usuarios!os_tecnico_agendado_id_fkey(nome)')
      .eq('unidade_id', selectedUnidade)
      .gte('created_at', dataInicio)
      .lte('created_at', dataFim + 'T23:59:59');

    const porDia = new Map<string, { criadas: number; fechadas: number }>();
    const porTecnico = new Map<string, number>();
    const tipos: Record<string, number> = {};

    (osData || []).forEach((os: any) => {
      const date = os.created_at?.split('T')[0];
      if (!porDia.has(date)) porDia.set(date, { criadas: 0, fechadas: 0 });
      const d = porDia.get(date)!;
      d.criadas++;
      if (os.coluna_kanban === 'os_fechada') d.fechadas++;
      if (os.usuarios?.nome) porTecnico.set(os.usuarios.nome, (porTecnico.get(os.usuarios.nome) || 0) + 1);
      const tipo = (os.tipo_atendimento || 'Outro').toUpperCase();
      tipos[tipo] = (tipos[tipo] || 0) + 1;
    });

    const criadas: any[] = [];
    for (let d = new Date(dataInicio); d <= new Date(dataFim); d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split('T')[0];
      const v = porDia.get(ds) || { criadas: 0, fechadas: 0 };
      criadas.push({ date: new Date(ds).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), ...v });
    }

    setChartCriadas(criadas);
    setChartTecnicos(Array.from(porTecnico.entries()).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total).slice(0, 10));
    setChartTipos(Object.entries(tipos).map(([name, value]) => ({ name, value })));
    setLoading(false);
  };

  const CORES_PIE = ['#0EA5E9', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#F97316'];
  const kpiCards = [
    { label: 'OS do Dia', value: kpis.osDoDia, icon: Activity, color: '#00D4FF', bg: '#00D4FF' },
    { label: 'Em Andamento', value: kpis.emAndamento, icon: Clock, color: '#3B82F6', bg: '#3B82F6' },
    { label: 'Concluidas Hoje', value: kpis.concluidas, icon: CheckCircle, color: '#10B981', bg: '#10B981' },
    { label: 'Checkouts Pendentes', value: kpis.checkoutsPendentes, icon: MapPin, color: '#F59E0B', bg: '#F59E0B' },
    { label: 'GIs Pendentes', value: kpis.gisPendentes, icon: Package, color: '#F97316', bg: '#F97316' },
    { label: 'Atrasadas (+7d)', value: kpis.atrasadas, icon: AlertTriangle, color: '#EF4444', bg: '#EF4444' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-accent)' }}>Dashboard Executivo</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Visão em tempo real da operação</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((k) => (
          <div key={k.label} className="rounded-xl p-4 transition-all hover:scale-[1.02]" style={{ backgroundColor: k.bg + '10', border: `1px solid ${k.bg}30` }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{k.label}</p>
                <p className="text-3xl font-bold mt-1" style={{ color: k.color }}>{k.value}</p>
              </div>
              <k.icon className="w-8 h-8 opacity-40" style={{ color: k.color }} />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <div className="flex items-center gap-3 mb-3">
          <Calendar className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Periodo</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--text-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>OS Criadas vs Fechadas</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartCriadas}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                <XAxis dataKey="date" stroke="var(--text-secondary)" style={{ fontSize: '11px' }} />
                <YAxis stroke="var(--text-secondary)" style={{ fontSize: '11px' }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                <Legend />
                <Area type="monotone" dataKey="criadas" stroke="#06B6D4" fill="#06B6D4" fillOpacity={0.2} name="Criadas" />
                <Area type="monotone" dataKey="fechadas" stroke="#10B981" fill="#10B981" fillOpacity={0.2} name="Fechadas" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
              <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>OS por Técnico (Top 10)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartTecnicos} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                  <XAxis type="number" stroke="var(--text-secondary)" style={{ fontSize: '11px' }} />
                  <YAxis type="category" dataKey="nome" stroke="var(--text-secondary)" style={{ fontSize: '10px' }} width={120} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                  <Bar dataKey="total" fill="#3B82F6" name="Total" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
              <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Por Tipo de Atendimento</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={chartTipos} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {chartTipos.map((_, i) => <Cell key={i} fill={CORES_PIE[i % CORES_PIE.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
