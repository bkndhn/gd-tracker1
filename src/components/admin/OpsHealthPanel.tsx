import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HeartPulse, RefreshCw, Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface StatusRow {
  label: string;
  state: 'ok' | 'warn' | 'bad' | 'idle';
  detail: string;
}

const Icon = ({ state }: { state: StatusRow['state'] }) =>
  state === 'ok' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
  state === 'warn' ? <AlertTriangle className="h-4 w-4 text-amber-500" /> :
  state === 'bad' ? <XCircle className="h-4 w-4 text-destructive" /> :
  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;

const ago = (d?: string | null) => d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : 'never';

/** Unified operational health: sync queue, exports, digests, backups, webhook errors. */
export const OpsHealthPanel = () => {
  const { profile } = useAuth();
  const { pendingCount, failedCount, isSyncing } = useOfflineSync();
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);

  const role = (profile as any)?.role;
  const adminId = role === 'admin' || role === 'super_admin' ? profile?.id : (profile as any)?.admin_id;

  const load = async () => {
    if (!adminId) return;
    setLoading(true);
    try {
      const [failedJobs, digest, backup, webhookErr] = await Promise.all([
        (supabase.from('export_jobs') as any)
          .select('id', { count: 'exact', head: true })
          .eq('admin_id', adminId).eq('status', 'failed')
          .gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()),
        (supabase.from('weekly_digests') as any)
          .select('created_at, emailed_to')
          .eq('admin_id', adminId)
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        (supabase.from('backup_logs') as any)
          .select('created_at, status, error_message')
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        (supabase.from('wa_webhook_events') as any)
          .select('id', { count: 'exact', head: true })
          .eq('admin_id', adminId).eq('status', 'failed')
          .gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()),
      ]);

      const list: StatusRow[] = [];

      list.push({
        label: 'Offline sync queue',
        state: failedCount > 0 ? 'bad' : pendingCount > 0 ? 'warn' : 'ok',
        detail: isSyncing ? 'Syncing now…' : failedCount > 0
          ? `${failedCount} failed, ${pendingCount} pending on this device`
          : pendingCount > 0 ? `${pendingCount} entries waiting on this device` : 'All entries delivered',
      });

      const fj = failedJobs.count || 0;
      list.push({
        label: 'Server exports (7d)',
        state: fj > 0 ? 'warn' : 'ok',
        detail: fj > 0 ? `${fj} failed export job${fj === 1 ? '' : 's'} in the last 7 days` : 'No failed export jobs',
      });

      list.push({
        label: 'Weekly digest',
        state: digest.data ? 'ok' : 'idle',
        detail: digest.data
          ? `Last sent ${ago(digest.data.created_at)}${digest.data.emailed_to ? ` to ${digest.data.emailed_to}` : ''}`
          : 'No digest generated yet',
      });

      const b = backup.data;
      list.push({
        label: 'Google Drive backup',
        state: !b ? 'idle' : b.status === 'success' ? 'ok' : 'bad',
        detail: !b ? 'No backup recorded yet' : b.status === 'success'
          ? `Last backup ${ago(b.created_at)}`
          : `Failed ${ago(b.created_at)}${b.error_message ? ` — ${b.error_message.slice(0, 80)}` : ''}`,
      });

      const we = webhookErr.count || 0;
      list.push({
        label: 'WhatsApp webhook (7d)',
        state: we > 0 ? 'warn' : 'ok',
        detail: we > 0 ? `${we} failed event${we === 1 ? '' : 's'} in the last 7 days` : 'No failed webhook events',
      });

      setRows(list);
    } catch (e) {
      if (import.meta.env.DEV) console.error('OpsHealthPanel', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [adminId]);

  const overall: StatusRow['state'] = rows.some(r => r.state === 'bad') ? 'bad' : rows.some(r => r.state === 'warn') ? 'warn' : 'ok';

  return (
    <Card className="premium-card">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartPulse className="h-4 w-4 text-primary" /> System health
            {!loading && (
              <Badge variant={overall === 'ok' ? 'secondary' : overall === 'warn' ? 'outline' : 'destructive'} className="text-[10px]">
                {overall === 'ok' ? 'All clear' : overall === 'warn' ? 'Needs attention' : 'Action required'}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Sync queue, exports, digests, backups and webhook status in one place.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2">
          {(loading && rows.length === 0 ? [] : rows).map(r => (
            <div key={r.label} className="flex items-start gap-2.5 rounded-lg border p-3">
              <Icon state={r.state} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.detail}</p>
              </div>
            </div>
          ))}
          {loading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Checking systems…</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
