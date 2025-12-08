import { googleMapsService, type Coordinates } from './googleMapsService';
import { routeKanbanSync, type OS } from './routeKanbanSync';
import { supabase } from './supabase';

interface RouteConfig {
  mode?: 'driving' | 'walking' | 'bicycling';
  avoid?: 'tolls' | 'highways' | 'ferries';
  considerTraffic?: boolean;
  departureTime?: Date;
  workdayStart?: string;
  workdayEnd?: string;
  lunchBreakMinutes?: number;
}

interface OptimizedRoute {
  sequence: OS[];
  totalDistance: number;
  totalDuration: number;
  polyline: string;
  legs: {
    os: OS | null;
    distance: number;
    duration: number;
    arrivalTime: Date;
    departureTime: Date;
  }[];
  metrics: {
    totalKm: number;
    totalHours: number;
    estimatedStart: Date;
    estimatedEnd: Date;
    osCount: number;
    completedCount: number;
  };
}

interface SessionData {
  id: string;
  unidadeId: string;
  usuarioId: string;
  tecnicoId: string | null;
  rotasSelecionadas: string[];
  osIds: string[];
  osSequence: string[];
  osCompleted: string[];
  config: RouteConfig;
  metrics: any;
  polyline: string | null;
  lastCalculatedAt: string | null;
}

class RouteOptimizerService {
  async optimizeRoute(
    baseCoordinates: Coordinates,
    osData: OS[],
    config: RouteConfig = {}
  ): Promise<OptimizedRoute> {
    if (osData.length === 0) {
      return this.createEmptyRoute(baseCoordinates);
    }

    const validOSs = osData.filter(os => os.lat !== null && os.lng !== null);

    if (validOSs.length === 0) {
      return this.createEmptyRoute(baseCoordinates);
    }

    try {
      const waypoints: Coordinates[] = validOSs.map(os => ({
        lat: os.lat!,
        lng: os.lng!
      }));

      const directionsResult = await googleMapsService.getOptimizedRoute(
        waypoints,
        baseCoordinates,
        baseCoordinates,
        {
          mode: config.mode || 'driving',
          avoid: config.avoid,
          optimize: true,
          trafficModel: config.considerTraffic ? 'best_guess' : undefined,
          departureTime: config.departureTime
        }
      );

      const optimizedSequence = directionsResult.waypointOrder.map(
        index => validOSs[index]
      );

      const startTime = this.parseTime(config.workdayStart || '08:00');
      let currentTime = new Date(startTime);

      const legs = directionsResult.legs.map((leg, index) => {
        const arrivalTime = new Date(currentTime);
        currentTime = new Date(currentTime.getTime() + leg.duration * 1000);

        const os = index === 0 ? null : optimizedSequence[index - 1];

        if (os && index > 0) {
          const serviceTime = 60 * 60 * 1000;
          currentTime = new Date(currentTime.getTime() + serviceTime);
        }

        return {
          os,
          distance: leg.distance,
          duration: leg.duration,
          arrivalTime,
          departureTime: new Date(currentTime)
        };
      });

      const totalKm = directionsResult.totalDistance / 1000;
      const totalHours = directionsResult.totalDuration / 3600;

      return {
        sequence: optimizedSequence,
        totalDistance: directionsResult.totalDistance,
        totalDuration: directionsResult.totalDuration,
        polyline: directionsResult.polyline,
        legs,
        metrics: {
          totalKm: Math.round(totalKm * 100) / 100,
          totalHours: Math.round(totalHours * 100) / 100,
          estimatedStart: startTime,
          estimatedEnd: currentTime,
          osCount: validOSs.length,
          completedCount: validOSs.filter(os => os.concluida).length
        }
      };
    } catch (error) {
      console.error('Erro ao otimizar rota:', error);
      return this.createFallbackRoute(baseCoordinates, validOSs, config);
    }
  }

  private createEmptyRoute(baseCoordinates: Coordinates): OptimizedRoute {
    return {
      sequence: [],
      totalDistance: 0,
      totalDuration: 0,
      polyline: '',
      legs: [],
      metrics: {
        totalKm: 0,
        totalHours: 0,
        estimatedStart: new Date(),
        estimatedEnd: new Date(),
        osCount: 0,
        completedCount: 0
      }
    };
  }

  private createFallbackRoute(
    baseCoordinates: Coordinates,
    osData: OS[],
    config: RouteConfig
  ): OptimizedRoute {
    const startTime = this.parseTime(config.workdayStart || '08:00');
    let currentTime = new Date(startTime);
    let totalDistance = 0;
    let totalDuration = 0;

    const legs = osData.map((os, index) => {
      const fromCoords = index === 0 ? baseCoordinates : { lat: osData[index - 1].lat!, lng: osData[index - 1].lng! };
      const toCoords = { lat: os.lat!, lng: os.lng! };

      const distance = this.calculateDistance(fromCoords, toCoords);
      const duration = (distance / 40000) * 3600;

      totalDistance += distance;
      totalDuration += duration;

      const arrivalTime = new Date(currentTime);
      currentTime = new Date(currentTime.getTime() + duration * 1000 + 3600 * 1000);

      return {
        os,
        distance,
        duration,
        arrivalTime,
        departureTime: new Date(currentTime)
      };
    });

    const returnDistance = this.calculateDistance(
      { lat: osData[osData.length - 1].lat!, lng: osData[osData.length - 1].lng! },
      baseCoordinates
    );
    totalDistance += returnDistance;
    totalDuration += (returnDistance / 40000) * 3600;

    return {
      sequence: osData,
      totalDistance,
      totalDuration,
      polyline: '',
      legs,
      metrics: {
        totalKm: Math.round(totalDistance / 1000 * 100) / 100,
        totalHours: Math.round(totalDuration / 3600 * 100) / 100,
        estimatedStart: startTime,
        estimatedEnd: currentTime,
        osCount: osData.length,
        completedCount: osData.filter(os => os.concluida).length
      }
    };
  }

  private calculateDistance(from: Coordinates, to: Coordinates): number {
    const R = 6371000;
    const lat1 = (from.lat * Math.PI) / 180;
    const lat2 = (to.lat * Math.PI) / 180;
    const deltaLat = ((to.lat - from.lat) * Math.PI) / 180;
    const deltaLng = ((to.lng - from.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private parseTime(timeString: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  async saveSession(
    unidadeId: string,
    usuarioId: string,
    tecnicoId: string | null,
    rotasSelecionadas: string[],
    osData: OS[],
    optimizedRoute: OptimizedRoute,
    config: RouteConfig
  ): Promise<string | null> {
    try {
      const { data: existingSession } = await supabase
        .from('route_sessions')
        .select('id')
        .eq('unidade_id', unidadeId)
        .eq('usuario_id', usuarioId)
        .maybeSingle();

      const sessionData = {
        unidade_id: unidadeId,
        usuario_id: usuarioId,
        tecnico_id: tecnicoId,
        rotas_selecionadas: rotasSelecionadas,
        os_ids: osData.map(os => os.id),
        os_sequence: optimizedRoute.sequence.map(os => os.id),
        os_completed: osData.filter(os => os.concluida).map(os => os.id),
        config: config,
        metrics: optimizedRoute.metrics,
        polyline: optimizedRoute.polyline,
        last_calculated_at: new Date().toISOString()
      };

      if (existingSession) {
        const { error } = await supabase
          .from('route_sessions')
          .update(sessionData)
          .eq('id', existingSession.id);

        if (error) throw error;
        return existingSession.id;
      } else {
        const { data, error } = await supabase
          .from('route_sessions')
          .insert(sessionData)
          .select('id')
          .single();

        if (error) throw error;
        return data.id;
      }
    } catch (error) {
      console.error('Erro ao salvar sessão:', error);
      return null;
    }
  }

  async loadSession(unidadeId: string, usuarioId: string): Promise<SessionData | null> {
    try {
      const { data, error } = await supabase
        .from('route_sessions')
        .select('*')
        .eq('unidade_id', unidadeId)
        .eq('usuario_id', usuarioId)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        unidadeId: data.unidade_id,
        usuarioId: data.usuario_id,
        tecnicoId: data.tecnico_id,
        rotasSelecionadas: data.rotas_selecionadas,
        osIds: data.os_ids,
        osSequence: data.os_sequence,
        osCompleted: data.os_completed,
        config: data.config,
        metrics: data.metrics,
        polyline: data.polyline,
        lastCalculatedAt: data.last_calculated_at
      };
    } catch (error) {
      console.error('Erro ao carregar sessão:', error);
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('route_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Erro ao deletar sessão:', error);
      return false;
    }
  }

  async recalculateRoute(
    baseCoordinates: Coordinates,
    osSequence: OS[],
    config: RouteConfig = {}
  ): Promise<OptimizedRoute> {
    return this.optimizeRoute(baseCoordinates, osSequence, {
      ...config,
      departureTime: new Date()
    });
  }
}

export const routeOptimizer = new RouteOptimizerService();

export type { RouteConfig, OptimizedRoute, SessionData };
