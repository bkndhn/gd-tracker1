/**
 * Excel + PDF exports for the insight widgets (Stock & size gaps and the
 * Top 3 Fixes drill-downs). Kept UI-free so it can be unit tested.
 */
import * as XLSX from 'xlsx';
import { formatISTDateTime, formatISTDate, formatISTFileName } from '@/lib/dateUtils';
import { exportToPDFViaHTML } from '@/utils/htmlPdfExport';
import { formatINR, type InsightEntry, type StockGapRow, type TopFix } from '@/lib/lostSaleInsights';
import { DEFAULT_EXPORT_TEMPLATE, type ExportTemplate } from '@/lib/reportTemplate';

export interface SheetTable {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  fileName: string;
  /** Human readable range covered by the report, printed when the template allows it */
  dateRange?: string;
}

export function buildStockGapTable(rows: StockGapRow[], days: number): SheetTable {
  return {
    title: 'Stock & size gap report',
    subtitle: `Last ${days} days · generated ${formatISTDateTime(new Date())} (IST)`,
    dateRange: `${formatISTDate(new Date(Date.now() - days * 86400000))} – ${formatISTDate(new Date())}`,
    columns: ['Category', 'Size', 'Misses', 'Trend %', 'Shops', 'Last seen (IST)'],
    rows: rows.map(r => [
      r.category,
      r.size,
      r.count,
      r.trend === null ? 'new' : r.trend,
      r.shops.join(', '),
      formatISTDate(r.lastSeen),
    ]),
    fileName: formatISTFileName(new Date(), `stock-size-gaps-${days}d`),
  };
}

export function buildFixDrilldownTable(fix: TopFix, entries: InsightEntry[]): SheetTable {
  const dates = entries.map(e => new Date(e.created_at).getTime()).filter(n => Number.isFinite(n));
  return {
    title: `${fix.headline}`,
    subtitle: [
      `Score ${fix.score}`,
      `${entries.length} visits`,
      fix.estimatedValue > 0 ? `${formatINR(fix.estimatedValue)} recoverable` : null,
      `generated ${formatISTDateTime(new Date())} (IST)`,
    ].filter(Boolean).join(' · '),
    dateRange: dates.length
      ? `${formatISTDate(new Date(Math.min(...dates)))} – ${formatISTDate(new Date(Math.max(...dates)))}`
      : undefined,
    columns: ['Date (IST)', 'Shop', 'Reason', 'Size', 'Customer type', 'Reporter'],
    rows: entries.map(e => [
      formatISTDateTime(e.created_at),
      e.shops?.name || '—',
      e.categories?.name || '—',
      e.sizes?.size || '—',
      e.customer_types?.name || '—',
      e.employee_name || '—',
    ]),
    fileName: formatISTFileName(new Date(), `fix-${fix.kind}-${fix.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`),
  };
}

export function exportTableToExcel(table: SheetTable, template: ExportTemplate = DEFAULT_EXPORT_TEMPLATE) {
  const head: (string | number)[][] = [];
  if (template.orgName) head.push([template.orgName]);
  head.push([table.title]);
  if (table.subtitle) head.push([table.subtitle]);
  if (template.showDateRange && table.dateRange) head.push([`Period: ${table.dateRange}`]);
  if (template.headerNote) head.push([template.headerNote]);
  head.push([]);

  const foot: (string | number)[][] = template.footerNote ? [[], [template.footerNote]] : [];

  const aoa = [...head, table.columns, ...table.rows, ...foot];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = table.columns.map(c => ({ wch: Math.max(12, c.length + 4) }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Report');
  XLSX.writeFile(book, `${table.fileName}.xlsx`);
}

/** Plain CSV download (RFC-4180 quoting) for spreadsheet-agnostic consumers. */
export function exportTableToCSV(table: SheetTable, template: ExportTemplate = DEFAULT_EXPORT_TEMPLATE) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  if (template.orgName) lines.push(esc(template.orgName));
  lines.push(esc(table.title));
  if (table.subtitle) lines.push(esc(table.subtitle));
  if (template.showDateRange && table.dateRange) lines.push(esc(`Period: ${table.dateRange}`));
  if (template.headerNote) lines.push(esc(template.headerNote));
  lines.push('');
  lines.push(table.columns.map(esc).join(','));
  table.rows.forEach(r => lines.push(r.map(esc).join(',')));
  if (template.footerNote) { lines.push(''); lines.push(esc(template.footerNote)); }

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${table.fileName}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportTableToPDF(table: SheetTable, template: ExportTemplate = DEFAULT_EXPORT_TEMPLATE) {
  const subtitleParts = [
    table.subtitle,
    template.showDateRange && table.dateRange ? `Period: ${table.dateRange}` : null,
    template.headerNote || null,
  ].filter(Boolean) as string[];

  exportToPDFViaHTML({
    title: table.title,
    subtitle: subtitleParts.join(' · ') || undefined,
    columns: table.columns.map(header => ({ header })),
    rows: table.rows.map(r => r.map(c => String(c))),
    fileName: table.fileName,
    orientation: 'landscape',
    branding: {
      orgName: template.orgName,
      logoDataUrl: template.logoDataUrl,
      footerNote: template.footerNote,
      accentColor: template.accentColor,
    },
  });
}
