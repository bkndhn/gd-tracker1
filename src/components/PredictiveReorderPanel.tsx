import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  PackagePlus,
  FileSpreadsheet,
  FileText,
  Download,
  Clock,
  CheckCircle2,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  ArrowLeftRight,
} from 'lucide-react';
import { usePredictiveDemand } from '@/hooks/usePredictiveDemand';
import { useExportTemplate } from '@/hooks/useExportTemplate';
import { exportTableToExcel, exportTableToPDF, exportTableToCSV } from '@/lib/insightExports';
import type { InsightEntry } from '@/lib/lostSaleInsights';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  entries?: InsightEntry[];
}

const RANGES = [
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
];

export const PredictiveReorderPanel = ({ entries }: Props) => {
  const { isSuperAdmin, isAdmin, isManager } = useAuth();
  const { template } = useExportTemplate();
  const {
    items,
    summary,
    availableCategories,
    windowDays,
    setWindowDays,
    leadTimeDays,
    setLeadTimeDays,
    categoryFilter,
    setCategoryFilter,
    severityFilter,
    setSeverityFilter,
    raiseRestockRequirement,
    buildPurchaseOrderSheet,
  } = usePredictiveDemand(entries);

  const [raisingId, setRaisingId] = useState<string | null>(null);

  const handleRaise = async (item: any) => {
    setRaisingId(item.id);
    try {
      await raiseRestockRequirement(item);
    } finally {
      setRaisingId(null);
    }
  };

  const handleExportExcel = () => {
    const sheet = buildPurchaseOrderSheet();
    exportTableToExcel(sheet, template);
  };

  const handleExportPDF = () => {
    const sheet = buildPurchaseOrderSheet();
    exportTableToPDF(sheet, template);
  };

  const handleExportCSV = () => {
    const sheet = buildPurchaseOrderSheet();
    exportTableToCSV(sheet, template);
  };

  return (
    <Card className="border-2 border-primary/25 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
      <CardHeader className="pb-3 space-y-3">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Predictive AI Demand &amp; Re-Order Intelligence
            </CardTitle>
            <CardDescription className="text-xs">
              Algorithmic forecasting analyzing lost counter sales, warehouse inventory velocity, and depletion runways.
            </CardDescription>
          </div>

          {/* Export Actions */}
          <div className="grid grid-cols-3 sm:flex items-center gap-1.5 w-full sm:w-auto">
            <Button size="sm" variant="outline" className="h-8 gap-1 px-2.5 text-xs rounded-xl justify-center font-medium shadow-2xs hover:bg-emerald-50 dark:hover:bg-emerald-950/30" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span className="sm:inline">Excel</span>
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1 px-2.5 text-xs rounded-xl justify-center font-medium shadow-2xs hover:bg-red-50 dark:hover:bg-red-950/30" onClick={handleExportPDF}>
              <FileText className="h-3.5 w-3.5 text-red-600 shrink-0" />
              <span className="sm:inline">PDF</span>
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1 px-2.5 text-xs rounded-xl justify-center font-medium shadow-2xs" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span className="sm:inline">CSV</span>
            </Button>
          </div>
        </div>

        {/* Responsive Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {/* Horizon Selector */}
            <div className="grid grid-cols-4 sm:flex rounded-xl border bg-muted/70 p-1 w-full sm:w-auto gap-0.5">
              {RANGES.map((r) => (
                <Button
                  key={r.days}
                  size="sm"
                  variant={windowDays === r.days ? 'secondary' : 'ghost'}
                  className={`h-7.5 text-xs px-2 sm:px-2.5 font-medium rounded-lg justify-center transition-all ${
                    windowDays === r.days ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setWindowDays(r.days)}
                >
                  {r.label}
                </Button>
              ))}
            </div>

            {/* Category Filter */}
            {availableCategories.length > 0 && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-7 w-[140px] text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories ({availableCategories.length})</SelectItem>
                  {availableCategories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Severity Filter */}
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="h-7 w-[120px] text-xs">
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="CRITICAL">Critical Only ({summary.criticalCount})</SelectItem>
                <SelectItem value="WARNING">Warning Only ({summary.warningCount})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Supplier Lead Time Config */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Supplier Lead Time:</span>
            <Select value={String(leadTimeDays)} onValueChange={(v) => setLeadTimeDays(Number(v))}>
              <SelectTrigger className="h-7 w-[90px] text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 Days</SelectItem>
                <SelectItem value="5">5 Days</SelectItem>
                <SelectItem value="7">7 Days</SelectItem>
                <SelectItem value="10">10 Days</SelectItem>
                <SelectItem value="14">14 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border bg-card/60 p-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Critical Stockouts</span>
              <ShieldAlert className="h-4 w-4 text-rose-500" />
            </div>
            <p className="text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">
              {summary.criticalCount} SKUs
            </p>
          </div>

          <div className="rounded-lg border bg-card/60 p-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Est. Revenue at Risk</span>
              <TrendingUp className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">
              ₹{summary.totalRevenueAtRisk.toLocaleString('en-IN')}
            </p>
          </div>

          <div className="rounded-lg border bg-card/60 p-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Recommended Re-order</span>
              <PackagePlus className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xl font-bold mt-1 text-foreground">
              {summary.totalUnitsToReorder} units
            </p>
          </div>

          <div className="rounded-lg border bg-card/60 p-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Highest Demand Spike</span>
              <Sparkles className="h-4 w-4 text-violet-500" />
            </div>
            <p className="text-sm font-bold mt-1 truncate" title={`${summary.topSpikeCategory} - Size ${summary.topSpikeSize}`}>
              {summary.topSpikeCategory} ({summary.topSpikeSize})
            </p>
          </div>
        </div>

        {/* Mobile Touch Swipe Indicator */}
        <div className="sm:hidden flex items-center justify-between px-2.5 py-1 text-[11px] font-medium text-muted-foreground bg-muted/40 rounded-lg border border-border/50">
          <span className="flex items-center gap-1.5">
            <ArrowLeftRight className="h-3 w-3 text-violet-600 animate-pulse" />
            Swipe table horizontally to view all forecasting columns
          </span>
          <span className="text-[10px] text-violet-600 font-semibold">Touch scroll</span>
        </div>

        {/* Predictive Recommendations Table */}
        <div className="w-full overflow-x-auto overflow-y-auto max-h-[500px] rounded-xl border border-border/80 bg-card shadow-xs touch-pan-x overscroll-x-contain -webkit-overflow-scrolling-touch">
          <div className="min-w-[850px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold text-xs">Category &amp; Size</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Lost Demand</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Daily Velocity</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Warehouse Avail.</TableHead>
                  <TableHead className="font-semibold text-xs">Depletion Runway</TableHead>
                  <TableHead className="font-semibold text-xs">Status</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Recommended Re-Order</TableHead>
                  <TableHead className="font-semibold text-xs text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm py-8 text-muted-foreground">
                      No demand depletion risks detected for this selection.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => {
                    const isCritical = item.severity === 'CRITICAL';
                    const isWarning = item.severity === 'WARNING';

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs">
                          <div>
                            <span className="font-bold text-foreground">{item.category}</span>
                            <span className="ml-1.5 font-semibold text-primary">Size {item.size}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            Likelihood: {item.conversionLikelihood}% · Est. Risk: ₹{item.estimatedRevenueAtRisk.toLocaleString('en-IN')}
                          </span>
                        </TableCell>

                        <TableCell className="text-xs text-right font-medium">
                          {item.recentRequests} req
                        </TableCell>

                        <TableCell className="text-xs text-right font-semibold">
                          {item.dailyVelocity.toFixed(2)}/day
                        </TableCell>

                        <TableCell className="text-xs text-right">
                          <span className={item.availableStock === 0 ? 'text-rose-600 font-bold' : 'font-medium'}>
                            {item.availableStock}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({item.currentOnHand} on hand)
                          </span>
                        </TableCell>

                        <TableCell className="text-xs">
                          {item.depletionRunwayDays <= 0 ? (
                            <Badge variant="destructive" className="text-[10px] py-0 px-1.5 font-semibold">
                              Stockout Now
                            </Badge>
                          ) : item.depletionRunwayDays <= 2 ? (
                            <Badge variant="destructive" className="text-[10px] py-0 px-1.5 font-semibold">
                              &lt; {item.depletionRunwayDays} days
                            </Badge>
                          ) : item.depletionRunwayDays <= 7 ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-400 text-[10px] py-0 px-1.5">
                              {item.depletionRunwayDays} days
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">{item.depletionRunwayDays} days</span>
                          )}
                        </TableCell>

                        <TableCell className="text-xs">
                          {isCritical ? (
                            <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[10px] py-0 font-semibold">
                              Critical Shortage
                            </Badge>
                          ) : isWarning ? (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] py-0 font-semibold">
                              Re-order Warning
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] py-0 font-normal">
                              Monitor
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-xs text-right font-bold text-primary">
                          {item.recommendedReorderQty > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                              +{item.recommendedReorderQty} pcs
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-normal">0 pcs</span>
                          )}
                        </TableCell>

                        <TableCell className="text-xs text-center">
                          {item.recommendedReorderQty > 0 ? (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 px-2 text-[11px] gap-1 font-semibold shadow-xs"
                              disabled={raisingId === item.id}
                              onClick={() => handleRaise(item)}
                            >
                              <PackagePlus className="h-3 w-3" />
                              {raisingId === item.id ? 'Raising...' : 'Raise Restock'}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">Sufficient</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
