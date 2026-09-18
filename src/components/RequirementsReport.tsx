import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileSpreadsheet, FileText, Download, ClipboardList, Layers, ListFilter,
  User, ArrowLeftRight, Search, Filter, RotateCcw, Building, Package,
  Clock, CheckCircle2, Truck, PackageCheck, AlertCircle, Calendar as CalendarIcon,
} from 'lucide-react';
import { formatISTDateTime, formatISTDate, formatISTFileName } from '@/lib/dateUtils';
import { exportTableToCSV, exportTableToExcel, exportTableToPDF, type SheetTable } from '@/lib/insightExports';
import { useExportTemplate } from '@/hooks/useExportTemplate';
import type { StockRequirement } from '@/hooks/useRequirements';

const fmt = (v: string | null) => (v ? formatISTDateTime(v) : '—');

const turnaround = (r: StockRequirement) => {
  const end = r.received_at || r.moved_at || r.packed_at || r.rejected_at;
  if (!end) return '—';
  const mins = Math.round((new Date(end).getTime() - new Date(r.created_at).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h}h ${mins % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
};

const getTurnaroundMinutes = (r: StockRequirement): number | null => {
  const end = r.received_at || r.moved_at || r.packed_at || r.rejected_at;
  if (!end) return null;
  return Math.round((new Date(end).getTime() - new Date(r.created_at).getTime()) / 60000);
};

export interface GroupedRow {
  shop_name: string;
  size: string;
  category: string;
  requesters: string[];
  requesters_display: string;
  request_count: number;
  total_qty: number;
  packed_qty: number;
  moved_qty: number;
  received_qty: number;
  pending_qty: number;
}

export const groupRequirementsByShopAndSize = (rows: StockRequirement[]): GroupedRow[] => {
  const groups: Record<string, GroupedRow> = {};

  rows.forEach(r => {
    const shop = r.shop_name || 'Unassigned Shop';
    const sz = r.size || 'Not Specified';
    const cat = r.category || 'General';
    const key = `${shop}___${sz}___${cat}`;

    if (!groups[key]) {
      groups[key] = {
        shop_name: shop,
        size: sz,
        category: cat,
        requesters: [],
        requesters_display: '',
        request_count: 0,
        total_qty: 0,
        packed_qty: 0,
        moved_qty: 0,
        received_qty: 0,
        pending_qty: 0,
      };
    }

    const g = groups[key];
    if (r.requested_by_name && !g.requesters.includes(r.requested_by_name)) {
      g.requesters.push(r.requested_by_name);
    }
    g.request_count += 1;
    g.total_qty += r.quantity || 0;

    if (r.status === 'packed') {
      g.packed_qty += r.packed_qty ?? r.quantity ?? 0;
      g.pending_qty += r.quantity || 0;
    } else if (r.status === 'moved') {
      g.packed_qty += r.packed_qty ?? r.quantity ?? 0;
      g.moved_qty += r.quantity || 0;
      g.pending_qty += r.quantity || 0;
    } else if (r.status === 'received') {
      g.packed_qty += r.packed_qty ?? r.quantity ?? 0;
      g.moved_qty += r.quantity || 0;
      g.received_qty += r.quantity || 0;
    } else if (r.status === 'requested') {
      g.pending_qty += r.quantity || 0;
    }
  });

  return Object.values(groups)
    .map(g => {
      g.requesters_display = g.requesters.length > 0 ? g.requesters.join(', ') : '—';
      return g;
    })
    .sort((a, b) => {
      if (a.shop_name !== b.shop_name) return a.shop_name.localeCompare(b.shop_name);
      return a.size.localeCompare(b.size);
    });
};

export const buildDetailedRequirementsTable = (
  rows: StockRequirement[],
  dateRangeStr?: string,
  filterContext?: string,
): SheetTable => ({
  title: 'Stock Requirements Detailed Action & Fulfillment Log',
  subtitle: [
    `${rows.length} records`,
    filterContext ? `Filters: ${filterContext}` : null,
    `Generated ${formatISTDateTime(new Date())} (IST)`,
  ].filter(Boolean).join(' · '),
  dateRange: dateRangeStr,
  columns: [
    'Requested At (IST)',
    'Requested By',
    'Shop',
    'Category',
    'Size',
    'Qty',
    'Urgency',
    'Status',
    'Packed By',
    'Packed At (IST)',
    'Packed Qty',
    'Packed Note',
    'Moved By',
    'Moved At (IST)',
    'Moved Note',
    'Received By',
    'Received At (IST)',
    'Turnaround',
    'Notes / Reason',
  ],
  rows: rows.map(r => [
    fmt(r.created_at),
    r.requested_by_name || '—',
    r.shop_name || '—',
    r.category || '—',
    r.size,
    r.quantity,
    r.urgency,
    r.status,
    r.packed_by_name || '—',
    fmt(r.packed_at),
    r.packed_qty ?? '—',
    r.packed_note || '—',
    r.moved_by_name || '—',
    fmt(r.moved_at),
    r.moved_note || '—',
    r.received_by_name || '—',
    fmt(r.received_at),
    turnaround(r),
    r.note || r.reject_reason || '—',
  ]),
  fileName: formatISTFileName(new Date(), 'stock-requirements-detailed'),
});

export const buildGroupedRequirementsTable = (
  rows: StockRequirement[],
  dateRangeStr?: string,
  filterContext?: string,
): SheetTable => {
  const grouped = groupRequirementsByShopAndSize(rows);
  return {
    title: 'Stock Requirements Grouped by Shop & Size',
    subtitle: [
      `${grouped.length} shop-size groups from ${rows.length} requests`,
      filterContext ? `Filters: ${filterContext}` : null,
      `Generated ${formatISTDateTime(new Date())} (IST)`,
    ].filter(Boolean).join(' · '),
    dateRange: dateRangeStr,
    columns: [
      'Shop',
      'Size',
      'Category',
      'Staff Involved',
      'Total Requests',
      'Units Demanded',
      'Units Packed',
      'Units Moved',
      'Units Received',
      'Units Pending',
    ],
    rows: grouped.map(g => [
      g.shop_name,
      g.size,
      g.category,
      g.requesters_display,
      g.request_count,
      g.total_qty,
      g.packed_qty,
      g.moved_qty,
      g.received_qty,
      g.pending_qty,
    ]),
    fileName: formatISTFileName(new Date(), 'stock-requirements-grouped'),
  };
};

interface Props {
  rows: StockRequirement[];
  /** Ticked rows take priority over the filtered list when exporting */
  selected?: StockRequirement[];
}

export const RequirementsReport = ({ rows, selected = [] }: Props) => {
  const { template } = useExportTemplate();
  const [viewMode, setViewMode] = useState<'grouped' | 'detailed'>('grouped');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [shopFilter, setShopFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'custom'>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Distinct lists derived from source rows
  const uniqueStaff = useMemo(() => {
    const names = new Set<string>();
    rows.forEach(r => {
      if (r.requested_by_name) names.add(r.requested_by_name);
      if (r.packed_by_name) names.add(r.packed_by_name);
      if (r.moved_by_name) names.add(r.moved_by_name);
      if (r.received_by_name) names.add(r.received_by_name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const uniqueShops = useMemo(() => {
    const shops = new Set<string>();
    rows.forEach(r => {
      if (r.shop_name) shops.add(r.shop_name);
    });
    return Array.from(shops).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const uniqueSizes = useMemo(() => {
    const sizes = new Set<string>();
    rows.forEach(r => {
      if (r.size) sizes.add(r.size);
    });
    return Array.from(sizes).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  // Handle Date Preset Switch
  const handleDatePreset = (preset: 'all' | 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'custom') => {
    setDatePreset(preset);
    const now = new Date();
    const toDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (preset === 'all') {
      setFromDate('');
      setToDate('');
    } else if (preset === 'today') {
      const today = toDateStr(now);
      setFromDate(today);
      setToDate(today);
    } else if (preset === 'yesterday') {
      const yesterday = new Date(now.getTime() - 86400000);
      const yStr = toDateStr(yesterday);
      setFromDate(yStr);
      setToDate(yStr);
    } else if (preset === 'last7') {
      const sevenDaysAgo = new Date(now.getTime() - 6 * 86400000);
      setFromDate(toDateStr(sevenDaysAgo));
      setToDate(toDateStr(now));
    } else if (preset === 'thisMonth') {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(toDateStr(firstOfMonth));
      setToDate(toDateStr(now));
    }
  };

  // Check active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (staffFilter !== 'all') count++;
    if (shopFilter !== 'all') count++;
    if (sizeFilter !== 'all') count++;
    if (statusFilter !== 'all') count++;
    if (fromDate || toDate) count++;
    return count;
  }, [searchQuery, staffFilter, shopFilter, sizeFilter, statusFilter, fromDate, toDate]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setStaffFilter('all');
    setShopFilter('all');
    setSizeFilter('all');
    setStatusFilter('all');
    setDatePreset('all');
    setFromDate('');
    setToDate('');
  };

  // Filtered Rows Calculation
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const startMs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const endMs = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;

    return rows.filter(r => {
      // 1. Staff Filter (matches requester, packer, mover, or receiver)
      if (staffFilter !== 'all') {
        const involved = [
          r.requested_by_name,
          r.packed_by_name,
          r.moved_by_name,
          r.received_by_name,
        ];
        if (!involved.includes(staffFilter)) return false;
      }

      // 2. Shop Filter
      if (shopFilter !== 'all' && r.shop_name !== shopFilter) {
        return false;
      }

      // 3. Size Filter
      if (sizeFilter !== 'all' && r.size !== sizeFilter) {
        return false;
      }

      // 4. Status Filter (packed, moved, requested, received, rejected)
      if (statusFilter !== 'all' && r.status !== statusFilter) {
        return false;
      }

      // 5. Date Range Filter
      const createdMs = new Date(r.created_at).getTime();
      if (startMs && createdMs < startMs) return false;
      if (endMs && createdMs > endMs) return false;

      // 6. Search Query
      if (q) {
        const searchable = [
          r.shop_name,
          r.size,
          r.category,
          r.requested_by_name,
          r.packed_by_name,
          r.moved_by_name,
          r.received_by_name,
          r.rejected_by_name,
          r.status,
          r.urgency,
          r.note,
          r.reject_reason,
          r.packed_note,
          r.moved_note,
        ].filter(Boolean).join(' ').toLowerCase();

        if (!searchable.includes(q)) return false;
      }

      return true;
    });
  }, [rows, searchQuery, staffFilter, shopFilter, sizeFilter, statusFilter, fromDate, toDate]);

  // Aggregate Metrics
  const totals = useMemo(() => {
    const total = filteredRows.length;
    const demandedQty = filteredRows.reduce((s, r) => s + (r.quantity || 0), 0);
    const packedQty = filteredRows.reduce((s, r) => s + (r.packed_qty ?? (r.status !== 'requested' && r.status !== 'rejected' ? r.quantity : 0)), 0);
    const movedCount = filteredRows.filter(r => r.status === 'moved').length;
    const receivedCount = filteredRows.filter(r => r.status === 'received').length;
    const pendingCount = filteredRows.filter(r => r.status === 'requested' || r.status === 'packed' || r.status === 'moved').length;

    // Average turnaround for completed requirements
    const turnarounds = filteredRows.map(getTurnaroundMinutes).filter((m): m is number => m !== null && m >= 0);
    let avgTurnaroundStr = '—';
    if (turnarounds.length > 0) {
      const avgMins = Math.round(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length);
      if (avgMins < 60) avgTurnaroundStr = `${avgMins}m`;
      else {
        const h = Math.floor(avgMins / 60);
        avgTurnaroundStr = `${h}h ${avgMins % 60}m`;
      }
    }

    return {
      total,
      demandedQty,
      packedQty,
      movedCount,
      receivedCount,
      pendingCount,
      avgTurnaroundStr,
    };
  }, [filteredRows]);

  // Active Context String for Export Header
  const dateRangeStr = useMemo(() => {
    if (fromDate && toDate) {
      return `${formatISTDate(new Date(`${fromDate}T00:00:00`))} – ${formatISTDate(new Date(`${toDate}T00:00:00`))}`;
    }
    if (fromDate) return `From ${formatISTDate(new Date(`${fromDate}T00:00:00`))}`;
    if (toDate) return `Until ${formatISTDate(new Date(`${toDate}T00:00:00`))}`;
    return undefined;
  }, [fromDate, toDate]);

  const activeFilterContext = useMemo(() => {
    const parts: string[] = [];
    if (staffFilter !== 'all') parts.push(`Staff: ${staffFilter}`);
    if (shopFilter !== 'all') parts.push(`Shop: ${shopFilter}`);
    if (sizeFilter !== 'all') parts.push(`Size: ${sizeFilter}`);
    if (statusFilter !== 'all') parts.push(`Status: ${statusFilter}`);
    if (searchQuery.trim()) parts.push(`Search: "${searchQuery.trim()}"`);
    return parts.length ? parts.join(' | ') : undefined;
  }, [staffFilter, shopFilter, sizeFilter, statusFilter, searchQuery]);

  const exportRows = selected.length ? selected : filteredRows;
  const detailedTable = useMemo(() => buildDetailedRequirementsTable(exportRows, dateRangeStr, activeFilterContext), [exportRows, dateRangeStr, activeFilterContext]);
  const groupedTable = useMemo(() => buildGroupedRequirementsTable(exportRows, dateRangeStr, activeFilterContext), [exportRows, dateRangeStr, activeFilterContext]);
  const groupedData = useMemo(() => groupRequirementsByShopAndSize(filteredRows), [filteredRows]);

  const handleExportExcel = () => {
    const target = viewMode === 'grouped' ? groupedTable : detailedTable;
    exportTableToExcel(target, template);
  };

  const handleExportPDF = () => {
    const target = viewMode === 'grouped' ? groupedTable : detailedTable;
    exportTableToPDF(target, template);
  };

  const handleExportCSV = () => {
    const target = viewMode === 'grouped' ? groupedTable : detailedTable;
    exportTableToCSV(target, template);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3 space-y-3">
        {/* Top Tier: Title and Description */}
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ClipboardList className="h-5 w-5 text-primary shrink-0" />
              <span>Requirements & Fulfillment Report</span>
            </CardTitle>
            <CardDescription className="mt-1 text-xs sm:text-sm">
              Complete logs of size requests from shops with warehouse pack, move, and receipt audit trails.
            </CardDescription>
          </div>

          {/* Export Action Buttons */}
          <div className="grid grid-cols-3 sm:flex items-center gap-1.5 w-full sm:w-auto shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-8.5 gap-1.5 px-3 text-xs rounded-xl justify-center font-medium shadow-2xs hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
              onClick={handleExportExcel}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Excel</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8.5 gap-1.5 px-3 text-xs rounded-xl justify-center font-medium shadow-2xs hover:bg-red-50 dark:hover:bg-red-950/30 text-red-700 dark:text-red-400 border-red-500/30"
              onClick={handleExportPDF}
            >
              <FileText className="h-4 w-4 text-red-600 shrink-0" />
              <span>PDF</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8.5 gap-1.5 px-3 text-xs rounded-xl justify-center font-medium shadow-2xs"
              onClick={handleExportCSV}
            >
              <Download className="h-4 w-4 shrink-0" />
              <span>CSV</span>
            </Button>
          </div>
        </div>

        {/* View Mode Switch + Filter Toggle Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-border/60">
          <div className="grid grid-cols-2 sm:flex rounded-xl border bg-muted/70 p-1 w-full sm:w-auto gap-1">
            <Button
              size="sm"
              variant={viewMode === 'grouped' ? 'secondary' : 'ghost'}
              className={`h-8 text-xs px-3 gap-1.5 font-semibold rounded-lg transition-all ${
                viewMode === 'grouped' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setViewMode('grouped')}
            >
              <Layers className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Grouped by Shop & Size</span>
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'detailed' ? 'secondary' : 'ghost'}
              className={`h-8 text-xs px-3 gap-1.5 font-semibold rounded-lg transition-all ${
                viewMode === 'detailed' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setViewMode('detailed')}
            >
              <ListFilter className="h-3.5 w-3.5 shrink-0 text-violet-600" />
              <span>Detailed Action Log</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={activeFiltersCount > 0 ? 'default' : 'outline'}
              className="h-8 text-xs gap-1.5 rounded-xl font-medium"
              onClick={() => setShowFilters(prev => !prev)}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 px-1.5 text-[10px] font-bold rounded-full bg-white/20 text-foreground">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>

            {activeFiltersCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs gap-1 text-muted-foreground hover:text-destructive"
                onClick={handleResetFilters}
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </Button>
            )}
          </div>
        </div>

        {/* Global Live Search Bar */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by staff (requester, packer, mover), shop, size, status, notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl bg-background"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Multi-Dimensional Filter Drawer (Staff, Shop, Size, Packed/Moved Status, Date Range) */}
        {(showFilters || activeFiltersCount > 0) && (
          <div className="rounded-xl border bg-muted/30 p-3.5 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-border/50">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-primary" /> Filter Options
              </span>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  Clear all ({activeFiltersCount})
                </button>
              )}
            </div>

            {/* Dropdown Filters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* 1. Staff Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Staff (Any Role)
                </label>
                <Select value={staffFilter} onValueChange={setStaffFilter}>
                  <SelectTrigger className="h-8.5 text-xs rounded-lg">
                    <SelectValue placeholder="All Staff" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Staff Members ({uniqueStaff.length})</SelectItem>
                    {uniqueStaff.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 2. Shop Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Building className="h-3 w-3" /> Shop
                </label>
                <Select value={shopFilter} onValueChange={setShopFilter}>
                  <SelectTrigger className="h-8.5 text-xs rounded-lg">
                    <SelectValue placeholder="All Shops" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shops ({uniqueShops.length})</SelectItem>
                    {uniqueShops.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Size Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Package className="h-3 w-3" /> Size
                </label>
                <Select value={sizeFilter} onValueChange={setSizeFilter}>
                  <SelectTrigger className="h-8.5 text-xs rounded-lg">
                    <SelectValue placeholder="All Sizes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sizes ({uniqueSizes.length})</SelectItem>
                    {uniqueSizes.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 4. Packed/Moved Status Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Truck className="h-3 w-3" /> Packed / Moved Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8.5 text-xs rounded-lg">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Fulfillment Statuses</SelectItem>
                    <SelectItem value="requested">Pending Pack (Requested)</SelectItem>
                    <SelectItem value="packed">Packed (Ready for Transit)</SelectItem>
                    <SelectItem value="moved">In Transit / Moved</SelectItem>
                    <SelectItem value="received">Delivered / Received</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date Range Section */}
            <div className="pt-2 border-t border-border/50 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" /> Date Range Filter
                </label>
                {/* Date Quick Presets */}
                <div className="flex flex-wrap items-center gap-1">
                  {[
                    { id: 'all', label: 'All Time' },
                    { id: 'today', label: 'Today' },
                    { id: 'yesterday', label: 'Yesterday' },
                    { id: 'last7', label: 'Last 7 Days' },
                    { id: 'thisMonth', label: 'This Month' },
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleDatePreset(p.id as any)}
                      className={`px-2 py-0.5 text-[10px] rounded-md font-medium transition-colors ${
                        datePreset === p.id
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Inputs */}
              <div className="grid grid-cols-2 gap-2 max-w-sm">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground">From Date</span>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={e => {
                      setFromDate(e.target.value);
                      setDatePreset('custom');
                    }}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground">To Date</span>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={e => {
                      setToDate(e.target.value);
                      setDatePreset('custom');
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {selected.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Exporting {selected.length} ticked row{selected.length > 1 ? 's' : ''} (overriding current filter).
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* KPI Summaries */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          <div className="rounded-lg border bg-card/60 p-2.5 space-y-0.5">
            <p className="text-[11px] text-muted-foreground">Total Requests</p>
            <p className="text-xl font-bold">{totals.total}</p>
          </div>
          <div className="rounded-lg border bg-card/60 p-2.5 space-y-0.5">
            <p className="text-[11px] text-muted-foreground">Units Demanded</p>
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{totals.demandedQty}</p>
          </div>
          <div className="rounded-lg border bg-card/60 p-2.5 space-y-0.5">
            <p className="text-[11px] text-muted-foreground">Units Packed</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{totals.packedQty}</p>
          </div>
          <div className="rounded-lg border bg-card/60 p-2.5 space-y-0.5">
            <p className="text-[11px] text-muted-foreground">In Transit (Moved)</p>
            <p className="text-xl font-bold text-violet-600 dark:text-violet-400">{totals.movedCount}</p>
          </div>
          <div className="rounded-lg border bg-card/60 p-2.5 space-y-0.5">
            <p className="text-[11px] text-muted-foreground">Delivered (Received)</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{totals.receivedCount}</p>
          </div>
          <div className="rounded-lg border bg-card/60 p-2.5 space-y-0.5">
            <p className="text-[11px] text-muted-foreground">Avg Turnaround</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{totals.avgTurnaroundStr}</p>
          </div>
        </div>

        {/* Grouped View */}
        {viewMode === 'grouped' ? (
          <div className="w-full space-y-1.5 min-w-0">
            {/* Mobile Touch Swipe Indicator */}
            <div className="sm:hidden flex items-center justify-between px-2.5 py-1 text-[11px] font-medium text-muted-foreground bg-muted/40 rounded-lg border border-border/50">
              <span className="flex items-center gap-1.5">
                <ArrowLeftRight className="h-3 w-3 text-primary animate-pulse" />
                Swipe table horizontally to view all columns
              </span>
              <span className="text-[10px] text-primary font-semibold">Touch scroll</span>
            </div>
            <div className="w-full overflow-x-auto overflow-y-auto max-h-[520px] rounded-xl border border-border/80 bg-card shadow-xs touch-pan-x overscroll-x-contain -webkit-overflow-scrolling-touch">
              <div className="min-w-[850px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold text-xs">Shop</TableHead>
                      <TableHead className="font-semibold text-xs">Size</TableHead>
                      <TableHead className="font-semibold text-xs">Category</TableHead>
                      <TableHead className="font-semibold text-xs">Staff Involved</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Requests</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Demanded Qty</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Packed</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Moved</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Received</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Pending</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-sm py-8 text-muted-foreground">
                          No requirement records matched the active filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      groupedData.map((g, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs font-medium">{g.shop_name}</TableCell>
                          <TableCell className="text-xs font-semibold">{g.size}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{g.category}</TableCell>
                          <TableCell className="text-xs">
                            {g.requesters.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1 max-w-[200px]">
                                {g.requesters.map((req, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px] py-0 px-1.5 font-normal bg-muted/40">
                                    {req}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium">{g.request_count}</TableCell>
                          <TableCell className="text-xs text-right font-medium">{g.total_qty}</TableCell>
                          <TableCell className="text-xs text-right text-blue-600 font-medium">{g.packed_qty}</TableCell>
                          <TableCell className="text-xs text-right text-violet-600 font-medium">{g.moved_qty}</TableCell>
                          <TableCell className="text-xs text-right text-emerald-600 font-medium">{g.received_qty}</TableCell>
                          <TableCell className="text-xs text-right font-semibold">
                            {g.pending_qty > 0 ? (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                                {g.pending_qty}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ) : (
          /* Detailed Action Log View */
          <div className="w-full space-y-1.5 min-w-0">
            {/* Mobile Touch Swipe Indicator */}
            <div className="sm:hidden flex items-center justify-between px-2.5 py-1 text-[11px] font-medium text-muted-foreground bg-muted/40 rounded-lg border border-border/50">
              <span className="flex items-center gap-1.5">
                <ArrowLeftRight className="h-3 w-3 text-violet-600 animate-pulse" />
                Swipe log horizontally to view audit trail &amp; notes
              </span>
              <span className="text-[10px] text-violet-600 font-semibold">Touch scroll</span>
            </div>
            <div className="w-full overflow-x-auto overflow-y-auto max-h-[520px] rounded-xl border border-border/80 bg-card shadow-xs touch-pan-x overscroll-x-contain -webkit-overflow-scrolling-touch">
              <div className="min-w-[1100px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs font-semibold">Requested (IST)</TableHead>
                      <TableHead className="text-xs font-semibold">Requested By</TableHead>
                      <TableHead className="text-xs font-semibold">Shop</TableHead>
                      <TableHead className="text-xs font-semibold">Size</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Qty</TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                      <TableHead className="text-xs font-semibold">Packed By / Time</TableHead>
                      <TableHead className="text-xs font-semibold">Moved By / Time</TableHead>
                      <TableHead className="text-xs font-semibold">Received By / Time</TableHead>
                      <TableHead className="text-xs font-semibold">Turnaround</TableHead>
                      <TableHead className="text-xs font-semibold">Notes / Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-sm py-8 text-muted-foreground">
                          No requirement logs matched the active filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">{fmt(r.created_at)}</TableCell>
                          <TableCell className="text-xs font-medium">{r.requested_by_name || '—'}</TableCell>
                          <TableCell className="text-xs">{r.shop_name || '—'}</TableCell>
                          <TableCell className="text-xs font-semibold">
                            <span>{r.size}</span>
                            {r.category && <span className="text-[10px] text-muted-foreground block">{r.category}</span>}
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium">{r.quantity}</TableCell>
                          <TableCell className="text-xs">
                            <Badge
                              variant="outline"
                              className={`capitalize font-semibold text-[10px] ${
                                r.status === 'packed'
                                  ? 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                                  : r.status === 'moved'
                                  ? 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                                  : r.status === 'received'
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                  : r.status === 'rejected'
                                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                                  : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.packed_by_name ? (
                              <div>
                                <p className="font-medium text-foreground">{r.packed_by_name}</p>
                                <p className="text-[10px] text-muted-foreground">{fmt(r.packed_at)} ({r.packed_qty ?? r.quantity} pcs)</p>
                                {r.packed_note && <p className="text-[10px] italic text-blue-600 dark:text-blue-400">&ldquo;{r.packed_note}&rdquo;</p>}
                              </div>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.moved_by_name ? (
                              <div>
                                <p className="font-medium text-foreground">{r.moved_by_name}</p>
                                <p className="text-[10px] text-muted-foreground">{fmt(r.moved_at)}</p>
                                {r.moved_note && <p className="text-[10px] italic text-violet-600 dark:text-violet-400">&ldquo;{r.moved_note}&rdquo;</p>}
                              </div>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.received_by_name ? (
                              <div>
                                <p className="font-medium text-foreground">{r.received_by_name}</p>
                                <p className="text-[10px] text-muted-foreground">{fmt(r.received_at)}</p>
                              </div>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {turnaround(r)}
                          </TableCell>
                          <TableCell className="text-xs max-w-xs truncate" title={r.note || r.reject_reason || ''}>
                            {r.note || r.reject_reason || '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
