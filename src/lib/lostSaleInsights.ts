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
  fixes: TopFix[];
}

/** Ranks the three most costly problems for the last 7 days. */
export function computeTopFixes(
  entries: InsightEntry[],
  followUps: InsightFollowUp[] = [],
  now: Date = new Date(),
): TopFixesResult {
  const end = now;
  const start = new Date(end.getTime() - WEEK_MS);
  const prevStart = new Date(start.getTime() - WEEK_MS);

  const inWindow = entries.filter(e => {
    const d = new Date(e.created_at);
    return d >= start && d <= end;
  });
  const prevWindow = entries.filter(e => {
    const d = new Date(e.created_at);
    return d >= prevStart && d < start;
  });

  const avgValue = avgRecoveredValue(followUps);
  const total = inWindow.length;

  const dims: Array<{ kind: FixKind; get: (e: InsightEntry) => string | null | undefined }> = [
    { kind: 'reason', get: e => e.categories?.name },
    { kind: 'shop', get: e => e.shops?.name },
    { kind: 'staff', get: e => e.employee_name },
  ];

  const candidates: TopFix[] = [];

  dims.forEach(({ kind, get }) => {
    const current = tally(inWindow, get);
    const previous = tally(prevWindow, get);
    Object.entries(current)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .forEach(([label, count]) => {
        const change = pctChange(count, previous[label] || 0);
        candidates.push({
          kind,
          label,
          count,
          share: total ? count / total : 0,
          changePct: change,
          estimatedValue: count * avgValue,
          headline: headlineFor(kind, label, count),
          action: actionFor(kind, label),
        });
      });
  });

  // Rank by money at stake, then by volume, keeping one entry per dimension first
  const sorted = candidates.sort((a, b) =>
    (b.estimatedValue - a.estimatedValue) || (b.count - a.count),
  );

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

  return { windowStart: start, windowEnd: end, totalVisits: total, avgValue, fixes: picked };
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
