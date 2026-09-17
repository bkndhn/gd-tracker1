import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  Volume2,
  Vibrate,
  Truck,
  Package,
  AlertTriangle,
  PhoneCall,
  CheckCircle2,
  Send,
  Loader2,
} from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

interface Props {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const NotificationSettingsModal = ({ trigger, open, onOpenChange }: Props) => {
  const {
    isSupported,
    permission,
    preferences,
    updatePreferences,
    requestPermission,
    sendTestAlert,
  } = usePushNotifications();

  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      const ok = await sendTestAlert();
      if (ok) {
        toast.success('Test alert dispatched! Check your device notifications & sound.');
      } else {
        toast.error('Could not dispatch alert. Check browser permission.');
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Bell className="h-5 w-5 text-primary" />
            Notification &amp; Alert Settings
          </DialogTitle>
          <DialogDescription className="text-xs">
            Configure how GD-Tracker notifies you about incoming requests, dispatches, and arrivals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Permission Status Pill */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <div>
              <p className="font-semibold text-foreground">Browser Permission</p>
              <p className="text-muted-foreground text-[11px] mt-0.5">
                {isSupported
                  ? permission === 'granted'
                    ? 'Active and allowed by browser'
                    : permission === 'denied'
                    ? 'Blocked by browser settings'
                    : 'Permission requested on next alert'
                  : 'Web notifications not supported on this browser'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={permission === 'granted' ? 'secondary' : 'outline'}
                className={`capitalize font-semibold text-[11px] ${
                  permission === 'granted'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : permission === 'denied'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    : 'text-amber-700 dark:text-amber-300'
                }`}
              >
                {permission}
              </Badge>
              {permission !== 'granted' && isSupported && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => requestPermission()}>
                  Grant
                </Button>
              )}
            </div>
          </div>

          {/* Sound & Haptic Controls */}
          <div className="space-y-2.5 rounded-lg border p-3">
            <p className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Audio &amp; Vibration</p>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="pref-sound" className="flex items-center gap-2 cursor-pointer">
                <Volume2 className="h-4 w-4 text-primary" />
                <div>
                  <span className="font-medium">Audio Chimes</span>
                  <p className="text-[11px] text-muted-foreground font-normal">Play synthesized chime for urgent and arrival events</p>
                </div>
              </Label>
              <Switch
                id="pref-sound"
                checked={preferences.soundEnabled}
                onCheckedChange={(checked) => updatePreferences({ soundEnabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-1 border-t">
              <Label htmlFor="pref-vibrate" className="flex items-center gap-2 cursor-pointer">
                <Vibrate className="h-4 w-4 text-primary" />
                <div>
                  <span className="font-medium">Vibration Pattern</span>
                  <p className="text-[11px] text-muted-foreground font-normal">Vibrate device on urgent stock requirements</p>
                </div>
              </Label>
              <Switch
                id="pref-vibrate"
                checked={preferences.vibrationEnabled}
                onCheckedChange={(checked) => updatePreferences({ vibrationEnabled: checked })}
              />
            </div>
          </div>

          {/* Granular Event Toggles */}
          <div className="space-y-2.5 rounded-lg border p-3">
            <p className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Alert Categories</p>

            <div className="flex items-center justify-between">
              <Label htmlFor="pref-requests" className="flex items-center gap-2 cursor-pointer">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <div>
                  <span className="font-medium">Urgent Size Requests</span>
                  <p className="text-[11px] text-muted-foreground font-normal">Alert warehouse when counter logs missing size</p>
                </div>
              </Label>
              <Switch
                id="pref-requests"
                checked={preferences.stockRequests}
                onCheckedChange={(checked) => updatePreferences({ stockRequests: checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-1 border-t">
              <Label htmlFor="pref-dispatches" className="flex items-center gap-2 cursor-pointer">
                <Truck className="h-4 w-4 text-blue-500" />
                <div>
                  <span className="font-medium">Warehouse Dispatches</span>
                  <p className="text-[11px] text-muted-foreground font-normal">Notify shop staff when delivery is in transit</p>
                </div>
              </Label>
              <Switch
                id="pref-dispatches"
                checked={preferences.dispatches}
                onCheckedChange={(checked) => updatePreferences({ dispatches: checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-1 border-t">
              <Label htmlFor="pref-arrivals" className="flex items-center gap-2 cursor-pointer">
                <Package className="h-4 w-4 text-emerald-500" />
                <div>
                  <span className="font-medium">Stock Arrivals &amp; Receipts</span>
                  <p className="text-[11px] text-muted-foreground font-normal">Notify when requested product reaches counter</p>
                </div>
              </Label>
              <Switch
                id="pref-arrivals"
                checked={preferences.arrivals}
                onCheckedChange={(checked) => updatePreferences({ arrivals: checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-1 border-t">
              <Label htmlFor="pref-followups" className="flex items-center gap-2 cursor-pointer">
                <PhoneCall className="h-4 w-4 text-violet-500" />
                <div>
                  <span className="font-medium">Customer Follow-up Reminders</span>
                  <p className="text-[11px] text-muted-foreground font-normal">Remind staff when scheduled customer call is due</p>
                </div>
              </Label>
              <Switch
                id="pref-followups"
                checked={preferences.followups}
                onCheckedChange={(checked) => updatePreferences({ followups: checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-1 border-t">
              <Label htmlFor="pref-reorders" className="flex items-center gap-2 cursor-pointer">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                <div>
                  <span className="font-medium">Predictive AI Re-Order Alerts</span>
                  <p className="text-[11px] text-muted-foreground font-normal">Warn when high-demand sizes face inventory depletion</p>
                </div>
              </Label>
              <Switch
                id="pref-reorders"
                checked={preferences.reorders}
                onCheckedChange={(checked) => updatePreferences({ reorders: checked })}
              />
            </div>
          </div>

          {/* Test Alert Button */}
          <div className="pt-1">
            <Button
              className="w-full h-8 text-xs font-semibold gap-1.5 shadow-sm"
              variant="secondary"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send Test Notification to This Device
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
