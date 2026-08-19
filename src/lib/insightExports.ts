/**
 * Excel + PDF exports for the insight widgets (Stock & size gaps and the
 * Top 3 Fixes drill-downs). Kept UI-free so it can be unit tested.
 */
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { exportToPDFViaHTML } from '@/utils/htmlPdfExport';
import { formatINR, type InsightEntry, type StockGapRow, type TopFix } from '@/lib/lostSaleInsights';

export interface SheetTable {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  fileName: string;
}

export function buildStockGapTable(rows: StockGapRow[], days: number): SheetTable {
  return {
    title: 'Stock & size gap report',
    subtitle: `Last ${days} days · generated ${format(new Date(), 'dd MMM yyyy HH:mm')}`,
    columns: ['Category', 'Size', 'Misses', 'Trend %', 'Shops', 'Last seen'],
    rows: rows.map(r => [
      r.category,
      r.size,
      r.count,
      r.trend === null ? 'new' : r.trend,
      r.shops.join(', '),
      format(new Date(r.lastSeen), 'dd MMM yyyy'),
    ]),
    fileName: `stock-size-gaps-${days}d-${format(new Date(), 'yyyyMMdd')}`,
  };
}

export function buildFixDrilldownTable(fix: TopFix, entries: InsightEntry[]): SheetTable {
  return {
    title: `${fix.headline}`,
    subtitle: [
      `Score ${fix.score}`,
      `${entries.length} visits`,
      fix.estimatedValue > 0 ? `${formatINR(fix.estimatedValue)} recoverable` : null,
      `generated ${format(new Date(), 'dd MMM yyyy HH:mm')}`,
    ].filter(Boolean).join(' · '),
    columns: ['Date', 'Shop', 'Reason', 'Size', 'Customer type', 'Reporter'],
    rows: entries.map(e => [
      format(new Date(e.created_at), 'dd MMM yyyy HH:mm'),
      e.shops?.name || '—',
      e.categories?.name || '—',
      e.sizes?.size || '—',
      e.customer_types?.name || '—',
      e.employee_name || '—',
    ]),
    fileName: `fix-${fix.kind}-${fix.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${format(new Date(), 'yyyyMMdd')}`,
  };
}

export function exportTableToExcel(table: SheetTable) {
  const aoa = [[table.title], table.subtitle ? [table.subtitle] : [], [], table.columns, ...table.rows];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = table.columns.map(c => ({ wch: Math.max(12, c.length + 4) }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Report');
  XLSX.writeFile(book, `${table.fileName}.xlsx`);
}

export function exportTableToPDF(table: SheetTable) {
  exportToPDFViaHTML({
    title: table.title,
    subtitle: table.subtitle,
    columns: table.columns.map(header => ({ header })),
    rows: table.rows.map(r => r.map(c => String(c))),
    fileName: table.fileName,
    orientation: 'landscape',
  });
}
