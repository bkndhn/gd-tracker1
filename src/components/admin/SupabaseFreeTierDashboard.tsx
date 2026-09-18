import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Database, HardDrive, Users, Zap, AlertTriangle, ShieldAlert,
  CheckCircle2, RefreshCw, Server, ArrowUpRight, Sparkles, Building,
  Package, Image as ImageIcon, Phone, MessageSquare, ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { formatISTDateTime } from '@/lib/dateUtils';
import { getContactDeepLinks } from '@/utils/upiPayment';

// Official Supabase Free Tier Specifications
const FREE_TIER_LIMITS = {
  dbStorageMB: 500, // 500 MB Postgres database
  fileStorageMB: 1024, // 1 GB file storage
  mauUsers: 50000, // 50,000 monthly active users
  realtimeConnections: 200, // 200 concurrent realtime connections
  dbEgressGB: 5, // 5 GB egress
};

interface TenantQuotaUsage {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  entriesUsed: number;
  entriesLimit: number | null;
  usersUsed: number;
  usersLimit: number | null;
  shopsUsed: number;
  shopsLimit: number | null;
  imagesUsed: number;
  imagesLimit: number | null;
  reqsUsed: number;
  reqsLimit: number | null;
  highestPct: number;
  approachingMetric: string | null;
}

interface SupabaseStats {
  entriesCount: number;
  stockReqsCount: number;
  profilesCount: number;
  activeProfilesCount: number;
  shopsCount: number;
  imagesCount: number;
  categoriesCount: number;
  sizesCount: number;
  customerTypesCount: number;
  customFieldsCount: number;
  customValuesCount: number;
  auditLogsCount: number;
  clientErrorsCount: number;
  totalRowsEstimated: number;
  estimatedDbMB: number;
  estimatedStorageMB: number;
  estimatedRealtime: number;
}

interface Props {
  onOpenLimits?: (tenantId: string) => void;
}

export const SupabaseFreeTierDashboard = ({ onOpenLimits }: Props = {}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [stats, setStats] = useState<SupabaseStats>({
    entriesCount: 0,
    stockReqsCount: 0,
    profilesCount: 0,
    activeProfilesCount: 0,
    shopsCount: 0,
    imagesCount: 0,
    categoriesCount: 0,
    sizesCount: 0,
    customerTypesCount: 0,
    customFieldsCount: 0,
    customValuesCount: 0,
    auditLogsCount: 0,
    clientErrorsCount: 0,
    totalRowsEstimated: 0,
    estimatedDbMB: 0,
    estimatedStorageMB: 0,
    estimatedRealtime: 0,
  });

  const [tenants, setTenants] = useState<TenantQuotaUsage[]>([]);
  const [tenantFilter, setTenantFilter] = useState<'all' | 'warnings' | 'critical'>('all');

  const fetchStats = useCallback(async () => {
    try {
      setRefreshing(true);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // 1. Fetch Global Table Row Counts
      const [
        entriesRes,
        reqsRes,
        profilesRes,
        activeProfilesRes,
        shopsRes,
        imagesRes,
        catsRes,
        sizesRes,
        custTypesRes,
        cfRes,
        cvRes,
        auditRes,
        errorsRes,
        adminsListRes,
      ] = await Promise.all([
        supabase.from('goods_damaged_entries').select('id', { count: 'exact', head: true }),
        supabase.from('stock_requirements').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null),
        supabase.from('shops').select('id', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('gd_entry_images').select('id', { count: 'exact', head: true }),
        supabase.from('categories').select('id', { count: 'exact', head: true }),
        supabase.from('sizes').select('id', { count: 'exact', head: true }),
        supabase.from('customer_types').select('id', { count: 'exact', head: true }),
        (supabase.from('custom_fields') as any).select('id', { count: 'exact', head: true }).is('deleted_at', null),
        ((supabase as any).from('gd_entry_custom_values')).select('id', { count: 'exact', head: true }),
        ((supabase as any).from('audit_logs')).select('id', { count: 'exact', head: true }),
        ((supabase as any).from('client_errors')).select('id', { count: 'exact', head: true }),
        // Admin profiles with configured quotas
        supabase
          .from('profiles')
          .select('id, name, email, phone, status, max_entries, max_users, max_shops, max_images_total, max_requirements_monthly')
          .in('role', ['admin', 'super_admin'])
          .is('deleted_at', null),
      ]);

      const entriesCount = entriesRes.count || 0;
      const stockReqsCount = reqsRes.count || 0;
      const profilesCount = profilesRes.count || 0;
      const activeProfilesCount = activeProfilesRes.count || 0;
      const shopsCount = shopsRes.count || 0;
      const imagesCount = imagesRes.count || 0;
      const categoriesCount = catsRes.count || 0;
      const sizesCount = sizesRes.count || 0;
      const customerTypesCount = custTypesRes.count || 0;
      const customFieldsCount = cfRes?.count || 0;
      const customValuesCount = cvRes?.count || 0;
      const auditLogsCount = auditRes?.count || 0;
      const clientErrorsCount = errorsRes?.count || 0;

      const totalRows =
        entriesCount +
        stockReqsCount +
        profilesCount +
        shopsCount +
        imagesCount +
        categoriesCount +
        sizesCount +
        customerTypesCount +
        customFieldsCount +
        customValuesCount +
        auditLogsCount +
        clientErrorsCount;

      // Realistic Postgres storage footprint estimation:
      // Base overhead per row ~ 1.5 KB (tuple header, data columns, TOAST index, primary & foreign key B-trees)
      // Base database schemas + extensions ~ 35 MB
      const estimatedDbMB = Math.round((35 + (totalRows * 1.5) / 1024) * 10) / 10;

      // Storage estimate: ~180 KB avg per compressed image asset
      const estimatedStorageMB = Math.round(((imagesCount * 180) / 1024) * 10) / 10;

      // Realtime connections: conservative active estimate based on logged in users
      const estimatedRealtime = Math.max(1, Math.min(200, Math.round(activeProfilesCount * 0.4)));

      setStats({
        entriesCount,
        stockReqsCount,
        profilesCount,
        activeProfilesCount,
        shopsCount,
        imagesCount,
        categoriesCount,
        sizesCount,
        customerTypesCount,
        customFieldsCount,
        customValuesCount,
        auditLogsCount,
        clientErrorsCount,
        totalRowsEstimated: totalRows,
        estimatedDbMB,
        estimatedStorageMB,
        estimatedRealtime,
      });

      // 2. Fetch Per-Tenant Consumption for Tenant Quota Early Warning
      const adminList = (adminsListRes.data || []) as any[];
      if (adminList.length > 0) {
        const tenantUsages: TenantQuotaUsage[] = await Promise.all(
          adminList.map(async (adm: any) => {
            const [tEntries, tUsers, tShops, tReqs] = await Promise.all([
              supabase.from('goods_damaged_entries').select('id', { count: 'exact', head: true }).eq('admin_id', adm.id),
              supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('admin_id', adm.id).is('deleted_at', null),
              supabase.from('shops').select('id', { count: 'exact', head: true }).eq('admin_id', adm.id).is('deleted_at', null),
              supabase.from('stock_requirements').select('id', { count: 'exact', head: true }).eq('admin_id', adm.id).gte('created_at', monthStart.toISOString()),
            ]);

            const entriesUsed = tEntries.count || 0;
            const usersUsed = tUsers.count || 0;
            const shopsUsed = tShops.count || 0;
            const reqsUsed = tReqs.count || 0;

            const entryPct = adm.max_entries ? (entriesUsed / adm.max_entries) * 100 : 0;
            const userPct = adm.max_users ? (usersUsed / adm.max_users) * 100 : 0;
            const shopPct = adm.max_shops ? (shopsUsed / adm.max_shops) * 100 : 0;
            const reqPct = adm.max_requirements_monthly ? (reqsUsed / adm.max_requirements_monthly) * 100 : 0;

            const pcts = [
              { name: 'Entries', pct: entryPct },
              { name: 'Team Users', pct: userPct },
              { name: 'Shops', pct: shopPct },
              { name: 'Requirements', pct: reqPct },
            ];

            pcts.sort((a, b) => b.pct - a.pct);
            const highest = pcts[0];

            return {
              id: adm.id,
              name: adm.name,
              email: adm.email,
              phone: adm.phone,
              status: adm.status,
              entriesUsed,
              entriesLimit: adm.max_entries,
              usersUsed,
              usersLimit: adm.max_users,
              shopsUsed,
              shopsLimit: adm.max_shops,
              imagesUsed: 0,
              imagesLimit: adm.max_images_total,
              reqsUsed,
              reqsLimit: adm.max_requirements_monthly,
              highestPct: Math.round(highest.pct),
              approachingMetric: highest.pct >= 80 ? `${highest.name} (${Math.round(highest.pct)}%)` : null,
            };
          }),
        );

        // Sort by highest quota consumption first
        tenantUsages.sort((a, b) => b.highestPct - a.highestPct);
        setTenants(tenantUsages);
      }

      setLastRefreshed(new Date());
    } catch (err) {
      if (import.meta.env.DEV) console.error('SupabaseFreeTierDashboard error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Global Utilization Percentages
  const dbPct = Math.min(100, Math.round((stats.estimatedDbMB / FREE_TIER_LIMITS.dbStorageMB) * 100));
  const storagePct = Math.min(100, Math.round((stats.estimatedStorageMB / FREE_TIER_LIMITS.fileStorageMB) * 100));
  const mauPct = Math.min(100, Math.round((stats.activeProfilesCount / FREE_TIER_LIMITS.mauUsers) * 100));
  const realtimePct = Math.min(100, Math.round((stats.estimatedRealtime / FREE_TIER_LIMITS.realtimeConnections) * 100));

  // Global Warnings & Alerts
  const hasGlobalWarning = dbPct >= 80 || storagePct >= 80 || mauPct >= 80 || realtimePct >= 80;
  const hasGlobalCritical = dbPct >= 95 || storagePct >= 95 || mauPct >= 95 || realtimePct >= 95;

  // Tenant Warnings (approaching ≥80% or capped ≥95%)
  const warningTenants = useMemo(() => tenants.filter(t => t.highestPct >= 80 && t.highestPct < 95), [tenants]);
  const criticalTenants = useMemo(() => tenants.filter(t => t.highestPct >= 95), [tenants]);

  const filteredTenants = useMemo(() => {
    if (tenantFilter === 'warnings') return tenants.filter(t => t.highestPct >= 80 && t.highestPct < 95);
    if (tenantFilter === 'critical') return tenants.filter(t => t.highestPct >= 95);
    return tenants;
  }, [tenants, tenantFilter]);

  const getBarColor = (pct: number) => {
    if (pct >= 95) return 'bg-destructive';
    if (pct >= 80) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getStatusBadge = (pct: number) => {
    if (pct >= 95) {
      return (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-bold">
          Critical ({pct}%)
        </Badge>
      );
    }
    if (pct >= 80) {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20 font-bold">
          Warning ({pct}%)
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20">
        Healthy
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Refresh Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border bg-card/60 backdrop-blur-sm shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-emerald-600 shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              Supabase Free Tier Limits & Resource Health
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Realtime monitoring of database capacity, file storage, active users, and tenant quota consumption.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Updated {formatISTDateTime(lastRefreshed)}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchStats}
            disabled={refreshing}
            className="h-8 gap-1.5 text-xs rounded-xl shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Critical Platform Alert Banner */}
      {hasGlobalCritical && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive space-y-1 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-sm">
            <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
            <span>CRITICAL: Supabase Free Tier Capacity Exceeded (≥95%)</span>
          </div>
          <p className="leading-relaxed">
            One or more Supabase free tier resources are approaching complete saturation. To avoid database pauses, failed writes, or blocked image uploads, consider upgrading your project to Supabase Pro ($25/mo) or running an audit cleanup.
          </p>
        </div>
      )}

      {/* Warning Platform Alert Banner */}
      {!hasGlobalCritical && hasGlobalWarning && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-200 space-y-1 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <span>WARNING: Supabase Free Tier Usage Approaching 80% Threshold</span>
          </div>
          <p className="leading-relaxed">
            Your project resources are currently at ≥80% capacity. Monitor your database row count and image storage closely.
          </p>
        </div>
      )}

      {/* Tenant Early Quota Warning Alert (If any tenant approaches limit) */}
      {(criticalTenants.length > 0 || warningTenants.length > 0) && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>
                {criticalTenants.length + warningTenants.length} Tenant(s) Approaching Quota Limits
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {criticalTenants.length > 0 && (
                <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                  {criticalTenants.length} Critical (≥95%)
                </Badge>
              )}
              {warningTenants.length > 0 && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20">
                  {warningTenants.length} Warning (≥80%)
                </Badge>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The following tenants are approaching their assigned caps for entries, team users, or shops. Adjust their plan limits or reach out via WhatsApp/Call to arrange an upgrade.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {[...criticalTenants, ...warningTenants].map(t => (
              <div
                key={t.id}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs bg-card/80 ${
                  t.highestPct >= 95 ? 'border-destructive/40 text-destructive' : 'border-amber-500/40 text-amber-700 dark:text-amber-300'
                }`}
              >
                <span className="font-semibold">{t.name}</span>
                <Badge variant={t.highestPct >= 95 ? 'destructive' : 'outline'} className="text-[10px] py-0 px-1">
                  {t.approachingMetric || `${t.highestPct}%`}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 Core Supabase Resource Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Database Storage */}
        <Card className="border bg-card/70 backdrop-blur-sm shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="p-3.5 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Database className="h-4 w-4 text-emerald-600" /> Database Space
              </span>
              {getStatusBadge(dbPct)}
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {stats.estimatedDbMB} <span className="text-sm font-normal text-muted-foreground">MB</span>
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                / {FREE_TIER_LIMITS.dbStorageMB} MB ({dbPct}%)
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-3.5 pt-0 space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all duration-300 ${getBarColor(dbPct)}`}
                style={{ width: `${Math.max(dbPct, 3)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
              <span>Total rows: ~{stats.totalRowsEstimated.toLocaleString()}</span>
              <span>Free tier cap: 500 MB</span>
            </div>
          </CardContent>
        </Card>

        {/* 2. File & Image Storage */}
        <Card className="border bg-card/70 backdrop-blur-sm shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="p-3.5 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <HardDrive className="h-4 w-4 text-blue-600" /> Image & File Storage
              </span>
              {getStatusBadge(storagePct)}
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {stats.estimatedStorageMB} <span className="text-sm font-normal text-muted-foreground">MB</span>
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                / {FREE_TIER_LIMITS.fileStorageMB} MB ({storagePct}%)
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-3.5 pt-0 space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all duration-300 ${getBarColor(storagePct)}`}
                style={{ width: `${Math.max(storagePct, 3)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
              <span>Images: {stats.imagesCount.toLocaleString()} stored</span>
              <span>Free tier cap: 1 GB</span>
            </div>
          </CardContent>
        </Card>

        {/* 3. Auth MAU */}
        <Card className="border bg-card/70 backdrop-blur-sm shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="p-3.5 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Users className="h-4 w-4 text-violet-600" /> Auth Active Users (MAU)
              </span>
              {getStatusBadge(mauPct)}
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {stats.activeProfilesCount.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                / {FREE_TIER_LIMITS.mauUsers.toLocaleString()} ({mauPct}%)
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-3.5 pt-0 space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all duration-300 ${getBarColor(mauPct)}`}
                style={{ width: `${Math.max(mauPct, 3)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
              <span>Total accounts: {stats.profilesCount.toLocaleString()}</span>
              <span>Free tier cap: 50,000 MAU</span>
            </div>
          </CardContent>
        </Card>

        {/* 4. Realtime Connections */}
        <Card className="border bg-card/70 backdrop-blur-sm shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="p-3.5 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-500" /> Realtime Connections
              </span>
              {getStatusBadge(realtimePct)}
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                ~{stats.estimatedRealtime}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                / {FREE_TIER_LIMITS.realtimeConnections} ({realtimePct}%)
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-3.5 pt-0 space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all duration-300 ${getBarColor(realtimePct)}`}
                style={{ width: `${Math.max(realtimePct, 3)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
              <span>Concurrent channels active</span>
              <span>Free tier cap: 200</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row breakdown by Table */}
      <Card className="border shadow-xs">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" /> Live Table Row Distribution
          </CardTitle>
          <CardDescription className="text-xs">
            Distribution of stored rows contributing to the 500 MB Postgres free tier allocation.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {[
              { label: 'Lost Visits', count: stats.entriesCount, icon: Package },
              { label: 'Requirements', count: stats.stockReqsCount, icon: Zap },
              { label: 'User Profiles', count: stats.profilesCount, icon: Users },
              { label: 'Shops / Branches', count: stats.shopsCount, icon: Building },
              { label: 'Image Metadata', count: stats.imagesCount, icon: ImageIcon },
              { label: 'Audit Logs', count: stats.auditLogsCount, icon: Server },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="p-2.5 rounded-xl border bg-muted/20 space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[11px] font-medium">{item.label}</span>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-base font-bold text-foreground">{item.count.toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tenant Quota Early Warning Table */}
      <Card className="border shadow-xs">
        <CardHeader className="p-4 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-600" /> Tenant Quota Early Warning Dashboard
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Monitor which clients are approaching their allocated plan limits for visits, team members, and shops.
              </CardDescription>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 p-1 bg-muted/60 border rounded-xl overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setTenantFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  tenantFilter === 'all'
                    ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({tenants.length})
              </button>
              <button
                type="button"
                onClick={() => setTenantFilter('warnings')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  tenantFilter === 'warnings'
                    ? 'bg-amber-600 text-white font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Warnings ≥80% ({warningTenants.length})
              </button>
              <button
                type="button"
                onClick={() => setTenantFilter('critical')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  tenantFilter === 'critical'
                    ? 'bg-destructive text-white font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Critical ≥95% ({criticalTenants.length})
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs font-semibold">Tenant Organization</TableHead>
                  <TableHead className="text-xs font-semibold">Visits / Cap</TableHead>
                  <TableHead className="text-xs font-semibold">Team / Cap</TableHead>
                  <TableHead className="text-xs font-semibold">Shops / Cap</TableHead>
                  <TableHead className="text-xs font-semibold">Requirements (Mo)</TableHead>
                  <TableHead className="text-xs font-semibold">Health Status</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                      No tenants found for this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTenants.map(t => {
                    const links = getContactDeepLinks(t.phone, t.email, t.name);
                    const entryPct = t.entriesLimit ? Math.round((t.entriesUsed / t.entriesLimit) * 100) : 0;
                    const userPct = t.usersLimit ? Math.round((t.usersUsed / t.usersLimit) * 100) : 0;
                    const shopPct = t.shopsLimit ? Math.round((t.shopsUsed / t.shopsLimit) * 100) : 0;

                    return (
                      <TableRow key={t.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="text-xs">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-foreground block">{t.name}</span>
                            <span className="text-[11px] text-muted-foreground block">{t.email || '—'}</span>
                            {/* Quick Contact Links */}
                            <div className="flex items-center gap-1.5 pt-0.5">
                              {links.telLink && (
                                <a
                                  href={links.telLink}
                                  title={`Call ${t.phone}`}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono transition-colors"
                                >
                                  <Phone className="h-2.5 w-2.5" />
                                  <span>{t.phone}</span>
                                </a>
                              )}
                              {links.waLink && (
                                <a
                                  href={links.waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`WhatsApp ${t.name}`}
                                  className="p-1 rounded-md bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 transition-colors"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Entries / Cap */}
                        <TableCell className="text-xs">
                          <div className="space-y-1 min-w-[100px]">
                            <div className="flex items-center justify-between text-[11px]">
                              <span>{t.entriesUsed.toLocaleString()}</span>
                              <span className="text-muted-foreground">/ {t.entriesLimit ? t.entriesLimit.toLocaleString() : '∞'}</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${getBarColor(entryPct)}`}
                                style={{ width: `${Math.max(t.entriesLimit ? entryPct : 5, 2)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>

                        {/* Team Users / Cap */}
                        <TableCell className="text-xs">
                          <div className="space-y-1 min-w-[90px]">
                            <div className="flex items-center justify-between text-[11px]">
                              <span>{t.usersUsed}</span>
                              <span className="text-muted-foreground">/ {t.usersLimit ?? '∞'}</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${getBarColor(userPct)}`}
                                style={{ width: `${Math.max(t.usersLimit ? userPct : 5, 2)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>

                        {/* Shops / Cap */}
                        <TableCell className="text-xs">
                          <div className="space-y-1 min-w-[90px]">
                            <div className="flex items-center justify-between text-[11px]">
                              <span>{t.shopsUsed}</span>
                              <span className="text-muted-foreground">/ {t.shopsLimit ?? '∞'}</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${getBarColor(shopPct)}`}
                                style={{ width: `${Math.max(t.shopsLimit ? shopPct : 5, 2)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>

                        {/* Requirements */}
                        <TableCell className="text-xs">
                          <span className="font-mono">
                            {t.reqsUsed}
                            {t.reqsLimit ? ` / ${t.reqsLimit}` : ' (∞)'}
                          </span>
                        </TableCell>

                        {/* Health Status */}
                        <TableCell className="text-xs">
                          {getStatusBadge(t.highestPct)}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-xs text-right">
                          {onOpenLimits && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onOpenLimits(t.id)}
                              className="h-7 text-[11px] px-2 rounded-lg"
                            >
                              Adjust Limits
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
