import { Activity, AlertTriangle, CheckCircle, Clock, TrendingUp, Users, Calendar } from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChartData {
  date: string;
  criadas: number;
  fechadas: number;
}

interface TecnicoData {
  nome: string;
  total: number;
}

interface TipoData {
  name: string;
  value: number;
}

export default function DashboardExecutivo() {
  const { selectedUnidade, refreshKey } = useOtimizador();
  const [kpis, setKpis] = useState({
    osDoDia: 0,
    osEmAndamento: 0,
    osConcluidas: 0,
    osAtrasadas: 0,
    checkoutsPendentes: 0,
    gisPendentes: 0
  });

  const [dataInicio, setDataInicio] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });

  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);

  const [chartOsCriadas, setChartOsCriadas] = useState<ChartData[]>([]);
  const [chartOsPorTecnico, setChartOsPorTecnico] = useState<TecnicoData[]>([]);
  const [chartOsPorTipo, setChartOsPorTipo] = useState<TipoData[]>([]);
  const [loadingCharts, setLoadingCharts] = useState(false);

  useEffect(() => {
    if (selectedUnidade) {
      loadKPIs();
      loadChartData();
    }
  }, [selectedUnidade, refreshKey, dataInicio, dataFim]);

  const loadKPIs = async () => {
    if (!selectedUnidade) return;

    try {
      const hoje = new Date().toISOString().split('T')[0];

      const { data: osHoje } = await supabase
        .from('os')
        .select('id, coluna_kanban')
        .eq('unidade_id', selectedUnidade)
        .eq('data_agendamento', hoje)
        .neq('coluna_kanban', 'os_fechada');

      const emAndamento = osHoje?.filter(os => os.coluna_kanban === 'em_atendimento').length || 0;
      const concluidas = osHoje?.filter(os => os.coluna_kanban === 'finalizada').length || 0;

      setKpis({
        osDoDia: osHoje?.length || 0,
        osEmAndamento: emAndamento,
        osConcluidas: concluidas,
        osAtrasadas: 0,
        checkoutsPendentes: 0,
        gisPendentes: 0
      });
    } catch (error) {
    }
  };

  const loadChartData = async () => {
    if (!selectedUnidade) return;

    setLoadingCharts(true);
    try {
      const { data: osData } = await supabase
        .from('os')
        .select('created_at, coluna_kanban, tipo_atendimento, tecnico_agendado_id, usuarios!os_tecnico_agendado_id_fkey(nome)')
        .eq('unidade_id', selectedUnidade)
        .gte('created_at', dataInicio)
        .lte('created_at', dataFim + 'T23:59:59')
        .order('created_at');

      const osPorDia = new Map<string, { criadas: number; fechadas: number }>();
      const osPorTecnico = new Map<string, number>();
      const osPorTipo = { IH: 0, CI: 0 };

      osData?.forEach(os => {
        const date = os.created_at.split('T')[0];

        if (!osPorDia.has(date)) {
          osPorDia.set(date, { criadas: 0, fechadas: 0 });
        }
        const dayData = osPorDia.get(date)!;
        dayData.criadas++;

        if (os.coluna_kanban === 'os_fechada') {
          dayData.fechadas++;
        }

        if (os.usuarios?.nome) {
          osPorTecnico.set(os.usuarios.nome, (osPorTecnico.get(os.usuarios.nome) || 0) + 1);
        }

        if (os.tipo_atendimento === 'IH' || os.tipo_atendimento === 'CI') {
          osPorTipo[os.tipo_atendimento]++;
        }
      });

      const chartDataCriadas: ChartData[] = [];
      const start = new Date(dataInicio);
      const end = new Date(dataFim);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const data = osPorDia.get(dateStr) || { criadas: 0, fechadas: 0 };
        chartDataCriadas.push({
          date: new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          criadas: data.criadas,
          fechadas: data.fechadas
        });
      }

      const chartDataTecnicos: TecnicoData[] = Array.from(osPorTecnico.entries())
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      const chartDataTipos: TipoData[] = [
        { name: 'In-Home (IH)', value: osPorTipo.IH },
        { name: 'Carry-In (CI)', value: osPorTipo.CI }
      ];

      setChartOsCriadas(chartDataCriadas);
      setChartOsPorTecnico(chartDataTecnicos);
      setChartOsPorTipo(chartDataTipos);
    } catch (error) {
    } finally {
      setLoadingCharts(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">
            Dashboard Executivo
          </h2>
          <p className="text-gray-400 mt-1">Visão 360° da operação em tempo real</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6 hover:shadow-lg hover:shadow-cyan-500/20 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">OS do Dia</p>
              <p className="text-4xl font-bold text-cyan-400 mt-2">{kpis.osDoDia}</p>
            </div>
            <Activity className="w-12 h-12 text-cyan-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-6 hover:shadow-lg hover:shadow-blue-500/20 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Em Andamento</p>
              <p className="text-4xl font-bold text-blue-400 mt-2">{kpis.osEmAndamento}</p>
            </div>
            <Clock className="w-12 h-12 text-blue-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-6 hover:shadow-lg hover:shadow-green-500/20 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Concluídas</p>
              <p className="text-4xl font-bold text-green-400 mt-2">{kpis.osConcluidas}</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-6 hover:shadow-lg hover:shadow-yellow-500/20 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Checkouts Pendentes</p>
              <p className="text-4xl font-bold text-yellow-400 mt-2">{kpis.checkoutsPendentes}</p>
            </div>
            <AlertTriangle className="w-12 h-12 text-yellow-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6 hover:shadow-lg hover:shadow-purple-500/20 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">GIs Pendentes</p>
              <p className="text-4xl font-bold text-purple-400 mt-2">{kpis.gisPendentes}</p>
            </div>
            <Users className="w-12 h-12 text-purple-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/30 rounded-xl p-6 hover:shadow-lg hover:shadow-red-500/20 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Atrasadas</p>
              <p className="text-4xl font-bold text-red-400 mt-2">{kpis.osAtrasadas}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-red-400 opacity-50" />
          </div>
        </div>
      </div>

      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Calendar className="w-6 h-6 text-cyan-400" />
          <h3 className="text-xl font-bold text-white">Filtros de Período</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-sm mb-2 block">Data Início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-2 block">Data Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {loadingCharts ? (
        <div className="flex items-center justify-center h-64">
          <div className="futuristic-loader"></div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">OSs Criadas vs Fechadas por Dia</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartOsCriadas}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#F3F4F6' }}
                />
                <Legend />
                <Area type="monotone" dataKey="criadas" stroke="#06B6D4" fill="#06B6D4" fillOpacity={0.3} name="Criadas" />
                <Area type="monotone" dataKey="fechadas" stroke="#10B981" fill="#10B981" fillOpacity={0.3} name="Fechadas" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">OSs por Técnico (Top 10)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartOsPorTecnico} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                  <YAxis type="category" dataKey="nome" stroke="#9CA3AF" style={{ fontSize: '10px' }} width={120} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#F3F4F6' }}
                  />
                  <Bar dataKey="total" fill="#3B82F6" name="Total OSs" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Distribuição por Tipo de Atendimento</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartOsPorTipo}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="#0EA5E9" />
                    <Cell fill="#F59E0B" />
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">Linha do Tempo - OSs Criadas</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartOsCriadas}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#F3F4F6' }}
                />
                <Legend />
                <Line type="monotone" dataKey="criadas" stroke="#06B6D4" strokeWidth={2} dot={{ fill: '#06B6D4', r: 4 }} name="Criadas" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
