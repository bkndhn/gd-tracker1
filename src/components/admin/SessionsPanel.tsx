import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MonitorSmartphone, LogOut } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getDeviceId } from '@/hooks/useSessionTracking';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';

interface SessionRow {
  id: string;
  user_id: string;
  device_id: string;
  device_label: string | null;
  last_active_at: string;
  revoked_at: string | null;
  created_at: string;
  profiles?: { name: string; email: string | null } | null;
}

/** Active device sessions: users manage their own devices; admins can revoke tenant devices. */
export const SessionsPanel = () => {
  const { profile, signOut } = useAuth();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<SessionRow | null>(null);
  const [busy, setBusy] = useState(false);

  const role = (profile as any)?.role;
  const isAdmin = role === 'admin' || role === 'super_admin';
  const myDevice = getDeviceId();

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      let q = (supabase.from('user_sessions') as any)
        .select('*, profiles:user_id(name, email)')
        .order('last_active_at', { ascending: false })
        .limit(100);
      if (!isAdmin) q = q.eq('user_id', profile.id);
      const { data, error } = await q;
      if (error) throw error;
      setRows((data || []) as SessionRow[]);
    } catch (e) {
      if (import.meta.env.DEV) console.error('SessionsPanel', e);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const revoke = async (row: SessionRow) => {
    setBusy(true);
    try {
      const { error } = await (supabase.from('user_sessions') as any)
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) throw error;
      toast.success('Device signed out');
      if (row.device_id === myDevice) {
        await signOut();
        return;
      }
      await load();
    } catch (e) {
      toast.error((e as Error).message || 'Could not revoke device');
    } finally {
      setBusy(false);
      setRevokeTarget(null);
    }
  };

  const revokeOthers = async () => {
    setBusy(true);
    try {
      const { error } = await (supabase.from('user_sessions') as any)
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', profile!.id)
        .neq('device_id', myDevice)
        .is('revoked_at', null);
      if (error) throw error;
      toast.success('All other devices signed out');
      await load();
    } catch (e) {
      toast.error((e as Error).message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const active = rows.filter(r => !r.revoked_at);

  return (
    <Card className="premium-card">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <MonitorSmartphone className="h-4 w-4 text-primary" /> Signed-in devices
          </CardTitle>
          <CardDescription>
            {isAdmin ? 'All devices signed in across your team. Revoke any device to force it out.' : 'Devices where your account is signed in.'}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={revokeOthers} disabled={busy || active.filter(r => r.user_id === profile?.id && r.device_id !== myDevice).length === 0}>
          <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out my other devices
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active devices found.</p>
        ) : (
          <div className="space-y-2">
            {active.map(r => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {r.device_label || 'Unknown device'}
                    {r.device_id === myDevice && <Badge variant="secondary" className="ml-2 text-[10px]">This device</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isAdmin && r.profiles ? `${r.profiles.name || r.profiles.email || 'User'} · ` : ''}
                    Active {formatDistanceToNow(new Date(r.last_active_at), { addSuffix: true })}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setRevokeTarget(r)} disabled={busy}>
                  Sign out
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <DeleteConfirmationDialog
        open={!!revokeTarget}
        onOpenChange={(v) => !v && setRevokeTarget(null)}
        onConfirm={() => revokeTarget && revoke(revokeTarget)}
        title="Sign out device"
        description={`Sign out "${revokeTarget?.device_label || 'this device'}"? It will be logged out within a few minutes.`}
        loading={busy}
      />
    </Card>
  );
};
