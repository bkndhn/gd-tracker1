// Push + in-app notification handling, imported by the generated service worker.
// Kept separate so Workbox precaching and this messaging logic stay independent.

const ICON = '/lovable-uploads/d9731f6e-4026-4be4-aaf0-1a401d8ba7be.png';

const EVENT_TITLES = {
  STOCK_REQUIREMENT_NEW: '🚨 Urgent Stock Request',
  STOCK_DISPATCHED: '🚚 Stock Dispatched',
  STOCK_RECEIVED: '📦 Stock Arrived at Counter',
  FOLLOW_UP_DUE: '📞 Customer Follow-up Reminder',
  REORDER_ALERT: '⚠️ Low Stock & Demand Alert',
  TEST_ALERT: '🔔 Push Notifications Active',
  NEW_GD_ENTRY: '📝 New Lost Visit Logged',
};

function buildNotificationOptions(data) {
  const eventType = data.type || 'NEW_GD_ENTRY';
  const defaultTitle = EVENT_TITLES[eventType] || 'Store Notification';
  const title = data.title || defaultTitle;
  const body = data.body || 'A new store event requires your attention';
  const url = data.url || '/';

  return {
    title,
    options: {
      body,
      icon: ICON,
      badge: ICON,
      data: { url, eventType },
      requireInteraction: data.requireInteraction !== false,
      tag: `gd-${eventType.toLowerCase()}-${Date.now()}`,
      renotify: true,
      vibrate: [200, 100, 200, 100, 300],
      actions: [
        { action: 'open_view', title: 'Open View' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    },
  };
}

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const { title, options } = buildNotificationOptions(data);
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a tab is already open, focus it and navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  const { type } = event.data;

  // Handle all supported in-app notification types
  if (
    type === 'NEW_GD_ENTRY' ||
    type === 'STOCK_REQUIREMENT_NEW' ||
    type === 'STOCK_DISPATCHED' ||
    type === 'STOCK_RECEIVED' ||
    type === 'FOLLOW_UP_DUE' ||
    type === 'REORDER_ALERT' ||
    type === 'TEST_ALERT'
  ) {
    const { title, options } = buildNotificationOptions(event.data);
    self.registration.showNotification(title, options);
  }
});

// ---- Background sync: retry queued offline visits without the app open ----
const OUTBOX_SYNC_TAG = 'outbox-sync';
const OUTBOX_PERIODIC_TAG = 'outbox-periodic-sync';

async function wakeClientsForOutbox() {
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (all.length > 0) {
    all.forEach((client) => client.postMessage({ type: 'OUTBOX_SYNC' }));
    return;
  }
  // No open window: keep the sync registration alive so the browser retries
  // again later (and re-arms when the user reopens the app).
  throw new Error('no-clients');
}

self.addEventListener('sync', (event) => {
  if (event.tag === OUTBOX_SYNC_TAG) event.waitUntil(wakeClientsForOutbox());
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === OUTBOX_PERIODIC_TAG) {
    event.waitUntil(wakeClientsForOutbox().catch(() => {}));
  }
});
