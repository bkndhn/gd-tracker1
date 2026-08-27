import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ShieldCheck, Download, Eraser } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';

/** GDPR-style per-customer export / anonymize by phone number. */
export const CustomerDataPrivacy = () => {
  const { profile } = useAuth();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState<'export' | 'anonymize' | null>(null);
  const [confirmAnon, setConfirmAnon] = useState(false);

  const role = (profile as any)?.role;
  if (role !== 'admin' && role !== 'super_admin') return null;

  const valid = phone.replace(/\D/g, '').length >= 10;

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
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" /> Customer data privacy
        </CardTitle>
        <CardDescription>
          Export everything stored for one customer phone number, or anonymize it on request (GDPR-style).
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
          <Button size="sm" variant="outline" disabled={!valid || busy !== null} onClick={doExport}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {busy === 'export' ? 'Exporting…' : 'Export data (JSON)'}
          </Button>
          <Button size="sm" variant="destructive" disabled={!valid || busy !== null} onClick={() => setConfirmAnon(true)}>
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
  );
};
