import { Clock, MapPin, Route, TrendingUp, Calendar, Timer } from 'lucide-react';
import type { OptimizedRoute } from '../../lib/routeOptimizerService';

interface RouteMetricsProps {
  metrics: OptimizedRoute['metrics'];
  lastCalculated?: string | null;
  isCalculating?: boolean;
}

export function RouteMetrics({ metrics, lastCalculated, isCalculating }: RouteMetricsProps) {
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date().getTime();
    const then = new Date(timestamp).getTime();
    const diffMinutes = Math.floor((now - then) / 1000 / 60);

    if (diffMinutes < 1) return 'agora mesmo';
    if (diffMinutes === 1) return 'há 1 minuto';
    if (diffMinutes < 60) return `há ${diffMinutes} minutos`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return 'há 1 hora';
    return `há ${diffHours} horas`;
  };

  const completionPercentage =
    metrics.osCount > 0
      ? Math.round((metrics.completedCount / metrics.osCount) * 100)
      : 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-900">Métricas da Rota</h3>
        {isCalculating && (
          <div className="flex items-center gap-2 text-blue-600 text-sm">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Recalculando...</span>
          </div>
        )}
        {lastCalculated && !isCalculating && (
          <div className="text-xs text-slate-500">
            Atualizado {formatRelativeTime(lastCalculated)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Route className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Distância</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">
            {metrics.totalKm.toFixed(1)}
            <span className="text-sm font-normal ml-1">km</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-900">Tempo</span>
          </div>
          <div className="text-2xl font-bold text-green-900">
            {metrics.totalHours.toFixed(1)}
            <span className="text-sm font-normal ml-1">h</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-purple-900">OSs</span>
          </div>
          <div className="text-2xl font-bold text-purple-900">
            {metrics.osCount}
            <span className="text-sm font-normal ml-1">paradas</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-medium text-orange-900">Progresso</span>
          </div>
          <div className="text-2xl font-bold text-orange-900">
            {completionPercentage}
            <span className="text-sm font-normal ml-1">%</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Progresso da Jornada</span>
            <span className="text-sm text-slate-600">
              {metrics.completedCount} de {metrics.osCount} concluídas
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Início Previsto</p>
              <p className="text-sm font-semibold text-slate-900">
                {formatTime(metrics.estimatedStart)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Timer className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Término Previsto</p>
              <p className="text-sm font-semibold text-slate-900">
                {formatTime(metrics.estimatedEnd)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {metrics.osCount > 0 && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Route className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900 mb-1">
                Rota Otimizada com Google Maps
              </p>
              <p className="text-xs text-blue-700">
                Cálculos baseados em dados reais de tráfego e condições de estrada atualizadas.
                A rota é recalculada automaticamente a cada alteração.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
