import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, RotateCcw } from 'lucide-react';
import { formatISTDateTime } from '@/lib/dateUtils';

interface WaEvent {
  id: string;
  event_id: string;
  kind: string;
  phone: string | null;
  status: string;
  error_message: string | null;
  attempts: number;
  payload: any;
  follow_up_id: string | null;
  entry_id: string | null;
  created_at: string;
  processed_at: string | null;
}

type Tab = 'all' | 'problems';

const statusTone: Record<string, string> = {
  processed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  unmatched: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  error: 'bg-destructive/10 text-destructive border-destructive/30',
  received: 'bg-muted text-muted-foreground',
  ignored: 'bg-muted text-muted-foreground',
};

const last10 = (v: string) => v.replace(/\D/g, '').slice(-10);

/** Admin-only: WhatsApp webhook health — processing errors, unmatched numbers, delivery sync. */
export const WhatsAppWebhookMonitor = () => {
  const { profile } = useAuth();
  const role = (profile as any)?.role;
  const canView = role === 'admin' || role === 'super_admin' || role === 'manager';
  const canFix = role === 'admin' || role === 'super_admin';

  const [rows, setRows] = useState<WaEvent[]>([]);
  const [delivery, setDelivery] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<Tab>('problems');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canView) { setLoading(false); return; }
    setLoading(true);
    const [e, f] = await Promise.all([
      (supabase.from('wa_webhook_events') as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      (supabase.from('follow_ups') as any).select('delivery_status').limit(1000),
    ]);
    setRows((e.data as WaEvent[]) || []);
    const counts: Record<string, number> = {};
    for (const r of ((f.data as any[]) || [])) {
      const k = r.delivery_status || 'queued';
      counts[k] = (counts[k] || 0) + 1;
    }
    setDelivery(counts);
    setLoading(false);
  }, [canView]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => (tab === 'problems' ? rows.filter(r => r.status === 'unmatched' || r.status === 'error') : rows),
    [rows, tab],
  );

  const counts = useMemo(() => ({
    processed: rows.filter(r => r.status === 'processed').length,
    unmatched: rows.filter(r => r.status === 'unmatched').length,
    error: rows.filter(r => r.status === 'error').length,
  }), [rows]);

  if (!canView) return null;

  /** Re-runs matching for an event that could not be linked when it first arrived. */
  const reprocess = async (row: WaEvent) => {
    setBusyId(row.id);
    try {
      if (row.kind === 'status') {
        const st = row.payload || {};
        const { data: fu } = await (supabase.from('follow_ups') as any)
          .select('id, delivery_status, delivered_at')
          .eq('wa_message_id', st.id)
          .maybeSingle();
        if (!fu) { toast.error('Still no follow-up linked to this message id'); return; }
        const ts = st.timestamp ? new Date(Number(st.timestamp) * 1000).toISOString() : new Date().toISOString();
        const patch: Record<string, unknown> = { delivery_status: st.status };
        if (st.status === 'delivered') patch.delivered_at = ts;
        if (st.status === 'read') { patch.read_at = ts; patch.delivered_at = fu.delivered_at ?? ts; }
        await (supabase.from('follow_ups') as any).update(patch).eq('id', fu.id);
        await (supabase.from('wa_webhook_events') as any)
          .update({ status: 'processed', error_message: null, follow_up_id: fu.id, processed_at: new Date().toISOString() })
          .eq('id', row.id);
        toast.success('Delivery status re-applied');
      } else {
        const phone = row.phone || '';
        if (last10(phone).length < 10) { toast.error('No usable phone number on this event'); return; }
        const { data: matches } = await (supabase.from('follow_ups') as any)
          .select('id, outcome, sent_at')
          .like('phone', `%${last10(phone)}`)
          .order('sent_at', { ascending: false })
          .limit(20);
        const list = (matches as any[]) || [];
        const fu = list.find(r => r.outcome === 'pending') || list[0];
        if (!fu) { toast.error('No follow-up found for this number yet'); return; }
        const text = row.payload?.text?.body || '';
        await (supabase.from('follow_ups') as any)
          .update({
            outcome: fu.outcome === 'pending' ? 'replied' : fu.outcome,
            outcome_at: new Date().toISOString(),
            outcome_note: text ? `Customer replied: ${String(text).slice(0, 500)}` : 'Customer replied',
            next_reminder_at: null,
          })
          .eq('id', fu.id);
        await (supabase.from('wa_webhook_events') as any)
          .update({ status: 'processed', error_message: null, follow_up_id: fu.id, processed_at: new Date().toISOString() })
          .eq('id', row.id);
        toast.success('Matched to follow-up');
      }
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Reprocess failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="premium-card">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-blue-600" />
            WhatsApp monitoring
          </CardTitle>
          <CardDescription>
            Webhook processing results, numbers that could not be matched, and delivery sync for follow-ups.
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Processed</p>
            <p className="text-lg font-semibold text-emerald-600">{counts.processed}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Unmatched</p>
            <p className="text-lg font-semibold text-amber-600">{counts.unmatched}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Errors</p>
            <p className="text-lg font-semibold text-destructive">{counts.error}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Delivery sync</p>
            <p className="text-xs font-medium leading-5">
              {['sent', 'delivered', 'read', 'failed', 'queued']
                .filter(k => delivery[k])
                .map(k => `${delivery[k]} ${k}`)
                .join(' · ') || 'No receipts yet'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {(['problems', 'all'] as Tab[]).map(t => (
            <Button key={t} size="sm" variant={tab === t ? 'default' : 'outline'} onClick={() => setTab(t)}>
              {t === 'problems' ? 'Needs attention' : 'All events'}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="h-24 animate-pulse rounded bg-muted" />
        ) : visible.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {tab === 'problems' ? 'Nothing needs attention.' : 'No webhook events yet.'}
          </p>
        ) : (
          <div className="space-y-2">
            {visible.map(row => (
              <div key={row.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {row.phone ? `+${row.phone}` : 'Unknown number'}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{row.kind}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatISTDateTime(row.created_at)}
                    {row.attempts > 1 && ` · ${row.attempts} duplicate deliveries ignored`}
                    {row.error_message && ` · ${row.error_message}`}
                  </p>
                </div>
                <Badge variant="outline" className={`text-[10px] ${statusTone[row.status] || ''}`}>
                  {row.status === 'error' && <AlertTriangle className="mr-1 h-3 w-3" />}
                  {row.status}
                </Badge>
                {canFix && (row.status === 'unmatched' || row.status === 'error') && (
                  <Button size="sm" variant="outline" disabled={busyId === row.id} onClick={() => reprocess(row)}>
                    <RotateCcw className={`h-3.5 w-3.5 mr-1.5 ${busyId === row.id ? 'animate-spin' : ''}`} /> Reprocess
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
