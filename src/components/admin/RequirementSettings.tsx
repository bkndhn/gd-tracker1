import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Warehouse, AlertTriangle, ClipboardList, Gauge, ShieldAlert, Users, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useRequirementsAccess } from '@/hooks/useRequirementsAccess';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const MeterBar = ({ used, limit }: { used: number; limit: number | null }) => {
  const pct = !limit ? 5 : Math.min(100, Math.round((used / limit) * 100));
  const color = !limit
    ? 'bg-primary'
    : pct >= 100
    ? 'bg-destructive'
    : pct >= 80
    ? 'bg-amber-500'
    : 'bg-emerald-500';

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${Math.max(pct, 3)}%` }}
      />
    </div>
  );
};

export const RequirementSettings = () => {
  const { visible, tenantEnabled, loading, save, canEdit } = useRequirementsAccess();
  const { profile, adminId } = useAuth();

  const effectiveAdminId = adminId || (profile as any)?.admin_id || profile?.id;

  // Quotas & Usage State
  const [loadingQuotas, setLoadingQuotas] = useState(true);
  const [maxReqMonthly, setMaxReqMonthly] = useState<number | null>(null);
  const [maxWarehouseStaff, setMaxWarehouseStaff] = useState<number | null>(null);
  const [reqUsedThisMonth, setReqUsedThisMonth] = useState(0);
  const [warehouseStaffUsed, setWarehouseStaffUsed] = useState(0);

  useEffect(() => {
    if (!effectiveAdminId) return;

    let isMounted = true;
    (async () => {
      try {
        setLoadingQuotas(true);
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const [adminProfRes, reqCountRes, staffCountRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('max_requirements_monthly, max_warehouse_users' as any)
            .eq('id', effectiveAdminId)
            .single(),
          supabase
            .from('stock_requirements')
            .select('id', { count: 'exact', head: true })
            .eq('admin_id', effectiveAdminId)
            .gte('created_at', monthStart.toISOString()),
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('admin_id', effectiveAdminId)
            .eq('role', 'warehouse')
            .is('deleted_at', null),
        ]);

        if (isMounted) {
          const profData = (adminProfRes.data as any) || {};
          setMaxReqMonthly(profData.max_requirements_monthly ?? null);
          setMaxWarehouseStaff(profData.max_warehouse_users ?? null);
          setReqUsedThisMonth(reqCountRes.count || 0);
          setWarehouseStaffUsed(staffCountRes.count || 0);
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error('RequirementSettings load quotas:', e);
      } finally {
        if (isMounted) setLoadingQuotas(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [effectiveAdminId]);

  const onToggle = async (next: boolean) => {
    try {
      await save(next, next ? 'Requirements tab shown' : 'Requirements tab hidden');
      toast.success(next ? 'Requirements tab is now visible' : 'Requirements tab hidden');
    } catch (e: any) {
      toast.error(e.message || 'Could not save this setting');
    }
  };

  const reqPct = maxReqMonthly ? Math.round((reqUsedThisMonth / maxReqMonthly) * 100) : 0;
  const staffPct = maxWarehouseStaff ? Math.round((warehouseStaffUsed / maxWarehouseStaff) * 100) : 0;

  const isNearLimit = (maxReqMonthly && reqPct >= 80) || (maxWarehouseStaff && staffPct >= 80);
  const isCapped = (maxReqMonthly && reqPct >= 100) || (maxWarehouseStaff && staffPct >= 100);

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5 text-primary" /> Stock Requirements & Warehouse Settings
          </CardTitle>
          <CardDescription>
            Enable requirement requests and warehouse fulfillment tracking across your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!tenantEnabled ? (
            <p className="text-sm text-muted-foreground">
              This feature is switched off for your account. Ask your platform provider to enable it.
            </p>
          ) : (
            <div className="flex items-center justify-between rounded-xl border p-4 bg-muted/20">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="font-medium text-sm">Show Requirements Tab</Label>
                  <Badge variant={visible !== false ? 'default' : 'outline'} className="text-xs">
                    {visible !== false ? 'Enabled' : 'Hidden'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  When enabled, shop staff can raise size requirements, and warehouse staff can pack and fulfill them.
                </p>
              </div>
              <Switch checked={visible !== false} disabled={loading || !canEdit} onCheckedChange={onToggle} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Limits & Quotas Card */}
      <Card className="premium-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-5 w-5 text-indigo-500" /> Stock Requirements Limits & Quotas
            </CardTitle>
            {isCapped ? (
              <Badge variant="destructive" className="gap-1 text-xs">
                <ShieldAlert className="h-3 w-3" /> Quota Reached
              </Badge>
            ) : isNearLimit ? (
              <Badge variant="outline" className="gap-1 text-xs border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20 font-semibold">
                <AlertTriangle className="h-3 w-3" /> Approaching Limit (≥80%)
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20">
                Active & Healthy
              </Badge>
            )}
          </div>
          <CardDescription>
            Monthly requirements throughput and warehouse staff allocation set for your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingQuotas ? (
            <p className="text-sm text-muted-foreground">Loading quota usage…</p>
          ) : (
            <>
              {isCapped ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>Monthly Requirement Quota Cap Reached</span>
                  </div>
                  <p>
                    You have reached your allocated limit for this month. Additional requirements may be blocked until the start of next month or until your plan is upgraded by your platform administrator.
                  </p>
                </div>
              ) : isNearLimit ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Approaching Quota Threshold (≥80%)</span>
                  </div>
                  <p>
                    You are approaching your monthly requirements or warehouse staff limit. Contact your platform administrator to raise your allocation before limits are hit.
                  </p>
                </div>
              ) : null}

              {/* 1. Monthly Requirements Quota */}
              <div className="space-y-1.5 p-3 rounded-xl border bg-card/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold flex items-center gap-1.5 text-foreground">
                    <PackageCheck className="h-4 w-4 text-primary" /> Monthly Stock Requirements
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {reqUsedThisMonth.toLocaleString()}
                    {maxReqMonthly ? ` / ${maxReqMonthly.toLocaleString()} (${reqPct}%)` : ' (Unlimited)'}
                  </span>
                </div>
                <MeterBar used={reqUsedThisMonth} limit={maxReqMonthly} />
                <p className="text-[11px] text-muted-foreground">
                  Resets automatically on the 1st of each calendar month.
                </p>
              </div>

              {/* 2. Warehouse Staff Quota */}
              <div className="space-y-1.5 p-3 rounded-xl border bg-card/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold flex items-center gap-1.5 text-foreground">
                    <Warehouse className="h-4 w-4 text-violet-500" /> Warehouse Staff Accounts
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {warehouseStaffUsed.toLocaleString()}
                    {maxWarehouseStaff ? ` / ${maxWarehouseStaff.toLocaleString()} (${staffPct}%)` : ' (Unlimited)'}
                  </span>
                </div>
                <MeterBar used={warehouseStaffUsed} limit={maxWarehouseStaff} />
                <p className="text-[11px] text-muted-foreground">
                  Active staff members assigned the &quot;warehouse&quot; role across all shops.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
