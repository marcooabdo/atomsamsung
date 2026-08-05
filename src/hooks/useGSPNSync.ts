import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface SyncRecord {
  id: string;
  os_id: string;
  status: 'em_andamento' | 'concluido' | 'erro';
  iniciado_em: string;
  finalizado_em: string | null;
  mudancas: string[] | null;
  novos_anexos: number | null;
  erro: string | null;
}

interface UseGSPNSyncOptions {
  osId: string | null;
  autoRefreshOnOpen?: boolean;
  onSyncComplete?: () => void;
}

interface UseGSPNSyncReturn {
  isSyncing: boolean;
  lastSync: SyncRecord | null;
  syncHistory: SyncRecord[];
  syncError: string | null;
  mudancas: string[] | null;
  triggerSync: () => Promise<void>;
  loadHistory: () => Promise<void>;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function useGSPNSync({ osId, autoRefreshOnOpen = true, onSyncComplete }: UseGSPNSyncOptions): UseGSPNSyncReturn {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncRecord | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncRecord[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [mudancas, setMudancas] = useState<string[] | null>(null);
  const onSyncCompleteRef = useRef(onSyncComplete);
  onSyncCompleteRef.current = onSyncComplete;
  const triggeredRef = useRef(false);

  const loadHistory = useCallback(async () => {
    if (!osId) return;
    const { data } = await supabase
      .from('os_sync_gspn')
      .select('*')
      .eq('os_id', osId)
      .order('iniciado_em', { ascending: false })
      .limit(10);
    if (data) {
      setSyncHistory(data as SyncRecord[]);
      if (data.length > 0) {
        const latest = data[0] as SyncRecord;
        setLastSync(latest);
        if (latest.status === 'em_andamento') {
          setIsSyncing(true);
        }
      }
    }
  }, [osId]);

  const triggerSync = useCallback(async () => {
    if (!osId) return;
    setSyncError(null);
    setMudancas(null);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/gspn-refresh-proxy?os_id=${osId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );

      const body = await response.json();

      if (response.status === 202 && body.disparado) {
        setIsSyncing(true);
      } else if (response.status === 200 && !body.disparado) {
        if (body.motivo === 'ja_em_andamento') {
          setIsSyncing(true);
        }
        // 'atualizado_recentemente' - do nothing, data is fresh
      } else if (response.status >= 500) {
        setSyncError(body?.erros?.[0] || body?.message || 'Erro ao iniciar sincronização');
      }
    } catch (err: any) {
      setSyncError('Falha na comunicação com o servidor');
    }
  }, [osId]);

  // Realtime subscription
  useEffect(() => {
    if (!osId) return;

    const channel = supabase
      .channel(`os_sync_gspn_${osId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'os_sync_gspn',
          filter: `os_id=eq.${osId}`,
        },
        (payload) => {
          const record = payload.new as SyncRecord;
          if (!record) return;

          setLastSync(record);

          if (record.status === 'concluido') {
            setIsSyncing(false);
            setMudancas(record.mudancas);
            setSyncError(null);
            onSyncCompleteRef.current?.();
            setSyncHistory(prev => {
              const updated = [record, ...prev.filter(r => r.id !== record.id)];
              return updated.slice(0, 10);
            });
          } else if (record.status === 'erro') {
            setIsSyncing(false);
            setSyncError(record.erro || 'Erro durante sincronização');
            setMudancas(null);
            setSyncHistory(prev => {
              const updated = [record, ...prev.filter(r => r.id !== record.id)];
              return updated.slice(0, 10);
            });
          } else if (record.status === 'em_andamento') {
            setIsSyncing(true);
            setSyncHistory(prev => {
              const updated = [record, ...prev.filter(r => r.id !== record.id)];
              return updated.slice(0, 10);
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [osId]);

  // Auto-trigger on mount
  useEffect(() => {
    if (!osId || !autoRefreshOnOpen || triggeredRef.current) return;
    triggeredRef.current = true;
    loadHistory().then(() => {
      triggerSync();
    });
  }, [osId, autoRefreshOnOpen, loadHistory, triggerSync]);

  // Reset when osId changes
  useEffect(() => {
    triggeredRef.current = false;
    setIsSyncing(false);
    setLastSync(null);
    setSyncHistory([]);
    setSyncError(null);
    setMudancas(null);
  }, [osId]);

  return {
    isSyncing,
    lastSync,
    syncHistory,
    syncError,
    mudancas,
    triggerSync,
    loadHistory,
  };
}
