/**
 * Guarded service-worker registration.
 * Never registers in dev, in Lovable preview, inside an iframe, or with ?sw=off —
 * in those contexts any existing /sw.js registration is removed instead.
 */

const SW_URL = '/sw.js';

function isBlockedContext(): boolean {
  // Only block if inside an embedded iframe (e.g. editor preview sandboxes)
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }

  // Explicit escape hatch for debugging
  try {
    if (new URLSearchParams(window.location.search).get('sw') === 'off') return true;
  } catch {}

  return false;
}

async function unregisterAppWorkers() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => (r.active?.scriptURL || r.installing?.scriptURL || '').endsWith(SW_URL))
        .map((r) => r.unregister()),
    );
  } catch {}
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  if (isBlockedContext()) {
    void unregisterAppWorkers();
    return;
  }

  const doRegister = () => {
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
      .catch((err) => {
        if (import.meta.env.DEV) {
          console.warn('Service worker registration failed:', err);
        }
      });
  };

  // If the window has already finished loading (e.g. called via whenIdle/requestIdleCallback),
  // register immediately. Otherwise wait for window load.
  if (document.readyState === 'complete') {
    doRegister();
  } else {
    window.addEventListener('load', doRegister);
  }
}
