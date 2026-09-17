import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileSpreadsheet, FileText, Download, ClipboardList } from 'lucide-react';
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

export const buildRequirementsTable = (rows: StockRequirement[]): SheetTable => ({
  title: 'Stock requirements report',
  subtitle: `${rows.length} requirements · generated ${format(new Date(), 'dd MMM yyyy HH:mm')}`,
  columns: [
    'Requested at', 'Requested by', 'Shop', 'Category', 'Size', 'Qty', 'Urgency', 'Status',
    'Packed by', 'Packed at', 'Packed qty', 'Moved by', 'Moved at', 'Received by', 'Received at',
    'Turnaround', 'Note',
  ],
  rows: rows.map(r => [
    fmt(r.created_at), r.requested_by_name || '—', r.shop_name || '—', r.category || '—', r.size,
    r.quantity, r.urgency, r.status,
    r.packed_by_name || '—', fmt(r.packed_at), r.packed_qty ?? '—',
    r.moved_by_name || '—', fmt(r.moved_at),
    r.received_by_name || '—', fmt(r.received_at),
    turnaround(r), r.note || r.reject_reason || '—',
  ]),
  fileName: `stock-requirements-${format(new Date(), 'yyyyMMdd-HHmm')}`,
});

interface Props {
  rows: StockRequirement[];
  /** Ticked rows take priority over the filtered list when exporting */
  selected: StockRequirement[];
}

export const RequirementsReport = ({ rows, selected }: Props) => {
  const { template } = useExportTemplate();
  const exportRows = selected.length ? selected : rows;
  const table = useMemo(() => buildRequirementsTable(exportRows), [exportRows]);

  const totals = useMemo(() => ({
    total: rows.length,
    qty: rows.reduce((s, r) => s + (r.quantity || 0), 0),
    received: rows.filter(r => r.status === 'received').length,
    pending: rows.filter(r => r.status === 'requested' || r.status === 'packed' || r.status === 'moved').length,
  }), [rows]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ClipboardList className="h-5 w-5 text-primary" /> Requirements report
          </CardTitle>
          <div className="flex flex-wrap items-center gap-1">
            <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" onClick={() => exportTableToExcel(table, template)}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" onClick={() => exportTableToPDF(table, template)}>
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" onClick={() => exportTableToCSV(table, template)}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {selected.length ? `${selected.length} ticked rows will be exported.` : 'All rows matching the current filters will be exported.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Requirements', value: totals.total },
            { label: 'Units requested', value: totals.qty },
            { label: 'In progress', value: totals.pending },
            { label: 'Received', value: totals.received },
          ].map(k => (
            <div key={k.label} className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-lg font-semibold">{k.value}</p>
            </div>
          ))}
        </div>

        <ScrollArea className="max-h-[420px] w-full">
          <div className="min-w-[980px]">
            <Table>
              <TableHeader>
                <TableRow>
                  {['Requested', 'By', 'Shop', 'Size', 'Qty', 'Status', 'Packed', 'Moved', 'Received', 'Turnaround'].map(h => (
                    <TableHead key={h} className="text-xs">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{fmt(r.created_at)}</TableCell>
                    <TableCell className="text-xs">{r.requested_by_name || '—'}</TableCell>
                    <TableCell className="text-xs">{r.shop_name || '—'}</TableCell>
                    <TableCell className="text-xs font-medium">{r.size}</TableCell>
                    <TableCell className="text-xs">{r.quantity}</TableCell>
                    <TableCell className="text-xs"><Badge variant="secondary">{r.status}</Badge></TableCell>
                    <TableCell className="text-xs">{r.packed_by_name ? `${r.packed_by_name} · ${fmt(r.packed_at)}` : '—'}</TableCell>
                    <TableCell className="text-xs">{r.moved_by_name ? `${r.moved_by_name} · ${fmt(r.moved_at)}` : '—'}</TableCell>
                    <TableCell className="text-xs">{r.received_by_name ? `${r.received_by_name} · ${fmt(r.received_at)}` : '—'}</TableCell>
                    <TableCell className="text-xs">{turnaround(r)}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="py-6 text-center text-sm text-muted-foreground">No requirements match these filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
