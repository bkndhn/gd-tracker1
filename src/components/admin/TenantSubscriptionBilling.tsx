import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { logAudit } from '@/utils/auditLog';
import {
  buildUpiDeepLink,
  generateQRCodeSVG,
  PlatformPaymentSettings,
} from '@/utils/upiPayment';
import {
  CreditCard,
  IndianRupee,
  QrCode,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  Send,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Smartphone
} from 'lucide-react';

interface TenantSubscriptionBillingProps {
  adminId?: string;
  onPaymentSubmitted?: () => void;
}

export const TenantSubscriptionBilling: React.FC<TenantSubscriptionBillingProps> = ({
  adminId: propAdminId,
  onPaymentSubmitted,
}) => {
  const { profile, user } = useAuth();
  const effectiveAdminId = propAdminId || (profile as any)?.admin_id || profile?.id;

  const [loading, setLoading] = useState(true);
  const [tenantProfile, setTenantProfile] = useState<any>(null);
  const [platformPayment, setPlatformPayment] = useState<PlatformPaymentSettings | null>(null);

  // Modals & User interaction
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [utrInput, setUtrInput] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);

  // Copy tracking
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchBillingData = async () => {
    if (!effectiveAdminId) return;
    try {
      setLoading(true);
      const [profileRes, settingsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, subscription_amount, billing_cycle, show_plan_to_client, payment_enabled, payment_status, last_payment_date, last_payment_ref' as any)
          .eq('id', effectiveAdminId)
          .maybeSingle(),
        (supabase.from('app_settings') as any)
          .select('value')
          .eq('key', 'platform_payment_settings')
          .is('admin_id', null)
          .maybeSingle(),
      ]);

      if (profileRes.data) {
        setTenantProfile(profileRes.data);
      }
      if (settingsRes.data?.value) {
        setPlatformPayment(settingsRes.data.value as PlatformPaymentSettings);
      }
    } catch (e: any) {
      if (import.meta.env.DEV) console.error('Error loading billing info:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, [effectiveAdminId]);

  const handleCopy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUtr = utrInput.trim();
    if (!cleanUtr || cleanUtr.length < 6) {
      toast.error('Please enter a valid 12-digit UPI UTR or Bank Transaction Reference ID');
      return;
    }

    setSubmittingUtr(true);
    try {
      const now = new Date().toISOString();
      const { error } = await (supabase.from('profiles') as any)
        .update({
          payment_status: 'pending_verification',
          last_payment_ref: cleanUtr,
          last_payment_date: now,
        })
        .eq('id', effectiveAdminId);

      if (error) throw error;

      await logAudit({
        action: 'tenant_submit_payment_ref',
        targetType: 'profile',
        targetId: effectiveAdminId,
        details: { utr: cleanUtr, workspace: tenantProfile?.name },
      });

      toast.success('Payment reference submitted successfully! Super Admin will verify and confirm.');
      setUtrInput('');
      fetchBillingData();
      if (onPaymentSubmitted) onPaymentSubmitted();
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit payment reference');
    } finally {
      setSubmittingUtr(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 rounded-2xl border bg-muted/20 animate-pulse space-y-3">
        <div className="h-5 w-40 bg-muted rounded" />
        <div className="h-16 w-full bg-muted rounded" />
      </div>
    );
  }

  // If payment is disabled for this tenant, or plan is hidden, hide billing card
  if (!tenantProfile || tenantProfile.payment_enabled === false) {
    return null;
  }

  const amount = tenantProfile.subscription_amount ? Number(tenantProfile.subscription_amount) : 0;
  const cycle = tenantProfile.billing_cycle || 'monthly';
  const status = tenantProfile.payment_status || 'unpaid';
  const upiId = platformPayment?.upi_id || '';
  const payeeName = platformPayment?.payee_name || 'GD Tracker Platform';
  const note = `Sub Fee - ${tenantProfile.name || 'Workspace'}`;

  // 1-Click Native Mobile UPI Deep Link
  const upiDeepLink = buildUpiDeepLink({
    upiId,
    payeeName,
    amount,
    note,
  });

  const qrSvg = generateQRCodeSVG(upiDeepLink, 200, 2);

  return (
    <Card className="border border-border/80 bg-gradient-to-br from-card to-muted/20 shadow-md rounded-2xl sm:rounded-3xl overflow-hidden mb-6">
      <CardHeader className="p-4 sm:p-5 border-b border-border/60 bg-muted/30 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 shrink-0">
              <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold">Workspace Subscription & Billing</CardTitle>
              <CardDescription className="text-xs">
                Manage your subscription fee and pay in 1-click via native mobile UPI or bank transfer.
              </CardDescription>
            </div>
          </div>

          <div className="self-start sm:self-auto flex items-center gap-1.5">
            {status === 'paid' ? (
              <Badge variant="outline" className="py-1 px-2.5 gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="h-3.5 w-3.5" /> Subscription Active
              </Badge>
            ) : status === 'pending_verification' ? (
              <Badge variant="outline" className="py-1 px-2.5 gap-1.5 border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs">
                <Clock className="h-3.5 w-3.5 animate-spin" /> Verification Pending
              </Badge>
            ) : (
              <Badge variant="outline" className="py-1 px-2.5 gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs">
                <AlertCircle className="h-3.5 w-3.5" /> Payment Due
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-5">
        {/* Top Highlight Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl border bg-card/60 space-y-1">
            <span className="text-[11px] text-muted-foreground block font-medium">Subscription Amount</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">₹{amount.toLocaleString('en-IN')}</span>
              <span className="text-xs text-muted-foreground">/{cycle}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card/60 space-y-1">
            <span className="text-[11px] text-muted-foreground block font-medium">Payment Channel</span>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Smartphone className="h-4 w-4 text-emerald-500" />
              <span>Instant 1-Click UPI & QR</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card/60 space-y-1">
            <span className="text-[11px] text-muted-foreground block font-medium">Invoice Status</span>
            <div className="text-sm font-semibold text-foreground capitalize">
              {status === 'pending_verification'
                ? `UTR Submitted (${tenantProfile.last_payment_ref || 'Under Review'})`
                : status}
            </div>
          </div>
        </div>

        {/* 1-Click UPI Intent Button & Quick Actions */}
        {upiId && amount > 0 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-blue-500/10 to-teal-500/10 border border-indigo-500/20 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  <span className="font-bold text-sm text-foreground">Single-Click Mobile Payment</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tap below on mobile to automatically open Google Pay, PhonePe, Paytm, or BHIM with ₹{amount} prefilled.
                </p>
              </div>

              {/* Single Click UPI Deep Link Button */}
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <Button
                  asChild
                  size="lg"
                  className="h-11 px-6 gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg shadow-indigo-500/25 font-bold text-sm transition-all transform active:scale-95"
                >
                  <a href={upiDeepLink}>
                    <Smartphone className="h-4 w-4" />
                    Pay ₹{amount.toLocaleString('en-IN')} via UPI
                  </a>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => setQrModalOpen(true)}
                  className="h-11 px-4 gap-1.5 border-border/80 text-foreground text-xs font-semibold"
                >
                  <QrCode className="h-4 w-4" />
                  Show QR
                </Button>

                {platformPayment?.account_number && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => setBankModalOpen(true)}
                    className="h-11 px-4 gap-1.5 border-border/80 text-foreground text-xs font-semibold"
                  >
                    <Building className="h-4 w-4" />
                    Bank Details
                  </Button>
                )}
              </div>
            </div>

            {/* Quick UPI ID display */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-indigo-500/15 text-xs">
              <span className="text-muted-foreground">Payee UPI VPA: <strong className="text-foreground font-mono">{upiId}</strong></span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(upiId, 'upiId')}
                className="h-6 text-[11px] gap-1 px-2"
              >
                {copiedKey === 'upiId' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                Copy UPI ID
              </Button>
            </div>
          </div>
        )}

        {/* UTR / Transaction Reference Submission Form */}
        <form onSubmit={handleSubmitUtr} className="p-3.5 sm:p-4 rounded-2xl border bg-muted/20 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="utr-input" className="text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Already Paid? Submit 12-Digit UPI Ref / UTR Number
            </Label>
            {tenantProfile.last_payment_ref && (
              <span className="text-[10px] text-muted-foreground font-mono">
                Current Ref: {tenantProfile.last_payment_ref}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              id="utr-input"
              placeholder="e.g. 428901928371 (12 digits)"
              value={utrInput}
              onChange={(e) => setUtrInput(e.target.value)}
              className="h-10 text-sm font-mono tracking-wider flex-1"
            />
            <Button
              type="submit"
              disabled={submittingUtr || !utrInput.trim()}
              className="h-10 px-4 gap-1.5 bg-foreground text-background hover:bg-foreground/90 shrink-0 font-semibold text-xs"
            >
              <Send className="h-3.5 w-3.5" />
              {submittingUtr ? 'Submitting...' : 'Submit Reference'}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            After paying through your UPI app, paste the 12-digit UTR/UPI reference code here for instant administrator verification.
          </p>
        </form>

        {/* Dynamic QR Code Modal */}
        <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
          <DialogContent className="w-[92vw] max-w-sm rounded-2xl sm:rounded-3xl p-5 text-center space-y-4">
            <DialogHeader className="text-center">
              <DialogTitle className="text-base sm:text-lg font-bold">Scan to Pay via UPI</DialogTitle>
              <DialogDescription className="text-xs">
                Scan with Google Pay, PhonePe, Paytm, BHIM, or any UPI app
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 bg-white rounded-2xl border shadow-sm inline-block mx-auto">
              <div
                dangerouslySetInnerHTML={{ __html: qrSvg }}
                className="w-48 h-48 flex items-center justify-center mx-auto"
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-bold text-foreground">₹{amount.toLocaleString('en-IN')}</div>
              <div className="text-xs text-muted-foreground font-mono">{upiId}</div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 text-xs gap-1"
                onClick={() => handleCopy(upiId, 'modalUpi')}
              >
                {copiedKey === 'modalUpi' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                Copy UPI ID
              </Button>
              <Button
                asChild
                className="flex-1 text-xs gap-1 bg-gradient-to-r from-indigo-600 to-blue-600 text-white"
              >
                <a href={upiDeepLink}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open UPI App
                </a>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bank Details Modal */}
        <Dialog open={bankModalOpen} onOpenChange={setBankModalOpen}>
          <DialogContent className="w-[94vw] max-w-md rounded-2xl sm:rounded-3xl p-5 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" /> Direct Bank Transfer Details
              </DialogTitle>
              <DialogDescription className="text-xs">
                Transfer via NEFT, RTGS, or IMPS using the following account details.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2.5 text-xs bg-muted/30 p-3.5 rounded-2xl border border-border/60">
              {platformPayment?.bank_name && (
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Bank Name:</span>
                  <span className="font-semibold text-foreground">{platformPayment.bank_name}</span>
                </div>
              )}

              {platformPayment?.account_holder && (
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Account Holder:</span>
                  <span className="font-semibold text-foreground">{platformPayment.account_holder}</span>
                </div>
              )}

              {platformPayment?.account_number && (
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Account Number:</span>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-foreground">
                    <span>{platformPayment.account_number}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(platformPayment.account_number!, 'accNum')}
                      className="h-6 w-6 p-0"
                    >
                      {copiedKey === 'accNum' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              )}

              {platformPayment?.ifsc_code && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">IFSC Code:</span>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-foreground">
                    <span>{platformPayment.ifsc_code}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(platformPayment.ifsc_code!, 'ifsc')}
                      className="h-6 w-6 p-0"
                    >
                      {copiedKey === 'ifsc' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground">
              After transfer, please submit the UTR / Transaction Reference number in the form to activate your invoice.
            </p>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
