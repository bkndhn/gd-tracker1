import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initErrorTracking, captureException } from './lib/errorTracking';
import { registerServiceWorker } from './lib/registerServiceWorker';
import { initBackgroundSync } from './lib/backgroundSync';

const container = document.getElementById("root");
if (!container) {
  const err = new Error("Root container not found");
  void captureException(err, { level: 'fatal', kind: 'bootstrap' });
  throw err;
}

// Paint the app first; boot side-effects run once the browser is idle.
const root = createRoot(container);
root.render(<App />);

const whenIdle = (cb: () => void) =>
  (window as any).requestIdleCallback?.(cb, { timeout: 2000 }) ?? setTimeout(cb, 300);

whenIdle(() => {
  initErrorTracking();
  registerServiceWorker();
  initBackgroundSync();
});
