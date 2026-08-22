import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSpreadsheet, FileText, IndianRupee, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { exportTableToExcel, exportTableToPDF, type SheetTable } from '@/lib/insightExports';
import { useExportTemplate } from '@/hooks/useExportTemplate';
import type { FollowUpRow, ShopTarget } from '@/hooks/useFollowUps';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

type Dimension = 'staff' | 'shop' | 'template';

export interface AttributionRow {
  key: string;
  label: string;
  sent: number;
  replied: number;
  converted: number;
  recovered: number;
  conversionRate: number;
  avgRecovered: number;
  share: number;
  targetRecovered: number;
  attainment: number | null;
}

const TEMPLATE_LABELS: Record<string, string> = {
  price: 'Price objection',
  size: 'Size / fit',
  stock: 'Out of stock',
  quality: 'Quality concern',
  service: 'Service issue',
  generic: 'General follow-up',
};

/** Buckets follow-ups into attribution rows for one dimension. */
export function buildAttribution(
  rows: FollowUpRow[],
  dimension: Dimension,
  targets: ShopTarget[],
  monthKey: string,
): AttributionRow[] {
  const map = new Map<string, AttributionRow>();
  const totalRecovered = rows.reduce((s, r) => s + Number(r.recovered_amount || 0), 0);

  rows.forEach(r => {
    let key: string;
    let label: string;
    if (dimension === 'staff') {
      key = r.sent_by;
      label = r.sent_by_name || 'Unknown staff';
    } else if (dimension === 'shop') {
      key = r.shop_id || r.shop_name || 'unknown';
      label = r.shop_name || 'Unknown shop';
    } else {
      key = r.template_key || 'generic';
      label = TEMPLATE_LABELS[key] || key;
    }

    const cur = map.get(key) || {
      key, label, sent: 0, replied: 0, converted: 0, recovered: 0,
      conversionRate: 0, avgRecovered: 0, share: 0, targetRecovered: 0, attainment: null,
    };
    cur.sent += 1;
    if (r.outcome === 'replied' || r.outcome === 'converted') cur.replied += 1;
    if (r.outcome === 'converted') {
      cur.converted += 1;
      cur.recovered += Number(r.recovered_amount || 0);
    }
    map.set(key, cur);
  });

  return Array.from(map.values())
    .map(v => {
      const t = dimension === 'shop'
        ? targets.find(t => t.shop_id === v.key && String(t.period_month).slice(0, 7) === monthKey.slice(0, 7))
        : undefined;
      const targetRecovered = Number(t?.target_recovered ?? 0);
      return {
        ...v,
        conversionRate: v.sent ? (v.converted / v.sent) * 100 : 0,
        avgRecovered: v.converted ? v.recovered / v.converted : 0,
        share: totalRecovered ? (v.recovered / totalRecovered) * 100 : 0,
        targetRecovered,
        attainment: targetRecovered > 0 ? (v.recovered / targetRecovered) * 100 : null,
      };
    })
    .sort((a, b) => b.recovered - a.recovered || b.converted - a.converted);
}

const DIM_LABEL: Record<Dimension, string> = {
  staff: 'Staff member',
  shop: 'Shop',
  template: 'Message template',
};

/**
 * Recovered-revenue attribution: which staff, shop and message template
 * actually brings lost customers back — the renewal-justifying number.
 */
export const RecoveryAttributionPanel = ({
  rows,
  targets,
  monthKey,
}: {
  rows: FollowUpRow[];
  targets: ShopTarget[];
  monthKey: string;
}) => {
  const { template } = useExportTemplate();
  const [period, setPeriod] = useState<'30' | '90' | 'month' | 'all'>('90');

  const months = useMemo(() => {
    const now = new Date();
    return { start: new Date(now.getFullYear(), now.getMonth(), 1).getTime() };
  }, []);

  const scoped = useMemo(() => {
    if (period === 'all') return rows;
    const cutoff = period === 'month'
      ? months.start
      : Date.now() - Number(period) * 86400000;
    return rows.filter(r => new Date(r.sent_at).getTime() >= cutoff);
  }, [rows, period, months.start]);

  const periodLabel = period === 'all'
    ? 'All time'
    : period === 'month'
      ? new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      : `Last ${period} days`;

  const totals = useMemo(() => {
    const recovered = scoped.reduce((s, r) => s + (r.outcome === 'converted' ? Number(r.recovered_amount || 0) : 0), 0);
    const converted = scoped.filter(r => r.outcome === 'converted').length;
    return { recovered, converted, sent: scoped.length };
  }, [scoped]);

  const tables = useMemo(() => ({
    staff: buildAttribution(scoped, 'staff', targets, monthKey),
    shop: buildAttribution(scoped, 'shop', targets, monthKey),
    template: buildAttribution(scoped, 'template', targets, monthKey),
  }), [scoped, targets, monthKey]);

  const toSheet = (dim: Dimension): SheetTable => ({
    title: `Recovered revenue by ${DIM_LABEL[dim].toLowerCase()}`,
    subtitle: `${periodLabel} · ${totals.sent} follow-ups · ${inr(totals.recovered)} recovered`,
    dateRange: periodLabel,
    columns: [DIM_LABEL[dim], 'Sent', 'Replied', 'Converted', 'Conversion %', 'Recovered', 'Avg / conversion', 'Share %', 'Target', 'Attainment %'],
    rows: tables[dim].map(r => [
      r.label, r.sent, r.replied, r.converted,
      Number(r.conversionRate.toFixed(1)),
      Math.round(r.recovered),
      Math.round(r.avgRecovered),
      Number(r.share.toFixed(1)),
      r.targetRecovered ? Math.round(r.targetRecovered) : '—',
      r.attainment === null ? '—' : Number(r.attainment.toFixed(0)),
    ]),
    fileName: `recovered-revenue-${dim}-${new Date().toISOString().slice(0, 10)}`,
  });

  const doExport = (dim: Dimension, kind: 'excel' | 'pdf') => {
    if (tables[dim].length === 0) { toast.error('Nothing to export yet'); return; }
    try {
      const sheet = toSheet(dim);
      if (kind === 'excel') exportTableToExcel(sheet, template);
      else exportTableToPDF(sheet, template);
    } catch (e: any) {
      toast.error(e?.message || 'Export failed');
    }
  };

  const renderTable = (dim: Dimension) => {
    const data = tables[dim];
    const max = data[0]?.recovered || 0;
    return (
      <Card className="premium-card">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" /> Recovered revenue by {DIM_LABEL[dim].toLowerCase()}
            </CardTitle>
            <CardDescription>{periodLabel} · {inr(totals.recovered)} recovered from {totals.converted} conversions.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => doExport(dim, 'excel')}>
              <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Excel
            </Button>
            <Button size="sm" variant="outline" onClick={() => doExport(dim, 'pdf')}>
              <FileText className="h-4 w-4 mr-1.5" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">{DIM_LABEL[dim]}</th>
                  <th className="p-2 text-right">Sent</th>
                  <th className="p-2 text-right">Converted</th>
                  <th className="p-2 text-right">Conv %</th>
                  <th className="p-2 text-right">Recovered</th>
                  <th className="p-2 text-right">Avg</th>
                  <th className="p-2 text-right">Share</th>
                  {dim === 'shop' && <th className="p-2 text-right">Target</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={r.key} className="border-t">
                    <td className="p-2">
                      <div className="font-medium truncate max-w-[180px]">{i + 1}. {r.label}</div>
                      <div className="mt-1 h-1.5 w-full max-w-[180px] rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${max ? (r.recovered / max) * 100 : 0}%` }} />
                      </div>
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">{r.sent}</td>
                    <td className="p-2 text-right whitespace-nowrap">{r.converted}</td>
                    <td className="p-2 text-right whitespace-nowrap">{r.conversionRate.toFixed(0)}%</td>
                    <td className="p-2 text-right whitespace-nowrap font-semibold">{inr(r.recovered)}</td>
                    <td className="p-2 text-right whitespace-nowrap">{r.converted ? inr(r.avgRecovered) : '—'}</td>
                    <td className="p-2 text-right whitespace-nowrap">{r.share.toFixed(0)}%</td>
                    {dim === 'shop' && (
                      <td className="p-2 text-right whitespace-nowrap">
                        {r.attainment === null ? '—' : (
                          <Badge
                            variant="outline"
                            className={r.attainment >= 100
                              ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-600 border-amber-500/30'}
                          >
                            {r.attainment.toFixed(0)}% of {inr(r.targetRecovered)}
                          </Badge>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={dim === 'shop' ? 8 : 7} className="p-6 text-center text-muted-foreground">No follow-ups in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-3 w-full min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IndianRupee className="h-4 w-4" /> Attribution period
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="staff">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="staff">By staff</TabsTrigger>
          <TabsTrigger value="shop">By shop</TabsTrigger>
          <TabsTrigger value="template">By template</TabsTrigger>
        </TabsList>
        <TabsContent value="staff" className="mt-3">{renderTable('staff')}</TabsContent>
        <TabsContent value="shop" className="mt-3">{renderTable('shop')}</TabsContent>
        <TabsContent value="template" className="mt-3">{renderTable('template')}</TabsContent>
      </Tabs>
    </div>
  );
};
