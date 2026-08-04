import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initErrorTracking, captureException } from './lib/errorTracking';
import { registerServiceWorker } from './lib/registerServiceWorker';

// Start crash reporting before React mounts so boot failures are captured too
initErrorTracking();
registerServiceWorker();


const container = document.getElementById("root");
if (!container) {
  const err = new Error("Root container not found");
  void captureException(err, { level: 'fatal', kind: 'bootstrap' });
  throw err;
}

const root = createRoot(container);
root.render(<App />);
