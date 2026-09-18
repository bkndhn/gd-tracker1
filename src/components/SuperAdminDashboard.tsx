import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ThemedSearchInput } from '@/components/ThemedSearchInput';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReleaseHealthPanel } from '@/components/admin/ReleaseHealthPanel';
import { toast } from 'sonner';
import {
  HeartPulse, Play, Pause, Trash2, Settings, Users, Building, Shield,
  Search, ChevronDown, ChevronRight, Image, CheckCircle, XCircle, Activity,
  UserPlus, Sparkles, RefreshCw, MoreHorizontal, ArrowUpDown, ClipboardList,
  Layers, Phone, MessageSquare, CreditCard, IndianRupee, Eye, EyeOff, Check, ExternalLink, Mail
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { CreateTenantDialog } from './admin/CreateTenantDialog';
import { GoogleDriveBackupPanel } from './admin/GoogleDriveBackupPanel';
import { PlatformPaymentSettings } from './admin/PlatformPaymentSettings';
import { AuditLogViewer } from './AuditLogViewer';
import { formatISTDate, formatISTDateTime } from '@/lib/dateUtils';
import { useAuth } from '@/hooks/useAuth';
import { logAudit } from '@/utils/auditLog';
import { getContactDeepLinks } from '@/utils/upiPayment';

interface AdminProfile {
  id: string;
  name: string;
  email: string | null;
  status: string;
  max_shops: number;
  max_users: number;
  max_entries: number | null;
  max_images_per_entry: number | null;
  max_images_total: number | null;
  created_at: string;
  last_login_at: string | null;
  admin_id: string | null;
  role: string;
  shop_id: string | null;
  ai_enabled?: boolean;
  ai_daily_limit?: number | null;
  ai_monthly_limit?: number | null;
  ai_lifetime_limit?: number | null;
  requirements_enabled?: boolean;
  max_requirements_monthly?: number | null;
  max_warehouse_users?: number | null;
  custom_fields_enabled?: boolean;
  max_custom_fields?: number | null;
  max_options_per_field?: number | null;
  theme_color?: string | null;
  phone?: string | null;
  subscription_amount?: number | null;
  billing_cycle?: string | null;
  show_plan_to_client?: boolean | null;
  payment_enabled?: boolean | null;
  payment_status?: string | null;
  last_payment_date?: string | null;
  last_payment_ref?: string | null;
}

export const SuperAdminDashboard = () => {
  const { user } = useAuth();
  const [allProfiles, setAllProfiles] = useState<AdminProfile[]>([]);
  const [allShops, setAllShops] = useState<any[]>([]);
  const [entryCounts, setEntryCounts] = useState<Record<string, number>>({});
  const [imageCounts, setImageCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminProfile | null>(null);
  const [limitsDialogOpen, setLimitsDialogOpen] = useState(false);
  const [createTenantOpen, setCreateTenantOpen] = useState(false);
  const [deleteAdmin, setDeleteAdmin] = useState<AdminProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [maxShops, setMaxShops] = useState(5);
  const [maxUsers, setMaxUsers] = useState(10);
  const [maxEntries, setMaxEntries] = useState<number | ''>('');
  const [maxImagesPerEntry, setMaxImagesPerEntry] = useState<number>(10);
  const [maxImagesTotal, setMaxImagesTotal] = useState<number | ''>('');
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const [aiDaily, setAiDaily] = useState<number | ''>('');
  const [aiMonthly, setAiMonthly] = useState<number | ''>('');
  const [aiLifetime, setAiLifetime] = useState<number | ''>('');
  const [reqEnabled, setReqEnabled] = useState<boolean>(true);
  const [maxReqMonthly, setMaxReqMonthly] = useState<number | ''>('');
  const [maxWarehouseUsers, setMaxWarehouseUsers] = useState<number | ''>(3);
  const [customFieldsEnabled, setCustomFieldsEnabled] = useState<boolean>(true);
  const [maxCustomFields, setMaxCustomFields] = useState<number | ''>(5);
  const [maxOptionsPerField, setMaxOptionsPerField] = useState<number | ''>(20);
  // Contact & Billing state
  const [tenantPhone, setTenantPhone] = useState('');
  const [subscriptionAmount, setSubscriptionAmount] = useState<number | ''>('');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [showPlanToClient, setShowPlanToClient] = useState(true);
  const [paymentEnabled, setPaymentEnabled] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState('unpaid');
  const [lastPaymentRef, setLastPaymentRef] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [sortKey, setSortKey] = useState<'name' | 'created_at' | 'last_login_at' | 'entries'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedAdmins, setExpandedAdmins] = useState<Set<string>>(new Set());

  // Confirmation state for pause/activate actions
  const [pauseTarget, setPauseTarget] = useState<AdminProfile | null>(null);
  const [activateTarget, setActivateTarget] = useState<AdminProfile | null>(null);
  const [bulkAction, setBulkAction] = useState<'pause' | 'activate' | null>(null);
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [signupLoading, setSignupLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [profilesRes, shopsRes] = await Promise.all([
        supabase.from('profiles').select('*').is('deleted_at', null),
        supabase.from('shops').select('*').is('deleted_at', null),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (shopsRes.error) throw shopsRes.error;

      const profiles = (profilesRes.data || []) as unknown as AdminProfile[];
      setAllProfiles(profiles);
      setAllShops(shopsRes.data || []);

      const adminIds = profiles.filter(p => p.role === 'admin').map(p => p.id);
      if (adminIds.length > 0) {
        const { data: entries } = await supabase.from('goods_damaged_entries').select('admin_id');
        if (entries) {
          const counts: Record<string, number> = {};
          entries.forEach((e: any) => { if (e.admin_id) counts[e.admin_id] = (counts[e.admin_id] || 0) + 1; });
          setEntryCounts(counts);
        }

        const { data: entryDetails } = await supabase.from('goods_damaged_entries').select('id, admin_id');
        if (entryDetails) {
          const entryToAdmin: Record<string, string> = {};
          entryDetails.forEach((e: any) => { if (e.admin_id) entryToAdmin[e.id] = e.admin_id; });

          const { data: images } = await supabase.from('gd_entry_images').select('gd_entry_id');
          if (images) {
            const imgCounts: Record<string, number> = {};
            images.forEach((img: any) => {
              const adminId = entryToAdmin[img.gd_entry_id];
              if (adminId) imgCounts[adminId] = (imgCounts[adminId] || 0) + 1;
            });
            setImageCounts(imgCounts);
          }
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch signup visibility setting
  useEffect(() => {
    const fetchSignupSetting = async () => {
      try {
        const { data } = await (supabase.from('app_settings') as any)
          .select('value')
          .eq('key', 'signup_enabled')
          .is('admin_id', null)
          .maybeSingle();
        if (data) setSignupEnabled(data.value === true || data.value === 'true');
      } catch {}
    };
    fetchSignupSetting();
  }, []);

  const handleToggleSignup = useCallback(async (enabled: boolean) => {
    setSignupLoading(true);
    try {
      const { error } = await (supabase.from('app_settings') as any)
        .update({ value: enabled })
        .eq('key', 'signup_enabled')
        .is('admin_id', null);
      if (error) throw error;
      setSignupEnabled(enabled);
      await logAudit({ action: 'signup_toggle', details: { enabled } });
      toast.success(`Public signup ${enabled ? 'enabled' : 'disabled'}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update signup setting');
    } finally {
      setSignupLoading(false);
    }
  }, []);

  useEffect(() => {
    const channelName = `sa_rt_${Math.random().toString(36).substring(2, 9)}`;
    let channel: any = null;

    try {
      channel = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'goods_damaged_entries' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gd_entry_images' }, () => fetchData())
        .subscribe();
    } catch (err) {
      if (import.meta.env.DEV) console.error('SuperAdminDashboard realtime error', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [fetchData]);

  const admins = useMemo(() => allProfiles.filter(p => p.role === 'admin'), [allProfiles]);
  const activeAdmins = useMemo(() => admins.filter(a => a.status === 'active'), [admins]);
  const pausedAdmins = useMemo(() => admins.filter(a => a.status === 'paused'), [admins]);

  const filteredAdmins = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const rows = admins.filter(a =>
      (statusFilter === 'all' || a.status === statusFilter) &&
      (!q || a.name.toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q))
    );
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === 'entries') return ((entryCounts[a.id] || 0) - (entryCounts[b.id] || 0)) * dir;
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir;
      const av = new Date(a[sortKey] || 0).getTime();
      const bv = new Date(b[sortKey] || 0).getTime();
      return (av - bv) * dir;
    });
  }, [admins, searchQuery, statusFilter, sortKey, sortDir, entryCounts]);

  const toggleSort = useCallback((key: typeof sortKey) => {
    setSortKey(prev => {
      if (prev === key) { setSortDir(d => (d === 'asc' ? 'desc' : 'asc')); return prev; }
      setSortDir('asc');
      return key;
    });
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast.success('Refreshed');
  }, [fetchData]);

  const totalEntries = useMemo(() => Object.values(entryCounts).reduce((a, b) => a + b, 0), [entryCounts]);
  const totalSubUsers = useMemo(
    () => allProfiles.filter(p => p.role !== 'admin' && p.role !== 'super_admin').length,
    [allProfiles]
  );


  const getSubUsers = useCallback((adminId: string) =>
    allProfiles.filter(p => p.admin_id === adminId && p.id !== adminId), [allProfiles]);

  const getAdminStats = useCallback((adminId: string) => {
    const shopCount = allShops.filter((s: any) => s.admin_id === adminId).length;
    const userCount = allProfiles.filter((p: any) => p.admin_id === adminId && p.id !== adminId).length;
    return { shopCount, userCount };
  }, [allShops, allProfiles]);

  const toggleExpand = useCallback((adminId: string) => {
    setExpandedAdmins(prev => {
      const next = new Set(prev);
      if (next.has(adminId)) next.delete(adminId); else next.add(adminId);
      return next;
    });
  }, []);

  const handleRoleChange = useCallback(async (profile: AdminProfile, newRole: string) => {
    if (profile.id === user?.id) { toast.error("You cannot change your own role"); return; }
    try {
      const updateData: any = { role: newRole };
      if (newRole === 'admin') { updateData.admin_id = profile.id; updateData.status = 'paused'; }
      if (newRole === 'super_admin') { updateData.admin_id = null; updateData.status = 'active'; }
      if (newRole === 'manager' || newRole === 'user') {
        if (!profile.admin_id || profile.admin_id === profile.id) {
          toast.error("Cannot demote to sub-user role without an admin parent."); return;
        }
      }
      const { error } = await (supabase.from('profiles') as any).update(updateData).eq('id', profile.id);
      if (error) throw error;
      toast.success(`${profile.name}'s role changed to ${newRole}`);
      fetchData();
    } catch (error: any) { toast.error(error.message || 'Failed to change role'); }
  }, [user?.id, fetchData]);

  const handleActivateConfirmed = useCallback(async (admin: AdminProfile) => {
    try {
      const { error } = await (supabase.from('profiles') as any).update({ status: 'active' }).eq('id', admin.id);
      if (error) throw error;
      await (supabase.from('profiles') as any).update({ status: 'active' }).eq('admin_id', admin.id).neq('id', admin.id);
      await logAudit({ action: 'user_activated', targetType: 'profile', targetId: admin.id, details: { name: admin.name } });
      toast.success(`${admin.name} activated successfully`);
      fetchData();
    } catch (error: any) { toast.error(error.message || 'Failed to activate'); }
    setActivateTarget(null);
  }, [fetchData]);

  const handlePauseConfirmed = useCallback(async (admin: AdminProfile) => {
    try {
      await (supabase.from('profiles') as any).update({ status: 'paused' }).eq('id', admin.id);
      await (supabase.from('profiles') as any).update({ status: 'paused' }).eq('admin_id', admin.id);
      // Force logout via edge function
      try {
        await supabase.functions.invoke('update-sub-user', { body: { user_id: admin.id, action: 'pause' } });
        const subUsers = getSubUsers(admin.id);
        for (const sub of subUsers) {
          await supabase.functions.invoke('update-sub-user', { body: { user_id: sub.id, action: 'pause' } });
        }
      } catch (e) {
        if (import.meta.env.DEV) console.warn('Force logout via edge function failed:', e);
      }
      await logAudit({ action: 'user_paused', targetType: 'profile', targetId: admin.id, details: { name: admin.name } });
      toast.success(`${admin.name} and all sub-users paused & logged out.`);
      fetchData();
    } catch (error: any) { toast.error(error.message || 'Failed to pause'); }
    setPauseTarget(null);
  }, [getSubUsers, fetchData]);

  const handleBulkActionConfirmed = useCallback(async () => {
    if (!bulkAction) return;
    const newStatus = bulkAction === 'pause' ? 'paused' : 'active';
    try {
      for (const admin of admins) {
        await (supabase.from('profiles') as any).update({ status: newStatus }).eq('id', admin.id);
        await (supabase.from('profiles') as any).update({ status: newStatus }).eq('admin_id', admin.id);
        if (bulkAction === 'pause') {
          try {
            await supabase.functions.invoke('update-sub-user', { body: { user_id: admin.id, action: 'pause' } });
            const subs = getSubUsers(admin.id);
            for (const sub of subs) {
              await supabase.functions.invoke('update-sub-user', { body: { user_id: sub.id, action: 'pause' } });
            }
          } catch {}
        }
      }
      await logAudit({ action: bulkAction === 'pause' ? 'bulk_pause' : 'bulk_activate', details: { count: admins.length } });
      toast.success(`All admins ${newStatus === 'active' ? 'activated' : 'paused'} successfully.`);
      fetchData();
    } catch (error: any) { toast.error(error.message || 'Bulk action failed'); }
    setBulkAction(null);
  }, [bulkAction, admins, getSubUsers, fetchData]);

  const handleDelete = useCallback(async () => {
    if (!deleteAdmin) return;
    setIsDeleting(true);
    try {
      const adminId = deleteAdmin.id;
      await (supabase.from('goods_damaged_entries') as any).delete().eq('admin_id', adminId);
      await (supabase.from('shops') as any).update({ deleted_at: new Date().toISOString() }).eq('admin_id', adminId);
      await Promise.all([
        (supabase.from('categories') as any).update({ deleted_at: new Date().toISOString() }).eq('admin_id', adminId),
        (supabase.from('sizes') as any).update({ deleted_at: new Date().toISOString() }).eq('admin_id', adminId),
        (supabase.from('customer_types') as any).update({ deleted_at: new Date().toISOString() }).eq('admin_id', adminId),
        (supabase.from('custom_fields') as any).update({ deleted_at: new Date().toISOString() }).eq('admin_id', adminId),
      ]);
      await (supabase.from('profiles') as any).update({ deleted_at: new Date().toISOString(), status: 'paused' }).eq('admin_id', adminId).neq('id', adminId);
      await (supabase.from('profiles') as any).update({ deleted_at: new Date().toISOString(), status: 'paused' }).eq('id', adminId);
      await (supabase.from('app_settings') as any).delete().eq('admin_id', adminId);
      toast.success(`${deleteAdmin.name} and ALL associated data deleted.`);
      setDeleteAdmin(null);
    } catch (error: any) { toast.error(error.message || 'Failed to delete admin'); }
    finally { setIsDeleting(false); }
  }, [deleteAdmin]);

  const handleSetLimits = useCallback(async () => {
    if (!selectedAdmin) return;
    try {
      const { error } = await (supabase.from('profiles') as any).update({
        phone: tenantPhone.trim() || null,
        subscription_amount: subscriptionAmount === '' ? null : Number(subscriptionAmount),
        billing_cycle: billingCycle,
        show_plan_to_client: showPlanToClient,
        payment_enabled: paymentEnabled,
        payment_status: paymentStatus,
        last_payment_ref: lastPaymentRef.trim() || null,
        max_shops: maxShops,
        max_users: maxUsers,
        max_entries: maxEntries === '' ? null : maxEntries,
        max_images_per_entry: maxImagesPerEntry,
        max_images_total: maxImagesTotal === '' ? null : maxImagesTotal,
        ai_enabled: aiEnabled,
        ai_daily_limit: aiDaily === '' ? null : aiDaily,
        ai_monthly_limit: aiMonthly === '' ? null : aiMonthly,
        ai_lifetime_limit: aiLifetime === '' ? null : aiLifetime,
        requirements_enabled: reqEnabled,
        max_requirements_monthly: maxReqMonthly === '' ? null : maxReqMonthly,
        max_warehouse_users: maxWarehouseUsers === '' ? null : maxWarehouseUsers,
        custom_fields_enabled: customFieldsEnabled,
        max_custom_fields: maxCustomFields === '' ? null : maxCustomFields,
        max_options_per_field: maxOptionsPerField === '' ? null : maxOptionsPerField,
      }).eq('id', selectedAdmin.id);
      if (error) throw error;
      toast.success('Tenant settings & limits updated successfully');
      setLimitsDialogOpen(false);
      fetchData();
    } catch (error: any) { toast.error(error.message || 'Failed to update limits'); }
  }, [selectedAdmin, tenantPhone, subscriptionAmount, billingCycle, showPlanToClient, paymentEnabled, paymentStatus, lastPaymentRef, maxShops, maxUsers, maxEntries, maxImagesPerEntry, maxImagesTotal, aiEnabled, aiDaily, aiMonthly, aiLifetime, reqEnabled, maxReqMonthly, maxWarehouseUsers, customFieldsEnabled, maxCustomFields, maxOptionsPerField, fetchData]);

  const handleVerifyPayment = useCallback(async (admin: AdminProfile) => {
    try {
      const now = new Date().toISOString();
      const { error } = await (supabase.from('profiles') as any).update({
        payment_status: 'paid',
        last_payment_date: now,
      }).eq('id', admin.id);
      if (error) throw error;
      await logAudit({
        action: 'verify_tenant_payment',
        targetType: 'profile',
        targetId: admin.id,
        details: { name: admin.name, utr: admin.last_payment_ref, amount: admin.subscription_amount },
      });
      toast.success(`Payment verified and marked as Paid for ${admin.name}!`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify payment');
    }
  }, [fetchData]);

  const openLimitsDialog = useCallback((admin: AdminProfile) => {
    setSelectedAdmin(admin);
    setTenantPhone(admin.phone || '');
    setSubscriptionAmount(admin.subscription_amount ?? '');
    setBillingCycle(admin.billing_cycle || 'monthly');
    setShowPlanToClient(admin.show_plan_to_client !== false);
    setPaymentEnabled(admin.payment_enabled !== false);
    setPaymentStatus(admin.payment_status || 'unpaid');
    setLastPaymentRef(admin.last_payment_ref || '');
    setMaxShops(admin.max_shops || 5);
    setMaxUsers(admin.max_users || 10);
    setMaxEntries(admin.max_entries ?? '');
    setMaxImagesPerEntry(admin.max_images_per_entry ?? 10);
    setMaxImagesTotal(admin.max_images_total ?? '');
    setAiEnabled(admin.ai_enabled !== false);
    setAiDaily(admin.ai_daily_limit ?? '');
    setAiMonthly(admin.ai_monthly_limit ?? '');
    setAiLifetime(admin.ai_lifetime_limit ?? '');
    setReqEnabled(admin.requirements_enabled !== false);
    setMaxReqMonthly(admin.max_requirements_monthly ?? '');
    setMaxWarehouseUsers(admin.max_warehouse_users ?? 3);
    setCustomFieldsEnabled(admin.custom_fields_enabled !== false);
    setMaxCustomFields(admin.max_custom_fields ?? 5);
    setMaxOptionsPerField(admin.max_options_per_field ?? 20);
    setLimitsDialogOpen(true);
  }, []);

  const kpis = [
    { label: 'Tenants', value: admins.length, icon: Shield, tone: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20', border: 'hover:border-indigo-500/40' },
    { label: 'Active', value: activeAdmins.length, icon: CheckCircle, tone: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', border: 'hover:border-emerald-500/40' },
    { label: 'Paused', value: pausedAdmins.length, icon: XCircle, tone: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', border: 'hover:border-rose-500/40' },
    { label: 'Sub-users', value: totalSubUsers, icon: Users, tone: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20', border: 'hover:border-sky-500/40' },
    { label: 'Shops', value: allShops.length, icon: Building, tone: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', border: 'hover:border-amber-500/40' },
    { label: 'Entries', value: totalEntries, icon: Activity, tone: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', border: 'hover:border-purple-500/40' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 rounded-lg bg-muted animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-72 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="tenants" className="space-y-6">
      {/* Sticky page header */}
      <div className="sticky top-0 z-20 -mx-2 px-2 py-3 bg-background/80 backdrop-blur-md border-b border-border/60 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2 truncate">
              <Shield className="h-5 w-5 text-primary shrink-0" /> Super Admin
            </h1>
            <p className="text-xs text-muted-foreground truncate">Global tenant, limit and platform controls</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px]">
              {import.meta.env.DEV ? 'Development' : 'Production'}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-1">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        <TabsList className="w-full grid grid-cols-4 gap-1 sm:gap-1.5 p-1 bg-muted/60 border rounded-xl">
          <TabsTrigger
            value="tenants"
            className="group flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg py-2 px-1 sm:px-3 text-xs sm:text-sm font-medium whitespace-nowrap transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-indigo-500/20"
          >
            <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-500 group-data-[state=active]:text-white transition-colors shrink-0" />
            <span className="whitespace-nowrap">Tenants</span>
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="group flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg py-2 px-1 sm:px-3 text-xs sm:text-sm font-medium whitespace-nowrap transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-500/20"
          >
            <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-500 group-data-[state=active]:text-white transition-colors shrink-0" />
            <span className="whitespace-nowrap">Settings</span>
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="group flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg py-2 px-1 sm:px-3 text-xs sm:text-sm font-medium whitespace-nowrap transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-amber-500/20"
          >
            <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500 group-data-[state=active]:text-white transition-colors shrink-0" />
            <span className="whitespace-nowrap">Audit</span>
          </TabsTrigger>
          <TabsTrigger
            value="health"
            className="group flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg py-2 px-1 sm:px-3 text-xs sm:text-sm font-medium whitespace-nowrap transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-emerald-500/20"
          >
            <HeartPulse className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 group-data-[state=active]:text-white transition-colors shrink-0" />
            <span className="whitespace-nowrap">Health</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="tenants">
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {kpis.map(({ label, value, icon: Icon, tone, bg, border }) => (
          <Card key={label} className={`border bg-card/60 backdrop-blur-sm shadow-sm transition-all duration-200 hover:shadow-md ${border}`}>
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                <div className={`p-1.5 rounded-lg border ${bg}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className={`text-2xl font-bold mt-2 tracking-tight ${tone}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + filters + bulk actions */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="flex-1 min-w-0">
          <ThemedSearchInput
            placeholder="Search by name or email..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-muted/60 border rounded-xl overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
              statusFilter === 'all'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-500/25 font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
          >
            <span>All</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${statusFilter === 'all' ? 'bg-white/20 text-white font-bold' : 'bg-muted-foreground/15 text-foreground'}`}>
              {admins.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
              statusFilter === 'active'
                ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-sm shadow-emerald-500/25 font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span>Active</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${statusFilter === 'active' ? 'bg-white/20 text-white font-bold' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'}`}>
              {activeAdmins.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('paused')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
              statusFilter === 'paused'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-500/25 font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>Paused</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${statusFilter === 'paused' ? 'bg-white/20 text-white font-bold' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'}`}>
              {pausedAdmins.length}
            </span>
          </button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setBulkAction('activate')} className="flex items-center gap-1 flex-1 sm:flex-none">
            <Play className="h-3 w-3" /> Activate all
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkAction('pause')} className="flex items-center gap-1 flex-1 sm:flex-none">
            <Pause className="h-3 w-3" /> Pause all
          </Button>
        </div>
      </div>


      {/* Tenant Admin Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Tenant Admin Management</CardTitle>
            <CardDescription>{admins.length} registered admin(s). Click to expand and see sub-users.</CardDescription>
          </div>
          <Button
            onClick={() => setCreateTenantOpen(true)}
            className="gap-2 self-start sm:self-auto bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-sm shadow-indigo-500/25 shrink-0"
          >
            <UserPlus className="h-4 w-4" /> Add New Tenant
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>
                    <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 hover:text-foreground">
                      Tenant / Contact <ArrowUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </TableHead>
                  <TableHead>Plan & Pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <button type="button" onClick={() => toggleSort('created_at')} className="inline-flex items-center gap-1 hover:text-foreground">
                      Signup <ArrowUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" onClick={() => toggleSort('last_login_at')} className="inline-flex items-center gap-1 hover:text-foreground">
                      Last Login <ArrowUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </TableHead>
                  <TableHead>Shops</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>
                    <button type="button" onClick={() => toggleSort('entries')} className="inline-flex items-center gap-1 hover:text-foreground">
                      Entries <ArrowUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </TableHead>
                  <TableHead>Images</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.map(admin => {
                  const stats = getAdminStats(admin.id);
                  const subUsers = getSubUsers(admin.id);
                  const isExpanded = expandedAdmins.has(admin.id);
                  const entryCount = entryCounts[admin.id] || 0;
                  const imageCount = imageCounts[admin.id] || 0;

                  return (
                    <AdminRow key={admin.id} admin={admin} stats={stats} subUsers={subUsers}
                      isExpanded={isExpanded} entryCount={entryCount} imageCount={imageCount}
                      currentUserId={user?.id} onToggleExpand={toggleExpand}
                      onActivate={(a) => setActivateTarget(a)} onPause={(a) => setPauseTarget(a)}
                      onDelete={setDeleteAdmin} onLimits={openLimitsDialog} onRoleChange={handleRoleChange}
                      onVerifyPayment={handleVerifyPayment} />
                  );
                })}
                {filteredAdmins.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-10">
                      <Shield className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm font-medium">No tenants match your filters</p>
                      <p className="text-xs text-muted-foreground">Try clearing the search or status filter.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>

            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Super Admins section */}
      {allProfiles.filter(p => p.role === 'super_admin').length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Super Admins</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allProfiles.filter(p => p.role === 'super_admin').map(sa => (
                <div key={sa.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <span className="font-medium">{sa.name}</span>
                    {sa.id === user?.id && <Badge variant="outline" className="ml-2 text-xs">You</Badge>}
                    <p className="text-sm text-muted-foreground">{sa.email || '-'}</p>
                  </div>
                  <Badge variant="secondary">super_admin</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Limits Dialog */}
      <Dialog open={limitsDialogOpen} onOpenChange={setLimitsDialogOpen}>
        <DialogContent className="w-[96vw] max-w-lg max-h-[88dvh] flex flex-col p-0 gap-0 rounded-2xl sm:rounded-3xl border border-border/80 shadow-2xl overflow-hidden bg-card">
          <DialogHeader className="p-4 sm:p-5 border-b border-border/60 bg-muted/30 shrink-0 text-left">
            <DialogTitle className="text-base sm:text-lg font-bold truncate">Manage Tenant: {selectedAdmin?.name}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Configure contact details, subscription fee, UPI payment, plan visibility and limits.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto p-4 sm:p-5 flex-1 min-h-0 overscroll-contain">

            {/* Contact & Subscription Section */}
            <div className="p-3.5 sm:p-4 rounded-2xl border bg-muted/20 space-y-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <CreditCard className="h-4 w-4 text-indigo-500" />
                Contact, Subscription Plan & Payment Controls
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Contact Phone</Label>
                  <Input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={tenantPhone}
                    onChange={e => setTenantPhone(e.target.value)}
                    className="h-9 text-sm font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Subscription Fee (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g. 2999"
                    value={subscriptionAmount}
                    onChange={e => setSubscriptionAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="h-9 text-sm font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Billing Cycle</Label>
                  <Select value={billingCycle} onValueChange={setBillingCycle}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Billing cycle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly (Recurring)</SelectItem>
                      <SelectItem value="quarterly">Quarterly (3 Months)</SelectItem>
                      <SelectItem value="yearly">Yearly (Annual)</SelectItem>
                      <SelectItem value="one_time">One-Time / Lifetime</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Payment Status</Label>
                  <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Payment status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid (Active)</SelectItem>
                      <SelectItem value="unpaid">Due / Unpaid</SelectItem>
                      <SelectItem value="pending_verification">Pending Verification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {lastPaymentRef && (
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="text-muted-foreground block text-[10px]">Client UTR / Ref ID:</span>
                    <span className="font-mono font-bold text-foreground text-sm truncate block">{lastPaymentRef}</span>
                  </div>
                  {paymentStatus !== 'paid' && (
                    <Button
                      size="sm"
                      type="button"
                      onClick={() => {
                        setPaymentStatus('paid');
                        toast.info('Status set to Paid. Click Save to persist.');
                      }}
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                    >
                      <Check className="h-3 w-3 mr-1" /> Mark Paid
                    </Button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
                <div className="flex items-center justify-between p-2.5 rounded-xl border bg-background/50">
                  <div className="space-y-0.5 pr-2">
                    <Label className="text-xs font-semibold">Show Plan to Client</Label>
                    <p className="text-[10px] text-muted-foreground">Show plan & quota meters to client</p>
                  </div>
                  <Switch checked={showPlanToClient} onCheckedChange={setShowPlanToClient} className="shrink-0" />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl border bg-background/50">
                  <div className="space-y-0.5 pr-2">
                    <Label className="text-xs font-semibold">Enable UPI Payment</Label>
                    <p className="text-[10px] text-muted-foreground">Enable 1-click mobile UPI pay</p>
                  </div>
                  <Switch checked={paymentEnabled} onCheckedChange={setPaymentEnabled} className="shrink-0" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Maximum Shops</Label>
              <Input type="number" min={1} value={maxShops} onChange={e => setMaxShops(Number(e.target.value))} className="h-9 text-sm" />
            </div>
            <div className="space-y-2">
              <Label>Maximum Sub-Users</Label>
              <Input type="number" min={1} value={maxUsers} onChange={e => setMaxUsers(Number(e.target.value))} className="h-9 text-sm" />
            </div>
            <div className="space-y-2">
              <Label>Maximum Visits <span className="text-xs text-muted-foreground">(blank = unlimited)</span></Label>
              <Input type="number" min={0} value={maxEntries}
                onChange={e => setMaxEntries(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Unlimited" className="h-9 text-sm" />
              <p className="text-xs text-muted-foreground">Current usage: {entryCounts[selectedAdmin?.id || ''] || 0} entries</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Image className="h-4 w-4" /> Max Images Per Entry</Label>
              <Input type="number" min={0} max={20} value={maxImagesPerEntry} onChange={e => setMaxImagesPerEntry(Number(e.target.value))} className="h-9 text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Image className="h-4 w-4" /> Max Images Total <span className="text-xs text-muted-foreground">(blank = unlimited)</span></Label>
              <Input type="number" min={0} value={maxImagesTotal}
                onChange={e => setMaxImagesTotal(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Unlimited" className="h-9 text-sm" />
              <p className="text-xs text-muted-foreground">Current usage: {imageCounts[selectedAdmin?.id || ''] || 0} images</p>
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/20">
              <div>
                <Label className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-purple-500" /> AI Insights</Label>
                <p className="text-xs text-muted-foreground">Allow this tenant (admin + sub-users) to use AI Summary & Ask AI.</p>
              </div>
              <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
            </div>
            {aiEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-xl border p-3 bg-muted/20">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Daily cap</Label>
                  <Input type="number" min={0} placeholder="∞" value={aiDaily}
                    onChange={e => setAiDaily(e.target.value === '' ? '' : Number(e.target.value))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Monthly cap</Label>
                  <Input type="number" min={0} placeholder="∞" value={aiMonthly}
                    onChange={e => setAiMonthly(e.target.value === '' ? '' : Number(e.target.value))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Lifetime cap</Label>
                  <Input type="number" min={0} placeholder="∞" value={aiLifetime}
                    onChange={e => setAiLifetime(e.target.value === '' ? '' : Number(e.target.value))} className="h-9 text-sm" />
                </div>
                <p className="text-[11px] text-muted-foreground sm:col-span-3">Blank = unlimited. Counters reset at midnight (daily) and on the 1st (monthly).</p>
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/20">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-2"><ClipboardList className="h-4 w-4 text-amber-500" /> Stock Requirements</Label>
                <p className="text-xs text-muted-foreground">Allow this tenant to raise and fulfil stock requirements.</p>
              </div>
              <Switch checked={reqEnabled} onCheckedChange={setReqEnabled} />
            </div>
            {reqEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border p-3 bg-muted/20">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Requirements per month</Label>
                  <Input type="number" min={0} placeholder="∞" value={maxReqMonthly}
                    onChange={e => setMaxReqMonthly(e.target.value === '' ? '' : Number(e.target.value))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Max warehouse staff</Label>
                  <Input type="number" min={0} placeholder="∞" value={maxWarehouseUsers}
                    onChange={e => setMaxWarehouseUsers(e.target.value === '' ? '' : Number(e.target.value))} className="h-9 text-sm" />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/20">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-2"><Layers className="h-4 w-4 text-teal-500" /> Custom Fields Permission</Label>
                <p className="text-xs text-muted-foreground">Allow this tenant to create custom fields. Toggle off to restrict to standard fields only.</p>
              </div>
              <Switch checked={customFieldsEnabled} onCheckedChange={setCustomFieldsEnabled} />
            </div>
            {customFieldsEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border p-3 bg-muted/20">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Max Custom Fields</Label>
                  <Input type="number" min={1} placeholder="5" value={maxCustomFields}
                    onChange={e => setMaxCustomFields(e.target.value === '' ? '' : Number(e.target.value))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Max Options Per Field</Label>
                  <Input type="number" min={1} placeholder="20" value={maxOptionsPerField}
                    onChange={e => setMaxOptionsPerField(e.target.value === '' ? '' : Number(e.target.value))} className="h-9 text-sm" />
                </div>
                <p className="text-[11px] text-muted-foreground sm:col-span-2">
                  Stops clients from bypassing shop/resource limits by creating fake branches as custom field options.
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end border-t border-border/60 p-3.5 sm:p-4 shrink-0 bg-card/95 backdrop-blur-md">
            <Button variant="outline" onClick={() => setLimitsDialogOpen(false)} className="h-10 sm:h-9">Cancel</Button>
            <Button onClick={handleSetLimits} className="h-10 sm:h-9 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md font-semibold">Save Limits</Button>
          </div>
        </DialogContent>

      </Dialog>
      
      {/* Create New Tenant Dialog */}
      <CreateTenantDialog
        open={createTenantOpen}
        onOpenChange={setCreateTenantOpen}
        onSuccess={fetchData}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmationDialog open={!!deleteAdmin} onOpenChange={open => !open && setDeleteAdmin(null)}
        onConfirm={handleDelete} title="Delete Admin & All Data" itemName={deleteAdmin?.name}
        description={`Are you sure you want to delete "${deleteAdmin?.name}"? This will permanently delete the admin, ALL their sub-users, shops, categories, sizes, customer types, visits, and settings.`}
        loading={isDeleting} />

      {/* Pause Confirmation */}
      <DeleteConfirmationDialog open={!!pauseTarget} onOpenChange={open => !open && setPauseTarget(null)}
        onConfirm={() => pauseTarget && handlePauseConfirmed(pauseTarget)} title="Pause Admin"
        description={`Are you sure you want to pause "${pauseTarget?.name}" and all their sub-users? They will be immediately logged out.`}
        confirmLabel="Pause" />

      {/* Activate Confirmation */}
      <DeleteConfirmationDialog open={!!activateTarget} onOpenChange={open => !open && setActivateTarget(null)}
        onConfirm={() => activateTarget && handleActivateConfirmed(activateTarget)} title="Activate Admin"
        description={`Activate "${activateTarget?.name}" and all their sub-users?`}
        confirmLabel="Activate" confirmVariant="default" />

      {/* Bulk Action Confirmation */}
      <DeleteConfirmationDialog open={!!bulkAction} onOpenChange={open => !open && setBulkAction(null)}
        onConfirm={handleBulkActionConfirmed}
        title={bulkAction === 'pause' ? 'Pause All Admins' : 'Activate All Admins'}
        description={bulkAction === 'pause'
          ? `Are you sure you want to pause ALL ${admins.length} admin(s) and their sub-users? They will all be immediately logged out.`
          : `Are you sure you want to activate ALL ${admins.length} admin(s) and their sub-users?`}
        confirmLabel={bulkAction === 'pause' ? 'Pause All' : 'Activate All'}
        confirmVariant={bulkAction === 'pause' ? 'destructive' : 'default'} />
    </div>
      </TabsContent>

      <TabsContent value="settings">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Public Signup Control</CardTitle>
              <CardDescription>Control whether new admins can sign up from the login page.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Allow Public Signup</p>
                  <p className="text-sm text-muted-foreground">
                    {signupEnabled ? 'New admins can register from the login page' : 'Signup is hidden — only existing users can log in'}
                  </p>
                </div>
                <Switch
                  checked={signupEnabled}
                  onCheckedChange={handleToggleSignup}
                  disabled={signupLoading}
                />
              </div>
            </CardContent>
          </Card>
          <PlatformPaymentSettings />
          <GoogleDriveBackupPanel />
        </div>
      </TabsContent>

      <TabsContent value="audit">
        <AuditLogViewer />
      </TabsContent>

      <TabsContent value="health">
        <ReleaseHealthPanel />
      </TabsContent>
    </Tabs>
  );
};

// Extracted admin row component
interface AdminRowProps {
  admin: AdminProfile;
  stats: { shopCount: number; userCount: number };
  subUsers: AdminProfile[];
  isExpanded: boolean;
  entryCount: number;
  imageCount: number;
  currentUserId?: string;
  onToggleExpand: (id: string) => void;
  onActivate: (admin: AdminProfile) => void;
  onPause: (admin: AdminProfile) => void;
  onDelete: (admin: AdminProfile) => void;
  onLimits: (admin: AdminProfile) => void;
  onRoleChange: (profile: AdminProfile, role: string) => void;
  onVerifyPayment: (admin: AdminProfile) => void;
}

const AdminRow = ({
  admin, stats, subUsers, isExpanded, entryCount, imageCount,
  currentUserId, onToggleExpand, onActivate, onPause, onDelete, onLimits, onRoleChange, onVerifyPayment
}: AdminRowProps) => {
  const links = getContactDeepLinks(admin.phone, admin.email, admin.name);

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => onToggleExpand(admin.id)}>
        <TableCell>
          {subUsers.length > 0 ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
        </TableCell>
        <TableCell className="font-medium">
          <div className="space-y-1">
            <div className="font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
              <span>{admin.name}</span>
              {admin.show_plan_to_client === false && (
                <Badge variant="outline" className="text-[9px] py-0 px-1 border-muted text-muted-foreground gap-0.5" title="Plan hidden from client">
                  <EyeOff className="h-2.5 w-2.5" /> Plan Hidden
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
              {admin.email || '-'}
            </div>
            {/* Quick-action Deep Links */}
            <div className="flex items-center gap-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
              {links.telLink && (
                <a
                  href={links.telLink}
                  title={`Call ${admin.phone}`}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-mono transition-colors"
                >
                  <Phone className="h-3 w-3 shrink-0" />
                  <span>{admin.phone}</span>
                </a>
              )}
              {links.waLink && (
                <a
                  href={links.waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`WhatsApp chat with ${admin.name}`}
                  className="p-1 rounded-md bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                </a>
              )}
              {links.mailLink && (
                <a
                  href={links.mailLink}
                  title={`Send email to ${admin.email}`}
                  className="p-1 rounded-md bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 transition-colors"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                </a>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="space-y-1 text-xs">
            <div className="font-semibold text-foreground flex items-center gap-1">
              <IndianRupee className="h-3 w-3 text-emerald-500" />
              <span>{admin.subscription_amount ? Number(admin.subscription_amount).toLocaleString('en-IN') : '0'}</span>
              <span className="text-[10px] text-muted-foreground font-normal">/{admin.billing_cycle || 'mo'}</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {admin.payment_status === 'paid' ? (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                  Paid
                </Badge>
              ) : admin.payment_status === 'pending_verification' ? (
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px] py-0 px-1 border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">
                    UTR Due
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onVerifyPayment(admin)}
                    className="h-5 px-1.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-none"
                    title={admin.last_payment_ref ? `Verify UTR: ${admin.last_payment_ref}` : 'Verify Payment'}
                  >
                    Approve
                  </Button>
                </div>
              ) : (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
                  Due
                </Badge>
              )}
              {admin.payment_enabled === false && (
                <Badge variant="outline" className="text-[9px] py-0 px-1 border-muted text-muted-foreground">
                  UPI Off
                </Badge>
              )}
            </div>
            {admin.last_payment_ref && admin.payment_status === 'pending_verification' && (
              <div className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-semibold truncate max-w-[130px]" title={admin.last_payment_ref}>
                Ref: {admin.last_payment_ref}
              </div>
            )}
          </div>
        </TableCell>
        <TableCell><Badge variant={admin.status === 'active' ? 'default' : 'destructive'}>{admin.status}</Badge></TableCell>
        <TableCell className="text-sm">{formatISTDate(admin.created_at)}</TableCell>
        <TableCell className="text-sm">{admin.last_login_at ? formatISTDateTime(admin.last_login_at) : 'Never'}</TableCell>
        <TableCell><span className="flex items-center gap-1 text-sm"><Building className="h-3 w-3" /> {stats.shopCount}/{admin.max_shops ?? '∞'}</span></TableCell>
        <TableCell><span className="flex items-center gap-1 text-sm"><Users className="h-3 w-3" /> {stats.userCount}/{admin.max_users ?? '∞'}</span></TableCell>
        <TableCell><span className="text-sm">{entryCount}/{admin.max_entries ?? '∞'}</span></TableCell>
        <TableCell><span className="flex items-center gap-1 text-sm"><Image className="h-3 w-3" /> {imageCount}/{admin.max_images_total ?? '∞'}</span></TableCell>
        <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label={`Actions for ${admin.name}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {admin.payment_status === 'pending_verification' && (
                <DropdownMenuItem onClick={() => onVerifyPayment(admin)} className="text-emerald-600 focus:text-emerald-600">
                  <Check className="h-3.5 w-3.5 mr-2 text-emerald-500" /> Verify Payment (Paid)
                </DropdownMenuItem>
              )}
              {admin.status === 'paused' ? (
                <DropdownMenuItem onClick={() => onActivate(admin)}><Play className="h-3.5 w-3.5 mr-2" /> Activate</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onPause(admin)}><Pause className="h-3.5 w-3.5 mr-2" /> Pause</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onLimits(admin)}><Settings className="h-3.5 w-3.5 mr-2" /> Manage Billing & Limits</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(admin)}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete tenant
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>

      </TableRow>
      {isExpanded && subUsers.map(sub => (
        <TableRow key={sub.id} className="bg-muted/20">
          <TableCell></TableCell>
          <TableCell className="pl-8 text-sm">↳ {sub.name}</TableCell>
          <TableCell className="text-sm text-muted-foreground">{sub.email || '-'}</TableCell>
          <TableCell><Badge variant={sub.status === 'active' ? 'default' : 'destructive'} className="text-xs">{sub.status}</Badge></TableCell>
          <TableCell className="text-sm">{formatISTDate(sub.created_at)}</TableCell>
          <TableCell className="text-sm">{sub.last_login_at ? formatISTDateTime(sub.last_login_at) : 'Never'}</TableCell>
          <TableCell colSpan={4}><Badge variant="outline" className="text-xs">{sub.role}</Badge></TableCell>
          <TableCell></TableCell>
          <TableCell>
            {sub.id !== currentUserId && (
              <Select value={sub.role} onValueChange={(val) => onRoleChange(sub, val)}>
                <SelectTrigger className="w-[110px] h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="user">Staff</SelectItem>
                </SelectContent>
              </Select>
            )}
          </TableCell>
        </TableRow>
      ))}
      {isExpanded && subUsers.length === 0 && (
        <TableRow className="bg-muted/20">
          <TableCell></TableCell>
          <TableCell colSpan={11} className="text-sm text-muted-foreground italic">No sub-users for this admin</TableCell>
        </TableRow>
      )}
    </>
  );
};
