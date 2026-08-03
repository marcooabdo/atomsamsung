import { useState, useEffect, useCallback } from 'react';
import { Activity, AlertTriangle, Clock, TrendingDown, MapPin, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface MonitorData {
  plano_id: string;
  nome_rota: string;
  nome_tecnico: string;
  total_paradas: number;
  concluidas: number;
  em_andamento: number;
  desvio_acumulado_min: number;
  proxima_parada?: {
    cliente_nome: string;
    cidade: string;
    tipo_reparo: string;
    horario_previsto: string;
  };
  alerta?: string;
}

interface Props {
  unidadeId: string;
}

export default function GIARotaMonitor({ unidadeId }: Props) {
  const [monitores, setMonitores] = useState<MonitorData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadActiveRoutes = useCallback(async () => {
    try {
      const { data: planos } = await supabase
        .from('gia_planos_rota')
        .select('id, nome_rota, nome_tecnico')
        .eq('unidade_id', unidadeId)
        .eq('status', 'em_andamento');

      if (!planos || planos.length === 0) {
        setMonitores([]);
        setLoading(false);
        return;
      }

      const monitorPromises = planos.map(async (plano) => {
        const { data: paradas } = await supabase
          .from('gia_plano_paradas')
          .select('status, desvio_minutos, cliente_nome, cidade, tipo_reparo, horario_previsto_chegada, data_prevista')
          .eq('plano_id', plano.id)
          .order('dia')
          .order('ordem');

        const all = paradas || [];
        const concluidas = all.filter(p => p.status === 'concluido').length;
        const emAndamento = all.filter(p => p.status === 'em_andamento').length;
        const desvioTotal = all.reduce((sum, p) => sum + (p.desvio_minutos || 0), 0);

        const proxima = all.find(p => p.status === 'confirmado' || p.status === 'pendente');

        let alerta: string | undefined;
        if (desvioTotal > 60) {
          alerta = `Atraso acumulado de ${desvioTotal} minutos. A rota pode não ser concluída no prazo.`;
        } else if (desvioTotal > 30) {
          alerta = `Atraso de ${desvioTotal} minutos detectado. Monitorando.`;
        }

        return {
          plano_id: plano.id,
          nome_rota: plano.nome_rota,
          nome_tecnico: plano.nome_tecnico,
          total_paradas: all.length,
          concluidas,
          em_andamento: emAndamento,
          desvio_acumulado_min: desvioTotal,
          proxima_parada: proxima ? {
            cliente_nome: proxima.cliente_nome || 'N/A',
            cidade: proxima.cidade || 'N/A',
            tipo_reparo: proxima.tipo_reparo || 'N/A',
            horario_previsto: proxima.horario_previsto_chegada || '',
          } : undefined,
          alerta,
        } as MonitorData;
      });

      const results = await Promise.all(monitorPromises);
      setMonitores(results);
    } catch {
      setMonitores([]);
    } finally {
      setLoading(false);
    }
  }, [unidadeId]);

  useEffect(() => {
    loadActiveRoutes();
    const interval = setInterval(loadActiveRoutes, 60000);
    return () => clearInterval(interval);
  }, [loadActiveRoutes]);

  if (loading) return null;
  if (monitores.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-5 h-5 text-green-400 animate-pulse" />
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Rotas Ativas - Tempo Real</h3>
      </div>

      {monitores.map(monitor => (
        <div
          key={monitor.plano_id}
          className={`p-4 rounded-xl border transition-all ${
            monitor.alerta
              ? 'bg-amber-500/5 border-amber-500/30'
              : 'bg-green-500/5 border-green-500/20'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-semibold text-white">{monitor.nome_rota}</span>
              <span className="text-gray-400 text-sm ml-2">({monitor.nome_tecnico})</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-green-300 text-sm font-medium">
                {monitor.concluidas}/{monitor.total_paradas}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${(monitor.concluidas / monitor.total_paradas) * 100}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 text-center text-xs mb-3">
            <div className="bg-gray-800/50 rounded-lg p-2">
              <p className="text-green-300 font-bold">{monitor.concluidas}</p>
              <p className="text-gray-500">Concluídas</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-2">
              <p className="text-amber-300 font-bold">{monitor.em_andamento}</p>
              <p className="text-gray-500">Em Atendim.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-2">
              <p className={`font-bold ${monitor.desvio_acumulado_min > 30 ? 'text-red-300' : 'text-gray-300'}`}>
                {monitor.desvio_acumulado_min > 0 ? `+${monitor.desvio_acumulado_min}` : '0'} min
              </p>
              <p className="text-gray-500">Desvio</p>
            </div>
          </div>

          {monitor.proxima_parada && (
            <div className="bg-gray-800/50 rounded-lg p-3 flex items-center gap-3">
              <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <div className="text-xs">
                <p className="text-gray-300">Próxima: <span className="text-white">{monitor.proxima_parada.cliente_nome}</span> ({monitor.proxima_parada.cidade})</p>
                <p className="text-gray-500">{monitor.proxima_parada.tipo_reparo}{monitor.proxima_parada.horario_previsto ? ` | Previsto: ${monitor.proxima_parada.horario_previsto}` : ''}</p>
              </div>
            </div>
          )}

          {monitor.alerta && (
            <div className="flex items-start gap-2 mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-300 text-xs">{monitor.alerta}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
