import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileSpreadsheet, FileText, Download, ClipboardList, Layers, ListFilter } from 'lucide-react';
import { format } from 'date-fns';
import { exportTableToCSV, exportTableToExcel, exportTableToPDF, type SheetTable } from '@/lib/insightExports';
import { useExportTemplate } from '@/hooks/useExportTemplate';
import type { StockRequirement } from '@/hooks/useRequirements';

const fmt = (v: string | null) => (v ? format(new Date(v), 'dd MMM yyyy HH:mm') : '—');

const turnaround = (r: StockRequirement) => {
  const end = r.received_at || r.moved_at || r.packed_at || r.rejected_at;
  if (!end) return '—';
  const mins = Math.round((new Date(end).getTime() - new Date(r.created_at).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h}h ${mins % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
};

export interface GroupedRow {
  shop_name: string;
  size: string;
  category: string;
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
        request_count: 0,
        total_qty: 0,
        packed_qty: 0,
        moved_qty: 0,
        received_qty: 0,
        pending_qty: 0,
      };
    }

    const g = groups[key];
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

  return Object.values(groups).sort((a, b) => {
    if (a.shop_name !== b.shop_name) return a.shop_name.localeCompare(b.shop_name);
    return a.size.localeCompare(b.size);
  });
};

export const buildDetailedRequirementsTable = (rows: StockRequirement[]): SheetTable => ({
  title: 'Stock Requirements Detailed Audit Log',
  subtitle: `${rows.length} requests · Generated ${format(new Date(), 'dd MMM yyyy HH:mm')}`,
  columns: [
    'Requested At',
    'Requested By',
    'Shop',
    'Category',
    'Size',
    'Qty',
    'Urgency',
    'Status',
    'Packed By',
    'Packed At',
    'Packed Qty',
    'Moved By',
    'Moved At',
    'Received By',
    'Received At',
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
    r.moved_by_name || '—',
    fmt(r.moved_at),
    r.received_by_name || '—',
    fmt(r.received_at),
    turnaround(r),
    r.note || r.reject_reason || '—',
  ]),
  fileName: `stock-requirements-detailed-${format(new Date(), 'yyyyMMdd-HHmm')}`,
});

export const buildGroupedRequirementsTable = (rows: StockRequirement[]): SheetTable => {
  const grouped = groupRequirementsByShopAndSize(rows);
  return {
    title: 'Stock Requirements Grouped by Shop & Size',
    subtitle: `${grouped.length} shop-size groups · Generated ${format(new Date(), 'dd MMM yyyy HH:mm')}`,
    columns: [
      'Shop',
      'Size',
      'Category',
      'Total Requests',
      'Units Requested',
      'Units Packed',
      'Units Moved',
      'Units Received',
      'Units Pending',
    ],
    rows: grouped.map(g => [
      g.shop_name,
      g.size,
      g.category,
      g.request_count,
      g.total_qty,
      g.packed_qty,
      g.moved_qty,
      g.received_qty,
      g.pending_qty,
    ]),
    fileName: `stock-requirements-grouped-${format(new Date(), 'yyyyMMdd-HHmm')}`,
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

  const exportRows = selected.length ? selected : rows;
  const detailedTable = useMemo(() => buildDetailedRequirementsTable(exportRows), [exportRows]);
  const groupedTable = useMemo(() => buildGroupedRequirementsTable(exportRows), [exportRows]);
  const groupedData = useMemo(() => groupRequirementsByShopAndSize(rows), [rows]);

  const totals = useMemo(() => ({
    total: rows.length,
    qty: rows.reduce((s, r) => s + (r.quantity || 0), 0),
    received: rows.filter(r => r.status === 'received').length,
    pending: rows.filter(r => r.status === 'requested' || r.status === 'packed' || r.status === 'moved').length,
  }), [rows]);

  const handleExportExcel = () => {
    // Export current active view table
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
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ClipboardList className="h-5 w-5 text-primary" /> Requirements & Fulfillment Report
            </CardTitle>
            <CardDescription>
              Complete logs of size requests from shops with warehouse pack, move, and receipt audit trails.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="mr-2 flex rounded-lg border bg-muted p-0.5">
              <Button
                size="sm"
                variant={viewMode === 'grouped' ? 'secondary' : 'ghost'}
                className="h-7 text-xs px-2.5 gap-1"
                onClick={() => setViewMode('grouped')}
              >
                <Layers className="h-3.5 w-3.5" /> Grouped by Shop & Size
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'detailed' ? 'secondary' : 'ghost'}
                className="h-7 text-xs px-2.5 gap-1"
                onClick={() => setViewMode('detailed')}
              >
                <ListFilter className="h-3.5 w-3.5" /> Detailed Action Log
              </Button>
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Excel
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" onClick={handleExportPDF}>
              <FileText className="h-3.5 w-3.5 text-red-600" /> PDF
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        </div>
        {selected.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Exporting {selected.length} selected row{selected.length > 1 ? 's' : ''}.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Summaries */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Total Requests', value: totals.total },
            { label: 'Total Units Demanded', value: totals.qty },
            { label: 'In Fulfillment Pipeline', value: totals.pending },
            { label: 'Successfully Delivered', value: totals.received },
          ].map(k => (
            <div key={k.label} className="rounded-lg border bg-card/60 p-3">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-xl font-bold mt-0.5">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Grouped View */}
        {viewMode === 'grouped' ? (
          <ScrollArea className="max-h-[500px] w-full border rounded-md">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold text-xs">Shop</TableHead>
                  <TableHead className="font-semibold text-xs">Size</TableHead>
                  <TableHead className="font-semibold text-xs">Category</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Requests</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Requested Qty</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Packed</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Moved</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Received</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm py-8 text-muted-foreground">
                      No requirement data available for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  groupedData.map((g, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs font-medium">{g.shop_name}</TableCell>
                      <TableCell className="text-xs font-semibold">{g.size}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{g.category}</TableCell>
                      <TableCell className="text-xs text-right">{g.request_count}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{g.total_qty}</TableCell>
                      <TableCell className="text-xs text-right text-blue-600 font-medium">{g.packed_qty}</TableCell>
                      <TableCell className="text-xs text-right text-violet-600 font-medium">{g.moved_qty}</TableCell>
                      <TableCell className="text-xs text-right text-emerald-600 font-medium">{g.received_qty}</TableCell>
                      <TableCell className="text-xs text-right font-semibold">
                        {g.pending_qty > 0 ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
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
          </ScrollArea>
        ) : (
          /* Detailed Action Log View */
          <ScrollArea className="max-h-[500px] w-full border rounded-md">
            <div className="min-w-[1000px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs font-semibold">Requested</TableHead>
                    <TableHead className="text-xs font-semibold">By</TableHead>
                    <TableHead className="text-xs font-semibold">Shop</TableHead>
                    <TableHead className="text-xs font-semibold">Size</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Qty</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold">Packed By / Time</TableHead>
                    <TableHead className="text-xs font-semibold">Moved By / Time</TableHead>
                    <TableHead className="text-xs font-semibold">Received By / Time</TableHead>
                    <TableHead className="text-xs font-semibold">Turnaround</TableHead>
                    <TableHead className="text-xs font-semibold">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-sm py-8 text-muted-foreground">
                        No requirement logs available.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{fmt(r.created_at)}</TableCell>
                        <TableCell className="text-xs font-medium">{r.requested_by_name || '—'}</TableCell>
                        <TableCell className="text-xs">{r.shop_name || '—'}</TableCell>
                        <TableCell className="text-xs font-semibold">{r.size}</TableCell>
                        <TableCell className="text-xs text-right font-medium">{r.quantity}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="secondary" className="capitalize">{r.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.packed_by_name ? (
                            <div>
                              <p className="font-medium">{r.packed_by_name}</p>
                              <p className="text-[10px] text-muted-foreground">{fmt(r.packed_at)} ({r.packed_qty ?? r.quantity} pcs)</p>
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.moved_by_name ? (
                            <div>
                              <p className="font-medium">{r.moved_by_name}</p>
                              <p className="text-[10px] text-muted-foreground">{fmt(r.moved_at)}</p>
                              {r.moved_note && <p className="text-[10px] italic text-muted-foreground">{r.moved_note}</p>}
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.received_by_name ? (
                            <div>
                              <p className="font-medium">{r.received_by_name}</p>
                              <p className="text-[10px] text-muted-foreground">{fmt(r.received_at)}</p>
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{turnaround(r)}</TableCell>
                        <TableCell className="text-xs max-w-xs truncate">{r.note || r.reject_reason || '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
