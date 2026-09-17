import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReleaseHealthPanel } from '@/components/admin/ReleaseHealthPanel';
import { HeartPulse } from 'lucide-react';
import { toast } from 'sonner';
import { Play, Pause, Trash2, Settings, Users, Building, Shield, Search, ChevronDown, ChevronRight, Image, CheckCircle, XCircle, Activity, UserPlus, Sparkles, RefreshCw, MoreHorizontal, ArrowUpDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { GoogleDriveBackupPanel } from './admin/GoogleDriveBackupPanel';
import { AuditLogViewer } from './AuditLogViewer';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { logAudit } from '@/utils/auditLog';

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
    const channel = supabase
      .channel('sa-profiles-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goods_damaged_entries' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gd_entry_images' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
    } catch (error: any) { toast.error(error.message || 'Failed to change role'); }
  }, [user?.id]);

  const handleActivateConfirmed = useCallback(async (admin: AdminProfile) => {
    try {
      const { error } = await (supabase.from('profiles') as any).update({ status: 'active' }).eq('id', admin.id);
      if (error) throw error;
      await (supabase.from('profiles') as any).update({ status: 'active' }).eq('admin_id', admin.id).neq('id', admin.id);
      await logAudit({ action: 'user_activated', targetType: 'profile', targetId: admin.id, details: { name: admin.name } });
      toast.success(`${admin.name} activated successfully`);
    } catch (error: any) { toast.error(error.message || 'Failed to activate'); }
    setActivateTarget(null);
  }, []);

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
    } catch (error: any) { toast.error(error.message || 'Failed to pause'); }
    setPauseTarget(null);
  }, [getSubUsers]);

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
    } catch (error: any) { toast.error(error.message || 'Bulk action failed'); }
    setBulkAction(null);
  }, [bulkAction, admins, getSubUsers]);

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
      toast.success('Limits updated successfully');
      setLimitsDialogOpen(false);
    } catch (error: any) { toast.error(error.message || 'Failed to update limits'); }
  }, [selectedAdmin, maxShops, maxUsers, maxEntries, maxImagesPerEntry, maxImagesTotal, aiEnabled, aiDaily, aiMonthly, aiLifetime, reqEnabled, maxReqMonthly, maxWarehouseUsers, customFieldsEnabled, maxCustomFields, maxOptionsPerField]);

  const openLimitsDialog = useCallback((admin: AdminProfile) => {
    setSelectedAdmin(admin);
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
    { label: 'Tenants', value: admins.length, icon: Shield, tone: 'text-foreground' },
    { label: 'Active', value: activeAdmins.length, icon: CheckCircle, tone: 'text-primary' },
    { label: 'Paused', value: pausedAdmins.length, icon: XCircle, tone: 'text-destructive' },
    { label: 'Sub-users', value: totalSubUsers, icon: Users, tone: 'text-foreground' },
    { label: 'Shops', value: allShops.length, icon: Building, tone: 'text-foreground' },
    { label: 'Entries', value: totalEntries, icon: Activity, tone: 'text-foreground' },
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

        <TabsList className="w-full flex sm:grid sm:grid-cols-4 gap-1 overflow-x-auto no-scrollbar justify-start">
          <TabsTrigger value="tenants" className="flex items-center gap-1 shrink-0 rounded-full sm:rounded-md"><Shield className="h-4 w-4" /> Tenants</TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1 shrink-0 rounded-full sm:rounded-md"><Settings className="h-4 w-4" /> Settings</TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1 shrink-0 rounded-full sm:rounded-md"><Activity className="h-4 w-4" /> Audit</TabsTrigger>
          <TabsTrigger value="health" className="flex items-center gap-1 shrink-0 rounded-full sm:rounded-md"><HeartPulse className="h-4 w-4" /> Health</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="tenants">
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {kpis.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="premium-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className={`text-2xl font-bold mt-1 ${tone}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + filters + bulk actions */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or email..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="paused">Paused only</SelectItem>
          </SelectContent>
        </Select>
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Tenant Admin Management</CardTitle>
          <CardDescription>{admins.length} registered admin(s). Click to expand and see sub-users.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>
                    <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 hover:text-foreground">
                      Name <ArrowUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </TableHead>
                  <TableHead>Email</TableHead>
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
                      onDelete={setDeleteAdmin} onLimits={openLimitsDialog} onRoleChange={handleRoleChange} />
                  );
                })}
                {filteredAdmins.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-10">
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
        <DialogContent className="max-h-[85dvh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
            <DialogTitle>Set Limits for {selectedAdmin?.name}</DialogTitle>
            <DialogDescription>Configure resource limits for this admin tenant.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto px-6 py-4 flex-1 min-h-0 overscroll-contain">

            <div className="space-y-2">
              <Label>Maximum Shops</Label>
              <Input type="number" min={1} value={maxShops} onChange={e => setMaxShops(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Maximum Sub-Users</Label>
              <Input type="number" min={1} value={maxUsers} onChange={e => setMaxUsers(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Maximum Visits <span className="text-xs text-muted-foreground">(blank = unlimited)</span></Label>
              <Input type="number" min={0} value={maxEntries}
                onChange={e => setMaxEntries(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Unlimited" />
              <p className="text-xs text-muted-foreground">Current usage: {entryCounts[selectedAdmin?.id || ''] || 0} entries</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Image className="h-4 w-4" /> Max Images Per Entry</Label>
              <Input type="number" min={0} max={20} value={maxImagesPerEntry} onChange={e => setMaxImagesPerEntry(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Image className="h-4 w-4" /> Max Images Total <span className="text-xs text-muted-foreground">(blank = unlimited)</span></Label>
              <Input type="number" min={0} value={maxImagesTotal}
                onChange={e => setMaxImagesTotal(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Unlimited" />
              <p className="text-xs text-muted-foreground">Current usage: {imageCounts[selectedAdmin?.id || ''] || 0} images</p>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> AI Insights</Label>
                <p className="text-xs text-muted-foreground">Allow this tenant (admin + sub-users) to use AI Summary & Ask AI.</p>
              </div>
              <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
            </div>
            {aiEnabled && (
              <div className="grid grid-cols-3 gap-2 rounded-md border p-3">
                <div className="space-y-1">
                  <Label className="text-xs">Daily cap</Label>
                  <Input type="number" min={0} placeholder="∞" value={aiDaily}
                    onChange={e => setAiDaily(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Monthly cap</Label>
                  <Input type="number" min={0} placeholder="∞" value={aiMonthly}
                    onChange={e => setAiMonthly(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lifetime cap</Label>
                  <Input type="number" min={0} placeholder="∞" value={aiLifetime}
                    onChange={e => setAiLifetime(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <p className="text-xs text-muted-foreground col-span-3">Blank = unlimited. Counters reset at midnight (daily) and on the 1st (monthly).</p>
              </div>
            )}
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Stock Requirements</Label>
                <p className="text-xs text-muted-foreground">Allow this tenant to raise and fulfil stock requirements.</p>
              </div>
              <Switch checked={reqEnabled} onCheckedChange={setReqEnabled} />
            </div>
            {reqEnabled && (
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                <div className="space-y-1">
                  <Label className="text-xs">Requirements per month</Label>
                  <Input type="number" min={0} placeholder="∞" value={maxReqMonthly}
                    onChange={e => setMaxReqMonthly(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max warehouse staff</Label>
                  <Input type="number" min={0} placeholder="∞" value={maxWarehouseUsers}
                    onChange={e => setMaxWarehouseUsers(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Custom Fields Permission</Label>
                <p className="text-xs text-muted-foreground">Allow this tenant to create custom fields. Toggle off to restrict to standard fields only.</p>
              </div>
              <Switch checked={customFieldsEnabled} onCheckedChange={setCustomFieldsEnabled} />
            </div>
            {customFieldsEnabled && (
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                <div className="space-y-1">
                  <Label className="text-xs">Max Custom Fields</Label>
                  <Input type="number" min={1} placeholder="5" value={maxCustomFields}
                    onChange={e => setMaxCustomFields(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Options Per Field</Label>
                  <Input type="number" min={1} placeholder="20" value={maxOptionsPerField}
                    onChange={e => setMaxOptionsPerField(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <p className="text-[11px] text-muted-foreground col-span-2">
                  Stops clients from bypassing shop/resource limits by creating fake branches as custom field options.
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end border-t px-6 py-3 shrink-0 bg-background">
            <Button variant="outline" onClick={() => setLimitsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSetLimits}>Save Limits</Button>
          </div>
        </DialogContent>

      </Dialog>

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
}

const AdminRow = ({
  admin, stats, subUsers, isExpanded, entryCount, imageCount,
  currentUserId, onToggleExpand, onActivate, onPause, onDelete, onLimits, onRoleChange
}: AdminRowProps) => (
  <>
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => onToggleExpand(admin.id)}>
      <TableCell>
        {subUsers.length > 0 ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
      </TableCell>
      <TableCell className="font-medium">{admin.name}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{admin.email || '-'}</TableCell>
      <TableCell><Badge variant={admin.status === 'active' ? 'default' : 'destructive'}>{admin.status}</Badge></TableCell>
      <TableCell className="text-sm">{format(new Date(admin.created_at), 'PP')}</TableCell>
      <TableCell className="text-sm">{admin.last_login_at ? format(new Date(admin.last_login_at), 'PP p') : 'Never'}</TableCell>
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
          <DropdownMenuContent align="end" className="w-44">
            {admin.status === 'paused' ? (
              <DropdownMenuItem onClick={() => onActivate(admin)}><Play className="h-3.5 w-3.5 mr-2" /> Activate</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onPause(admin)}><Pause className="h-3.5 w-3.5 mr-2" /> Pause</DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onLimits(admin)}><Settings className="h-3.5 w-3.5 mr-2" /> Set limits</DropdownMenuItem>
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
        <TableCell className="text-sm">{format(new Date(sub.created_at), 'PP')}</TableCell>
        <TableCell className="text-sm">{sub.last_login_at ? format(new Date(sub.last_login_at), 'PP p') : 'Never'}</TableCell>
        <TableCell colSpan={3}><Badge variant="outline" className="text-xs">{sub.role}</Badge></TableCell>
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
        <TableCell colSpan={10} className="text-sm text-muted-foreground italic">No sub-users for this admin</TableCell>
      </TableRow>
    )}
  </>
);
