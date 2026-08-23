import { useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetricInfo } from '@/components/MetricInfo';
import { OUTCOME_LABELS, type FollowUpRow } from '@/hooks/useFollowUps';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

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
  const converted = useMemo(() => rows.filter(r => r.outcome === 'converted'), [rows]);
  const recovered = useMemo(() => converted.reduce((s, r) => s + Number(r.recovered_amount || 0), 0), [converted]);
  const conversionRate = rows.length ? (converted.length / rows.length) * 100 : 0;
  const attainment = targetRecovered > 0 ? (recovered / targetRecovered) * 100 : null;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
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
            <TabsTrigger value="all">All follow-ups ({rows.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="entries" className="mt-3 space-y-2">
            {converted.map(r => (
              <div key={r.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">+91 {r.phone}{r.customer_name ? ` · ${r.customer_name}` : ''}</span>
                  <span className="text-sm font-semibold text-emerald-600">{inr(Number(r.recovered_amount || 0))}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(r.sent_at)} · by {r.sent_by_name || 'staff'} · {r.reason_label || 'no reason'} · closed {fmtDate(r.outcome_at)}
                </p>
                {r.outcome_note && <p className="text-xs mt-1 whitespace-pre-wrap">{r.outcome_note}</p>}
              </div>
            ))}
            {converted.length === 0 && <p className="text-sm text-muted-foreground p-3">No conversions in this period.</p>}
          </TabsContent>

          <TabsContent value="staff" className="mt-3">
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
