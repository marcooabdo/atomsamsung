import { useEffect, useState } from 'react';
import { TrendingUp, Clock, MapPin, Award, BarChart3, Target } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Metrics {
  total_atendimentos: number;
  total_concluidos: number;
  taxa_conclusao: number;
  tempo_medio_minutos: number;
  total_km_percorrido: number;
}

interface DailyMetric {
  data: string;
  total_os_atendidas: number;
  total_os_concluidas: number;
  tempo_medio_atendimento_minutos: number;
  distancia_total_km: number;
}

interface RouteDashboardProps {
  tecnicoId?: string;
  unidadeId?: string;
  periodo?: 'hoje' | '7dias' | '30dias';
}

export function RouteDashboard({ tecnicoId, unidadeId, periodo = '30dias' }: RouteDashboardProps) {
  const { usuario } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [tecnicoId, unidadeId, periodo]);

  const loadMetrics = async () => {
    try {
      setLoading(true);

      const finalTecnicoId = tecnicoId || usuario?.id;

      const { data: metricsData, error: metricsError } = await supabase
        .from('v_route_metrics_technician')
        .select('*')
        .eq('tecnico_id', finalTecnicoId)
        .maybeSingle();

      if (metricsError) throw metricsError;

      setMetrics(metricsData);

      let daysAgo = 30;
      if (periodo === 'hoje') daysAgo = 0;
      if (periodo === '7dias') daysAgo = 7;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      const { data: dailyData, error: dailyError } = await supabase
        .from('route_metrics')
        .select('*')
        .eq('tecnico_id', finalTecnicoId)
        .gte('data', startDate.toISOString().split('T')[0])
        .order('data', { ascending: true });

      if (dailyError) throw dailyError;

      setDailyMetrics(dailyData || []);
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="premium-card p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="premium-card p-6">
        <p className="text-gray-400 text-center">Nenhuma métrica disponível ainda</p>
      </div>
    );
  }

  const calculateTrend = () => {
    if (dailyMetrics.length < 2) return 0;
    const recent = dailyMetrics.slice(-7);
    const older = dailyMetrics.slice(-14, -7);
    if (older.length === 0) return 0;

    const recentAvg = recent.reduce((sum, m) => sum + m.total_os_concluidas, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.total_os_concluidas, 0) / older.length;

    if (olderAvg === 0) return 0;
    return ((recentAvg - olderAvg) / olderAvg) * 100;
  };

  const trend = calculateTrend();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="premium-card p-6 bg-gradient-to-br from-[#00D4FF]/10 to-transparent border border-[#00D4FF]/30">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-[#00D4FF]/20 flex items-center justify-center">
              <Target className="w-6 h-6 text-[#00D4FF]" />
            </div>
            {trend !== 0 && (
              <div className={`flex items-center gap-1 text-xs font-bold ${trend > 0 ? 'text-[#39FF14]' : 'text-[#FF0064]'}`}>
                <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
                {Math.abs(trend).toFixed(1)}%
              </div>
            )}
          </div>
          <h3 className="text-gray-400 text-sm mb-2">Total Atendimentos</h3>
          <p className="text-3xl font-bold text-[#00D4FF]">{metrics.total_atendimentos}</p>
          <p className="text-xs text-gray-500 mt-2">Últimos {periodo === 'hoje' ? '1 dia' : periodo === '7dias' ? '7 dias' : '30 dias'}</p>
        </div>

        <div className="premium-card p-6 bg-gradient-to-br from-[#39FF14]/10 to-transparent border border-[#39FF14]/30">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-[#39FF14]/20 flex items-center justify-center">
              <Award className="w-6 h-6 text-[#39FF14]" />
            </div>
          </div>
          <h3 className="text-gray-400 text-sm mb-2">Taxa de Conclusão</h3>
          <p className="text-3xl font-bold text-[#39FF14]">{metrics.taxa_conclusao?.toFixed(1) || 0}%</p>
          <p className="text-xs text-gray-500 mt-2">{metrics.total_concluidos} de {metrics.total_atendimentos} concluídos</p>
        </div>

        <div className="premium-card p-6 bg-gradient-to-br from-[#FFBF00]/10 to-transparent border border-[#FFBF00]/30">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-[#FFBF00]/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-[#FFBF00]" />
            </div>
          </div>
          <h3 className="text-gray-400 text-sm mb-2">Tempo Médio</h3>
          <p className="text-3xl font-bold text-[#FFBF00]">
            {metrics.tempo_medio_minutos ? `${metrics.tempo_medio_minutos}min` : 'N/A'}
          </p>
          <p className="text-xs text-gray-500 mt-2">Por atendimento</p>
        </div>

        <div className="premium-card p-6 bg-gradient-to-br from-[#FF0064]/10 to-transparent border border-[#FF0064]/30">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-[#FF0064]/20 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-[#FF0064]" />
            </div>
          </div>
          <h3 className="text-gray-400 text-sm mb-2">Distância Total</h3>
          <p className="text-3xl font-bold text-[#FF0064]">
            {metrics.total_km_percorrido?.toFixed(1) || 0} km
          </p>
          <p className="text-xs text-gray-500 mt-2">Percorridos</p>
        </div>

        <div className="premium-card p-6 bg-gradient-to-br from-[#9D4EDD]/10 to-transparent border border-[#9D4EDD]/30 col-span-1 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#9D4EDD]/20 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-[#9D4EDD]" />
              </div>
              <div>
                <h3 className="text-white font-bold">Desempenho Diário</h3>
                <p className="text-xs text-gray-400">Últimos {dailyMetrics.length} dias</p>
              </div>
            </div>
          </div>

          {dailyMetrics.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto cyber-scrollbar">
              {dailyMetrics.slice(-7).reverse().map((metric, index) => {
                const date = new Date(metric.data);
                const isToday = date.toDateString() === new Date().toDateString();

                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded ${
                      isToday ? 'bg-[#9D4EDD]/20 border border-[#9D4EDD]/40' : 'bg-black/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-semibold ${isToday ? 'text-[#9D4EDD]' : 'text-gray-300'}`}>
                        {date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </span>
                      {isToday && (
                        <span className="text-xs px-2 py-1 rounded bg-[#9D4EDD]/20 text-[#9D4EDD] border border-[#9D4EDD]/40">
                          HOJE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-400">
                        <span className="text-[#39FF14] font-bold">{metric.total_os_concluidas}</span>
                        /{metric.total_os_atendidas} OS
                      </span>
                      {metric.tempo_medio_atendimento_minutos && (
                        <span className="text-gray-400">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {metric.tempo_medio_atendimento_minutos}min
                        </span>
                      )}
                      {metric.distancia_total_km && (
                        <span className="text-gray-400">
                          <MapPin className="w-3 h-3 inline mr-1" />
                          {metric.distancia_total_km.toFixed(1)}km
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-4">Nenhum dado disponível</p>
          )}
        </div>
      </div>
    </div>
  );
}
