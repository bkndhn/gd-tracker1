import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Gauge } from 'lucide-react';

interface Meter {
  label: string;
  used: number;
  limit: number | null; // null = unlimited
}

const Bar = ({ used, limit }: { used: number; limit: number | null }) => {
  const pct = !limit ? 8 : Math.min(100, Math.round((used / limit) * 100));
  const color = !limit ? 'bg-primary' : pct >= 100 ? 'bg-destructive' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.max(pct, 3)}%` }} />
    </div>
  );
};

/** Per-tenant usage vs plan limits, visible to each Admin. */
export const UsageMetering = () => {
  const { profile } = useAuth();
  const [meters, setMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState(true);

  const role = (profile as any)?.role;
  const isAdmin = role === 'admin' || role === 'super_admin';
  const adminId = role === 'admin' || role === 'super_admin' ? profile?.id : (profile as any)?.admin_id;

  useEffect(() => {
    if (!profile?.id || !adminId) return;
    (async () => {
      try {
        const monthStart = new Date();
        monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

        const [adminProf, entries, users, shops, images, ai] = await Promise.all([
          supabase.from('profiles').select('max_entries, max_users, max_shops, max_images_total, ai_monthly_limit').eq('id', adminId).single(),
          supabase.from('goods_damaged_entries').select('id', { count: 'exact', head: true }).eq('admin_id', adminId).gte('created_at', monthStart.toISOString()),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('admin_id', adminId).is('deleted_at', null),
          supabase.from('shops').select('id', { count: 'exact', head: true }).eq('admin_id', adminId).is('deleted_at', null),
          supabase.from('gd_entry_images').select('id', { count: 'exact', head: true }),
          supabase.from('ai_usage_log').select('id', { count: 'exact', head: true }).eq('admin_id', adminId).gte('created_at', monthStart.toISOString()),
        ]);

        const p = (adminProf.data || {}) as any;
        setMeters([
          { label: 'Entries this month', used: entries.count || 0, limit: p.max_entries ?? null },
          { label: 'Team members', used: users.count || 0, limit: p.max_users ?? null },
          { label: 'Shops', used: shops.count || 0, limit: p.max_shops ?? null },
          { label: 'Images stored', used: images.count || 0, limit: p.max_images_total ?? null },
          { label: 'AI insights this month', used: ai.count || 0, limit: p.ai_monthly_limit ?? null },
        ]);
      } catch (e) {
        if (import.meta.env.DEV) console.error('UsageMetering', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [profile?.id, adminId]);

  const nearLimit = meters.some(m => m.limit && m.used / m.limit >= 0.8);

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4 text-primary" /> Plan & Limit Usage
        </CardTitle>
        <CardDescription>Current usage against the limits set for your account (visible to all users).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {nearLimit && (
              <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                You are close to a plan limit. Contact your provider to upgrade before new entries are blocked.
              </p>
            )}
            {meters.map(m => (
              <div key={m.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{m.label}</span>
                  <span className="text-muted-foreground">
                    {m.used.toLocaleString()}{m.limit ? ` / ${m.limit.toLocaleString()}` : ' (unlimited)'}
                  </span>
                </div>
                <Bar used={m.used} limit={m.limit} />
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
};
