import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, Users, Activity } from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { supabase } from '../../lib/supabase';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';

interface AnalyticsData {
  osPorMes: { mes: string; total: number }[];
  osPorTecnico: { tecnico: string; total: number }[];
  osPorTipo: { tipo: string; total: number }[];
  receitaMensal: { mes: string; receita: number }[];
  topTecnicos: { nome: string; os_concluidas: number; taxa_sucesso: number }[];
}

const COLORS = ['#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#06B6D4'];

export default function Analytics() {
  const { selectedUnidade, loading } = useOtimizador();
  const [data, setData] = useState<AnalyticsData>({ osPorMes: [], osPorTecnico: [], osPorTipo: [], receitaMensal: [], topTecnicos: [] });
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  useEffect(() => {
    if (selectedUnidade) loadAnalytics();
  }, [selectedUnidade]);

  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const meses = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        return { mes: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), mesNum: d.getMonth() + 1, ano: d.getFullYear() };
      }).reverse();

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const startDate = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

      const [osRes, tecRes, lancRes] = await Promise.all([
        supabase.from('os').select('id, tecnico_id, tecnico_agendado_id, coluna_kanban, tipo_atendimento, created_at').eq('unidade_id', selectedUnidade).gte('created_at', startDate),
        supabase.from('usuarios').select('id, nome').eq('unidade_id', selectedUnidade).in('tipo', ['tecnico', 'tecnico_ih']).eq('ativo', true).limit(10),
        supabase.from('financeiro_lancamentos').select('valor, data_pagamento').eq('unidade_id', selectedUnidade).gte('data_pagamento', startDate),
      ]);

      const allOs = osRes.data || [];
      const allTec = tecRes.data || [];
      const allLanc = lancRes.data || [];
      const closedColumns = ['os_fechada', 'reparo_concluido'];

      const osPorMes = meses.map(m => {
        const prefix = `${m.ano}-${String(m.mesNum).padStart(2, '0')}`;
        return { mes: m.mes, total: allOs.filter(o => o.created_at?.startsWith(prefix)).length };
      });

      const osPorTecnico = allTec
        .map(t => ({
          tecnico: t.nome.split(' ')[0],
          total: allOs.filter(o => o.tecnico_id === t.id || o.tecnico_agendado_id === t.id).length,
        }))
        .filter(t => t.total > 0);

      const tiposCount: Record<string, number> = {};
      allOs.forEach(o => {
        const tipo = o.tipo_atendimento || 'Outro';
        tiposCount[tipo] = (tiposCount[tipo] || 0) + 1;
      });
      const osPorTipo = Object.entries(tiposCount).map(([tipo, total]) => ({ tipo, total }));

      const receitaMensal = meses.map(m => {
        const prefix = `${m.ano}-${String(m.mesNum).padStart(2, '0')}`;
        const receita = allLanc.filter(l => l.data_pagamento?.startsWith(prefix)).reduce((s, l) => s + (l.valor || 0), 0);
        return { mes: m.mes, receita: Math.round(receita) };
      });

      const topTecnicos = allTec.slice(0, 5).map(t => {
        const tecOs = allOs.filter(o => o.tecnico_id === t.id || o.tecnico_agendado_id === t.id);
        const concluidas = tecOs.filter(o => closedColumns.includes(o.coluna_kanban)).length;
        const total = tecOs.length;
        return { nome: t.nome, os_concluidas: concluidas, taxa_sucesso: total > 0 ? Math.round((concluidas / total) * 100) : 0 };
      });

      setData({ osPorMes, osPorTecnico, osPorTipo, receitaMensal, topTecnicos });
    } catch {
    } finally {
      setLoadingAnalytics(false);
    }
  };

  if (loadingAnalytics || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: 'var(--border-primary)', borderTopColor: 'var(--text-accent)' }} />
      </div>
    );
  }

  const tooltipStyle = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'var(--text-primary)' };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Analytics e BI</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Análises detalhadas com tendências e comparativos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total OSs', value: data.osPorMes.reduce((s, i) => s + i.total, 0), icon: TrendingUp, color: '#0EA5E9' },
          { label: 'Técnicos Ativos', value: data.osPorTecnico.length, icon: Users, color: '#06B6D4' },
          { label: 'Receita Total', value: `R$ ${(data.receitaMensal.reduce((s, i) => s + i.receita, 0) / 1000).toFixed(0)}k`, icon: DollarSign, color: '#10B981' },
          { label: 'Taxa Média', value: `${data.topTecnicos.length > 0 ? Math.round(data.topTecnicos.reduce((s, t) => s + t.taxa_sucesso, 0) / data.topTecnicos.length) : 0}%`, icon: Activity, color: '#F59E0B' },
        ].map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl p-5" style={{ backgroundColor: `${c.color}08`, border: `1px solid ${c.color}25` }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{c.label}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
                </div>
                <Icon className="w-10 h-10 opacity-40" style={{ color: c.color }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5" style={{ color: '#0EA5E9' }} />
            <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Tendencia de OSs</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.osPorMes}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis dataKey="mes" stroke="var(--text-tertiary)" fontSize={12} />
              <YAxis stroke="var(--text-tertiary)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="total" stroke="#0EA5E9" strokeWidth={2} name="OSs" dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5" style={{ color: '#06B6D4' }} />
            <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>OSs por Técnico</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.osPorTecnico}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis dataKey="tecnico" stroke="var(--text-tertiary)" fontSize={12} />
              <YAxis stroke="var(--text-tertiary)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="total" fill="#3B82F6" name="OSs" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5" style={{ color: '#10B981' }} />
            <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Distribuicao por Tipo</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={data.osPorTipo} dataKey="total" nameKey="tipo" cx="50%" cy="50%" outerRadius={90}
                label={({ tipo, total }) => `${tipo}: ${total}`} labelLine={{ stroke: 'var(--text-tertiary)' }}>
                {data.osPorTipo.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5" style={{ color: '#10B981' }} />
            <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Receita Mensal</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.receitaMensal}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis dataKey="mes" stroke="var(--text-tertiary)" fontSize={12} />
              <YAxis stroke="var(--text-tertiary)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
              <Area type="monotone" dataKey="receita" stroke="#10B981" fill="#10B981" fillOpacity={0.15} name="Receita" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="w-5 h-5" style={{ color: '#F59E0B' }} />
          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Top Técnicos - Performance</h3>
        </div>

        {data.topTecnicos.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-14 h-14 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Nenhum dado disponível</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  {['Pos.', 'Técnico', 'OSs Concluídas', 'Taxa'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.topTecnicos.sort((a, b) => b.os_concluidas - a.os_concluidas).map((t, i) => {
                  const medalColor = i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#F97316' : '#3B82F6';
                  return (
                    <tr key={t.nome} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      <td className="py-3 px-4">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: `${medalColor}15`, color: medalColor, border: `1px solid ${medalColor}30` }}>
                          {i + 1}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium" style={{ color: 'var(--text-primary)' }}>{t.nome}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: '#10B98115', color: '#10B981', border: '1px solid #10B98130' }}>
                          {t.os_concluidas}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{
                          backgroundColor: `${t.taxa_sucesso >= 80 ? '#10B981' : t.taxa_sucesso >= 60 ? '#F59E0B' : '#EF4444'}15`,
                          color: t.taxa_sucesso >= 80 ? '#10B981' : t.taxa_sucesso >= 60 ? '#F59E0B' : '#EF4444',
                        }}>
                          {t.taxa_sucesso}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
