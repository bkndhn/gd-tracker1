import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { BarChart3, FileSpreadsheet, FileText } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import type { StockRequirement } from '@/hooks/useRequirements';
import { exportTableToExcel, exportTableToPDF, type SheetTable } from '@/lib/insightExports';

export interface ShopMonthRow {
  shop: string;
  requested: number;
  packed: number;
  moved: number;
  received: number;
  rejected: number;
  fulfilRate: number;
}

const monthKey = (iso: string) => iso.slice(0, 7);

/** Per-shop counts for one month (YYYY-MM). "requested" = all requests raised that month;
 * packed/moved/received count requests that reached at least that stage. */
export const summariseByShop = (rows: StockRequirement[], month: string): ShopMonthRow[] => {
  const map = new Map<string, ShopMonthRow>();
  for (const r of rows) {
    if (monthKey(r.created_at) !== month) continue;
    const shop = r.shop_name || 'Unassigned';
    const row = map.get(shop) || { shop, requested: 0, packed: 0, moved: 0, received: 0, rejected: 0, fulfilRate: 0 };
    row.requested += 1;
    if (r.status === 'rejected') row.rejected += 1;
    if (r.packed_at || ['packed', 'moved', 'received'].includes(r.status)) row.packed += 1;
    if (r.moved_at || ['moved', 'received'].includes(r.status)) row.moved += 1;
    if (r.received_at || r.status === 'received') row.received += 1;
    map.set(shop, row);
  }
  return [...map.values()]
    .map(r => ({ ...r, fulfilRate: r.requested ? Math.round((r.received / r.requested) * 100) : 0 }))
    .sort((a, b) => b.requested - a.requested);
};

const fmtMonth = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

export const RequirementsMonthlySummary = ({ rows }: { rows: StockRequirement[] }) => {
  const months = useMemo(() => {
    const s = new Set(rows.map(r => monthKey(r.created_at)));
    s.add(new Date().toISOString().slice(0, 7));
    return [...s].sort().reverse();
  }, [rows]);
  const [month, setMonth] = useState(months[0]);
  const data = useMemo(() => summariseByShop(rows, month), [rows, month]);
  const totals = data.reduce((t, r) => ({
    requested: t.requested + r.requested, packed: t.packed + r.packed, moved: t.moved + r.moved, received: t.received + r.received,
  }), { requested: 0, packed: 0, moved: 0, received: 0 });

  const table = (): SheetTable => ({
    title: `Monthly Stock Summary — ${fmtMonth(month)}`,
    columns: ['Shop', 'Requested', 'Packed', 'Moved', 'Received', 'Rejected', 'Fulfilment %'],
    rows: data.map(r => [r.shop, r.requested, r.packed, r.moved, r.received, r.rejected, `${r.fulfilRate}%`]),
    fileName: `stock-summary-${month}`,
  });

  const kpis = [
    { label: 'Requested', v: totals.requested, c: 'text-amber-600' },
    { label: 'Packed', v: totals.packed, c: 'text-blue-600' },
    { label: 'Moved', v: totals.moved, c: 'text-violet-600' },
    { label: 'Received', v: totals.received, c: 'text-emerald-600' },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><BarChart3 className="h-5 w-5 text-primary" /> Monthly shop summary</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Requested, packed, moved and received per shop</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-10 w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" title="Excel" onClick={() => exportTableToExcel(table() as any)}><FileSpreadsheet className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" title="PDF" onClick={() => exportTableToPDF(table() as any)}><FileText className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {kpis.map(k => (
            <div key={k.label} className="rounded-xl border bg-card p-3">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className={`text-2xl font-bold ${k.c}`}>{k.v}</div>
            </div>
          ))}
        </div>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No requests in {fmtMonth(month)}.</p>
        ) : (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <BarChart data={data} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="shop" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="requested" name="Requested" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="packed" name="Packed" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="moved" name="Moved" fill="hsl(262 83% 58%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="received" name="Received" fill="hsl(160 84% 39%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>{['Shop', 'Req', 'Packed', 'Moved', 'Recvd', 'Rej', 'Done %'].map(h => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {data.map(r => (
                    <tr key={r.shop} className="border-t">
                      <td className="px-3 py-2.5 font-medium">{r.shop}</td>
                      <td className="px-3 py-2.5">{r.requested}</td>
                      <td className="px-3 py-2.5">{r.packed}</td>
                      <td className="px-3 py-2.5">{r.moved}</td>
                      <td className="px-3 py-2.5">{r.received}</td>
                      <td className="px-3 py-2.5">{r.rejected}</td>
                      <td className="px-3 py-2.5 font-semibold">{r.fulfilRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
