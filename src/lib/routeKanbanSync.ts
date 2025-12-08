import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface RouteColumn {
  id: string;
  nome: string;
  cor: string;
  coluna_kanban: string;
  unidade_id: string | null;
  cidades: string[];
  ativa: boolean;
  os_count?: number;
}

interface OS {
  id: string;
  numero_os: string;
  cliente_nome: string;
  cliente_endereco: string;
  cliente_cidade: string;
  cliente_cep: string;
  lat: number | null;
  lng: number | null;
  coluna_kanban: string;
  tipo_atendimento: string;
  prioridade: number | null;
  concluida: boolean;
}

type RouteUpdateCallback = (routes: RouteColumn[]) => void;
type OSUpdateCallback = (osData: OS[]) => void;

class RouteKanbanSyncService {
  private routeChannel: RealtimeChannel | null = null;
  private osChannel: RealtimeChannel | null = null;
  private routeCallbacks: Set<RouteUpdateCallback> = new Set();
  private osCallbacks: Set<OSUpdateCallback> = new Set();

  async getRouteColumns(unidadeId: string): Promise<RouteColumn[]> {
    try {
      const { data, error } = await supabase
        .from('rotas')
        .select('*')
        .or(`unidade_id.eq.${unidadeId},unidade_id.is.null`)
        .eq('ativa', true)
        .order('nome');

      if (error) throw error;

      const routesWithCount = await Promise.all(
        (data || []).map(async (route) => {
          const { count } = await supabase
            .from('os')
            .select('id', { count: 'exact', head: true })
            .eq('coluna_kanban', route.coluna_kanban)
            .eq('tipo_atendimento', 'IH')
            .eq('unidade_id', unidadeId);

          return {
            ...route,
            os_count: count || 0
          };
        })
      );

      return routesWithCount;
    } catch (error) {
      console.error('Erro ao buscar colunas de rota:', error);
      return [];
    }
  }

  async getOSFromRoutes(unidadeId: string, routeColumns: string[]): Promise<OS[]> {
    try {
      if (routeColumns.length === 0) return [];

      const { data, error } = await supabase
        .from('os')
        .select('id, numero_os, cliente_nome, cliente_endereco, cliente_cidade, cliente_cep, lat, lng, coluna_kanban, tipo_atendimento, prioridade, concluida')
        .eq('unidade_id', unidadeId)
        .eq('tipo_atendimento', 'IH')
        .in('coluna_kanban', routeColumns)
        .order('prioridade', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).filter(os => os.lat !== null && os.lng !== null) as OS[];
    } catch (error) {
      console.error('Erro ao buscar OSs das rotas:', error);
      return [];
    }
  }

  async markOSAsCompleted(osId: string): Promise<boolean> {
    try {
      const { error: osError } = await supabase
        .from('os')
        .update({
          concluida: true,
          concluida_em: new Date().toISOString(),
          coluna_kanban: 'fechar_os'
        })
        .eq('id', osId);

      if (osError) throw osError;

      return true;
    } catch (error) {
      console.error('Erro ao marcar OS como concluída:', error);
      return false;
    }
  }

  async markOSAsIncomplete(osId: string, originalColumn: string): Promise<boolean> {
    try {
      const { error: osError } = await supabase
        .from('os')
        .update({
          concluida: false,
          concluida_em: null,
          coluna_kanban: originalColumn
        })
        .eq('id', osId);

      if (osError) throw osError;

      return true;
    } catch (error) {
      console.error('Erro ao desfazer conclusão da OS:', error);
      return false;
    }
  }

  async updateOSSequence(osIds: string[]): Promise<boolean> {
    try {
      const updates = osIds.map((osId, index) =>
        supabase
          .from('os')
          .update({ ordem_visita: index + 1 })
          .eq('id', osId)
      );

      await Promise.all(updates);
      return true;
    } catch (error) {
      console.error('Erro ao atualizar sequência de OSs:', error);
      return false;
    }
  }

  async geocodeOSAddress(osId: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const { data: os, error } = await supabase
        .from('os')
        .select('cliente_endereco, cliente_numero, cliente_bairro, cliente_cidade, cliente_estado, cliente_cep')
        .eq('id', osId)
        .single();

      if (error || !os) return null;

      const address = [
        os.cliente_endereco,
        os.cliente_numero,
        os.cliente_bairro,
        os.cliente_cidade,
        os.cliente_estado,
        os.cliente_cep
      ].filter(Boolean).join(', ');

      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.warn('Google Maps API key não configurada');
        return null;
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      );

      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const location = data.results[0].geometry.location;

        await supabase
          .from('os')
          .update({
            lat: location.lat,
            lng: location.lng
          })
          .eq('id', osId);

        return { lat: location.lat, lng: location.lng };
      }

      return null;
    } catch (error) {
      console.error('Erro ao geocodificar endereço da OS:', error);
      return null;
    }
  }

  subscribeToRouteChanges(unidadeId: string, callback: RouteUpdateCallback): void {
    this.routeCallbacks.add(callback);

    if (this.routeChannel) {
      return;
    }

    this.routeChannel = supabase
      .channel('rotas-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rotas',
          filter: `unidade_id=eq.${unidadeId}`
        },
        async () => {
          const routes = await this.getRouteColumns(unidadeId);
          this.routeCallbacks.forEach(cb => cb(routes));
        }
      )
      .subscribe();
  }

  subscribeToOSChanges(unidadeId: string, callback: OSUpdateCallback): void {
    this.osCallbacks.add(callback);

    if (this.osChannel) {
      return;
    }

    this.osChannel = supabase
      .channel('os-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'os',
          filter: `unidade_id=eq.${unidadeId}`
        },
        async (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const os = payload.new as OS;
            if (os.tipo_atendimento === 'IH' && os.coluna_kanban.startsWith('rota_')) {
              this.osCallbacks.forEach(cb => cb([os]));
            }
          }
        }
      )
      .subscribe();
  }

  unsubscribeFromRouteChanges(callback: RouteUpdateCallback): void {
    this.routeCallbacks.delete(callback);

    if (this.routeCallbacks.size === 0 && this.routeChannel) {
      supabase.removeChannel(this.routeChannel);
      this.routeChannel = null;
    }
  }

  unsubscribeFromOSChanges(callback: OSUpdateCallback): void {
    this.osCallbacks.delete(callback);

    if (this.osCallbacks.size === 0 && this.osChannel) {
      supabase.removeChannel(this.osChannel);
      this.osChannel = null;
    }
  }

  cleanup(): void {
    if (this.routeChannel) {
      supabase.removeChannel(this.routeChannel);
      this.routeChannel = null;
    }

    if (this.osChannel) {
      supabase.removeChannel(this.osChannel);
      this.osChannel = null;
    }

    this.routeCallbacks.clear();
    this.osCallbacks.clear();
  }
}

export const routeKanbanSync = new RouteKanbanSyncService();

export type { RouteColumn, OS, RouteUpdateCallback, OSUpdateCallback };
