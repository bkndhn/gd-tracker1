import { useEffect, useRef, useCallback } from 'react';
import { getLockoutTimeout, setScreenLocked, isScreenLocked } from '@/utils/screenLockSecurity';
import { logAudit } from '@/utils/auditLog';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

/**
 * Bank-Grade Inactivity Lock Hook
 *
 * Monitors user interactions across the application. When the configured
 * inactivity duration expires without activity, locks the screen with
 * a security privacy shield without destroying user session data.
 */
export const useSessionTimeout = (onLock: () => void, enabled = true) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!enabled) return;

    // Check configured duration
    const timeoutMs = getLockoutTimeout();
    if (timeoutMs <= 0) return; // 0 = Disabled

    // If already locked, do not schedule
    if (isScreenLocked()) return;

    lastActivityRef.current = Date.now();

    timeoutRef.current = setTimeout(() => {
      setScreenLocked(true);
      logAudit({
        action: 'screen_lock',
        targetType: 'security',
        details: { reason: 'inactivity_timeout', duration_ms: timeoutMs },
      });
      onLock();
    }, timeoutMs);
  }, [onLock, enabled]);

  const lockNow = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setScreenLocked(true);
    logAudit({
      action: 'screen_lock',
      targetType: 'security',
      details: { reason: 'manual_trigger' },
    });
    onLock();
  }, [onLock]);

  useEffect(() => {
    if (!enabled) return;

    // If already locked on load (e.g. page was refreshed while locked)
    if (isScreenLocked()) {
      onLock();
      return;
    }

    resetTimer();

    // Throttle activity listener so high frequency events (scroll, mousemove) don't thrash CPU
    let throttleTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleActivity = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
        if (!isScreenLocked()) {
          resetTimer();
        }
      }, 1000); // 1-second throttle
    };

    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (throttleTimeout) clearTimeout(throttleTimeout);
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [resetTimer, onLock, enabled]);

  return { resetTimer, lockNow };
};
