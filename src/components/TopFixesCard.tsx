import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, TrendingDown, Store, User, Tag, ArrowRight, ListFilter } from 'lucide-react';
import { computeTopFixes, formatINR, type FixKind, type InsightEntry, type InsightFollowUp, type TopFix } from '@/lib/lostSaleInsights';
import { useScoringWeights } from '@/hooks/useScoringWeights';
import { FixDrilldownDialog } from './FixDrilldownDialog';

interface TopFixesCardProps {
  entries: InsightEntry[] | undefined;
  followUps?: InsightFollowUp[];
  /** Opens the dashboard drill-down modal for the clicked dimension */
  onDrill?: (type: 'shop' | 'category' | 'size' | 'customer_type', value: string) => void;
}

const KIND_META: Record<FixKind, { icon: typeof Tag; label: string; accent: string }> = {
  reason: { icon: Tag, label: 'Lost reason', accent: 'from-rose-500/15 to-transparent border-rose-500/30' },
  shop: { icon: Store, label: 'Shop', accent: 'from-amber-500/15 to-transparent border-amber-500/30' },
  staff: { icon: User, label: 'Coaching', accent: 'from-sky-500/15 to-transparent border-sky-500/30' },
};

export const TopFixesCard = ({ entries, followUps = [], onDrill }: TopFixesCardProps) => {
  const { weights } = useScoringWeights();
  const [activeFix, setActiveFix] = useState<TopFix | null>(null);
  const result = useMemo(
    () => computeTopFixes(entries || [], followUps, new Date(), weights),
    [entries, followUps, weights],
  );

  if (!entries || result.fixes.length === 0) return null;

  return (
    <Card className="border-2 border-primary/25 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Target className="h-5 w-5 text-primary" />
            This week's top 3 fixes
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {result.totalVisits} lost visits · last 7 days
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {result.fixes.map((fix, i) => {
          const meta = KIND_META[fix.kind];
          const Icon = meta.icon;
          const drillType = fix.kind === 'reason' ? 'category' : fix.kind === 'shop' ? 'shop' : null;
          return (
            <div
              key={`${fix.kind}-${fix.label}`}
              className={`rounded-xl border bg-gradient-to-br p-3 sm:p-4 ${meta.accent}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background/80 text-sm font-bold">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{meta.label}</span>
                    {fix.changePct !== null && (
                      <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${fix.changePct > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {fix.changePct > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {Math.abs(fix.changePct)}% vs last week
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold leading-snug break-words">{fix.headline}</p>
                  <p className="text-xs text-muted-foreground break-words">{fix.action}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="outline" className="text-xs">
                      {Math.round(fix.share * 100)}% of lost visits
                    </Badge>
                    {fix.estimatedValue > 0 && (
                      <Badge variant="outline" className="text-xs">
                        ~{formatINR(fix.estimatedValue)} recoverable
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">score {fix.score}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => setActiveFix(fix)}
                    >
                      <ListFilter className="h-3 w-3" /> Why &amp; export
                    </Button>
                    {drillType && onDrill && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => onDrill(drillType, fix.label)}
                      >
                        View visits <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {result.avgValue === 0 && (
          <p className="text-xs text-muted-foreground">
            Log recovered amounts on follow-ups to see the money value of each fix.
          </p>
        )}
      </CardContent>

      <FixDrilldownDialog
        open={!!activeFix}
        onOpenChange={(v) => { if (!v) setActiveFix(null); }}
        fix={activeFix}
        entries={entries}
        windowStart={result.windowStart}
        windowEnd={result.windowEnd}
      />
    </Card>
  );
};
