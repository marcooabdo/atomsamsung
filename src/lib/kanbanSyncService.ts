import { supabase } from './supabase';

export interface SyncLog {
  id: string;
  timestamp: string;
  tipo: string;
  origem: string;
  destino: string;
  os_id?: string;
  status: string;
  detalhes: any;
  erro_mensagem?: string;
}

export interface SyncQueueItem {
  id: string;
  tipo: string;
  dados: any;
  tentativas: number;
  status: string;
}

export class KanbanSyncService {
  private static instance: KanbanSyncService;
  private syncChannel: any;

  private constructor() {
    this.setupRealtimeSync();
  }

  static getInstance(): KanbanSyncService {
    if (!KanbanSyncService.instance) {
      KanbanSyncService.instance = new KanbanSyncService();
    }
    return KanbanSyncService.instance;
  }

  private setupRealtimeSync() {
    this.syncChannel = supabase
      .channel('sync_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'os_anexos'
        },
        (payload) => {
          this.handleAnexoChange(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'os'
        },
        (payload) => {
          this.handleOSChange(payload);
        }
      )
      .subscribe();
  }

  private async handleAnexoChange(payload: any) {
  }

  private async handleOSChange(payload: any) {
  }

  async syncFotoToKanban(anexoId: string, osId: string): Promise<boolean> {
    try {
      const { data: anexo } = await supabase
        .from('os_anexos')
        .select('*')
        .eq('id', anexoId)
        .single();

      if (!anexo) return false;

      const { data: os } = await supabase
        .from('os')
        .select('unidade_id')
        .eq('id', osId)
        .single();

      if (!os) return false;

      await supabase.from('sync_queue').insert({
        tipo: 'foto',
        dados: {
          anexo_id: anexoId,
          os_id: osId,
          url: anexo.url
        },
        unidade_id: os.unidade_id
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  async syncStatusChange(osId: string, oldStatus: string, newStatus: string): Promise<boolean> {
    try {
      const { data: os } = await supabase
        .from('os')
        .select('unidade_id')
        .eq('id', osId)
        .single();

      if (!os) return false;

      await supabase.from('sync_logs').insert({
        tipo: 'status',
        origem: 'otimizador',
        destino: 'kanban',
        os_id: osId,
        status: 'sucesso',
        detalhes: {
          status_anterior: oldStatus,
          status_novo: newStatus
        },
        unidade_id: os.unidade_id
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  async getSyncLogs(unidadeId: string, limit: number = 50): Promise<SyncLog[]> {
    try {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('unidade_id', unidadeId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      return [];
    }
  }

  async getSyncQueue(unidadeId: string): Promise<SyncQueueItem[]> {
    try {
      const { data, error } = await supabase
        .from('sync_queue')
        .select('*')
        .eq('unidade_id', unidadeId)
        .eq('status', 'pendente')
        .order('criado_em', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      return [];
    }
  }

  async retryFailedSync(syncId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sync_queue')
        .update({
          status: 'pendente',
          processar_apos: new Date().toISOString()
        })
        .eq('id', syncId);

      return !error;
    } catch (error) {
      return false;
    }
  }

  disconnect() {
    if (this.syncChannel) {
      supabase.removeChannel(this.syncChannel);
    }
  }
}

export const kanbanSyncService = KanbanSyncService.getInstance();
