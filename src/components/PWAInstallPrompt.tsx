import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download, Share } from 'lucide-react';

const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_DAYS = 7;

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    // @ts-ignore - iOS Safari
    window.navigator.standalone === true);

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !/crios|fxios|edgios/i.test(navigator.userAgent);

const wasRecentlyDismissed = () => {
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    const ageMs = Date.now() - Number(ts);
    return ageMs < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
};

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari has no beforeinstallprompt — show a manual hint once
    if (isIOS()) {
      const t = setTimeout(() => setIosHint(true), 4000);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', handler);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setDeferredPrompt(null);
      setShowPrompt(false);
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setIosHint(false);
    setDeferredPrompt(null);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
  };

  if (showPrompt && deferredPrompt) {
    return (
      <div className="fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:w-96 z-50 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-2xl shadow-2xl border border-primary-foreground/10">
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-full bg-primary-foreground/15 p-2 shrink-0">
              <Download className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">Install GD Tracker</div>
              <div className="text-xs opacity-90 truncate">Faster, works offline, native feel</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="secondary" onClick={handleInstall} className="text-xs h-8">Install</Button>
            <Button size="icon" variant="ghost" onClick={handleDismiss}
              className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/15">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (iosHint) {
    return (
      <div className="fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:w-96 z-50 bg-card text-card-foreground rounded-2xl shadow-2xl border border-border">
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-full bg-primary/15 text-primary p-2 shrink-0">
              <Share className="h-5 w-5" />
            </div>
            <div className="min-w-0 text-sm">
              <div className="font-semibold">Install on iPhone</div>
              <div className="text-muted-foreground text-xs mt-1">
                Tap <Share className="inline h-3 w-3 mx-0.5" /> Share, then
                <span className="font-medium"> "Add to Home Screen"</span>.
              </div>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={handleDismiss} className="h-8 w-8 shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
};
