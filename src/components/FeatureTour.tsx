import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ClipboardList, BarChart3, MessageCircle, WifiOff, FileDown } from 'lucide-react';

const tourKey = (uid: string) => `lsi_tour_done_${uid}`;
const GLOBAL_TOUR_KEY = 'lsi_tour_global_dismissed';

const STEPS = [
  { icon: ClipboardList, title: 'Log every non-purchase visit', body: 'Record why a visitor left without buying — reason, notes, photos and voice notes. Works fully offline and syncs later.' },
  { icon: BarChart3, title: 'Dashboard & reports', body: 'Filter by date, shop or reason. Drill into any card, compare periods, and export branded PDF/Excel reports.' },
  { icon: MessageCircle, title: 'Follow up on WhatsApp', body: 'Send pre-written follow-ups to visitors, track outcomes, and see recovered revenue per shop and staff.' },
  { icon: WifiOff, title: 'Offline-first', body: 'No internet? Entries queue on the device and deliver automatically when you are back online.' },
  { icon: FileDown, title: 'Digests & alerts', body: 'Get a weekly AI digest, anomaly alerts for unusual spikes, and scheduled email reports — all configurable in Admin.' },
];

/** First-login feature tour; permanently hidden once dismissed or completed. */
export const FeatureTour = () => {
  const { profile, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // If globally dismissed or marked done for this user/profile, do not open
    if (localStorage.getItem(GLOBAL_TOUR_KEY)) return;
    const uid = profile?.id || user?.id;
    if (uid && localStorage.getItem(tourKey(uid))) return;

    // Check if user has already logged in before (if user exists, only show once if never seen)
    if (uid) {
      // If we haven't shown it in this session and it's not marked done:
      const alreadyShownThisSession = sessionStorage.getItem('lsi_tour_shown_session');
      if (!alreadyShownThisSession) {
        // Don't show again if dismissed
      }
    }

    // Allow manual replay from settings
    const handleReplay = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener('replay-feature-tour', handleReplay);
    return () => window.removeEventListener('replay-feature-tour', handleReplay);
  }, [profile?.id, user?.id]);

  const close = () => {
    const uid = profile?.id || user?.id;
    if (uid) {
      localStorage.setItem(tourKey(uid), new Date().toISOString());
    }
    // Set global flag so user is never prompted again on subsequent logins
    localStorage.setItem(GLOBAL_TOUR_KEY, new Date().toISOString());
    sessionStorage.setItem('lsi_tour_shown_session', 'true');
    setOpen(false);
  };

  const s = STEPS[step];
  const Icon = s.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">{s.title}</DialogTitle>
          <DialogDescription className="text-center">{s.body}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-1.5 py-1">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-primary' : 'w-1.5 bg-muted'}`} />
          ))}
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={close}>Skip tour</Button>
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep(step + 1)}>Next</Button>
          ) : (
            <Button size="sm" onClick={close}>Get started</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
