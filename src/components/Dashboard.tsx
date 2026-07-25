import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { TrendingUp, Package, Calendar, CalendarDays, Sparkles, Filter, X, ArrowUpDown, BarChart3, FileDown, FileSpreadsheet, LineChart } from 'lucide-react';
import { exportToPDFViaHTML, makeImageCell } from '@/utils/htmlPdfExport';
import * as XLSX from 'xlsx';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImageDisplay } from './ImageDisplay';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import { NoteViewerModal } from './NoteViewerModal';
import { AnalyticsCharts } from './AnalyticsCharts';
import { useFieldLabels } from '@/hooks/useFieldLabels';
import { AIInsightsPanel } from './AIInsightsPanel';

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
}


export const Dashboard = () => {
  const { profile, isAdmin, isManager, userShopId } = useAuth();
  const { isOnline, pendingCount } = useOfflineSync();
  const { labels } = useFieldLabels();

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

  // Fetch master data (shops, categories, customer types)
  const { data: masterData } = useQuery({
    queryKey: ['dashboard-master-data'],
    queryFn: async () => {
      const [shopsRes, categoriesRes, customerTypesRes] = await Promise.all([
        supabase.from('shops').select('*').is('deleted_at', null).order('name'),
        supabase.from('categories').select('*').is('deleted_at', null).order('name'),
        supabase.from('customer_types').select('*').is('deleted_at', null).order('name'),
      ]);

      return {
        shops: shopsRes.data || [],
        categories: categoriesRes.data || [],
        customerTypes: customerTypesRes.data || [],
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch all GD entries
  const { data: allEntries, isLoading, refetch } = useQuery<GDEntry[]>({
    queryKey: ['dashboard-entries', userShopId],
    queryFn: async () => {
      if (import.meta.env.DEV) console.log('Fetching dashboard entries...');

      // Fetch entries without images first
      const { data: entriesData, error: entriesError } = await supabase
        .from('goods_damaged_entries')
        .select(`
          id,
          created_at,
          shop_id,
          category_id,
          size_id,
          customer_type_id,
          notes,
          voice_note_url,
          shops:shop_id(name),
          categories:category_id(name),
          sizes:size_id(size),
          customer_types:customer_type_id(name)
        `)
        .order('created_at', { ascending: false });

      if (entriesError) {
        if (import.meta.env.DEV) console.error('Dashboard fetch error:', entriesError);
        throw entriesError;
      }

      // Fetch images separately for reliability
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
          // Continue without images rather than failing
        } else {
          imagesData = imgData || [];
        }
      }

      if (import.meta.env.DEV) console.log('Fetched entries:', entriesData?.length || 0, 'images:', imagesData.length);

      // Join images to entries
      const entriesWithImages = entriesData?.map(entry => ({
        ...entry,
        gd_entry_images: imagesData.filter(img => img.gd_entry_id === entry.id)
      })) || [];

      return entriesWithImages as unknown as GDEntry[];
    },
    enabled: !!profile && (isAdmin || isManager),
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60 * 5,
  });


  // Calculate summary from filtered entries
  const summary = useMemo(() => {
    if (!allEntries) return null;

    // Apply filters
    let filtered = allEntries;

    if (selectedShop !== 'all') {
      filtered = filtered.filter(e => e.shop_id === selectedShop);
    }
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(e => e.category_id === selectedCategory);
    }
    if (selectedCustomerType !== 'all') {
      filtered = filtered.filter(e => e.customer_type_id === selectedCustomerType);
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
      title: `GD Report: ${modalFilter.value}`,
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
              Start by creating your first GD entry. Click the "GD" tab below to get started.
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
                        {masterData?.categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
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
                        {masterData?.customerTypes.map(type => (
                          <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Time-based Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          </div>

          {/* Analytics Charts */}
          {showCharts && allEntries && allEntries.length > 0 && (
            <div className="mt-6">
              <AnalyticsCharts entries={allEntries} />
            </div>
          )}

          {/* AI Insights */}
          {summary && (
            <div className="mt-6">
              <AIInsightsPanel context="dashboard" data={summary} />
            </div>
          )}


          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {/* By Shop */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="h-1 w-8 bg-gradient-to-r from-primary to-primary/50 rounded-full" />
                  <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">By Shop</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {summary && Object.keys(summary.byShop).length > 0 ? (
                  Object.entries(summary.byShop)
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, count], idx) => (
                      <div
                        key={name}
                        onClick={() => handleItemClick('shop', name)}
                        className="flex justify-between items-center p-3 rounded-lg bg-card hover:bg-muted transition-all duration-200 border border-border hover:border-primary/40 cursor-pointer active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xs font-bold text-primary/60 w-6 text-center">{idx + 1}</span>
                          <span className="font-medium truncate text-foreground">{name}</span>
                        </div>
                        <span className="font-bold text-primary text-lg ml-2">{count}</span>
                      </div>
                    ))
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-4">No shop data</p>
                )}
              </CardContent>
            </Card>

            {/* By Category */}
            <Card className="hover:shadow-lg transition-shadow bg-card/95">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="h-1 w-8 bg-gradient-to-r from-orange-500 to-orange-400 rounded-full" />
                  <span className="font-semibold text-foreground">By Category</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {summary && Object.keys(summary.byCategory).length > 0 ? (
                  Object.entries(summary.byCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, count], idx) => (
                      <div
                        key={name}
                        onClick={() => handleItemClick('category', name)}
                        className="flex justify-between items-center p-3 rounded-lg bg-card hover:bg-muted transition-all duration-200 border border-border hover:border-primary/40 cursor-pointer active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xs font-bold text-orange-500/80 w-6 text-center">{idx + 1}</span>
                          <span className="font-medium truncate text-foreground">{name}</span>
                        </div>
                        <span className="font-bold text-orange-500 text-lg ml-2">{count}</span>
                      </div>
                    ))
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-4">No category data</p>
                )}
              </CardContent>
            </Card>

            {/* By Size */}
            <Card className="hover:shadow-lg transition-shadow bg-card/95">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="h-1 w-8 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full" />
                  <span className="font-semibold text-foreground">By Size</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {summary && Object.keys(summary.bySize).length > 0 ? (
                  Object.entries(summary.bySize)
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, count], idx) => (
                      <div
                        key={name}
                        onClick={() => handleItemClick('size', name)}
                        className="flex justify-between items-center p-3 rounded-lg bg-card hover:bg-muted transition-all duration-200 border border-border hover:border-primary/40 cursor-pointer active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xs font-bold text-cyan-500/80 w-6 text-center">{idx + 1}</span>
                          <span className="font-medium truncate text-foreground">{name}</span>
                        </div>
                        <span className="font-bold text-cyan-500 text-lg ml-2">{count}</span>
                      </div>
                    ))
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-4">No size data</p>
                )}
              </CardContent>
            </Card>

            {/* By Customer Type */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="h-1 w-8 bg-gradient-to-r from-primary to-primary/50 rounded-full" />
                  <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">By Customer Type</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {summary && Object.keys(summary.byCustomerType).length > 0 ? (
                  Object.entries(summary.byCustomerType)
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, count], idx) => (
                      <div
                        key={name}
                        onClick={() => handleItemClick('customer_type', name)}
                        className="flex justify-between items-center p-3 rounded-lg bg-card hover:bg-muted transition-all duration-200 border border-border hover:border-primary/40 cursor-pointer active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xs font-bold text-primary/60 w-6 text-center">{idx + 1}</span>
                          <span className="font-medium truncate text-foreground">{name}</span>
                        </div>
                        <span className="font-bold text-primary text-lg ml-2">{count}</span>
                      </div>
                    ))
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-4">No customer type data</p>
                )}
              </CardContent>
            </Card>
          </div>

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
