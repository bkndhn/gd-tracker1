import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PackageSearch, TrendingUp, TrendingDown, ArrowRight, FileSpreadsheet, FileText } from 'lucide-react';
import { formatISTDate } from '@/lib/dateUtils';
import { computeStockGaps, type InsightEntry } from '@/lib/lostSaleInsights';
import { buildStockGapTable, exportTableToExcel, exportTableToPDF } from '@/lib/insightExports';
import { useExportTemplate } from '@/hooks/useExportTemplate';

interface StockGapReportProps {
  entries: InsightEntry[] | undefined;
  onDrill?: (type: 'shop' | 'category' | 'size' | 'customer_type', value: string) => void;
}

const RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

export const StockGapReport = ({ entries, onDrill }: StockGapReportProps) => {
  const [days, setDays] = useState(30);
  const { template } = useExportTemplate();
  const result = useMemo(() => computeStockGaps(entries || [], days), [entries, days]);

  if (!entries || result.rows.length === 0) return null;

  return (
    <Card className="border-2 border-emerald-500/25">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <PackageSearch className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Stock &amp; size gap report
          </CardTitle>
          <div className="flex items-center gap-1">
            {RANGES.map(r => (
              <Button
                key={r.days}
                size="sm"
                variant={days === r.days ? 'default' : 'outline'}
                className="h-7 px-2 text-xs"
                onClick={() => setDays(r.days)}
              >
                {r.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => exportTableToExcel(buildStockGapTable(result.rows, days), template)}
            >
              <FileSpreadsheet className="h-3 w-3" /> Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => exportTableToPDF(buildStockGapTable(result.rows, days), template)}
            >
              <FileText className="h-3 w-3" /> PDF
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {result.totalGapVisits} visits analysed · {Math.round(result.gapShare * 100)}% of the period. Restock the
          combinations at the top first.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top categories</p>
            <div className="flex flex-wrap gap-1.5">
              {result.topCategories.map(c => (
                <Badge key={c.name} variant="secondary" className="text-xs">{c.name} · {c.count}</Badge>
              ))}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top sizes</p>
            <div className="flex flex-wrap gap-1.5">
              {result.topSizes.map(s => (
                <Badge key={s.name} variant="secondary" className="text-xs">{s.name} · {s.count}</Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto overflow-y-auto max-h-[360px] rounded-xl border border-border/80 bg-card shadow-xs touch-pan-x overscroll-x-contain -webkit-overflow-scrolling-touch">
          <div className="min-w-[520px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs">Size</TableHead>
                  <TableHead className="text-xs">Misses</TableHead>
                  <TableHead className="text-xs">Trend</TableHead>
                  <TableHead className="text-xs">Shops</TableHead>
                  <TableHead className="text-xs">Last seen</TableHead>
                  <TableHead className="text-xs" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.slice(0, 25).map(row => (
                  <TableRow key={`${row.category}-${row.size}`}>
                    <TableCell className="text-sm font-medium">{row.category}</TableCell>
                    <TableCell className="text-sm">{row.size}</TableCell>
                    <TableCell className="text-sm font-semibold">{row.count}</TableCell>
                    <TableCell className="text-xs">
                      {row.trend === null ? (
                        <span className="text-muted-foreground">new</span>
                      ) : (
                        <span className={`inline-flex items-center gap-0.5 font-semibold ${row.trend > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {row.trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {Math.abs(row.trend)}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                      {row.shops.join(', ') || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatISTDate(row.lastSeen)}
                    </TableCell>
                    <TableCell>
                      {onDrill && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => onDrill('size', row.size)}
                        >
                          View <ArrowRight className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
