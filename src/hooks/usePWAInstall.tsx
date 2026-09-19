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

export const isDeviceAndroid = () =>
  typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

export const isMobileDevice = () =>
  typeof navigator !== 'undefined' &&
  /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(isPWAStandalone());
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [initialPromptVisible, setInitialPromptVisible] = useState(false);

  const isIOS = isDeviceIOS();
  const isAndroid = isDeviceAndroid();
  const isMobile = isMobileDevice();

  useEffect(() => {
    setIsInstalled(isPWAStandalone());

    const updatePrompt = (prompt: any) => {
      setDeferredPrompt(prompt);
      if (prompt && !isPWAStandalone() && !wasPWADismissedRecently()) {
        setInitialPromptVisible(true);
      }
    };

    promptListeners.add(updatePrompt);

    // Show install banner on mobile or when prompt is available
    if (!isPWAStandalone() && !wasPWADismissedRecently()) {
      if (globalDeferredPrompt) {
        setInitialPromptVisible(true);
      } else {
        // Show banner after brief delay on mobile devices even before native event
        const t = setTimeout(() => {
          if (!isPWAStandalone() && !wasPWADismissedRecently()) {
            setInitialPromptVisible(true);
          }
        }, isMobile ? 2500 : 5000);
        return () => {
          clearTimeout(t);
          promptListeners.delete(updatePrompt);
        };
      }
    }

    return () => {
      promptListeners.delete(updatePrompt);
    };
  }, [isIOS, isMobile]);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (isInstalled) return false;

    // 1. If native beforeinstallprompt is ready, invoke it directly
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          globalDeferredPrompt = null;
          setDeferredPrompt(null);
          setInitialPromptVisible(false);
          setInstallModalOpen(false);
          setIsInstalled(true);
          return true;
        }
      } catch (err) {
        console.warn('Native prompt install failed, falling back to guide:', err);
      }
    }

    // 2. If native prompt is unavailable or was dismissed, open the visual step-by-step modal
    setInstallModalOpen(true);
    return true;
  }, [deferredPrompt, isInstalled]);

  const dismissInitialPrompt = useCallback(() => {
    setInitialPromptVisible(false);
    markPWADismissed();
  }, []);

  return {
    canInstall: !isInstalled,
    isInstalled,
    isIOS,
    isAndroid,
    isMobile,
    hasNativePrompt: !!deferredPrompt,
    promptInstall,
    initialPromptVisible,
    dismissInitialPrompt,
    installModalOpen,
    setInstallModalOpen,
    // Backward compatibility for existing references
    iosModalOpen: installModalOpen,
    setIosModalOpen: setInstallModalOpen,
  };
};
