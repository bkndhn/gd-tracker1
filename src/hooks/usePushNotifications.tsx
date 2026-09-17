import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { notificationAudio } from '@/lib/notificationAudio';

export interface NotificationPreferences {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  stockRequests: boolean;
  dispatches: boolean;
  arrivals: boolean;
  followups: boolean;
  reorders: boolean;
}

const STORAGE_KEY = 'gd_notification_preferences';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  soundEnabled: true,
  vibrationEnabled: true,
  stockRequests: true,
  dispatches: true,
  arrivals: true,
  followups: true,
  reorders: true,
};

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) } : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });

  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  const updatePreferences = useCallback((patch: Partial<NotificationPreferences>) => {
    setPreferences(prev => {
      const updated = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        if ('serviceWorker' in navigator) {
          await navigator.serviceWorker.ready;
        }
        // Play welcome audio confirmation
        if (preferences.soundEnabled) {
          notificationAudio.playSuccess();
        }
      }
      return result === 'granted';
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported, preferences.soundEnabled]);

  const postToServiceWorker = useCallback((payload: {
    type: string;
    title: string;
    body: string;
    url?: string;
  }) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(payload);
    } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(payload.title, {
          body: payload.body,
          icon: '/lovable-uploads/d9731f6e-4026-4be4-aaf0-1a401d8ba7be.png',
        });
      } catch {}
    }
  }, []);

  const notifyNewRequirement = useCallback((req: {
    size: string;
    quantity: number;
    shop_name?: string;
    urgency?: string;
  }) => {
    if (!preferences.stockRequests) return;
    const isUrgent = req.urgency === 'urgent';
    if (preferences.soundEnabled) {
      if (isUrgent) notificationAudio.playUrgent();
      else notificationAudio.playChime();
    }

    postToServiceWorker({
      type: 'STOCK_REQUIREMENT_NEW',
      title: isUrgent ? '🚨 URGENT Stock Requirement' : '📋 New Size Request',
      body: `${req.shop_name || 'Counter'} requested Size ${req.size} (${req.quantity} pcs)`,
      url: '/?tab=requirements',
    });
  }, [preferences.stockRequests, preferences.soundEnabled, postToServiceWorker]);

  const notifyDispatched = useCallback((details: { count: number; shop_name?: string }) => {
    if (!preferences.dispatches) return;
    if (preferences.soundEnabled) notificationAudio.playChime();

    postToServiceWorker({
      type: 'STOCK_DISPATCHED',
      title: '🚚 Stock Dispatched in Transit',
      body: `${details.count} item(s) on the way to ${details.shop_name || 'shop counter'}`,
      url: '/?tab=requirements',
    });
  }, [preferences.dispatches, preferences.soundEnabled, postToServiceWorker]);

  const notifyReceived = useCallback((details: { size: string; shop_name?: string }) => {
    if (!preferences.arrivals) return;
    if (preferences.soundEnabled) notificationAudio.playSuccess();

    postToServiceWorker({
      type: 'STOCK_RECEIVED',
      title: '📦 Stock Arrived at Counter',
      body: `Size ${details.size} has arrived and is ready for customer handover at ${details.shop_name || 'shop'}`,
      url: '/?tab=requirements',
    });
  }, [preferences.arrivals, preferences.soundEnabled, postToServiceWorker]);

  const notifyFollowUpDue = useCallback((customerName: string, note?: string) => {
    if (!preferences.followups) return;
    if (preferences.soundEnabled) notificationAudio.playChime();

    postToServiceWorker({
      type: 'FOLLOW_UP_DUE',
      title: '📞 Customer Follow-up Reminder',
      body: `Scheduled follow-up due for ${customerName}${note ? ` · "${note}"` : ''}`,
      url: '/?tab=followups',
    });
  }, [preferences.followups, preferences.soundEnabled, postToServiceWorker]);

  const notifyReorderAlert = useCallback((category: string, size: string, runwayDays: number) => {
    if (!preferences.reorders) return;
    if (preferences.soundEnabled) notificationAudio.playWarning();

    postToServiceWorker({
      type: 'REORDER_ALERT',
      title: '⚠️ Low Stock & Demand Alert',
      body: `${category} Size ${size} will deplete in ~${runwayDays} days. High lost sale velocity.`,
      url: '/?tab=dashboard',
    });
  }, [preferences.reorders, preferences.soundEnabled, postToServiceWorker]);

  const sendTestAlert = useCallback(async () => {
    if (permission !== 'granted') {
      const ok = await requestPermission();
      if (!ok) return false;
    }

    if (preferences.soundEnabled) {
      notificationAudio.playSuccess();
    }

    postToServiceWorker({
      type: 'TEST_ALERT',
      title: '🔔 GD-Tracker Push Active',
      body: 'Web Push alerts, audio chimes, and background sync are operating normally.',
      url: '/',
    });
    return true;
  }, [permission, preferences.soundEnabled, requestPermission, postToServiceWorker]);

  return {
    isSupported,
    permission,
    preferences,
    updatePreferences,
    requestPermission,
    notifyNewRequirement,
    notifyDispatched,
    notifyReceived,
    notifyFollowUpDue,
    notifyReorderAlert,
    sendTestAlert,
  };
};
