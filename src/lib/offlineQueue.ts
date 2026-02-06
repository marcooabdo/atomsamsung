import { supabase } from './supabase';

const DB_NAME = 'atom_offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending_operations';

interface PendingOperation {
  id: string;
  table: string;
  type: 'insert' | 'update' | 'upsert';
  data: Record<string, any>;
  match?: Record<string, any>;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueOperation(op: Omit<PendingOperation, 'id' | 'timestamp'>): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const entry: PendingOperation = {
      ...op,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    store.add(entry);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

export async function getPendingCount(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const count = store.count();
    return new Promise((resolve) => {
      count.onsuccess = () => resolve(count.result);
      count.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const allRequest = store.getAll();

    const operations: PendingOperation[] = await new Promise((resolve) => {
      allRequest.onsuccess = () => resolve(allRequest.result || []);
      allRequest.onerror = () => resolve([]);
    });

    operations.sort((a, b) => a.timestamp - b.timestamp);

    for (const op of operations) {
      try {
        let result;
        if (op.type === 'insert') {
          result = await supabase.from(op.table).insert(op.data);
        } else if (op.type === 'update' && op.match) {
          let query = supabase.from(op.table).update(op.data);
          for (const [key, val] of Object.entries(op.match)) {
            query = query.eq(key, val);
          }
          result = await query;
        } else if (op.type === 'upsert') {
          result = await supabase.from(op.table).upsert(op.data);
        }

        if (result && !result.error) {
          const delTx = db.transaction(STORE_NAME, 'readwrite');
          delTx.objectStore(STORE_NAME).delete(op.id);
          await new Promise<void>((resolve) => {
            delTx.oncomplete = () => resolve();
            delTx.onerror = () => resolve();
          });
          synced++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
  } catch {}

  return { synced, failed };
}

export function isOnline(): boolean {
  return navigator.onLine;
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoSync(intervalMs = 30000): void {
  stopAutoSync();

  window.addEventListener('online', handleOnline);

  if (isOnline()) {
    flushQueue();
  }

  syncInterval = setInterval(() => {
    if (isOnline()) flushQueue();
  }, intervalMs);
}

export function stopAutoSync(): void {
  window.removeEventListener('online', handleOnline);
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

function handleOnline() {
  flushQueue();
}

export async function offlineInsert(table: string, data: Record<string, any>): Promise<{ error: any }> {
  if (isOnline()) {
    const result = await supabase.from(table).insert(data);
    if (!result.error) return { error: null };
  }
  await queueOperation({ table, type: 'insert', data });
  return { error: null };
}

export async function offlineUpdate(table: string, data: Record<string, any>, match: Record<string, any>): Promise<{ error: any }> {
  if (isOnline()) {
    let query = supabase.from(table).update(data);
    for (const [key, val] of Object.entries(match)) {
      query = query.eq(key, val);
    }
    const result = await query;
    if (!result.error) return { error: null };
  }
  await queueOperation({ table, type: 'update', data, match });
  return { error: null };
}
