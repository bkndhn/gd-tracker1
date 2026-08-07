// Push + in-app notification handling, imported by the generated service worker.
// Kept separate so Workbox precaching and this messaging logic stay independent.

const ICON = '/lovable-uploads/d9731f6e-4026-4be4-aaf0-1a401d8ba7be.png';

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'New GD Entry', {
      body: data.body || 'A new goods damaged entry has been added',
      icon: ICON,
      badge: ICON,
      data: data.url || '/',
      requireInteraction: true,
      tag: 'gd-notification',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data || '/'));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NEW_GD_ENTRY') {
    const { title, body, url } = event.data;
    self.registration.showNotification(title || 'New GD Entry', {
      body: body || 'A new goods damaged entry has been added',
      icon: ICON,
      badge: ICON,
      data: url || '/',
      requireInteraction: true,
      tag: 'gd-notification',
      renotify: true,
    });
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
