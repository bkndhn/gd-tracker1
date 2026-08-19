/**
 * Insight helpers that turn raw non-purchase visits + follow-up outcomes into
 * ranked, actionable recommendations (weekly "Top 3 fixes" and stock/size gaps).
 */

export interface InsightEntry {
  id: string;
  created_at: string;
  shop_id?: string | null;
  shops?: { name: string } | null;
  categories?: { name: string } | null;
  sizes?: { size: string } | null;
  customer_types?: { name: string } | null;
  employee_name?: string | null;
}

export interface InsightFollowUp {
  reason_label?: string | null;
  shop_name?: string | null;
  outcome: string;
  recovered_amount: number;
  sent_by_name?: string | null;
}

export type FixKind = 'reason' | 'shop' | 'staff';

/** One line of the "why is this ranked here" explanation. */
export interface ScoreComponent {
  key: 'volume' | 'value' | 'trend' | 'recency';
  label: string;
  /** Raw measured number (visits, rupees, % change, days) */
  raw: number;
  /** 0-1 normalised score across the candidates in this window */
  normalized: number;
  weight: number;
  /** normalized * weight */
  contribution: number;
  explanation: string;
}

/**
 * Tunable scoring model. Admins can change these weights so the ranking matches
 * how their business thinks about a "costly" problem.
 */
export interface ScoringWeights {
  /** How much raw visit volume matters */
  volume: number;
  /** How much estimated recoverable rupees matter */
  value: number;
  /** How much a week-on-week increase matters */
  trend: number;
  /** How much "it happened recently" matters */
  recency: number;
  /** Per-dimension multipliers so an admin can bias towards shops or coaching */
  kindMultiplier: Record<FixKind, number>;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  volume: 40,
  value: 30,
  trend: 20,
  recency: 10,
  kindMultiplier: { reason: 1, shop: 1, staff: 1 },
};

export function normalizeWeights(input: Partial<ScoringWeights> | null | undefined): ScoringWeights {
  const w = input || {};
  const num = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    volume: num(w.volume, DEFAULT_SCORING_WEIGHTS.volume),
    value: num(w.value, DEFAULT_SCORING_WEIGHTS.value),
    trend: num(w.trend, DEFAULT_SCORING_WEIGHTS.trend),
    recency: num(w.recency, DEFAULT_SCORING_WEIGHTS.recency),
    kindMultiplier: {
      reason: num(w.kindMultiplier?.reason, 1),
      shop: num(w.kindMultiplier?.shop, 1),
      staff: num(w.kindMultiplier?.staff, 1),
    },
  };
}

export interface TopFix {
  kind: FixKind;
  /** The dimension value, e.g. "Price too high" or "MG Road" */
  label: string;
  /** Visits in the window attributed to this item */
  count: number;
  /** Share of the window's visits (0-1) */
  share: number;
  /** Change vs the previous window, in percent (null when no baseline) */
  changePct: number | null;
  /** Estimated recoverable value (INR) based on realised recovery per visit */
  estimatedValue: number;
  /** Average age in days of the visits behind this fix */
  avgAgeDays: number;
  /** Weighted score used for ranking (higher = more urgent) */
  score: number;
  /** Human-readable breakdown of the score */
  breakdown: ScoreComponent[];
  headline: string;
  action: string;
}

const WEEK_MS = 7 * 86400000;

function tally<T>(items: T[], key: (item: T) => string | undefined | null) {
  const map: Record<string, number> = {};
  items.forEach(item => {
    const k = (key(item) || '').trim();
    if (!k || k === 'Unknown') return;
    map[k] = (map[k] || 0) + 1;
  });
  return map;
}

function pctChange(current: number, previous: number): number | null {
  if (!previous) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Average revenue recovered per converted follow-up. Used as the money proxy
 * when estimating what a lost reason is costing. Falls back to 0 when the
 * tenant has not logged any recovered amounts yet.
 */
export function avgRecoveredValue(followUps: InsightFollowUp[]): number {
  const converted = followUps.filter(f => f.outcome === 'converted' && Number(f.recovered_amount) > 0);
  if (converted.length === 0) return 0;
  const sum = converted.reduce((s, f) => s + Number(f.recovered_amount || 0), 0);
  return Math.round(sum / converted.length);
}

export interface TopFixesResult {
  windowStart: Date;
  windowEnd: Date;
  totalVisits: number;
  avgValue: number;
  weights: ScoringWeights;
  fixes: TopFix[];
}

/** Accessor used to attribute an entry to a dimension value. */
export const FIX_DIMENSION: Record<FixKind, (e: InsightEntry) => string | null | undefined> = {
  reason: e => e.categories?.name,
  shop: e => e.shops?.name,
  staff: e => e.employee_name,
};

/** Entries behind a given fix, newest first — used by the drill-down view. */
export function entriesForFix(
  entries: InsightEntry[],
  fix: Pick<TopFix, 'kind' | 'label'>,
  windowStart?: Date,
  windowEnd?: Date,
): InsightEntry[] {
  const get = FIX_DIMENSION[fix.kind];
  return entries
    .filter(e => (get(e) || '').trim() === fix.label)
    .filter(e => {
      const d = new Date(e.created_at);
      if (windowStart && d < windowStart) return false;
      if (windowEnd && d > windowEnd) return false;
      return true;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/** Ranks the three most costly problems for the last 7 days. */
export function computeTopFixes(
  entries: InsightEntry[],
  followUps: InsightFollowUp[] = [],
  now: Date = new Date(),
  weightsInput: Partial<ScoringWeights> = DEFAULT_SCORING_WEIGHTS,
): TopFixesResult {
  const weights = normalizeWeights(weightsInput);
  const end = now;
  const start = new Date(end.getTime() - WEEK_MS);
  const prevStart = new Date(start.getTime() - WEEK_MS);

  const valid = entries.filter(e => !Number.isNaN(new Date(e.created_at).getTime()));

  const inWindow = valid.filter(e => {
    const d = new Date(e.created_at);
    return d >= start && d <= end;
  });
  const prevWindow = valid.filter(e => {
    const d = new Date(e.created_at);
    return d >= prevStart && d < start;
  });

  const avgValue = avgRecoveredValue(followUps);
  const total = inWindow.length;

  type Raw = Omit<TopFix, 'score' | 'breakdown'>;
  const raws: Raw[] = [];

  (Object.keys(FIX_DIMENSION) as FixKind[]).forEach(kind => {
    const get = FIX_DIMENSION[kind];
    const current = tally(inWindow, get);
    const previous = tally(prevWindow, get);
    Object.entries(current)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .forEach(([label, count]) => {
        const own = inWindow.filter(e => (get(e) || '').trim() === label);
        const avgAgeDays = own.length
          ? own.reduce((s, e) => s + (end.getTime() - new Date(e.created_at).getTime()), 0) /
            own.length / 86400000
          : 7;
        raws.push({
          kind,
          label,
          count,
          share: total ? count / total : 0,
          changePct: pctChange(count, previous[label] || 0),
          estimatedValue: count * avgValue,
          avgAgeDays: Math.max(0, avgAgeDays),
          headline: headlineFor(kind, label, count),
          action: actionFor(kind, label),
        });
      });
  });

  const max = (fn: (r: Raw) => number) => raws.reduce((m, r) => Math.max(m, fn(r)), 0);
  const maxCount = max(r => r.count);
  const maxValue = max(r => r.estimatedValue);
  const maxTrend = max(r => Math.max(0, r.changePct ?? 0));

  const candidates: TopFix[] = raws.map(r => {
    const parts: ScoreComponent[] = [
      {
        key: 'volume',
        label: 'Volume',
        raw: r.count,
        normalized: maxCount ? r.count / maxCount : 0,
        weight: weights.volume,
        contribution: 0,
        explanation: `${r.count} lost visits vs the busiest item this week (${maxCount}).`,
      },
      {
        key: 'value',
        label: 'Money at stake',
        raw: r.estimatedValue,
        normalized: maxValue ? r.estimatedValue / maxValue : 0,
        weight: weights.value,
        contribution: 0,
        explanation: avgValue
          ? `${r.count} visits × ${formatINR(avgValue)} average recovered per converted follow-up.`
          : 'No recovered amounts logged yet, so money impact scores 0.',
      },
      {
        key: 'trend',
        label: 'Getting worse',
        raw: r.changePct ?? 0,
        normalized: maxTrend ? Math.max(0, r.changePct ?? 0) / maxTrend : 0,
        weight: weights.trend,
        contribution: 0,
        explanation:
          r.changePct === null
            ? 'New this week — no previous week to compare against.'
            : `${r.changePct > 0 ? 'Up' : 'Down'} ${Math.abs(r.changePct)}% vs last week.`,
      },
      {
        key: 'recency',
        label: 'Recency',
        raw: Number(r.avgAgeDays.toFixed(1)),
        normalized: Math.max(0, Math.min(1, 1 - r.avgAgeDays / 7)),
        weight: weights.recency,
        contribution: 0,
        explanation: `These visits happened ${r.avgAgeDays.toFixed(1)} days ago on average.`,
      },
    ].map(p => ({ ...p, contribution: p.normalized * p.weight }));

    const base = parts.reduce((s, p) => s + p.contribution, 0);
    return {
      ...r,
      breakdown: parts,
      score: Math.round(base * (weights.kindMultiplier[r.kind] ?? 1) * 100) / 100,
    };
  });

  const sorted = candidates.sort((a, b) => (b.score - a.score) || (b.count - a.count));

  const picked: TopFix[] = [];
  const seenKinds = new Set<FixKind>();
  sorted.forEach(fix => {
    if (picked.length >= 3) return;
    if (seenKinds.has(fix.kind)) return;
    seenKinds.add(fix.kind);
    picked.push(fix);
  });
  sorted.forEach(fix => {
    if (picked.length >= 3) return;
    if (picked.includes(fix)) return;
    picked.push(fix);
  });

  return { windowStart: start, windowEnd: end, totalVisits: total, avgValue, weights, fixes: picked };
}


function headlineFor(kind: FixKind, label: string, count: number): string {
  switch (kind) {
    case 'reason':
      return `"${label}" drove ${count} lost ${count === 1 ? 'visit' : 'visits'}`;
    case 'shop':
      return `${label} lost ${count} ${count === 1 ? 'visitor' : 'visitors'}`;
    case 'staff':
      return `${label} logged ${count} non-purchase ${count === 1 ? 'visit' : 'visits'}`;
  }
}

function actionFor(kind: FixKind, label: string): string {
  switch (kind) {
    case 'reason':
      if (/price|cost|expensive|budget/i.test(label)) return 'Approve a limited discount slab or bundle offer this week.';
      if (/stock|size|out of|availability/i.test(label)) return 'Raise a purchase indent for the missing sizes and set a restock date.';
      if (/design|style|colou?r|model/i.test(label)) return 'Share the requested styles with buying and add a pre-order option.';
      if (/service|staff|wait|rude|slow/i.test(label)) return 'Run a 15-minute floor briefing on greeting and response time.';
      return `Review recent visits tagged "${label}" and assign an owner to fix the root cause.`;
    case 'shop':
      return `Call ${label} for a daily huddle and set a recovery target for this week.`;
    case 'staff':
      return `Coach ${label} on objection handling and review their last 5 lost visits together.`;
  }
}

export interface StockGapRow {
  category: string;
  size: string;
  count: number;
  shops: string[];
  lastSeen: string;
  trend: number | null;
}

export interface StockGapResult {
  rows: StockGapRow[];
  totalGapVisits: number;
  gapShare: number;
  topCategories: Array<{ name: string; count: number }>;
  topSizes: Array<{ name: string; count: number }>;
}

const GAP_PATTERN = /stock|size|out of|availability|not available|unavailab/i;

/**
 * Aggregates recurring size/stock-driven losses so buying teams know exactly
 * which category + size combinations to replenish.
 */
export function computeStockGaps(
  entries: InsightEntry[],
  days = 30,
  now: Date = new Date(),
): StockGapResult {
  const start = new Date(now.getTime() - days * 86400000);
  const prevStart = new Date(start.getTime() - days * 86400000);

  const isGap = (e: InsightEntry) =>
    GAP_PATTERN.test(e.categories?.name || '') || GAP_PATTERN.test(e.customer_types?.name || '');

  const windowEntries = entries.filter(e => new Date(e.created_at) >= start);
  // When the tenant does not tag stock reasons explicitly, fall back to all
  // visits so the size distribution still guides purchasing.
  const gapEntries = windowEntries.filter(isGap);
  const basis = gapEntries.length > 0 ? gapEntries : windowEntries;

  const prevBasis = entries.filter(e => {
    const d = new Date(e.created_at);
    if (!(d >= prevStart && d < start)) return false;
    return gapEntries.length > 0 ? isGap(e) : true;
  });

  const key = (e: InsightEntry) => `${e.categories?.name || 'Unknown'}|||${e.sizes?.size || 'Unknown'}`;
  const prevCounts = tally(prevBasis, key);

  const grouped: Record<string, StockGapRow> = {};
  basis.forEach(e => {
    const category = e.categories?.name || 'Unknown';
    const size = e.sizes?.size || 'Unknown';
    if (category === 'Unknown' && size === 'Unknown') return;
    const k = `${category}|||${size}`;
    const row = (grouped[k] ||= {
      category,
      size,
      count: 0,
      shops: [],
      lastSeen: e.created_at,
      trend: null,
    });
    row.count += 1;
    const shop = e.shops?.name;
    if (shop && shop !== 'Unknown' && !row.shops.includes(shop)) row.shops.push(shop);
    if (new Date(e.created_at) > new Date(row.lastSeen)) row.lastSeen = e.created_at;
  });

  const rows = Object.entries(grouped)
    .map(([k, row]) => ({ ...row, trend: pctChange(row.count, prevCounts[k] || 0) }))
    .sort((a, b) => b.count - a.count);

  const catMap = tally(basis, e => e.categories?.name);
  const sizeMap = tally(basis, e => e.sizes?.size);
  const top = (m: Record<string, number>) =>
    Object.entries(m).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, count]) => ({ name, count }));

  return {
    rows,
    totalGapVisits: basis.length,
    gapShare: windowEntries.length ? basis.length / windowEntries.length : 0,
    topCategories: top(catMap),
    topSizes: top(sizeMap),
  };
}

export function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(value || 0));
}
