import { useMemo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetricInfo } from '@/components/MetricInfo';
import { OUTCOME_LABELS, type FollowUpRow } from '@/hooks/useFollowUps';
import { useExportTemplate } from '@/hooks/useExportTemplate';
import { exportTableToExcel, exportTableToPDF, exportTableToCSV, type SheetTable } from '@/lib/insightExports';
import {
  ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ExternalLink, FileDown,
  FileSpreadsheet, FileText, Filter, Search, X,
} from 'lucide-react';
import { formatISTDateTime, formatISTDate, formatISTShort, formatISTFileName } from '@/lib/dateUtils';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtDate = (d?: string | null) =>
  d ? formatISTShort(d) : '—';

type SortKey = 'sent_at' | 'employee' | 'reason' | 'template' | 'amount';
const PAGE_SIZE = 10;
const ALL = '__all__';
const CHART_COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6'];

/**
 * Shows the exact follow-ups and staff attribution behind one shop's
 * recovered rupees and conversion rate on the leaderboard.
 */
export const ShopRecoveryDrilldown = ({
  open,
  onOpenChange,
  shopName,
  periodLabel,
  rows,
  targetRecovered,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shopName: string;
  periodLabel: string;
  rows: FollowUpRow[];
  targetRecovered: number;
}) => {
  const { template } = useExportTemplate();
  const converted = useMemo(() => rows.filter(r => r.outcome === 'converted'), [rows]);
  const recovered = useMemo(() => converted.reduce((s, r) => s + Number(r.recovered_amount || 0), 0), [converted]);
  const conversionRate = rows.length ? (converted.length / rows.length) * 100 : 0;
  const attainment = targetRecovered > 0 ? (recovered / targetRecovered) * 100 : null;

  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [employee, setEmployee] = useState(ALL);
  const [templateKey, setTemplateKey] = useState(ALL);
  const [reason, setReason] = useState(ALL);
  const [notesKeyword, setNotesKeyword] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'amount', dir: 'desc' });
  const [page, setPage] = useState(0);
  const [source, setSource] = useState<FollowUpRow | null>(null);

  const filterState = [employee, templateKey, reason, notesKeyword, minAmount, fromDate, toDate].join('|');
  useEffect(() => { setPage(0); }, [query, sort, open, shopName, filterState]);

  const uniq = (vals: (string | null | undefined)[]) =>
    Array.from(new Set(vals.map(v => (v || '').trim()).filter(Boolean))).sort();

  const employeeOptions = useMemo(() => uniq(converted.map(r => r.sent_by_name)), [converted]);
  const templateOptions = useMemo(() => uniq(converted.map(r => r.template_key || 'generic')), [converted]);
  const reasonOptions = useMemo(() => uniq(converted.map(r => r.reason_label)), [converted]);

  const activeFilters =
    (employee !== ALL ? 1 : 0) + (templateKey !== ALL ? 1 : 0) + (reason !== ALL ? 1 : 0) +
    (notesKeyword ? 1 : 0) + (minAmount ? 1 : 0) + (fromDate ? 1 : 0) + (toDate ? 1 : 0);

  const clearFilters = () => {
    setEmployee(ALL); setTemplateKey(ALL); setReason(ALL);
    setNotesKeyword(''); setMinAmount(''); setFromDate(''); setToDate('');
  };

  const staff = useMemo(() => {
    const map = new Map<string, { name: string; sent: number; converted: number; recovered: number }>();
    rows.forEach(r => {
      const cur = map.get(r.sent_by) || { name: r.sent_by_name || 'Unknown staff', sent: 0, converted: 0, recovered: 0 };
      cur.sent += 1;
      if (r.outcome === 'converted') { cur.converted += 1; cur.recovered += Number(r.recovered_amount || 0); }
      map.set(r.sent_by, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.recovered - a.recovered || b.converted - a.converted);
  }, [rows]);

  /** Search + advanced filters + sort applied to the converted entries table. */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const kw = notesKeyword.trim().toLowerCase();
    const min = Number(minAmount) || 0;
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

    const match = (r: FollowUpRow) => {
      const searchOk = !q ||
        [r.sent_by_name, r.reason_label, r.template_key, r.customer_name, r.phone, fmtDate(r.sent_at), formatISTDate(r.sent_at)]
          .some(v => (v || '').toString().toLowerCase().includes(q));
      if (!searchOk) return false;
      if (employee !== ALL && (r.sent_by_name || '') !== employee) return false;
      if (templateKey !== ALL && (r.template_key || 'generic') !== templateKey) return false;
      if (reason !== ALL && (r.reason_label || '') !== reason) return false;
      if (kw && ![r.outcome_note, r.message].some(v => (v || '').toLowerCase().includes(kw))) return false;
      if (min && Number(r.recovered_amount || 0) < min) return false;
      const t = new Date(r.sent_at).getTime();
      if (from && t < from) return false;
      if (to && t > to) return false;
      return true;
    };

    const val = (r: FollowUpRow) => {
      switch (sort.key) {
        case 'employee': return (r.sent_by_name || '').toLowerCase();
        case 'reason': return (r.reason_label || '').toLowerCase();
        case 'template': return (r.template_key || '').toLowerCase();
        case 'amount': return Number(r.recovered_amount || 0);
        default: return new Date(r.sent_at).getTime();
      }
    };

    return converted.filter(match).sort((a, b) => {
      const av = val(a), bv = val(b);
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [converted, query, sort, employee, templateKey, reason, notesKeyword, minAmount, fromDate, toDate]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const filteredRecovered = filtered.reduce((s, r) => s + Number(r.recovered_amount || 0), 0);

  /** Recovered ₹ and conversion rate grouped by employee, for the period. */
  const employeeChart = useMemo(() => {
    const map = new Map<string, { name: string; recovered: number; sent: number; converted: number }>();
    rows.forEach(r => {
      const name = r.sent_by_name || 'Unknown';
      const cur = map.get(name) || { name, recovered: 0, sent: 0, converted: 0 };
      cur.sent += 1;
      if (r.outcome === 'converted') { cur.converted += 1; cur.recovered += Number(r.recovered_amount || 0); }
      map.set(name, cur);
    });
    return Array.from(map.values())
      .map(v => ({ ...v, conversion: v.sent ? Number(((v.converted / v.sent) * 100).toFixed(1)) : 0 }))
      .sort((a, b) => b.recovered - a.recovered)
      .slice(0, 8);
  }, [rows]);

  /** Same split by lost reason / category. */
  const categoryChart = useMemo(() => {
    const map = new Map<string, { name: string; recovered: number; sent: number; converted: number }>();
    rows.forEach(r => {
      const name = r.reason_label || 'No reason';
      const cur = map.get(name) || { name, recovered: 0, sent: 0, converted: 0 };
      cur.sent += 1;
      if (r.outcome === 'converted') { cur.converted += 1; cur.recovered += Number(r.recovered_amount || 0); }
      map.set(name, cur);
    });
    return Array.from(map.values())
      .map(v => ({ ...v, conversion: v.sent ? Number(((v.converted / v.sent) * 100).toFixed(1)) : 0 }))
      .sort((a, b) => b.recovered - a.recovered)
      .slice(0, 8);
  }, [rows]);

  const toggleSort = (key: SortKey) =>
    setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'amount' || key === 'sent_at' ? 'desc' : 'asc' }));

  const SortHead = ({ k, label, align = 'left' }: { k: SortKey; label: string; align?: 'left' | 'right' }) => (
    <th className={`p-2 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        {sort.key === k && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );

  const filterSummary = [
    query ? `search "${query}"` : null,
    employee !== ALL ? `employee ${employee}` : null,
    templateKey !== ALL ? `template ${templateKey}` : null,
    reason !== ALL ? `reason ${reason}` : null,
    notesKeyword ? `notes "${notesKeyword}"` : null,
    minAmount ? `min ${inr(Number(minAmount))}` : null,
    fromDate || toDate ? `dates ${fromDate || '…'} → ${toDate || '…'}` : null,
  ].filter(Boolean).join(' · ');

  const buildEntriesTable = (): SheetTable => ({
    title: `${shopName} · recovered entries`,
    subtitle: `${periodLabel} · ${filtered.length} converted follow-ups · ${inr(filteredRecovered)} recovered${filterSummary ? ` · ${filterSummary}` : ''}`,
    dateRange: periodLabel,
    columns: ['Date', 'Phone', 'Customer', 'Employee', 'Reason', 'Template', 'Recovered ₹', 'Closed'],
    rows: filtered.map(r => [
      formatISTDate(r.sent_at),
      r.phone,
      r.customer_name || '—',
      r.sent_by_name || '—',
      r.reason_label || '—',
      r.template_key || 'generic',
      Math.round(Number(r.recovered_amount || 0)),
      r.outcome_at ? formatISTDate(r.outcome_at) : '—',
    ]),
    fileName: formatISTFileName(new Date(), `recovery-${shopName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-entries`),
  });

  const buildStaffTable = (): SheetTable => ({
    title: `${shopName} · staff attribution`,
    subtitle: `${periodLabel} · ${rows.length} follow-ups · ${inr(recovered)} recovered`,
    dateRange: periodLabel,
    columns: ['Staff', 'Sent', 'Converted', 'Conversion %', 'Recovered ₹', 'Share %'],
    rows: staff.map(s => [
      s.name,
      s.sent,
      s.converted,
      s.sent ? Number(((s.converted / s.sent) * 100).toFixed(1)) : 0,
      Math.round(s.recovered),
      recovered ? Number(((s.recovered / recovered) * 100).toFixed(1)) : 0,
    ]),
    fileName: formatISTFileName(new Date(), `recovery-${shopName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-staff`),
  });

  const doExport = (kind: 'excel' | 'pdf' | 'csv', table: SheetTable) => {
    if (kind === 'excel') exportTableToExcel(table, template);
    else if (kind === 'csv') exportTableToCSV(table, template);
    else exportTableToPDF(table, template);
  };

  const ExportButtons = ({ build }: { build: () => SheetTable }) => (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => doExport('excel', build())}>
        <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
      </Button>
      <Button size="sm" variant="outline" onClick={() => doExport('csv', build())}>
        <FileDown className="h-3.5 w-3.5 mr-1" /> CSV
      </Button>
      <Button size="sm" variant="outline" onClick={() => doExport('pdf', build())}>
        <FileText className="h-3.5 w-3.5 mr-1" /> PDF
      </Button>
    </div>
  );

  const ChartCard = ({
    title, data, metric, label, color,
  }: {
    title: string;
    data: { name: string; recovered: number; conversion: number }[];
    metric: 'recovered' | 'conversion';
    label: string;
    color: string;
  }) => (
    <div className="rounded-lg border p-3">
      <p className="mb-2 text-xs font-semibold">{title}</p>
      {data.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">No data in this period.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => (metric === 'recovered' ? inr(Number(v)) : `${v}%`)} />
            <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v: number) => [metric === 'recovered' ? inr(v) : `${v}%`, label]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey={metric} name={label} radius={[0, 4, 4, 0]}>
              {data.map((_, i) => <Cell key={i} fill={color === 'multi' ? CHART_COLORS[i % CHART_COLORS.length] : color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{shopName} · recovery breakdown</DialogTitle>
            <DialogDescription>{periodLabel} · every follow-up counted in this shop's leaderboard row.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-lg border p-3">
              <p className="text-[11px] text-muted-foreground">Follow-ups sent</p>
              <p className="text-lg font-semibold">{rows.length}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">Conversion <MetricInfo metric="conversionRate" /></p>
              <p className="text-lg font-semibold">{conversionRate.toFixed(0)}%</p>
              <p className="text-[11px] text-muted-foreground">{converted.length} / {rows.length}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">Recovered <MetricInfo metric="recovered" /></p>
              <p className="text-lg font-semibold">{inr(recovered)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">Attainment <MetricInfo metric="attainment" /></p>
              <p className="text-lg font-semibold">{attainment === null ? '—' : `${attainment.toFixed(0)}%`}</p>
              {targetRecovered > 0 && <p className="text-[11px] text-muted-foreground">target {inr(targetRecovered)}</p>}
            </div>
          </div>

          <Tabs defaultValue="entries">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="entries">Recovered entries ({converted.length})</TabsTrigger>
              <TabsTrigger value="charts">Charts</TabsTrigger>
              <TabsTrigger value="staff">Staff attribution</TabsTrigger>
              <TabsTrigger value="explain">Attribution breakdown</TabsTrigger>
              <TabsTrigger value="all">All follow-ups ({rows.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="entries" className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="h-9 pl-8 text-sm"
                    placeholder="Search employee, reason, template, date, phone…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <Button size="sm" variant={showFilters ? 'secondary' : 'outline'} onClick={() => setShowFilters(v => !v)}>
                  <Filter className="h-3.5 w-3.5 mr-1" /> Filters
                  {activeFilters > 0 && <Badge className="ml-1.5 h-4 px-1 text-[10px]">{activeFilters}</Badge>}
                </Button>
                <ExportButtons build={buildEntriesTable} />
              </div>

              {showFilters && (
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Select value={employee} onValueChange={setEmployee}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Employee" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All employees</SelectItem>
                        {employeeOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={templateKey} onValueChange={setTemplateKey}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Message template" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All templates</SelectItem>
                        {templateOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={reason} onValueChange={setReason}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Reason" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All reasons</SelectItem>
                        {reasonOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <Input
                      className="h-9 text-xs sm:col-span-2"
                      placeholder="Notes / message keyword"
                      value={notesKeyword}
                      onChange={(e) => setNotesKeyword(e.target.value)}
                    />
                    <Input
                      className="h-9 text-xs"
                      type="number"
                      min={0}
                      placeholder="Min ₹ recovered"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Input className="h-9 text-xs" type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
                      <Input className="h-9 text-xs" type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
                    </div>
                  </div>
                  {activeFilters > 0 && (
                    <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={clearFilters}>
                      <X className="h-3 w-3 mr-1" /> Clear filters
                    </Button>
                  )}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <SortHead k="sent_at" label="Date" />
                      <th className="p-2 text-left">Customer</th>
                      <SortHead k="employee" label="Employee" />
                      <SortHead k="reason" label="Reason" />
                      <SortHead k="template" label="Template" />
                      <SortHead k="amount" label="Recovered" align="right" />
                      <th className="p-2 text-right">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map(r => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2 whitespace-nowrap">{fmtDate(r.sent_at)}</td>
                        <td className="p-2 truncate max-w-[150px]">{r.customer_name || `+91 ${r.phone}`}</td>
                        <td className="p-2 truncate max-w-[130px]">{r.sent_by_name || '—'}</td>
                        <td className="p-2 truncate max-w-[130px]">{r.reason_label || '—'}</td>
                        <td className="p-2 truncate max-w-[120px]">{r.template_key || 'generic'}</td>
                        <td className="p-2 text-right font-semibold text-emerald-600">{inr(Number(r.recovered_amount || 0))}</td>
                        <td className="p-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 px-2 text-[11px]"
                            onClick={() => setSource(r)}
                          >
                            <ExternalLink className="h-3 w-3" /> View
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No matching recovered entries.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{filtered.length} entries · {inr(filteredRecovered)}</span>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span>Page {page + 1} / {pageCount}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" disabled={page + 1 >= pageCount} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="charts" className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">{periodLabel} · top 8 by recovered rupees.</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <ChartCard title="Recovered ₹ by employee" data={employeeChart} metric="recovered" label="Recovered ₹" color="hsl(var(--primary))" />
                <ChartCard title="Conversion % by employee" data={employeeChart} metric="conversion" label="Conversion %" color="#10b981" />
                <ChartCard title="Recovered ₹ by category / reason" data={categoryChart} metric="recovered" label="Recovered ₹" color="multi" />
                <ChartCard title="Conversion % by category / reason" data={categoryChart} metric="conversion" label="Conversion %" color="#f59e0b" />
              </div>
            </TabsContent>

            <TabsContent value="staff" className="mt-3 space-y-3">
              <div className="flex justify-end"><ExportButtons build={buildStaffTable} /></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Staff</th>
                      <th className="p-2 text-right">Sent</th>
                      <th className="p-2 text-right">Converted</th>
                      <th className="p-2 text-right">Conv %</th>
                      <th className="p-2 text-right">Recovered</th>
                      <th className="p-2 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map(s => (
                      <tr key={s.name} className="border-t">
                        <td className="p-2 truncate max-w-[160px]">{s.name}</td>
                        <td className="p-2 text-right">{s.sent}</td>
                        <td className="p-2 text-right">{s.converted}</td>
                        <td className="p-2 text-right">{s.sent ? ((s.converted / s.sent) * 100).toFixed(0) : 0}%</td>
                        <td className="p-2 text-right font-semibold">{inr(s.recovered)}</td>
                        <td className="p-2 text-right">{recovered ? ((s.recovered / recovered) * 100).toFixed(0) : 0}%</td>
                      </tr>
                    ))}
                    {staff.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No follow-ups.</td></tr>}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="explain" className="mt-3 space-y-3">
              <div className="rounded-lg border p-3 space-y-1 text-sm">
                <p className="font-medium">How this shop's numbers are built</p>
                <p className="text-xs text-muted-foreground">
                  Every follow-up message logged for <span className="font-medium text-foreground">{shopName}</span> in {periodLabel} counts once.
                  A follow-up joins the recovered total only when its outcome is marked <em>Converted (purchased)</em>, and it contributes exactly the
                  rupee amount entered when that outcome was saved. Nothing is estimated or split.
                </p>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5 pt-1">
                  <li>Recovered = sum of recovered ₹ on converted follow-ups → <span className="font-medium text-foreground">{inr(recovered)}</span></li>
                  <li>Conversion rate = converted ÷ total sent → {converted.length} ÷ {rows.length} = <span className="font-medium text-foreground">{conversionRate.toFixed(1)}%</span></li>
                  <li>Attainment = recovered ÷ this month's shop target → {targetRecovered > 0 ? `${inr(recovered)} ÷ ${inr(targetRecovered)} = ${attainment?.toFixed(1)}%` : 'no target set'}</li>
                  <li>Credit goes to the staff member who sent the message (<code>sent_by</code>), not the one who closed it.</li>
                </ul>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Converted entry</th>
                      <th className="p-2 text-left">Credited to</th>
                      <th className="p-2 text-right">Recovered ₹</th>
                      <th className="p-2 text-right">% of shop total</th>
                      <th className="p-2 text-right">Conversion weight</th>
                      <th className="p-2 text-right">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {converted.map(r => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2">
                          <p className="truncate max-w-[190px]">{r.customer_name || `+91 ${r.phone}`}</p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[190px]">
                            {fmtDate(r.sent_at)} · {r.reason_label || 'no reason'} · {r.template_key || 'generic'}
                          </p>
                        </td>
                        <td className="p-2 truncate max-w-[140px]">{r.sent_by_name || 'staff'}</td>
                        <td className="p-2 text-right font-semibold">{inr(Number(r.recovered_amount || 0))}</td>
                        <td className="p-2 text-right">{recovered ? ((Number(r.recovered_amount || 0) / recovered) * 100).toFixed(1) : '0.0'}%</td>
                        <td className="p-2 text-right">{rows.length ? (100 / rows.length).toFixed(1) : '0.0'} pts</td>
                        <td className="p-2 text-right">
                          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]" onClick={() => setSource(r)}>
                            <ExternalLink className="h-3 w-3" /> View
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {converted.length === 0 && (
                      <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No conversions in this period.</td></tr>
                    )}
                  </tbody>
                  {converted.length > 0 && (
                    <tfoot>
                      <tr className="border-t bg-muted/30 font-semibold">
                        <td className="p-2">Total</td>
                        <td className="p-2">{staff.length} staff</td>
                        <td className="p-2 text-right">{inr(recovered)}</td>
                        <td className="p-2 text-right">100%</td>
                        <td className="p-2 text-right">{conversionRate.toFixed(1)}%</td>
                        <td className="p-2" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </TabsContent>

            <TabsContent value="all" className="mt-3 space-y-2">
              {rows.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm truncate">+91 {r.phone} · {fmtDate(r.sent_at)}</p>
                    <p className="text-xs text-muted-foreground truncate">by {r.sent_by_name || 'staff'} · {r.reason_label || 'no reason'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="outline">{OUTCOME_LABELS[r.outcome]}</Badge>
                    {r.recovered_amount > 0 && <p className="text-xs mt-1 text-emerald-600">{inr(Number(r.recovered_amount))}</p>}
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Source of one recovered entry: the original follow-up and the template used. */}
      <Dialog open={!!source} onOpenChange={(v) => !v && setSource(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Source follow-up</DialogTitle>
            <DialogDescription>The exact message and outcome used to compute this recovered amount.</DialogDescription>
          </DialogHeader>
          {source && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ['Customer', source.customer_name || '—'],
                  ['Phone', `+91 ${source.phone}`],
                  ['Sent by', source.sent_by_name || '—'],
                  ['Sent at', formatISTDateTime(source.sent_at)],
                  ['Reason', source.reason_label || '—'],
                  ['Template', source.template_key || 'generic'],
                  ['Outcome', OUTCOME_LABELS[source.outcome]],
                  ['Closed at', source.outcome_at ? formatISTDateTime(source.outcome_at) : '—'],
                  ['Delivery', source.delivery_status || 'unknown'],
                  ['Recovered', inr(Number(source.recovered_amount || 0))],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-md border p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">{k}</p>
                    <p className="font-medium break-words">{v}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-semibold mb-1">Message sent</p>
                <p className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-xs">
                  {source.message || 'No message body stored for this follow-up.'}
                </p>
              </div>

              {source.outcome_note && (
                <div>
                  <p className="text-xs font-semibold mb-1">Outcome note</p>
                  <p className="whitespace-pre-wrap rounded-lg border p-3 text-xs">{source.outcome_note}</p>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
                This follow-up contributes {inr(Number(source.recovered_amount || 0))} to {shopName}'s recovered total
                {recovered ? ` (${((Number(source.recovered_amount || 0) / recovered) * 100).toFixed(1)}% of the period)` : ''}.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
