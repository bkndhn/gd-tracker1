import { useState, useEffect, useCallback } from 'react';

const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_DAYS = 14;

// Module-level cache so the beforeinstallprompt event is never lost across component re-mounts
let globalDeferredPrompt: any = null;
const promptListeners = new Set<(prompt: any) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    promptListeners.forEach((fn) => fn(e));
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    promptListeners.forEach((fn) => fn(null));
  });
}

export const isPWAStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    // @ts-ignore - iOS Safari standalone check
    window.navigator.standalone === true);

export const isDeviceIOS = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !/crios|fxios|edgios/i.test(navigator.userAgent);

export const wasPWADismissedRecently = () => {
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    const ageMs = Date.now() - Number(ts);
    return ageMs < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
};

export const markPWADismissed = () => {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // storage disabled
  }
};

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(isPWAStandalone());
  const [iosModalOpen, setIosModalOpen] = useState(false);
  const [initialPromptVisible, setInitialPromptVisible] = useState(false);

  const isIOS = isDeviceIOS();

  useEffect(() => {
    setIsInstalled(isPWAStandalone());

    const updatePrompt = (prompt: any) => {
      setDeferredPrompt(prompt);
      if (prompt && !isPWAStandalone() && !wasPWADismissedRecently()) {
        setInitialPromptVisible(true);
      }
    };

    promptListeners.add(updatePrompt);

    // Initial check on mount
    if (!isPWAStandalone() && !wasPWADismissedRecently()) {
      if (globalDeferredPrompt) {
        setInitialPromptVisible(true);
      } else if (isIOS) {
        // Show iOS subtle banner after delay on first visits
        const t = setTimeout(() => {
          if (!isPWAStandalone() && !wasPWADismissedRecently()) {
            setInitialPromptVisible(true);
          }
        }, 3500);
        return () => {
          clearTimeout(t);
          promptListeners.delete(updatePrompt);
        };
      }
    }

    return () => {
      promptListeners.delete(updatePrompt);
    };
  }, [isIOS]);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (isInstalled) return false;

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        globalDeferredPrompt = null;
        setDeferredPrompt(null);
        setInitialPromptVisible(false);
        setIsInstalled(true);
        return true;
      }
      return false;
    }

    if (isIOS) {
      setIosModalOpen(true);
      return true;
    }

    return false;
  }, [deferredPrompt, isInstalled, isIOS]);

  const dismissInitialPrompt = useCallback(() => {
    setInitialPromptVisible(false);
    markPWADismissed();
  }, []);

  return {
    canInstall: !isInstalled && (!!deferredPrompt || isIOS),
    isInstalled,
    isIOS,
    promptInstall,
    initialPromptVisible,
    dismissInitialPrompt,
    iosModalOpen,
    setIosModalOpen,
  };
};
