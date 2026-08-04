/**
 * Single IndexedDB database for the whole offline layer.
 * Stores:
 *  - outbox: entries created while offline, waiting to be pushed to Supabase
 *  - cache:  key/value cache of reference data + recent entries for offline reads
 */

const DB_NAME = 'gd_offline';
const DB_VERSION = 1;

export const OUTBOX_STORE = 'outbox';
export const CACHE_STORE = 'cache';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('status', 'status');
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction([storeName], mode);
        const req = fn(tx.objectStore(storeName));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const idb = {
  put: <T>(store: string, value: T) => run<IDBValidKey>(store, 'readwrite', (s) => s.put(value as any)),
  get: <T>(store: string, key: IDBValidKey) => run<T | undefined>(store, 'readonly', (s) => s.get(key)),
  getAll: <T>(store: string) => run<T[]>(store, 'readonly', (s) => s.getAll()),
  delete: (store: string, key: IDBValidKey) => run<undefined>(store, 'readwrite', (s) => s.delete(key)),
  clear: (store: string) => run<undefined>(store, 'readwrite', (s) => s.clear()),
};

/* ------------------------------------------------------------------ */
/* Offline read cache                                                  */
/* ------------------------------------------------------------------ */

interface CacheRecord<T> {
  key: string;
  value: T;
  savedAt: number;
  tenant: string | null;
}

export async function cacheSet<T>(key: string, value: T, tenant: string | null = null) {
  try {
    await idb.put<CacheRecord<T>>(CACHE_STORE, { key, value, savedAt: Date.now(), tenant });
  } catch {
    /* cache writes must never break the app */
  }
}

export async function cacheGet<T>(key: string): Promise<{ value: T; savedAt: number } | null> {
  try {
    const rec = await idb.get<CacheRecord<T>>(CACHE_STORE, key);
    return rec ? { value: rec.value, savedAt: rec.savedAt } : null;
  } catch {
    return null;
  }
}

/** Drop every cached read (called on logout / tenant switch). Outbox is kept. */
export async function cacheClear() {
  try {
    await idb.clear(CACHE_STORE);
  } catch {
    /* ignore */
  }
}
