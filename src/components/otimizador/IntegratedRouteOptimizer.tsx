import { useState, useEffect, useCallback } from 'react';
import { Save, Play, RefreshCw, AlertCircle, MapPin, Settings } from 'lucide-react';
import { GoogleRouteMapViewer } from './GoogleRouteMapViewer';
import { RouteControlPanel } from './RouteControlPanel';
import { RouteMetrics } from './RouteMetrics';
import { routeKanbanSync, type OS, type RouteColumn } from '../../lib/routeKanbanSync';
import { routeOptimizer, type OptimizedRoute, type RouteConfig } from '../../lib/routeOptimizerService';
import { googleMapsService } from '../../lib/googleMapsService';
import type { Coordinates } from '../../lib/googleMapsService';

interface IntegratedRouteOptimizerProps {
  unidadeId: string;
  usuarioId: string;
}

export function IntegratedRouteOptimizer({
  unidadeId,
  usuarioId
}: IntegratedRouteOptimizerProps) {
  const [baseCoordinates, setBaseCoordinates] = useState<Coordinates | null>(null);
  const [baseAddress, setBaseAddress] = useState<string>('');
  const [availableRoutes, setAvailableRoutes] = useState<RouteColumn[]>([]);
  const [selectedRouteColumns, setSelectedRouteColumns] = useState<string[]>([]);
  const [allOSs, setAllOSs] = useState<OS[]>([]);
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
  const [selectedOS, setSelectedOS] = useState<OS | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<RouteConfig>({
    mode: 'driving',
    considerTraffic: true,
    workdayStart: '08:00',
    workdayEnd: '18:00',
    lunchBreakMinutes: 60
  });

  useEffect(() => {
    loadBaseCoordinates();
    loadAvailableRoutes();
    loadSession();
  }, [unidadeId, usuarioId]);

  useEffect(() => {
    const handleRouteUpdate = (routes: RouteColumn[]) => {
      setAvailableRoutes(routes);
    };

    routeKanbanSync.subscribeToRouteChanges(unidadeId, handleRouteUpdate);

    return () => {
      routeKanbanSync.unsubscribeFromRouteChanges(handleRouteUpdate);
    };
  }, [unidadeId]);

  useEffect(() => {
    if (selectedRouteColumns.length > 0) {
      loadOSsFromRoutes();
    } else {
      setAllOSs([]);
      setOptimizedRoute(null);
    }
  }, [selectedRouteColumns]);

  const loadBaseCoordinates = async () => {
    try {
      const { data: unidade, error } = await import('../../lib/supabase').then(m =>
        m.supabase
          .from('unidades')
          .select('latitude, longitude, endereco')
          .eq('id', unidadeId)
          .single()
      );

      if (error) throw error;

      if (unidade.latitude && unidade.longitude) {
        setBaseCoordinates({
          lat: Number(unidade.latitude),
          lng: Number(unidade.longitude)
        });
        setBaseAddress(unidade.endereco || '');
      } else {
        setError('Coordenadas da base não configuradas. Configure no menu Configurações.');
      }
    } catch (err) {
      setError('Erro ao carregar informações da unidade.');
    }
  };

  const loadAvailableRoutes = async () => {
    const routes = await routeKanbanSync.getRouteColumns(unidadeId);
    setAvailableRoutes(routes);
  };

  const loadOSsFromRoutes = async () => {
    const oss = await routeKanbanSync.getOSFromRoutes(unidadeId, selectedRouteColumns);
    setAllOSs(oss);
  };

  const loadSession = async () => {
    const session = await routeOptimizer.loadSession(unidadeId, usuarioId);
    if (session) {
      setSelectedRouteColumns(session.rotasSelecionadas);
      if (session.config) {
        setConfig(session.config as RouteConfig);
      }
    }
  };

  const handleOptimize = async () => {
    if (!baseCoordinates || allOSs.length === 0) {
      setError('Não há OSs para otimizar ou coordenadas da base não configuradas.');
      return;
    }

    if (!googleMapsService.isConfigured()) {
      setError('Google Maps API não está configurada. Adicione a chave no arquivo .env');
      return;
    }

    setIsCalculating(true);
    setError(null);

    try {
      const result = await routeOptimizer.optimizeRoute(baseCoordinates, allOSs, config);
      setOptimizedRoute(result);

      await routeOptimizer.saveSession(
        unidadeId,
        usuarioId,
        null,
        selectedRouteColumns,
        allOSs,
        result,
        config
      );
    } catch (err) {
      setError('Erro ao calcular rota otimizada. Tente novamente.');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleReorder = async (newSequence: OS[]) => {
    if (!baseCoordinates) return;

    setIsCalculating(true);

    try {
      const result = await routeOptimizer.recalculateRoute(baseCoordinates, newSequence, config);
      setOptimizedRoute(result);

      await routeOptimizer.saveSession(
        unidadeId,
        usuarioId,
        null,
        selectedRouteColumns,
        newSequence,
        result,
        config
      );
    } catch (err) {
    } finally {
      setIsCalculating(false);
    }
  };

  const handleRemoveOS = async (osId: string) => {
    if (!optimizedRoute) return;

    const newSequence = optimizedRoute.sequence.filter(os => os.id !== osId);
    setAllOSs(allOSs.filter(os => os.id !== osId));

    if (newSequence.length > 0 && baseCoordinates) {
      await handleReorder(newSequence);
    } else {
      setOptimizedRoute(null);
    }
  };

  const handleToggleComplete = async (osId: string, completed: boolean) => {
    if (completed) {
      const success = await routeKanbanSync.markOSAsCompleted(osId);
      if (success) {
        setAllOSs(allOSs.map(os =>
          os.id === osId ? { ...os, concluida: true } : os
        ));

        if (optimizedRoute) {
          const updatedSequence = optimizedRoute.sequence.map(os =>
            os.id === osId ? { ...os, concluida: true } : os
          );
          setOptimizedRoute({
            ...optimizedRoute,
            sequence: updatedSequence,
            metrics: {
              ...optimizedRoute.metrics,
              completedCount: optimizedRoute.metrics.completedCount + 1
            }
          });
        }
      }
    }
  };

  const handleRouteSelection = (routeColumn: string) => {
    setSelectedRouteColumns(prev =>
      prev.includes(routeColumn)
        ? prev.filter(r => r !== routeColumn)
        : [...prev, routeColumn]
    );
  };

  if (!googleMapsService.isConfigured()) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="max-w-md p-8 bg-white rounded-lg shadow-lg border border-slate-200">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 text-center mb-2">
            Google Maps não configurado
          </h2>
          <p className="text-slate-600 text-center mb-4">
            Para usar o sistema de otimização de rotas, você precisa configurar a chave da API do Google Maps.
          </p>
          <div className="bg-slate-100 p-4 rounded-lg text-sm font-mono text-slate-800">
            VITE_GOOGLE_MAPS_API_KEY=sua_chave_aqui
          </div>
          <p className="text-xs text-slate-500 text-center mt-4">
            Adicione esta variável no arquivo .env do projeto
          </p>
        </div>
      </div>
    );
  }

  if (!baseCoordinates) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="max-w-md p-8 bg-white rounded-lg shadow-lg border border-slate-200">
          <MapPin className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 text-center mb-2">
            Base não configurada
          </h2>
          <p className="text-slate-600 text-center mb-4">
            Configure as coordenadas da base da unidade para usar o otimizador de rotas.
          </p>
          <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Ir para Configurações
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Otimizador de Rotas com Google Maps
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Base: {baseAddress || 'Endereço não informado'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOptimize}
              disabled={isCalculating || allOSs.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
            >
              {isCalculating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Otimizando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Otimizar Rota
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {availableRoutes.map(route => (
            <button
              key={route.id}
              onClick={() => handleRouteSelection(route.coluna_kanban)}
              className={`
                px-4 py-2 rounded-lg border-2 font-medium transition-all
                ${selectedRouteColumns.includes(route.coluna_kanban)
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                }
              `}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: route.cor }}
                />
                <span>{route.nome}</span>
                {route.os_count !== undefined && (
                  <span className="ml-1 px-2 py-0.5 bg-slate-200 text-slate-700 text-xs rounded-full">
                    {route.os_count}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-12 gap-4 p-6 overflow-hidden">
        <div className="col-span-8 flex flex-col gap-4">
          <div className="flex-1 rounded-lg overflow-hidden shadow-lg border border-slate-200">
            <GoogleRouteMapViewer
              baseCoordinates={baseCoordinates}
              osData={optimizedRoute?.sequence || allOSs}
              polyline={optimizedRoute?.polyline}
              selectedOS={selectedOS}
              onOSClick={setSelectedOS}
              showCompleted={true}
            />
          </div>

          {optimizedRoute && (
            <RouteMetrics
              metrics={optimizedRoute.metrics}
              lastCalculated={new Date().toISOString()}
              isCalculating={isCalculating}
            />
          )}
        </div>

        <div className="col-span-4 flex flex-col">
          <RouteControlPanel
            osSequence={optimizedRoute?.sequence || allOSs}
            onReorder={handleReorder}
            onRemove={handleRemoveOS}
            onToggleComplete={handleToggleComplete}
            onOSSelect={setSelectedOS}
            selectedOS={selectedOS}
          />
        </div>
      </div>
    </div>
  );
}
