import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { logAudit } from '@/utils/auditLog';
import { buildUpiDeepLink, generateQRCodeSVG, PlatformPaymentSettings as PaymentSettingsData } from '@/utils/upiPayment';
import {
  CreditCard,
  Building,
  QrCode,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Save,
  ShieldCheck,
  Info,
  RefreshCw
} from 'lucide-react';

const SETTING_KEY = 'platform_payment_settings';

const DEFAULT_SETTINGS: PaymentSettingsData = {
  upi_id: '',
  payee_name: '',
  bank_name: '',
  account_number: '',
  ifsc_code: '',
  account_holder: '',
  qr_note: 'Subscription Payment',
};

export const PlatformPaymentSettings: React.FC = () => {
  const [settings, setSettings] = useState<PaymentSettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [testAmount, setTestAmount] = useState<number>(100);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase.from('app_settings') as any)
        .select('value')
        .eq('key', SETTING_KEY)
        .is('admin_id', null)
        .maybeSingle();

      if (error) throw error;
      if (data?.value && typeof data.value === 'object') {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data.value,
        });
      }
    } catch (e: any) {
      if (import.meta.env.DEV) console.error('Error fetching platform payment settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings.upi_id?.trim()) {
      toast.error('Please specify a valid receiving UPI ID (e.g. merchant@upi)');
      return;
    }

    setSaving(true);
    try {
      // Upsert into app_settings with admin_id: null
      const { data: existing } = await (supabase.from('app_settings') as any)
        .select('id')
        .eq('key', SETTING_KEY)
        .is('admin_id', null)
        .maybeSingle();

      if (existing) {
        const { error } = await (supabase.from('app_settings') as any)
          .update({ value: settings })
          .eq('key', SETTING_KEY)
          .is('admin_id', null);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from('app_settings') as any)
          .insert({
            key: SETTING_KEY,
            value: settings,
            admin_id: null,
          });
        if (error) throw error;
      }

      await logAudit({
        action: 'update_payment_settings',
        details: {
          upi_id: settings.upi_id,
          payee_name: settings.payee_name,
          bank_name: settings.bank_name,
        },
      });

      toast.success('Platform payment receiving details saved successfully!');
    } catch (e: any) {
      console.error('Failed to save payment settings:', e);
      toast.error(e.message || 'Failed to update payment settings');
    } finally {
      setSaving(false);
    }
  };

  const previewUpiLink = buildUpiDeepLink({
    upiId: settings.upi_id || 'sample@upi',
    payeeName: settings.payee_name || 'GD Tracker Enterprise',
    amount: testAmount || 100,
    note: settings.qr_note || 'Test Payment',
  });

  const qrSvg = generateQRCodeSVG(previewUpiLink, 180, 2);

  const handleCopyUpiId = async () => {
    if (!settings.upi_id) return;
    await navigator.clipboard.writeText(settings.upi_id);
    setCopiedUpi(true);
    toast.success('UPI ID copied to clipboard');
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  if (loading) {
    return (
      <Card className="border bg-card shadow-sm animate-pulse">
        <CardContent className="p-6 space-y-4">
          <div className="h-6 w-48 bg-muted rounded" />
          <div className="h-10 w-full bg-muted rounded" />
          <div className="h-10 w-full bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border bg-card shadow-sm rounded-2xl overflow-hidden">
      <CardHeader className="bg-muted/30 border-b pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Platform Receiving Payment Settings (UPI & Bank)
            </CardTitle>
            <CardDescription className="text-xs">
              Configure receiving UPI ID and bank transfer account details. Clients with payments enabled can pay in 1-click via native mobile UPI or scan QR code.
            </CardDescription>
          </div>
          <Badge variant="outline" className="self-start sm:self-auto text-xs py-1 px-2.5 gap-1.5 border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Super Admin Controlled
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1 & 2: Form Fields */}
            <div className="lg:col-span-2 space-y-4">
              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300 flex items-start gap-2.5">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  When configured, tenants whose subscription has <strong>payment enabled</strong> will see a <strong>"Pay via UPI"</strong> button that launches Google Pay, PhonePe, Paytm, or BHIM instantly on mobile devices.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="upi_id" className="text-xs font-semibold flex items-center gap-1.5">
                    Receiving UPI ID / VPA <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="upi_id"
                    placeholder="e.g. gdtracker@okaxis or merchant@upi"
                    value={settings.upi_id}
                    onChange={(e) => setSettings({ ...settings, upi_id: e.target.value.trim() })}
                    className="h-10 text-sm font-mono"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">The VPA address where client subscription payments will be credited.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="payee_name" className="text-xs font-semibold">
                    Payee Business / Merchant Name <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="payee_name"
                    placeholder="e.g. GD Tracker Enterprise"
                    value={settings.payee_name}
                    onChange={(e) => setSettings({ ...settings, payee_name: e.target.value })}
                    className="h-10 text-sm"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">Name shown to the client inside their UPI app during authorization.</p>
                </div>
              </div>

              {/* Bank Details */}
              <div className="pt-2 border-t space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Building className="h-4 w-4 text-primary" />
                  Bank Account Transfer Details (Direct NEFT / RTGS / IMPS)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="bank_name" className="text-xs font-medium">Bank Name</Label>
                    <Input
                      id="bank_name"
                      placeholder="e.g. State Bank of India"
                      value={settings.bank_name || ''}
                      onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="account_holder" className="text-xs font-medium">Account Holder Name</Label>
                    <Input
                      id="account_holder"
                      placeholder="e.g. GD Tracker Technologies Pvt Ltd"
                      value={settings.account_holder || ''}
                      onChange={(e) => setSettings({ ...settings, account_holder: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="account_number" className="text-xs font-medium">Account Number</Label>
                    <Input
                      id="account_number"
                      placeholder="e.g. 50200012345678"
                      value={settings.account_number || ''}
                      onChange={(e) => setSettings({ ...settings, account_number: e.target.value.trim() })}
                      className="h-9 text-sm font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ifsc_code" className="text-xs font-medium">IFSC Code</Label>
                    <Input
                      id="ifsc_code"
                      placeholder="e.g. SBIN0001234"
                      value={settings.ifsc_code || ''}
                      onChange={(e) => setSettings({ ...settings, ifsc_code: e.target.value.toUpperCase().trim() })}
                      className="h-9 text-sm font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="qr_note" className="text-xs font-medium">Default Payment Remark / Note</Label>
                  <Input
                    id="qr_note"
                    placeholder="e.g. GD-Tracker Workspace Subscription Fee"
                    value={settings.qr_note || ''}
                    onChange={(e) => setSettings({ ...settings, qr_note: e.target.value })}
                    className="h-9 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">Pre-filled memo in client UPI transfer remarks.</p>
                </div>
              </div>
            </div>

            {/* Column 3: Live Test & QR Code Preview */}
            <div className="p-4 rounded-2xl border bg-muted/20 flex flex-col items-center justify-between text-center space-y-4">
              <div className="w-full">
                <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  <QrCode className="h-4 w-4 text-primary" />
                  Live UPI QR Preview
                </div>

                <div className="p-3 bg-white rounded-2xl shadow-sm border inline-block mx-auto">
                  <div
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                    className="w-44 h-44 flex items-center justify-center"
                  />
                </div>

                <div className="mt-3 space-y-1">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {settings.payee_name || 'GD Tracker Enterprise'}
                  </p>
                  <div className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-lg max-w-full">
                    <span className="truncate">{settings.upi_id || 'upi_id@bank'}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyUpiId}
                      className="h-5 w-5 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      {copiedUpi ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="w-full pt-3 border-t border-border/60 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Simulated Amount:</span>
                  <div className="flex items-center gap-1">
                    <span>₹</span>
                    <input
                      type="number"
                      min={1}
                      value={testAmount}
                      onChange={(e) => setTestAmount(Number(e.target.value) || 1)}
                      className="w-16 h-6 px-1 text-right text-xs bg-background border rounded font-mono"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full gap-1.5 text-xs h-8 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
                >
                  <a href={previewUpiLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> Test UPI Intent Link
                  </a>
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t">
            <Button
              type="submit"
              disabled={saving}
              className="gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md font-semibold"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Platform Payment Settings
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
