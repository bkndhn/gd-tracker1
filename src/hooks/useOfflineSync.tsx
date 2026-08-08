import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  OutboxItem,
  discardItem,
  enqueueEntry,
  isSyncing as outboxSyncing,
  retryItem,
  scheduleSync,
  subscribeOutbox,
  syncOutbox,
} from '@/lib/outbox';

/**
 * Single source of truth for connectivity + the offline outbox.
 * Triggers a sync on reconnect, on focus, and on app start.
 */
export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(outboxSyncing());

  // Items already announced as permanently failed, so we alert only once each.
  const announcedFailures = useRef<Set<string>>(new Set());

  useEffect(
    () =>
      subscribeOutbox((next) => {
        setItems(next);

        // Permanent delivery failure → in-app notification with reason + one-tap retry.
        next
          .filter((i) => i.status === 'failed' && !announcedFailures.current.has(i.id))
          .forEach((i) => {
            announcedFailures.current.add(i.id);
            toast.error(`Couldn't send "${i.label}"`, {
              description: i.lastError || 'Delivery failed after several attempts.',
              duration: Infinity,
              action: {
                label: 'Retry',
                onClick: () => {
                  announcedFailures.current.delete(i.id);
                  void retryItem(i.id);
                },
              },
            });
          });

        // Allow re-alerting if an item recovers and later fails again.
        const failedIds = new Set(next.filter((i) => i.status === 'failed').map((i) => i.id));
        announcedFailures.current.forEach((id) => {
          if (!failedIds.has(id)) announcedFailures.current.delete(id);
        });
      }),
    [],
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      scheduleSync(500);
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline. Entries are saved on this device.');
    };
    const handleFocus = () => {
      if (navigator.onLine) scheduleSync(0);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    scheduleSync(0);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  // Track sync activity for the status strip
  useEffect(() => {
    const id = setInterval(() => setIsSyncing(outboxSyncing()), 700);
    return () => clearInterval(id);
  }, []);

  const manualSync = useCallback(async () => {
    if (!navigator.onLine) {
      toast.warning('Still offline — will sync automatically when back online.');
      return;
    }
    const { sent, failed } = await syncOutbox();
    if (sent > 0) toast.success(`Synced ${sent} entr${sent === 1 ? 'y' : 'ies'}.`);
    if (failed > 0) toast.error(`${failed} entr${failed === 1 ? 'y' : 'ies'} could not sync yet.`);
    if (sent === 0 && failed === 0) toast.info('Nothing to sync.');
  }, []);

  const pending = items.filter((i) => i.status !== 'failed');
  const failed = items.filter((i) => i.status === 'failed');

  return {
    isOnline,
    items,
    pendingItems: pending,
    failedItems: failed,
    pendingCount: pending.length,
    failedCount: failed.length,
    isSyncing,
    manualSync,
    saveOfflineEntry: enqueueEntry,
    retryItem,
    discardItem,
  };
};
