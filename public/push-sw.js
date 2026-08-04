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
