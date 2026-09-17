import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, MessageSquarePlus, Plus, Trash2 } from 'lucide-react';
import { formatISTDateTime } from '@/lib/dateUtils';

interface WaContact {
  id: string;
  phone: string;
  display_name: string | null;
  profile_id: string | null;
  is_approved: boolean;
  last_message_at: string | null;
}

const digitsOnly = (v: string) => v.replace(/\D/g, '');

/** Admin-only: approve the staff WhatsApp numbers allowed to log visits by message. */
export const WhatsAppIntakeSettings = () => {
  const { profile, adminId } = useAuth();
  const role = (profile as any)?.role;
  const canEdit = role === 'admin' || role === 'super_admin';

  const [rows, setRows] = useState<WaContact[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const webhookUrl = useMemo(
    () => `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/whatsapp-webhook`,
    [],
  );

  const load = useCallback(async () => {
    if (!canEdit) { setLoading(false); return; }
    setLoading(true);
    const [c, p] = await Promise.all([
      (supabase.from('wa_contacts') as any).select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, name').is('deleted_at', null).order('name'),
    ]);
    setRows((c.data as WaContact[]) || []);
    setStaff(((p.data as any[]) || []).map(r => ({ id: r.id, name: r.name })));
    setLoading(false);
  }, [canEdit]);

  useEffect(() => { load(); }, [load]);

  if (!canEdit) return null;

  const add = async () => {
    const digits = digitsOnly(phone);
    if (digits.length < 10 || digits.length > 15) {
      toast.error('Enter the full number with country code, e.g. 919876543210');
      return;
    }
    try {
      setSaving(true);
      const { error } = await (supabase.from('wa_contacts') as any).insert({
        admin_id: adminId,
        phone: digits,
        display_name: name.trim() || null,
        is_approved: true,
      });
      if (error) throw error;
      setPhone(''); setName('');
      toast.success('Number approved for visit logging');
      await load();
    } catch (e: any) {
      toast.error(e.message?.includes('duplicate') ? 'This number is already registered' : (e.message || 'Failed to add number'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (row: WaContact, value: boolean) => {
    setRows(rs => rs.map(r => (r.id === row.id ? { ...r, is_approved: value } : r)));
    const { error } = await (supabase.from('wa_contacts') as any).update({ is_approved: value }).eq('id', row.id);
    if (error) { toast.error(error.message); await load(); }
  };

  const linkStaff = async (row: WaContact, profileId: string) => {
    const value = profileId === 'none' ? null : profileId;
    setRows(rs => rs.map(r => (r.id === row.id ? { ...r, profile_id: value } : r)));
    const { error } = await (supabase.from('wa_contacts') as any).update({ profile_id: value }).eq('id', row.id);
    if (error) { toast.error(error.message); await load(); }
  };

  const remove = async (row: WaContact) => {
    const { error } = await (supabase.from('wa_contacts') as any).delete().eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Number removed');
    await load();
  };

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquarePlus className="h-4 w-4 text-green-600" />
          WhatsApp intake
        </CardTitle>
        <CardDescription>
          Approved staff can message your WhatsApp business number and the app turns it into a visit entry,
          asking which shop and which reason with numbered replies.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
          <Label className="text-xs">Meta webhook callback URL</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 min-w-0 truncate rounded bg-background px-2 py-1.5 text-xs">{webhookUrl}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('Copied'); }}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Paste this in Meta → WhatsApp → Configuration, use your verify token, and subscribe to the
            <span className="font-medium"> messages </span> field.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">Staff WhatsApp number (with country code)</Label>
            <Input
              inputMode="numeric"
              placeholder="919876543210"
              value={phone}
              onChange={(e) => setPhone(digitsOnly(e.target.value).slice(0, 15))}
            />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">Label (optional)</Label>
            <Input placeholder="e.g. Ravi – Anna Nagar" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button size="sm" onClick={add} disabled={saving}>
            <Plus className="h-4 w-4 mr-1.5" /> Add
          </Button>
        </div>

        {loading ? (
          <div className="h-20 animate-pulse rounded bg-muted" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No numbers registered yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map(row => (
              <div key={row.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">+{row.phone}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.display_name || 'No label'}
                    {row.last_message_at
                      ? ` · last message ${formatISTDateTime(row.last_message_at)}`
                      : ' · no messages yet'}
                  </p>
                </div>

                <select
                  className="h-9 rounded-md border bg-background px-2 text-xs"
                  value={row.profile_id ?? 'none'}
                  onChange={(e) => linkStaff(row, e.target.value)}
                >
                  <option value="none">Not linked to a user</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>

                <Badge variant={row.is_approved ? 'default' : 'secondary'} className="text-[10px]">
                  {row.is_approved ? 'Approved' : 'Pending'}
                </Badge>
                <Switch checked={row.is_approved} onCheckedChange={(v) => toggle(row, v)} />
                <Button size="icon" variant="ghost" onClick={() => remove(row)} aria-label="Remove number">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
