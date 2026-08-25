import { useMemo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetricInfo } from '@/components/MetricInfo';
import { OUTCOME_LABELS, type FollowUpRow } from '@/hooks/useFollowUps';
import { useExportTemplate } from '@/hooks/useExportTemplate';
import { exportTableToExcel, exportTableToPDF, type SheetTable } from '@/lib/insightExports';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Search } from 'lucide-react';
import { format } from 'date-fns';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

type SortKey = 'sent_at' | 'employee' | 'reason' | 'template' | 'amount';
const PAGE_SIZE = 10;

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
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'amount', dir: 'desc' });
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [query, sort, open, shopName]);

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

  /** Search + sort applied to the converted entries table. */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (r: FollowUpRow) =>
      !q ||
      [r.sent_by_name, r.reason_label, r.template_key, r.customer_name, r.phone, fmtDate(r.sent_at), format(new Date(r.sent_at), 'dd MMM yyyy')]
        .some(v => (v || '').toString().toLowerCase().includes(q));

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
  }, [converted, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const filteredRecovered = filtered.reduce((s, r) => s + Number(r.recovered_amount || 0), 0);

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

  const buildEntriesTable = (): SheetTable => ({
    title: `${shopName} · recovered entries`,
    subtitle: `${periodLabel} · ${filtered.length} converted follow-ups · ${inr(filteredRecovered)} recovered${query ? ` · filter "${query}"` : ''}`,
    dateRange: periodLabel,
    columns: ['Date', 'Phone', 'Customer', 'Employee', 'Reason', 'Template', 'Recovered ₹', 'Closed'],
    rows: filtered.map(r => [
      format(new Date(r.sent_at), 'dd MMM yyyy'),
      r.phone,
      r.customer_name || '—',
      r.sent_by_name || '—',
      r.reason_label || '—',
      r.template_key || 'generic',
      Math.round(Number(r.recovered_amount || 0)),
      r.outcome_at ? format(new Date(r.outcome_at), 'dd MMM yyyy') : '—',
    ]),
    fileName: `recovery-${shopName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-entries-${format(new Date(), 'yyyyMMdd')}`,
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
    fileName: `recovery-${shopName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-staff-${format(new Date(), 'yyyyMMdd')}`,
  });

  const doExport = (kind: 'excel' | 'pdf', table: SheetTable) => {
    if (kind === 'excel') exportTableToExcel(table, template);
    else exportTableToPDF(table, template);
  };

  const ExportButtons = ({ build }: { build: () => SheetTable }) => (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => doExport('excel', build())}>
        <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
      </Button>
      <Button size="sm" variant="outline" onClick={() => doExport('pdf', build())}>
        <FileText className="h-3.5 w-3.5 mr-1" /> PDF
      </Button>
    </div>
  );

  return (
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
              <ExportButtons build={buildEntriesTable} />
            </div>

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
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No matching recovered entries.</td></tr>
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
                    </tr>
                  ))}
                  {converted.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No conversions in this period.</td></tr>
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
  );
};
