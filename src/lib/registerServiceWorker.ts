/**
 * Guarded service-worker registration.
 * Never registers in dev, in Lovable preview, inside an iframe, or with ?sw=off —
 * in those contexts any existing /sw.js registration is removed instead.
 */

const SW_URL = '/sw.js';

function isBlockedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith('id-preview--') || host.startsWith('preview--')) return true;
  if (host === 'lovableproject.com' || host.endsWith('.lovableproject.com')) return true;
  if (host === 'lovableproject-dev.com' || host.endsWith('.lovableproject-dev.com')) return true;
  if (host === 'beta.lovable.dev' || host.endsWith('.beta.lovable.dev')) return true;
  if (new URLSearchParams(window.location.search).has('sw')
      && new URLSearchParams(window.location.search).get('sw') === 'off') return true;
  return false;
}

async function unregisterAppWorkers() {
  if (!('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs
      .filter((r) => (r.active?.scriptURL || r.installing?.scriptURL || '').endsWith(SW_URL))
      .map((r) => r.unregister()),
  );
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  if (isBlockedContext()) {
    void unregisterAppWorkers();
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(SW_URL, { scope: '/' })
      .then((reg) => {
        // Promptly check for manifest and cache updates on every launch
        reg.update().catch(() => {});

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      })
      .catch(() => {
        /* offline support is best-effort */
      });
  });
}
