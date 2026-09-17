import { useState } from 'react';
import { Bell, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

export const NotificationPromptBanner = () => {
  const { isSupported, permission, requestPermission } = usePushNotifications();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('gd_push_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [requesting, setRequesting] = useState(false);

  // If already granted, denied, unsupported, or dismissed in session, do not render
  if (!isSupported || permission === 'granted' || permission === 'denied' || dismissed) {
    return null;
  }

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const granted = await requestPermission();
      if (granted) {
        toast.success('Real-time alerts enabled! You will be notified on stock arrivals and urgent requests.');
      } else {
        toast.info('Notifications were not granted. You can re-enable them in browser settings.');
      }
    } finally {
      setRequesting(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('gd_push_banner_dismissed', 'true');
    } catch {}
  };

  return (
    <div className="relative z-40 bg-gradient-to-r from-primary/15 via-accent/15 to-primary/10 border-b border-primary/20 px-3 py-2 text-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-full bg-primary/20 text-primary shrink-0">
            <Bell className="h-3.5 w-3.5 animate-pulse" />
          </div>
          <p className="text-foreground font-medium truncate">
            Enable instant alerts for warehouse dispatches, counter stock arrivals &amp; urgent sizes.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <Button
            size="sm"
            className="h-7 text-xs px-3 gap-1 shadow-sm font-semibold"
            onClick={handleEnable}
            disabled={requesting}
          >
            <CheckCircle2 className="h-3 w-3" />
            {requesting ? 'Enabling...' : 'Enable Alerts'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
            aria-label="Dismiss notification prompt"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
