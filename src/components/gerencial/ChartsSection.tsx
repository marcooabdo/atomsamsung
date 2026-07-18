import { useMemo } from 'react';
import { OSData } from '../../pages/GerencialDashboard';
import { format, subDays, startOfDay, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend, Area, AreaChart
} from 'recharts';

interface Props {
  osList: OSData[];
}

const COLORS_PIE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export function ChartsSection({ osList }: Props) {
  const typeDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    osList.forEach(os => {
      const key = `${os.tipo_os || '?'} / ${os.tipo_atendimento || '?'}`;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [osList]);

  const dailyFlow = useMemo(() => {
    const last30 = subDays(new Date(), 30);
    const days = eachDayOfInterval({ start: last30, end: new Date() });

    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const created = osList.filter(os => os.created_at?.startsWith(dayStr)).length;
      const closed = osList.filter(os => os.fechada_em?.startsWith(dayStr)).length;
      return {
        date: format(day, 'dd/MM', { locale: ptBR }),
        criadas: created,
        fechadas: closed,
      };
    });
  }, [osList]);

  const columnDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    osList.filter(os => os.coluna_kanban !== 'os_fechada').forEach(os => {
      map[os.coluna_kanban] = (map[os.coluna_kanban] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [osList]);

  const revenueByMonth = useMemo(() => {
    const map: Record<string, { receita: number; pecas: number; servicos: number }> = {};
    osList.forEach(os => {
      if (!os.created_at) return;
      const month = format(new Date(os.created_at), 'MMM/yy', { locale: ptBR });
      if (!map[month]) map[month] = { receita: 0, pecas: 0, servicos: 0 };
      map[month].receita += Number(os.valor_total || 0);
      map[month].pecas += Number(os.valor_pecas || 0);
      map[month].servicos += Number(os.valor_servicos || 0);
    });
    return Object.entries(map).map(([month, vals]) => ({ month, ...vals }));
  }, [osList]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Daily Flow */}
      <div className="bg-[#1a1d27] rounded-xl border border-[#2a2e3a] p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Fluxo Diário (30 dias)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={dailyFlow}>
            <defs>
              <linearGradient id="gradCriadas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="gradFechadas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3a" />
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#232733', border: '1px solid #2a2e3a', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#9ca3af' }}
            />
            <Area type="monotone" dataKey="criadas" stroke="#3b82f6" fillOpacity={1} fill="url(#gradCriadas)" strokeWidth={2} />
            <Area type="monotone" dataKey="fechadas" stroke="#10b981" fillOpacity={1} fill="url(#gradFechadas)" strokeWidth={2} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Type Distribution */}
      <div className="bg-[#1a1d27] rounded-xl border border-[#2a2e3a] p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Distribuição por Tipo</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={typeDistribution}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {typeDistribution.map((_, i) => (
                <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#232733', border: '1px solid #2a2e3a', borderRadius: 8, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Top Columns Bar */}
      <div className="bg-[#1a1d27] rounded-xl border border-[#2a2e3a] p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Top 10 Etapas (OS Ativas)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={columnDistribution} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3a" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis dataKey="name" type="category" width={120} tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#232733', border: '1px solid #2a2e3a', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue */}
      <div className="bg-[#1a1d27] rounded-xl border border-[#2a2e3a] p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Receita por Mês</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={revenueByMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3a" />
            <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: '#232733', border: '1px solid #2a2e3a', borderRadius: 8, fontSize: 12 }}
              formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
            />
            <Bar dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} name="Receita" />
            <Bar dataKey="pecas" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Peças" />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
