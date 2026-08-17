import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';
import { toast } from 'sonner';
import { Plus, Trash2, Mail, Clock } from 'lucide-react';

interface Schedule {
  id: string;
  admin_id: string;
  recipient_email: string;
  report_time: string;
  frequency: string;
  timezone: string;
  is_enabled: boolean;
  last_sent_at: string | null;
}

export const ScheduledEmailReports = () => {
  const { profile } = useAuth();
  const [items, setItems] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [time, setTime] = useState('09:00');
  const [freq, setFreq] = useState('daily');
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Schedule | null>(null);
  const adminId = (profile as any)?.admin_id || profile?.id;

  const fetch = async () => {
    setLoading(true);
    const { data } = await (supabase.from('scheduled_email_reports') as any)
      .select('*').is('deleted_at', null).order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const add = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email');
      return;
    }
    setSaving(true);
    const { error } = await (supabase.from('scheduled_email_reports') as any).insert({
      admin_id: adminId,
      recipient_email: email.trim().toLowerCase(),
      report_time: (time.length === 5 ? time + ':00' : time),
      frequency: freq,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
      is_enabled: true,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Scheduled report added');
    setEmail(''); setTime('09:00'); setFreq('daily');
    fetch();
  };

  const toggle = async (s: Schedule) => {
    await (supabase.from('scheduled_email_reports') as any)
      .update({ is_enabled: !s.is_enabled }).eq('id', s.id);
    fetch();
  };

  const remove = async () => {
    if (!toDelete) return;
    await (supabase.from('scheduled_email_reports') as any)
      .update({ deleted_at: new Date().toISOString() }).eq('id', toDelete.id);
    setToDelete(null);
    fetch();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Scheduled Email Reports</CardTitle>
        <CardDescription>Auto-send visit reports to chosen email(s) at a specific time. Tenant-isolated.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div className="space-y-1 md:col-span-2">
            <Label>Recipient Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" />
          </div>
          <div className="space-y-1">
            <Label>Time</Label>
            <Input value={time} onChange={(e) => setTime(e.target.value)} type="time" />
          </div>
          <div className="space-y-1">
            <Label>Frequency</Label>
            <Select value={freq} onValueChange={setFreq}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly (Mon)</SelectItem>
                <SelectItem value="monthly">Monthly (1st)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={add} disabled={saving || !email.trim()} className="md:col-span-4">
            <Plus className="h-4 w-4 mr-1" /> Add Schedule
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No schedules yet</p>
        ) : (
          <div className="space-y-2">
            {items.map((s) => (
              <div key={s.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{s.recipient_email}</span>
                    <Badge variant="outline" className="text-xs capitalize">{s.frequency}</Badge>
                    <Badge variant="secondary" className="text-xs"><Clock className="h-3 w-3 mr-1" />{s.report_time.slice(0,5)}</Badge>
                  </div>
                  {s.last_sent_at && (
                    <span className="text-xs text-muted-foreground">Last sent: {new Date(s.last_sent_at).toLocaleString()}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={s.is_enabled} onCheckedChange={() => toggle(s)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setToDelete(s)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <DeleteConfirmationDialog
          open={!!toDelete}
          onOpenChange={(o) => !o && setToDelete(null)}
          onConfirm={remove}
          title="Delete Schedule"
          itemName={toDelete?.recipient_email}
        />
      </CardContent>
    </Card>
  );
};
