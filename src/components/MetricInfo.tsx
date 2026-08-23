import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface MetricDefinition {
  title: string;
  what: string;
  formula: string;
  note?: string;
}

/** Canonical definitions for every recovered-revenue metric shown in the UI. */
export const METRIC_DEFS: Record<string, MetricDefinition> = {
  conversionRate: {
    title: 'Conversion rate',
    what: 'Share of follow-ups sent in the period whose outcome was set to "Converted (purchased)".',
    formula: 'conversion % = converted follow-ups ÷ follow-ups sent × 100',
    note: 'Follow-ups still awaiting a reply stay in the denominator, so the rate only rises when an outcome is actually recorded.',
  },
  recovered: {
    title: 'Recovered attribution',
    what: 'Rupees credited to a staff member, shop or template when a lost visit turns into a sale.',
    formula: 'recovered ₹ = Σ recovered_amount of follow-ups where outcome = converted',
    note: 'The full amount is credited to the person who sent the message (sent_by), the shop stored on the follow-up, and the template used. No splitting — one follow-up, one owner.',
  },
  share: {
    title: 'Share of total',
    what: 'How much of all recovered rupees in the selected period this row is responsible for.',
    formula: 'share % = row recovered ₹ ÷ total recovered ₹ in period × 100',
  },
  avgRecovered: {
    title: 'Average per conversion',
    what: 'Typical sale value recovered each time a follow-up converts.',
    formula: 'avg ₹ = recovered ₹ ÷ converted follow-ups',
  },
  attainment: {
    title: 'Target attainment',
    what: 'Progress against the monthly recovered-revenue target set for that shop.',
    formula: 'attainment % = recovered ₹ in period ÷ monthly target ₹ × 100',
    note: 'Shows "—" when no target has been set for the shop in the current month.',
  },
  momTrend: {
    title: 'Month-over-month trend',
    what: 'Change in recovered rupees against the immediately preceding period of the same length.',
    formula: 'change % = (current period − previous period) ÷ previous period × 100',
  },
};

/** Small info affordance that explains exactly how a metric is calculated. */
export const MetricInfo = ({ metric, className = '' }: { metric: keyof typeof METRIC_DEFS | string; className?: string }) => {
  const def = METRIC_DEFS[metric as string];
  if (!def) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`How ${def.title} is calculated`}
          className={`inline-flex align-middle text-muted-foreground/70 hover:text-foreground transition-colors ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 text-xs space-y-2">
        <p className="text-sm font-semibold">{def.title}</p>
        <p className="text-muted-foreground">{def.what}</p>
        <code className="block rounded bg-muted px-2 py-1.5 font-mono text-[11px] leading-relaxed">{def.formula}</code>
        {def.note && <p className="text-muted-foreground">{def.note}</p>}
      </PopoverContent>
    </Popover>
  );
};
