import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, Users, Activity } from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { supabase } from '../../lib/supabase';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface AnalyticsData {
  osPorMes: { mes: string; total: number }[];
  osPorTecnico: { tecnico: string; total: number }[];
  osPorTipo: { tipo: string; total: number }[];
  receitaMensal: { mes: string; receita: number }[];
  topTecnicos: { nome: string; os_concluidas: number; taxa_sucesso: number }[];
}

const COLORS = ['#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

export default function Analytics() {
  const { selectedUnidade, loading } = useOtimizador();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    osPorMes: [],
    osPorTecnico: [],
    osPorTipo: [],
    receitaMensal: [],
    topTecnicos: [],
  });
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  useEffect(() => {
    if (selectedUnidade) {
      loadAnalytics();
    }
  }, [selectedUnidade]);

  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const ultimosMeses = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        return {
          mes: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          mesNum: d.getMonth() + 1,
          ano: d.getFullYear(),
        };
      }).reverse();

      const osPorMesPromises = ultimosMeses.map(async ({ mes, mesNum, ano }) => {
        const { count } = await supabase
          .from('os')
          .select('*', { count: 'exact', head: true })
          .eq('unidade_id', selectedUnidade)
          .gte('created_at', `${ano}-${String(mesNum).padStart(2, '0')}-01`)
          .lt(
            'created_at',
            `${mesNum === 12 ? ano + 1 : ano}-${String(mesNum === 12 ? 1 : mesNum + 1).padStart(2, '0')}-01`
          );

        return { mes, total: count || 0 };
      });

      const osPorMes = await Promise.all(osPorMesPromises);

      const { data: tecnicosData } = await supabase
        .from('usuarios')
        .select('id, nome')
        .eq('unidade_id', selectedUnidade)
        .in('tipo', ['tecnico', 'tecnico_ih'])
        .limit(7);

      const osPorTecnicoPromises =
        tecnicosData?.map(async (tecnico) => {
          const { count } = await supabase
            .from('os')
            .select('*', { count: 'exact', head: true })
            .eq('tecnico_id', tecnico.id);

          return { tecnico: tecnico.nome.split(' ')[0], total: count || 0 };
        }) || [];

      const osPorTecnico = await Promise.all(osPorTecnicoPromises);

      const { data: osPorTipoData } = await supabase
        .from('os')
        .select('tipo_atendimento')
        .eq('unidade_id', selectedUnidade);

      const tiposCount: Record<string, number> = {};
      osPorTipoData?.forEach((os) => {
        const tipo = os.tipo_atendimento || 'Não definido';
        tiposCount[tipo] = (tiposCount[tipo] || 0) + 1;
      });

      const osPorTipo = Object.entries(tiposCount).map(([tipo, total]) => ({
        tipo,
        total,
      }));

      const receitaMensalPromises = ultimosMeses.map(async ({ mes, mesNum, ano }) => {
        const { data: lancamentos } = await supabase
          .from('financeiro_lancamentos')
          .select('valor')
          .eq('unidade_id', selectedUnidade)
          .gte('data_pagamento', `${ano}-${String(mesNum).padStart(2, '0')}-01`)
          .lt(
            'data_pagamento',
            `${mesNum === 12 ? ano + 1 : ano}-${String(mesNum === 12 ? 1 : mesNum + 1).padStart(2, '0')}-01`
          );

        const receita = lancamentos?.reduce((sum, l) => sum + (l.valor || 0), 0) || 0;

        return { mes, receita: Math.round(receita) };
      });

      const receitaMensal = await Promise.all(receitaMensalPromises);

      const topTecnicosPromises =
        tecnicosData?.slice(0, 5).map(async (tecnico) => {
          const { count: osConcluidas } = await supabase
            .from('os')
            .select('*', { count: 'exact', head: true })
            .eq('tecnico_id', tecnico.id)
            .eq('coluna_kanban', 'os_fechada');

          const { count: totalOs } = await supabase
            .from('os')
            .select('*', { count: 'exact', head: true })
            .eq('tecnico_id', tecnico.id);

          const taxaSucesso = totalOs && totalOs > 0 ? Math.round(((osConcluidas || 0) / totalOs) * 100) : 0;

          return {
            nome: tecnico.nome,
            os_concluidas: osConcluidas || 0,
            taxa_sucesso: taxaSucesso,
          };
        }) || [];

      const topTecnicos = await Promise.all(topTecnicosPromises);

      setAnalyticsData({
        osPorMes,
        osPorTecnico: osPorTecnico.filter((t) => t.total > 0),
        osPorTipo,
        receitaMensal,
        topTecnicos,
      });
    } catch (error) {
    } finally {
      setLoadingAnalytics(false);
    }
  };

  if (loadingAnalytics || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-500 to-teal-600">
            Analytics e BI
          </h2>
          <p className="text-gray-400 mt-1">Análises detalhadas com tendências e comparativos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total de OSs</p>
              <p className="text-3xl font-bold text-cyan-400 mt-1">
                {analyticsData.osPorMes.reduce((sum, item) => sum + item.total, 0)}
              </p>
            </div>
            <TrendingUp className="w-12 h-12 text-cyan-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Técnicos Ativos</p>
              <p className="text-3xl font-bold text-purple-400 mt-1">{analyticsData.osPorTecnico.length}</p>
            </div>
            <Users className="w-12 h-12 text-purple-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Receita Total</p>
              <p className="text-3xl font-bold text-green-400 mt-1">
                R$ {(analyticsData.receitaMensal.reduce((sum, item) => sum + item.receita, 0) / 1000).toFixed(0)}k
              </p>
            </div>
            <DollarSign className="w-12 h-12 text-green-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Taxa Média Sucesso</p>
              <p className="text-3xl font-bold text-yellow-400 mt-1">
                {analyticsData.topTecnicos.length > 0
                  ? Math.round(
                      analyticsData.topTecnicos.reduce((sum, t) => sum + t.taxa_sucesso, 0) /
                        analyticsData.topTecnicos.length
                    )
                  : 0}
                %
              </p>
            </div>
            <Activity className="w-12 h-12 text-yellow-400 opacity-50" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-cyan-400" />
            <h3 className="text-xl font-bold text-white">Tendência de OSs</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData.osPorMes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="mes" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="total" stroke="#0EA5E9" strokeWidth={2} name="OSs" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-6 h-6 text-purple-400" />
            <h3 className="text-xl font-bold text-white">OSs por Técnico</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.osPorTecnico}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="tecnico" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="total" fill="#8B5CF6" name="OSs" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-6 h-6 text-green-400" />
            <h3 className="text-xl font-bold text-white">Distribuição por Tipo</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analyticsData.osPorTipo}
                dataKey="total"
                nameKey="tipo"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(entry) => `${entry.tipo}: ${entry.total}`}
              >
                {analyticsData.osPorTipo.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-6 h-6 text-green-400" />
            <h3 className="text-xl font-bold text-white">Receita Mensal</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analyticsData.receitaMensal}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="mes" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                formatter={(value: number) =>
                  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                }
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="receita"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.3}
                name="Receita"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="w-6 h-6 text-yellow-400" />
          <h3 className="text-xl font-bold text-white">Top Técnicos - Performance</h3>
        </div>

        {analyticsData.topTecnicos.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Nenhum dado de performance disponível</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Posição</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Técnico</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-semibold">OSs Concluídas</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-semibold">Taxa de Sucesso</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.topTecnicos
                  .sort((a, b) => b.os_concluidas - a.os_concluidas)
                  .map((tecnico, index) => (
                    <tr key={tecnico.nome} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                              index === 0
                                ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400'
                                : index === 1
                                ? 'bg-gray-400/20 border border-gray-400/30 text-gray-300'
                                : index === 2
                                ? 'bg-orange-500/20 border border-orange-500/30 text-orange-400'
                                : 'bg-blue-500/20 border border-blue-500/30 text-blue-400'
                            }`}
                          >
                            {index + 1}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-white font-medium">{tecnico.nome}</td>
                      <td className="py-4 px-4 text-center">
                        <span className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 font-bold">
                          {tecnico.os_concluidas}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`px-3 py-1 rounded-full font-bold ${
                            tecnico.taxa_sucesso >= 80
                              ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                              : tecnico.taxa_sucesso >= 60
                              ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400'
                              : 'bg-red-500/20 border border-red-500/30 text-red-400'
                          }`}
                        >
                          {tecnico.taxa_sucesso}%
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
