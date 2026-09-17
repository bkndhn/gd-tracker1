import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ShieldCheck,
  Download,
  Eraser,
  Lock,
  KeyRound,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';
import {
  getLockoutTimeout,
  setLockoutTimeout,
  TIMEOUT_OPTIONS,
  hasQuickPin,
  setQuickPin,
  clearQuickPin,
  setScreenLocked,
} from '@/utils/screenLockSecurity';
import { MaskedPhone } from '@/components/MaskedPhone';

/**
 * Bank-Grade Security & Customer Data Privacy Panel
 *
 * Provides controls for:
 * 1. Session Inactivity Auto-Lockout & Quick 4-Digit PIN configuration
 * 2. Customer PII Phone Number Masking Policy
 * 3. GDPR / DPDP Right-to-be-Forgotten (JSON export & customer anonymization)
 */
export const CustomerDataPrivacy = () => {
  const { profile, user } = useAuth();
  const userId = user?.id || '';

  // Inactivity timeout state
  const [timeoutMs, setTimeoutMsState] = useState<number>(() => getLockoutTimeout());

  // Quick PIN state
  const [hasPin, setHasPin] = useState<boolean>(() => hasQuickPin(userId));
  const [newPin, setNewPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  // GDPR export/anonymize state
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState<'export' | 'anonymize' | null>(null);
  const [confirmAnon, setConfirmAnon] = useState(false);

  const role = (profile as any)?.role;
  if (role !== 'admin' && role !== 'super_admin') return null;

  const validPhone = phone.replace(/\D/g, '').length >= 10;

  const handleTimeoutChange = (val: string) => {
    const num = Number(val);
    setLockoutTimeout(num);
    setTimeoutMsState(num);
    toast.success('Inactivity lockout timeout updated');
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin || newPin.length !== 4) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }
    setSavingPin(true);
    try {
      await setQuickPin(userId, newPin);
      setHasPin(true);
      setNewPin('');
      toast.success('4-digit Quick PIN saved successfully!');
    } catch {
      toast.error('Failed to save Quick PIN');
    } finally {
      setSavingPin(false);
    }
  };

  const handleRemovePin = () => {
    clearQuickPin(userId);
    setHasPin(false);
    toast.info('Quick PIN removed. Screen will require account password to unlock.');
  };

  const handleTestLock = () => {
    setScreenLocked(true);
    // Reload window state to invoke ScreenLockOverlay
    window.location.reload();
  };

  const call = async (action: 'export' | 'anonymize') => {
    setBusy(action);
    try {
      const { data, error } = await supabase.functions.invoke('customer-data', {
        body: { action, phone },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    } finally {
      setBusy(null);
    }
  };

  const doExport = async () => {
    try {
      const data = await call('export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customer-data-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Customer data exported');
    } catch (e) {
      toast.error((e as Error).message || 'Export failed');
    }
  };

  const doAnonymize = async () => {
    try {
      const data = await call('anonymize');
      toast.success(`Anonymized ${(data as any)?.records_updated ?? 0} records for this customer.`);
    } catch (e) {
      toast.error((e as Error).message || 'Anonymize failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Inactivity Screen Lock & Quick PIN */}
      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Inactivity Screen Lock & Quick PIN
          </CardTitle>
          <CardDescription>
            Protects your store billing counter when staff step away. Automatically blurs and locks the screen after inactivity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Timeout duration selector */}
          <div className="grid gap-2 sm:grid-cols-2 items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Auto-Lock Inactivity Period
              </Label>
              <p className="text-xs text-muted-foreground">
                Locks the terminal if no touch, mouse, or keyboard input is detected.
              </p>
            </div>
            <Select value={String(timeoutMs)} onValueChange={handleTimeoutChange}>
              <SelectTrigger className="w-full sm:w-[240px]">
                <SelectValue placeholder="Select timeout" />
              </SelectTrigger>
              <SelectContent>
                {TIMEOUT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="h-px bg-border/60" />

          {/* Quick PIN Setup */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <KeyRound className="h-4 w-4 text-primary" />
                  Terminal Quick Unlock PIN
                </Label>
                <p className="text-xs text-muted-foreground">
                  Fast 4-digit code for instant screen unlocking on mobile and counter tablets.
                </p>
              </div>
              {hasPin ? (
                <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-xs">
                  <CheckCircle2 className="h-3 w-3" /> Active
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs">
                  Not Set
                </Badge>
              )}
            </div>

            <form onSubmit={handleSavePin} className="flex flex-wrap items-center gap-2 pt-1">
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="4-Digit PIN (e.g. 2580)"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-48 font-mono text-center tracking-widest text-sm"
              />
              <Button type="submit" size="sm" disabled={newPin.length !== 4 || savingPin}>
                {hasPin ? 'Change PIN' : 'Set Quick PIN'}
              </Button>
              {hasPin && (
                <Button type="button" size="sm" variant="ghost" onClick={handleRemovePin} className="text-xs text-muted-foreground hover:text-destructive">
                  Remove PIN
                </Button>
              )}
            </form>
          </div>

          <div className="h-px bg-border/60" />

          {/* Manual Test Lock */}
          <div className="flex items-center justify-between pt-1">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Test Privacy Shield</p>
              <p className="text-xs text-muted-foreground">Lock screen immediately to test the counter shield experience.</p>
            </div>
            <Button size="sm" variant="outline" onClick={handleTestLock} className="gap-1.5 text-xs">
              <Lock className="h-3.5 w-3.5 text-emerald-500" />
              Lock Screen Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Staff PII Phone Number Masking Policy */}
      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4 text-primary" />
            Customer PII Phone Number Masking Policy
          </CardTitle>
          <CardDescription>
            Prevents store staff from copying or harvesting your proprietary customer database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live Masking Preview</span>
              <Badge variant="secondary" className="text-[11px] font-mono">Bank Standard</Badge>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs text-muted-foreground block mb-1">Floor Staff View:</span>
                <MaskedPhone phone="9876543210" context="settings_preview" showWhatsAppBtn />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              By default, middle digits are hidden (`+91 98••• ••210`). Managers and Store Owners can click the eye icon to reveal the number. Every unmask action is recorded in the immutable audit log.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 3. GDPR Customer Data Privacy (Export / Anonymize) */}
      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" /> Customer Right-to-be-Forgotten (GDPR / DPDP)
          </CardTitle>
          <CardDescription>
            Export everything stored for one customer phone number, or anonymize it on request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="privacy-phone">Customer phone number</Label>
            <Input
              id="privacy-phone"
              inputMode="tel"
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!validPhone || busy !== null} onClick={doExport}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {busy === 'export' ? 'Exporting…' : 'Export data (JSON)'}
            </Button>
            <Button size="sm" variant="destructive" disabled={!validPhone || busy !== null} onClick={() => setConfirmAnon(true)}>
              <Eraser className="mr-1.5 h-3.5 w-3.5" />
              Anonymize customer
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Anonymizing replaces the phone number, name and message text with an anonymous marker across visits and follow-ups. This cannot be undone.
          </p>
        </CardContent>

        <DeleteConfirmationDialog
          open={confirmAnon}
          onOpenChange={setConfirmAnon}
          onConfirm={doAnonymize}
          title="Anonymize customer data"
          description={`This permanently masks all data for ${phone}. Continue?`}
          loading={busy === 'anonymize'}
        />
      </Card>
    </div>
  );
};
