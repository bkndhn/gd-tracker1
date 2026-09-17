import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Lock, KeyRound, LogOut, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { hasQuickPin, verifyQuickPin, setScreenLocked } from '@/utils/screenLockSecurity';
import { logAudit } from '@/utils/auditLog';
import { toast } from 'sonner';

interface ScreenLockOverlayProps {
  onUnlock: () => void;
  onSignOut: () => void;
}

export const ScreenLockOverlay = ({ onUnlock, onSignOut }: ScreenLockOverlayProps) => {
  const { user, profile } = useAuth();
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [usePasswordMode, setUsePasswordMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const userId = user?.id || '';
  const userEmail = user?.email || '';
  const role = (profile as any)?.role || 'staff';
  const name = (profile as any)?.name || userEmail.split('@')[0] || 'User';

  const userHasPin = hasQuickPin(userId);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const passInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // If user has no PIN set, default to password mode
    if (!userHasPin) {
      setUsePasswordMode(true);
    }
    // Prevent background scrolling while locked
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [userHasPin]);

  useEffect(() => {
    if (usePasswordMode) {
      passInputRef.current?.focus();
    } else {
      pinInputRef.current?.focus();
    }
  }, [usePasswordMode]);

  const handleUnlockWithPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin || pin.length < 4) {
      setErrorMsg('Please enter your 4-digit PIN');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const valid = await verifyQuickPin(userId, pin);
    setSubmitting(false);

    if (valid) {
      setScreenLocked(false);
      logAudit({
        action: 'screen_unlock',
        targetType: 'security',
        details: { method: 'quick_pin' },
      });
      toast.success('Welcome back!');
      onUnlock();
    } else {
      setErrorMsg('Incorrect 4-digit PIN. Please try again.');
      setPin('');
      pinInputRef.current?.focus();
    }
  };

  const handleUnlockWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMsg('Please enter your account password');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });

      if (error) throw error;

      setScreenLocked(false);
      logAudit({
        action: 'screen_unlock',
        targetType: 'security',
        details: { method: 'password' },
      });
      toast.success('Welcome back!');
      onUnlock();
    } catch (err: any) {
      setErrorMsg(err.message || 'Incorrect password');
      setPassword('');
      passInputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  // Auto submit when 4 digits are typed
  const handlePinChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 4);
    setPin(clean);
    setErrorMsg(null);
    if (clean.length === 4) {
      // Small timeout for visual confirmation
      setTimeout(async () => {
        setSubmitting(true);
        const valid = await verifyQuickPin(userId, clean);
        setSubmitting(false);
        if (valid) {
          setScreenLocked(false);
          logAudit({
            action: 'screen_unlock',
            targetType: 'security',
            details: { method: 'quick_pin' },
          });
          toast.success('Welcome back!');
          onUnlock();
        } else {
          setErrorMsg('Incorrect 4-digit PIN');
          setPin('');
          pinInputRef.current?.focus();
        }
      }, 100);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Screen Locked"
      className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 select-none animate-in fade-in duration-300"
    >
      <div className="w-full max-w-sm mx-auto bg-card border rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
        {/* Header Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
          <Lock className="h-8 w-8" />
        </div>

        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
            <Shield className="h-5 w-5 text-emerald-500" />
            Session Locked
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Locked due to inactivity to protect customer data & counter privacy.
          </p>
        </div>

        {/* User Card */}
        <div className="bg-muted/40 border rounded-2xl p-3 flex items-center justify-between text-left">
          <div className="min-w-0 flex-1 pr-2">
            <p className="text-sm font-semibold truncate text-foreground">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>
          <Badge variant="secondary" className="capitalize text-[11px] shrink-0 font-medium">
            {role}
          </Badge>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 text-left animate-in shake">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}

        {/* PIN / Password Unlock Forms */}
        {!usePasswordMode && userHasPin ? (
          <form onSubmit={handleUnlockWithPin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Enter 4-Digit Quick PIN
              </label>
              <Input
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                value={pin}
                disabled={submitting}
                onChange={(e) => handlePinChange(e.target.value)}
                placeholder="••••"
                className="text-center text-2xl tracking-[0.5em] font-mono h-12 rounded-xl"
              />
            </div>

            <Button
              type="submit"
              disabled={pin.length < 4 || submitting}
              className="w-full h-11 rounded-xl font-semibold gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Unlock Screen <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <button
              type="button"
              onClick={() => {
                setUsePasswordMode(true);
                setErrorMsg(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Unlock with account password instead
            </button>
          </form>
        ) : (
          <form onSubmit={handleUnlockWithPassword} className="space-y-4">
            <div className="space-y-2 text-left">
              <label className="text-xs font-medium text-muted-foreground">
                Enter Account Password
              </label>
              <div className="relative">
                <Input
                  ref={passInputRef}
                  type="password"
                  autoFocus
                  value={password}
                  disabled={submitting}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="Password"
                  className="h-11 rounded-xl pr-10"
                />
                <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <Button
              type="submit"
              disabled={!password || submitting}
              className="w-full h-11 rounded-xl font-semibold gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Unlock Screen <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            {userHasPin && (
              <button
                type="button"
                onClick={() => {
                  setUsePasswordMode(false);
                  setErrorMsg(null);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Use 4-digit Quick PIN instead
              </button>
            )}
          </form>
        )}

        <div className="pt-2 border-t">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSignOut}
            className="w-full text-xs text-muted-foreground hover:text-destructive gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" />
            Switch Account / Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};
