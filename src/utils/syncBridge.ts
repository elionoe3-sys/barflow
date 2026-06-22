// src/utils/syncBridge.ts
// Pont de synchronisation générique pour les stores qui n'utilisent pas
// la base Dexie principale (db.ts) : orderStore, reapproStore, lossStore.
//
// Chaque store y enregistre ses opérations en attente dans IndexedDB
// (persistant, survit aux refresh) puis on les rejoue vers l'API dès
// que le réseau est disponible.

import Dexie, { Table } from 'dexie';

export interface BridgeQueueItem {
  id?: number;
  store: 'orders' | 'reappro' | 'losses';
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entityId: string;
  apiCall: string; // nom de la fonction api.ts à appeler, ex: 'createCommande'
  payload: any;
  timestamp: number;
  retryCount: number;
}

class SyncBridgeDB extends Dexie {
  queue!: Table<BridgeQueueItem>;

  constructor() {
    super('BarFlowSyncBridge');
    this.version(1).stores({
      queue: '++id, store, operation, entityId, timestamp',
    });
  }
}

export const bridgeDB = new SyncBridgeDB();

let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let flushing = false;

// ── API map : on importe paresseusement pour éviter les cycles ────
async function callApi(name: string, payload: any): Promise<void> {
  const api = await import('@/services/api');
  const fn = (api as any)[name];
  if (typeof fn !== 'function') {
    console.warn(`[syncBridge] Fonction API inconnue: ${name}`);
    return;
  }
  if (Array.isArray(payload)) await fn(...payload);
  else await fn(payload);
}

// ── Enregistre une opération à synchroniser ────────────────────
export async function enqueueSync(item: Omit<BridgeQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
  await bridgeDB.queue.add({ ...item, timestamp: Date.now(), retryCount: 0 });
  if (isOnline) flushQueue();
}

// ── Rejoue la file vers le serveur ──────────────────────────────
export async function flushQueue(): Promise<void> {
  if (flushing || !isOnline) return;
  flushing = true;
  try {
    const pending = await bridgeDB.queue.orderBy('timestamp').toArray();
    for (const item of pending) {
      try {
        await callApi(item.apiCall, item.payload);
        if (item.id != null) await bridgeDB.queue.delete(item.id);
      } catch (error) {
        console.error('[syncBridge] Échec sync', item.store, item.operation, item.entityId, error);
        if (item.id != null) {
          const retryCount = (item.retryCount || 0) + 1;
          if (retryCount >= 10) {
            // Abandonne après 10 tentatives pour ne pas bloquer la file indéfiniment
            await bridgeDB.queue.delete(item.id);
          } else {
            await bridgeDB.queue.update(item.id, { retryCount });
          }
        }
        // On arrête au premier échec pour conserver l'ordre, on retentera au prochain flush
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

export async function getPendingBridgeCount(): Promise<number> {
  return bridgeDB.queue.count();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { isOnline = true; flushQueue(); });
  window.addEventListener('offline', () => { isOnline = false; });
  // Tentative initiale au chargement
  setTimeout(() => { if (isOnline) flushQueue(); }, 2000);
}