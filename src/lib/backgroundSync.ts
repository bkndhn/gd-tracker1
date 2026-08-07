/**
 * Background sync scheduling for the offline outbox.
 *
 * Queued visits are retried by the browser itself (Background Sync +
 * Periodic Background Sync) so delivery resumes after the tab is closed.
 * When the app is open, service-worker messages trigger an immediate flush,
 * and a timer keeps things moving on browsers without the Sync API.
 */

import { syncOutbox, scheduleSync } from './outbox';

export const OUTBOX_SYNC_TAG = 'outbox-sync';
export const OUTBOX_PERIODIC_TAG = 'outbox-periodic-sync';

type SyncCapableRegistration = ServiceWorkerRegistration & {
  sync?: { register: (tag: string) => Promise<void> };
  periodicSync?: {
    register: (tag: string, options?: { minInterval: number }) => Promise<void>;
    getTags?: () => Promise<string[]>;
  };
};

async function getRegistration(): Promise<SyncCapableRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return reg as SyncCapableRegistration;
  } catch {
    return null;
  }
}

/** Ask the browser to flush the outbox as soon as connectivity allows. */
export async function requestBackgroundSync(): Promise<boolean> {
  const reg = await getRegistration();
  if (!reg?.sync) return false;
  try {
    await reg.sync.register(OUTBOX_SYNC_TAG);
    return true;
  } catch {
    return false;
  }
}

/** Register a periodic wake-up so long-queued visits keep retrying. */
async function requestPeriodicSync() {
  const reg = await getRegistration();
  if (!reg?.periodicSync) return;
  try {
    const status = await (navigator as any).permissions?.query?.({
      name: 'periodic-background-sync' as PermissionName,
    });
    if (status && status.state !== 'granted') return;
    const tags = (await reg.periodicSync.getTags?.()) || [];
    if (tags.includes(OUTBOX_PERIODIC_TAG)) return;
    await reg.periodicSync.register(OUTBOX_PERIODIC_TAG, {
      minInterval: 15 * 60 * 1000,
    });
  } catch {
    /* not supported — the in-app timer keeps retrying */
  }
}

let started = false;

/** Wire service-worker driven retries. Safe to call once at app start. */
export function initBackgroundSync() {
  if (started) return;
  started = true;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if ((event.data as any)?.type === 'OUTBOX_SYNC') void syncOutbox();
    });
  }

  void requestPeriodicSync();
  void requestBackgroundSync();

  // Fallback heartbeat for browsers without the Sync API (Safari/Firefox).
  const heartbeat = () => {
    if (navigator.onLine) scheduleSync(0);
  };
  setInterval(heartbeat, 60_000);
  window.addEventListener('online', heartbeat);
}
