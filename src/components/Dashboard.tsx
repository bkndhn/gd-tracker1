import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { TrendingUp, TrendingDown, Package, Calendar, CalendarDays, Sparkles, Filter, X, ArrowUpDown, BarChart3, FileDown, FileSpreadsheet, LineChart, LayoutGrid, Users, UserCheck, Store } from 'lucide-react';
import { exportToPDFViaHTML, makeImageCell } from '@/utils/htmlPdfExport';
import * as XLSX from 'xlsx';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { SavedViewsBar } from '@/components/SavedViewsBar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImageDisplay } from './ImageDisplay';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import { NoteViewerModal } from './NoteViewerModal';
import { AnalyticsCharts } from './AnalyticsCharts';
import { useFieldLabels } from '@/hooks/useFieldLabels';
import { AIInsightsPanel } from './AIInsightsPanel';
import { useCustomValueIndex, stdValue, stdOptions } from '@/hooks/useEntryCustomValues';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { DashboardLayoutEditor } from './DashboardLayoutEditor';
import { cacheGet, cacheSet } from '@/lib/offlineDb';
import { WhatsAppFollowUpButton } from '@/components/WhatsAppFollowUpButton';
import { isValidPhone, type FollowUpContext } from '@/lib/whatsappFollowUp';

const DASHBOARD_CACHE_KEY = 'dashboard:entries';
const DASHBOARD_SHOPS_CACHE_KEY = 'dashboard:shops';


interface GDEntry {
  id: string;
  created_at: string;
  shop_id: string;
  notes: string;
  shops: { name: string } | null;
  categories: { name: string } | null;
  sizes: { size: string } | null;
  customer_types: { name: string } | null;
  voice_note_url?: string | null;
  gd_entry_images?: Array<{ id: string; image_url: string; image_name?: string }>;
  employee_name?: string | null;
  customFieldValues?: Record<string, string>;
}


export const Dashboard = () => {
  const { profile, isAdmin, isManager, userShopId } = useAuth();
  const { isOnline, pendingCount } = useOfflineSync();
  const { labels } = useFieldLabels();
  const layoutController = useDashboardLayout();
  const { orderedVisible } = layoutController;
  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false);

  // Filter states
  const [selectedShop, setSelectedShop] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCustomerType, setSelectedCustomerType] = useState<string>('all');
  const [dateRangePreset, setDateRangePreset] = useState<string>('all_time');
  const [customDateFrom, setCustomDateFrom] = useState<Date>();
  const [customDateTo, setCustomDateTo] = useState<Date>();
  const [showFilters, setShowFilters] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showCharts, setShowCharts] = useState(false);

  // Modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [modalFilter, setModalFilter] = useState<{ type: 'shop' | 'category' | 'size' | 'customer_type'; value: string }>({ type: 'shop', value: '' });

  // Effect to force shop selection for manager
  useEffect(() => {
    if (import.meta.env.DEV) console.log('Dashboard Manager check:', { isManager, userShopId, selectedShop });
    if (isManager && userShopId) {
      // Always force manager to their shop
      if (selectedShop === 'all' || selectedShop !== userShopId) {
        if (import.meta.env.DEV) console.log('Setting manager shop to:', userShopId);
        setSelectedShop(userShopId);
      }
    }
  }, [isManager, userShopId]);

  // Shops still live in their own table (branch-level RLS depends on shop_id)
  const { data: masterData } = useQuery({
    queryKey: ['dashboard-master-data'],
    queryFn: async () => {
      if (!navigator.onLine) {
        const cached = await cacheGet<any[]>(DASHBOARD_SHOPS_CACHE_KEY);
        if (cached) return { shops: cached.value };
      }
      const shopsRes = await supabase.from('shops').select('*').is('deleted_at', null).order('name');
      if (shopsRes.error) {
        const cached = await cacheGet<any[]>(DASHBOARD_SHOPS_CACHE_KEY);
        if (cached) return { shops: cached.value };
        throw shopsRes.error;
      }
      void cacheSet(DASHBOARD_SHOPS_CACHE_KEY, shopsRes.data || []);
      return { shops: shopsRes.data || [] };
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch all GD entries (no legacy lookup joins)
  const { data: rawEntries, isLoading, refetch } = useQuery<any[]>({
    queryKey: ['dashboard-entries', userShopId],
    queryFn: async () => {
      // Offline: serve the last successful snapshot straight from IndexedDB
      if (!navigator.onLine) {
        const cached = await cacheGet<any[]>(DASHBOARD_CACHE_KEY);
        if (cached) return cached.value;
      }

      const { data: entriesData, error: entriesError } = await supabase
        .from('goods_damaged_entries')
        .select('id, created_at, shop_id, notes, voice_note_url, employee_name')
        .order('created_at', { ascending: false });

      if (entriesError) {
        if (import.meta.env.DEV) console.error('Dashboard fetch error:', entriesError);
        const cached = await cacheGet<any[]>(DASHBOARD_CACHE_KEY);
        if (cached) return cached.value;
        throw entriesError;
      }

      const entryIds = entriesData?.map(e => e.id) || [];
      let imagesData: any[] = [];

      if (entryIds.length > 0) {
        const { data: imgData, error: imagesError } = await supabase
          .from('gd_entry_images')
          .select('id, gd_entry_id, image_url, image_name')
          .in('gd_entry_id', entryIds)
          .order('created_at', { ascending: true });

        if (imagesError) {
          if (import.meta.env.DEV) console.error('Dashboard images fetch error:', imagesError);
        } else {
          imagesData = imgData || [];
        }
      }

      const merged = (entriesData || []).map(entry => ({
        ...entry,
        gd_entry_images: imagesData.filter(img => img.gd_entry_id === entry.id),
      }));
      void cacheSet(DASHBOARD_CACHE_KEY, merged);
      return merged;
    },
    enabled: !!profile && (isAdmin || isManager),
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60 * 5,
  });

  const entryIds = useMemo(() => (rawEntries || []).map(e => e.id), [rawEntries]);
  const { data: cvIndex } = useCustomValueIndex(entryIds, !!rawEntries);

  // Resolve every display field from gd_entry_custom_values
  const allEntries = useMemo<GDEntry[] | undefined>(() => {
    if (!rawEntries) return undefined;
    return rawEntries.map(entry => ({
      ...entry,
      shops: { name: stdValue(cvIndex, entry.id, 'shop') || 'Unknown' },
      categories: { name: stdValue(cvIndex, entry.id, 'category') || 'Unknown' },
      sizes: { size: stdValue(cvIndex, entry.id, 'size') || 'Unknown' },
      customer_types: { name: stdValue(cvIndex, entry.id, 'customer_type') || 'Unknown' },
      customFieldValues: cvIndex?.valuesByEntry?.[entry.id] || {},
    })) as GDEntry[];
  }, [rawEntries, cvIndex]);

  // --- WhatsApp follow-up (tenant-scoped: values come from this admin's own entries) ---
  const tenantFields = cvIndex?.fields || [];
  const phoneFields = useMemo(
    () => tenantFields.filter(f => (f.field_type || '') === 'phone'),
    [tenantFields],
  );

  const buildFollowUpContext = useCallback((entry: GDEntry): FollowUpContext | null => {
    const rawPhone = phoneFields
      .map(f => entry.customFieldValues?.[f.id])
      .find(v => isValidPhone(v));
    if (!rawPhone) return null;

    const extras: Record<string, string> = {};
    tenantFields.forEach(f => {
      if ((f.field_type || '') === 'phone' || f.is_standard) return;
      const val = entry.customFieldValues?.[f.id];
      if (val) extras[f.name] = val;
    });

    const reasonField = tenantFields.find(f => /reason/i.test(f.name));
    const reason = (reasonField && entry.customFieldValues?.[reasonField.id])
      || entry.customer_types?.name
      || entry.categories?.name;
    if (reasonField) delete extras[reasonField.name];

    return {
      phone: rawPhone,
      shopName: entry.shops?.name,
      reason,
      category: entry.categories?.name,
      size: entry.sizes?.size,
      customerType: entry.customer_types?.name,
      notes: entry.notes,
      visitedAt: entry.created_at,
      extras,
      reporterName: entry.employee_name || undefined,
    };
  }, [tenantFields, phoneFields]);

  const categoryOptions = useMemo(() => stdOptions(cvIndex, 'category'), [cvIndex]);
  const customerTypeOptions = useMemo(() => stdOptions(cvIndex, 'customer_type'), [cvIndex]);

  // Calculate summary from filtered entries
  const summary = useMemo(() => {
    if (!allEntries) return null;

    // Apply filters
    let filtered = allEntries;

    if (selectedShop !== 'all') {
      filtered = filtered.filter(e => e.shop_id === selectedShop);
    }
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(e => e.categories?.name === selectedCategory);
    }
    if (selectedCustomerType !== 'all') {
      filtered = filtered.filter(e => e.customer_types?.name === selectedCustomerType);
    }

    if (customDateFrom) {
      filtered = filtered.filter(e => new Date(e.created_at) >= customDateFrom);
    }
    if (customDateTo) {
      const endOfDay = new Date(customDateTo);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(e => new Date(e.created_at) <= endOfDay);
    }

    // Calculate time-based counts
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Previous periods
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

    const today = filtered.filter(e => new Date(e.created_at) >= todayStart).length;
    const thisWeek = filtered.filter(e => new Date(e.created_at) >= weekAgo).length;
    const thisMonth = filtered.filter(e => new Date(e.created_at) >= monthStart).length;

    const prevToday = filtered.filter(e => {
      const d = new Date(e.created_at);
      return d >= yesterdayStart && d < todayStart;
    }).length;

    const prevWeek = filtered.filter(e => {
      const d = new Date(e.created_at);
      return d >= twoWeeksAgo && d < weekAgo;
    }).length;

    const prevMonth = filtered.filter(e => {
      const d = new Date(e.created_at);
      return d >= prevMonthStart && d < monthStart;
    }).length;

    // Calculate breakdowns
    const byShop: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const bySize: Record<string, number> = {};
    const byCustomerType: Record<string, number> = {};

    // Use filtered entries based on dateRangePreset:
    // - "all_time": show all filtered entries
    // - Custom dates set: show filtered entries
    // - Otherwise (default "today"): show only today's entries
    const breakdownEntries = dateRangePreset === 'all_time'
      ? filtered
      : (customDateFrom || customDateTo)
        ? filtered
        : filtered.filter(e => new Date(e.created_at) >= todayStart);

    breakdownEntries.forEach(entry => {
      const shop = entry.shops?.name || 'Unknown';
      const category = entry.categories?.name || 'Unknown';
      const size = entry.sizes?.size || 'Unknown';
      const customerType = entry.customer_types?.name || 'Unknown';

      byShop[shop] = (byShop[shop] || 0) + 1;
      byCategory[category] = (byCategory[category] || 0) + 1;
      bySize[size] = (bySize[size] || 0) + 1;
      byCustomerType[customerType] = (byCustomerType[customerType] || 0) + 1;
    });

    const topList = (map: Record<string, number>, limit = 3) =>
      Object.entries(map)
        .filter(([name]) => name && name !== 'Unknown')
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([name, count]) => ({ name, count }));

    // Who logged the visits (reporter/employee)
    const byEmployee: Record<string, number> = {};
    breakdownEntries.forEach(entry => {
      const who = (entry as any).employee_name || 'Unknown';
      byEmployee[who] = (byEmployee[who] || 0) + 1;
    });

    return {
      today,
      thisWeek,
      thisMonth,
      total: filtered.length,
      prevToday,
      prevWeek,
      prevMonth,
      byShop,
      byCategory,
      bySize,
      byCustomerType,
      byEmployee,
      breakdownTotal: breakdownEntries.length,
      topReasons: topList(byCategory),
      topEmployees: topList(byEmployee),
      topSegments: topList(byCustomerType),
      topShops: topList(byShop),
    };

  }, [allEntries, selectedShop, selectedCategory, selectedCustomerType, customDateFrom, customDateTo, dateRangePreset]);

  // Real-time subscription
  useEffect(() => {
    if (!profile || !isAdmin) return;

    const channel = supabase
      .channel('dashboard-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'goods_damaged_entries'
        },
        () => {
          if (import.meta.env.DEV) console.log('GD entry changed, refreshing dashboard...');
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, isAdmin, refetch]);

  const clearFilters = () => {
    setSelectedShop('all');
    setSelectedCategory('all');
    setSelectedCustomerType('all');
    setDateRangePreset('all_time');
    setCustomDateFrom(undefined);
    setCustomDateTo(undefined);
  };

  const applySavedFilters = (f: Record<string, any>) => {
    if (!f) return;
    setSelectedShop(f.selectedShop ?? 'all');
    setSelectedCategory(f.selectedCategory ?? 'all');
    setSelectedCustomerType(f.selectedCustomerType ?? 'all');
    setDateRangePreset(f.dateRangePreset ?? 'all_time');
    setCustomDateFrom(f.customDateFrom ? new Date(f.customDateFrom) : undefined);
    setCustomDateTo(f.customDateTo ? new Date(f.customDateTo) : undefined);
  };


  // Handle date range preset changes
  const handleDateRangePresetChange = (value: string) => {
    setDateRangePreset(value);
    const now = new Date();

    switch (value) {
      case 'today':
        setCustomDateFrom(new Date(now.setHours(0, 0, 0, 0)));
        setCustomDateTo(new Date());
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        setCustomDateFrom(new Date(yesterday.setHours(0, 0, 0, 0)));
        setCustomDateTo(new Date(yesterday.setHours(23, 59, 59, 999)));
        break;
      case 'this_week':
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        setCustomDateFrom(new Date(weekStart.setHours(0, 0, 0, 0)));
        setCustomDateTo(new Date());
        break;
      case 'this_month':
        setCustomDateFrom(new Date(now.getFullYear(), now.getMonth(), 1));
        setCustomDateTo(new Date());
        break;
      case 'this_year':
        setCustomDateFrom(new Date(now.getFullYear(), 0, 1));
        setCustomDateTo(new Date());
        break;
      case 'all_time':
        setCustomDateFrom(undefined);
        setCustomDateTo(undefined);
        break;
      case 'custom':
        // Keep existing dates or clear them
        break;
    }
  };

  const hasActiveFilters = selectedShop !== 'all' || selectedCategory !== 'all' ||
    selectedCustomerType !== 'all' || dateRangePreset !== 'all_time';

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  // Get filtered entries for modal based on clicked item
  const getModalEntries = useMemo(() => {
    if (!allEntries || !modalFilter.value) return [];

    // Use date filters based on dateRangePreset
    let dateFilteredEntries = allEntries;

    if (dateRangePreset === 'all_time') {
      // Show all entries for All Time
      dateFilteredEntries = allEntries;
    } else if (customDateFrom || customDateTo) {
      // Apply custom date filters
      if (customDateFrom) {
        dateFilteredEntries = dateFilteredEntries.filter(e => new Date(e.created_at) >= customDateFrom);
      }
      if (customDateTo) {
        const endOfDay = new Date(customDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        dateFilteredEntries = dateFilteredEntries.filter(e => new Date(e.created_at) <= endOfDay);
      }
    } else {
      // Default to today's entries
      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      dateFilteredEntries = allEntries.filter(e => new Date(e.created_at) >= todayStart);
    }

    // Apply specific filter based on clicked item
    switch (modalFilter.type) {
      case 'shop':
        return dateFilteredEntries.filter(e => e.shops?.name === modalFilter.value);
      case 'category':
        return dateFilteredEntries.filter(e => e.categories?.name === modalFilter.value);
      case 'size':
        return dateFilteredEntries.filter(e => e.sizes?.size === modalFilter.value);
      case 'customer_type':
        return dateFilteredEntries.filter(e => e.customer_types?.name === modalFilter.value);
      default:
        return dateFilteredEntries;
    }
  }, [allEntries, modalFilter, customDateFrom, customDateTo, dateRangePreset]);

  const handleItemClick = (type: 'shop' | 'category' | 'size' | 'customer_type', value: string) => {
    setModalFilter({ type, value });
    setDetailModalOpen(true);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day}-${month}-${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  // Export to Excel
  const exportToExcel = () => {
    const data = getModalEntries.map((entry, idx) => ({
      'S.NO': idx + 1,
      'SHOP': entry.shops?.name || 'N/A',
      'CATEGORY': entry.categories?.name || 'N/A',
      'SIZE': entry.sizes?.size || 'N/A',
      'CUSTOMER TYPE': entry.customer_types?.name || 'N/A',
      'NOTES': entry.notes,
      'DATE AND TIME': formatDateTime(entry.created_at)
    }));

    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-fit columns
    const colWidths = [
      { wch: 6 },  // S.NO
      { wch: 20 }, // SHOP
      { wch: 20 }, // CATEGORY
      { wch: 10 }, // SIZE
      { wch: 20 }, // CUSTOMER TYPE
      { wch: 40 }, // NOTES
      { wch: 20 }, // DATE AND TIME
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GD Entries');

    const fileName = `GD_${modalFilter.type}_${modalFilter.value}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Export to PDF using HTML print method (supports Tamil + images)
  const exportToPDF = () => {
    const dateRangeText = (customDateFrom || customDateTo)
      ? `${customDateFrom ? format(customDateFrom, 'PP') : ''} - ${customDateTo ? format(customDateTo, 'PP') : ''}`
      : "Today's entries";

    const rows = getModalEntries.map((entry, idx) => [
      String(idx + 1),
      entry.shops?.name || 'N/A',
      entry.categories?.name || 'N/A',
      entry.sizes?.size || 'N/A',
      entry.customer_types?.name || 'N/A',
      entry.notes,
      makeImageCell((entry.gd_entry_images || []).map(img => img.image_url)),
      formatDateTime(entry.created_at)
    ]);

    exportToPDFViaHTML({
      title: `Lost Sale Report: ${modalFilter.value}`,
      subtitle: dateRangeText,
      columns: [
        { header: 'S.NO', width: '40px', align: 'center' },
        { header: 'SHOP', width: '11%' },
        { header: 'CATEGORY', width: '11%' },
        { header: 'SIZE', width: '7%', align: 'center' },
        { header: 'CUSTOMER TYPE', width: '12%' },
        { header: 'NOTES' },
        { header: 'IMAGE', width: '14%', align: 'center' },
        { header: 'DATE & TIME', width: '13%' }
      ],
      rows,
      orientation: 'landscape',
    });
  };

  if (!isAdmin && !isManager) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-6 px-4">
        <Package className="h-24 w-24 text-muted-foreground/20" />
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Dashboard Access</h2>
          <p className="text-muted-foreground max-w-md">
            Dashboard is only available for admin and manager users.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <Sparkles className="h-8 w-8 text-primary animate-pulse" />
        <div className="text-lg font-medium text-primary">Loading dashboard...</div>
      </div>
    );
  }

  // Show empty state only when there's truly no data in the database
  const hasNoData = !allEntries || allEntries.length === 0;
  const hasNoFilteredData = summary && summary.total === 0 && !hasNoData;

  const breakdownConfig: Array<{
    id: 'by_shop' | 'by_category' | 'by_size' | 'by_customer_type';
    title: string;
    accentBar: string;
    accentText: string;
    countClass: string;
    data: Record<string, number>;
    filterType: 'shop' | 'category' | 'size' | 'customer_type';
    emptyText: string;
    gradientTitle?: boolean;
  }> = [
    { id: 'by_shop', title: 'By Shop', accentBar: 'from-primary to-primary/50', accentText: 'text-primary/60', countClass: 'text-primary', data: summary?.byShop || {}, filterType: 'shop', emptyText: 'No shop data', gradientTitle: true },
    { id: 'by_category', title: 'By Category', accentBar: 'from-orange-500 to-orange-400', accentText: 'text-orange-500/80', countClass: 'text-orange-500', data: summary?.byCategory || {}, filterType: 'category', emptyText: 'No category data' },
    { id: 'by_size', title: 'By Size', accentBar: 'from-cyan-500 to-cyan-400', accentText: 'text-cyan-500/80', countClass: 'text-cyan-500', data: summary?.bySize || {}, filterType: 'size', emptyText: 'No size data' },
    { id: 'by_customer_type', title: 'By Customer Type', accentBar: 'from-primary to-primary/50', accentText: 'text-primary/60', countClass: 'text-primary', data: summary?.byCustomerType || {}, filterType: 'customer_type', emptyText: 'No customer type data', gradientTitle: true },
  ];

  const kpiNodes: Record<string, JSX.Element> = {
    kpi_today: (
      <Card className="group hover:shadow-xl border-2 border-primary/20 hover:border-primary/40 transition-all duration-300 cursor-pointer overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold text-primary">Today</CardTitle>
          <Calendar className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">{summary?.today || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">Today's entries</p>
          {showComparison && summary && summary.prevToday !== undefined && (
            <p className="text-xs mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {calculateChange(summary.today, summary.prevToday)}% vs yesterday
            </p>
          )}
        </CardContent>
      </Card>
    ),
    kpi_week: (
      <Card className="group hover:shadow-xl border-2 border-primary/20 hover:border-primary/40 transition-all duration-300 cursor-pointer overflow-hidden relative bg-gradient-to-br from-card to-card/80">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">This Week</CardTitle>
          <CalendarDays className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">{summary?.thisWeek || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
          {showComparison && summary && summary.prevWeek !== undefined && (
            <p className="text-xs mt-1 flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              {calculateChange(summary.thisWeek, summary.prevWeek)}% vs last week
            </p>
          )}
        </CardContent>
      </Card>
    ),
    kpi_month: (
      <Card className="group hover:shadow-xl border-2 border-primary/20 hover:border-primary/40 transition-all duration-300 cursor-pointer overflow-hidden relative bg-gradient-to-br from-card to-card/80">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">This Month</CardTitle>
          <Package className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">{summary?.thisMonth || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">Current month</p>
          {showComparison && summary && summary.prevMonth !== undefined && (
            <p className="text-xs mt-1 flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              {calculateChange(summary.thisMonth, summary.prevMonth)}% vs last month
            </p>
          )}
        </CardContent>
      </Card>
    ),
    kpi_total: (
      <Card className="group hover:shadow-xl border-2 border-muted-foreground/20 hover:border-muted-foreground/40 transition-all duration-300 cursor-pointer overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-muted-foreground/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold">Total</CardTitle>
          <Sparkles className="h-5 w-5" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{summary?.total || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">All time entries</p>
        </CardContent>
      </Card>
    ),
  };

  const sectionNodes: Record<string, JSX.Element | null> = {
    charts: showCharts && allEntries && allEntries.length > 0 ? (
      <div className="mt-6"><AnalyticsCharts entries={allEntries} /></div>
    ) : null,
    ai: summary ? (
      <div className="mt-6"><AIInsightsPanel context="dashboard" data={summary} /></div>
    ) : null,
  };

  const visibleKpis = orderedVisible('kpi');
  const visibleSections = orderedVisible('section');
  const visibleBreakdowns = orderedVisible('breakdown');

  return (
    <div className="space-y-6 pb-6">
      {hasNoData ? (
        <div className="flex flex-col items-center justify-center h-[70vh] gap-6 px-4">
          <div className="relative">
            <Package className="h-24 w-24 text-muted-foreground/20" />
            <Sparkles className="h-10 w-10 text-primary/50 absolute -top-2 -right-2" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Welcome to Your Dashboard!</h2>
            <p className="text-muted-foreground max-w-md">
              Start by logging your first non-purchase visit. Click the "Log Visit" tab below to get started.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Header with Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Dashboard Overview
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={showCharts ? "default" : "outline"}
                size="sm"
                onClick={() => setShowCharts(!showCharts)}
                className="gap-1 sm:gap-2 text-xs sm:text-sm"
              >
                <LineChart className="h-3 w-3 sm:h-4 sm:w-4" />
                Charts
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowComparison(!showComparison)}
                className="gap-1 sm:gap-2 text-xs sm:text-sm"
              >
                <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">{showComparison ? 'Hide' : 'Show'}</span> Comparison
              </Button>
              <Button
                variant={hasActiveFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-1 sm:gap-2 text-xs sm:text-sm"
              >
                <Filter className="h-3 w-3 sm:h-4 sm:w-4" />
                Filters
                {hasActiveFilters && <span className="ml-1 bg-background/80 text-foreground rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-xs font-bold">!</span>}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLayoutEditorOpen(true)}
                className="gap-1 sm:gap-2 text-xs sm:text-sm"
              >
                <LayoutGrid className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Customize</span>
              </Button>
            </div>
          </div>

          {/* No filtered results message */}
          {hasNoFilteredData && (
            <Card className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium">No entries match your current filters</p>
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters Panel */}
          {showFilters && (
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Advanced Filters</CardTitle>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2">
                      <X className="h-4 w-4" />
                      Clear All
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <SavedViewsBar
                  page="dashboard"
                  getFilters={() => ({
                    selectedShop,
                    selectedCategory,
                    selectedCustomerType,
                    dateRangePreset,
                    customDateFrom: customDateFrom ? customDateFrom.toISOString() : null,
                    customDateTo: customDateTo ? customDateTo.toISOString() : null,
                  })}
                  onApply={applySavedFilters}
                  onDefaultLoaded={applySavedFilters}
                />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Date Range</Label>
                    <Select value={dateRangePreset} onValueChange={handleDateRangePresetChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select date range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_time">All Time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="this_week">This Week</SelectItem>
                        <SelectItem value="this_month">This Month</SelectItem>
                        <SelectItem value="this_year">This Year</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {dateRangePreset === 'custom' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-2">
                        <Label>From Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                              <Calendar className="mr-2 h-4 w-4" />
                              {customDateFrom ? format(customDateFrom, 'PPP') : 'Pick a date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <CalendarComponent
                              mode="single"
                              selected={customDateFrom}
                              onSelect={setCustomDateFrom}
                              disabled={(date) => date > new Date()}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label>To Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                              <Calendar className="mr-2 h-4 w-4" />
                              {customDateTo ? format(customDateTo, 'PPP') : 'Pick a date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <CalendarComponent
                              mode="single"
                              selected={customDateTo}
                              onSelect={setCustomDateTo}
                              disabled={(date) => {
                                const today = new Date();
                                today.setHours(23, 59, 59, 999);
                                if (date > today) return true;
                                if (customDateFrom) return date < customDateFrom;
                                return false;
                              }}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label>{labels.shops}</Label>
                    <Select
                      value={selectedShop}
                      onValueChange={setSelectedShop}
                      disabled={isManager}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`All ${labels.shops}s`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All {labels.shops}s</SelectItem>
                        {masterData?.shops.map(shop => (
                          <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{labels.category}</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder={`All ${labels.category}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All {labels.category}</SelectItem>
                        {categoryOptions.map(name => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{labels.customer_type}</Label>
                    <Select value={selectedCustomerType} onValueChange={setSelectedCustomerType}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {customerTypeOptions.map(name => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}

                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lost-sale highlights */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" /> Total non-purchase visits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">{summary.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.breakdownTotal} in the selected period
                  </p>
                </CardContent>
              </Card>

              {[
                { title: `Top lost reasons`, icon: TrendingDown, list: summary.topReasons, type: 'category' as const, accent: 'text-rose-500' },
                { title: 'Top employees', icon: UserCheck, list: summary.topEmployees, type: null, accent: 'text-emerald-500' },
                { title: 'Common shop segments', icon: Store, list: summary.topSegments, type: 'customer_type' as const, accent: 'text-amber-500' },
              ].map(({ title, icon: Icon, list, type, accent }) => (
                <Card key={title} className="bg-card/95">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${accent}`} /> {title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {list.length > 0 ? list.map((row, idx) => (
                      <button
                        key={row.name}
                        type="button"
                        onClick={() => type && handleItemClick(type, row.name)}
                        disabled={!type}
                        className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors enabled:hover:bg-muted disabled:cursor-default"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={`text-xs font-bold w-4 ${accent}`}>{idx + 1}</span>
                          <span className="truncate text-sm font-medium text-foreground">{row.name}</span>
                        </span>
                        <span className="text-sm font-bold text-foreground">{row.count}</span>
                      </button>
                    )) : (
                      <p className="text-sm text-muted-foreground py-3 text-center">No data yet</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Time-based Stats (order & visibility from layout editor) */}

          {visibleKpis.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {visibleKpis.map(id => <div key={id}>{kpiNodes[id]}</div>)}
            </div>
          )}

          {/* Widgets: charts / AI insights */}
          {visibleSections.map(id => (
            <div key={id}>{sectionNodes[id]}</div>
          ))}

          {/* Breakdown cards */}
          {visibleBreakdowns.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              {visibleBreakdowns.map(id => {
                const cfg = breakdownConfig.find(c => c.id === id);
                if (!cfg) return null;
                const entriesList = Object.entries(cfg.data).sort(([, a], [, b]) => b - a);
                return (
                  <Card key={id} className="hover:shadow-lg transition-shadow bg-card/95">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className={`h-1 w-8 bg-gradient-to-r ${cfg.accentBar} rounded-full`} />
                        {cfg.gradientTitle ? (
                          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">{cfg.title}</span>
                        ) : (
                          <span className="font-semibold text-foreground">{cfg.title}</span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {entriesList.length > 0 ? (
                        entriesList.map(([name, count], idx) => (
                          <div
                            key={name}
                            onClick={() => handleItemClick(cfg.filterType, name)}
                            className="flex justify-between items-center p-3 rounded-lg bg-card hover:bg-muted transition-all duration-200 border border-border hover:border-primary/40 cursor-pointer active:scale-[0.98]"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className={`text-xs font-bold ${cfg.accentText} w-6 text-center`}>{idx + 1}</span>
                              <span className="font-medium truncate text-foreground">{name}</span>
                            </div>
                            <span className={`font-bold ${cfg.countClass} text-lg ml-2`}>{count}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-sm text-center py-4">{cfg.emptyText}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <DashboardLayoutEditor
            open={layoutEditorOpen}
            onOpenChange={setLayoutEditorOpen}
            controller={layoutController}
          />

          {/* Detail Modal */}
          <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
            <DialogContent className="max-w-[95vw] md:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <DialogTitle className="text-lg md:text-xl">
                      {modalFilter.type === 'shop' && `Shop: ${modalFilter.value}`}
                      {modalFilter.type === 'category' && `Category: ${modalFilter.value}`}
                      {modalFilter.type === 'size' && `Size: ${modalFilter.value}`}
                      {modalFilter.type === 'customer_type' && `Customer Type: ${modalFilter.value}`}
                    </DialogTitle>
                    <DialogDescription className="text-xs md:text-sm mt-1">
                      {(customDateFrom || customDateTo) ? (
                        <>
                          {customDateFrom && `From ${format(customDateFrom, 'PP')}`}
                          {customDateFrom && customDateTo && ' - '}
                          {customDateTo && `To ${format(customDateTo, 'PP')}`}
                          {` (${getModalEntries.length} entries)`}
                        </>
                      ) : (
                        `Today's entries (${getModalEntries.length} total)`
                      )}
                    </DialogDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToExcel}
                      className="gap-2"
                      disabled={getModalEntries.length === 0}
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      <span className="hidden sm:inline">Excel</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToPDF}
                      className="gap-2"
                      disabled={getModalEntries.length === 0}
                    >
                      <FileDown className="h-4 w-4" />
                      <span className="hidden sm:inline">PDF</span>
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-xs md:text-sm text-center">S.NO</TableHead>
                        <TableHead className="min-w-[100px] text-xs md:text-sm text-center">SHOP</TableHead>
                        <TableHead className="min-w-[100px] text-xs md:text-sm text-center">CATEGORY</TableHead>
                        <TableHead className="w-16 text-xs md:text-sm text-center">SIZE</TableHead>
                        <TableHead className="min-w-[120px] text-xs md:text-sm text-center">CUSTOMER TYPE</TableHead>
                        <TableHead className="min-w-[200px] text-xs md:text-sm text-center">VOICE</TableHead>
                        <TableHead className="min-w-[150px] text-xs md:text-sm text-center">NOTES</TableHead>
                        <TableHead className="w-16 text-xs md:text-sm text-center">IMAGE</TableHead>
                        <TableHead className="min-w-[140px] text-xs md:text-sm text-center">DATE AND TIME</TableHead>
                        {phoneFields.length > 0 && (
                          <TableHead className="w-20 text-xs md:text-sm text-center">FOLLOW-UP</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {getModalEntries.length > 0 ? (
                        getModalEntries.map((entry, idx) => (
                          <TableRow key={entry.id}>
                            <TableCell className="font-medium text-xs md:text-sm">{idx + 1}</TableCell>
                            <TableCell className="text-xs md:text-sm text-center">{entry.shops?.name || 'N/A'}</TableCell>
                            <TableCell className="text-xs md:text-sm text-center">{entry.categories?.name || 'N/A'}</TableCell>
                            <TableCell className="text-xs md:text-sm text-center">{entry.sizes?.size || 'N/A'}</TableCell>
                            <TableCell className="text-xs md:text-sm text-center">{entry.customer_types?.name || 'N/A'}</TableCell>
                            <TableCell className="text-xs md:text-sm text-center">
                              {entry.voice_note_url && (
                                <VoiceNotePlayer
                                  voiceUrl={entry.voice_note_url}
                                  compact={true}
                                />
                              )}
                            </TableCell>
                            <TableCell className="text-xs md:text-sm max-w-[200px]">
                              {entry.notes ? (
                                <NoteViewerModal notes={entry.notes} />
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs md:text-sm text-center">
                              {entry.gd_entry_images && entry.gd_entry_images.length > 0 && (
                                <ImageDisplay images={entry.gd_entry_images} />
                              )}
                            </TableCell>
                            <TableCell className="text-xs md:text-sm whitespace-nowrap text-center">
                              {formatDateTime(entry.created_at)}
                            </TableCell>
                            {phoneFields.length > 0 && (
                              <TableCell className="text-center">
                                {(() => {
                                  const ctx = buildFollowUpContext(entry);
                                  return ctx
                                    ? <WhatsAppFollowUpButton context={ctx} entryId={entry.id} shopId={(entry as any).shop_id ?? null} />
                                    : <span className="text-muted-foreground text-xs">-</span>;
                                })()}
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No entries found for today
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};
