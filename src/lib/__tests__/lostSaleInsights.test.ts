import { describe, expect, it } from 'vitest';
import {
  avgRecoveredValue,
  computeStockGaps,
  computeTopFixes,
  entriesForFix,
  formatINR,
  normalizeWeights,
  DEFAULT_SCORING_WEIGHTS,
  type InsightEntry,
  type InsightFollowUp,
} from '@/lib/lostSaleInsights';

const NOW = new Date('2026-03-15T12:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString();

const entry = (over: Partial<InsightEntry> & { created_at: string }): InsightEntry => ({
  id: Math.random().toString(36).slice(2),
  ...over,
});

describe('normalizeWeights', () => {
  it('falls back to defaults for missing/invalid values', () => {
    expect(normalizeWeights(null)).toEqual(DEFAULT_SCORING_WEIGHTS);
    expect(normalizeWeights({ volume: -5, value: NaN as any })).toEqual(DEFAULT_SCORING_WEIGHTS);
  });

  it('keeps valid overrides including zero', () => {
    const w = normalizeWeights({ volume: 0, trend: 55, kindMultiplier: { shop: 2 } as any });
    expect(w.volume).toBe(0);
    expect(w.trend).toBe(55);
    expect(w.kindMultiplier.shop).toBe(2);
    expect(w.kindMultiplier.reason).toBe(1);
  });
});

describe('avgRecoveredValue', () => {
  it('is 0 when nothing converted', () => {
    const fu: InsightFollowUp[] = [{ outcome: 'pending', recovered_amount: 0 }];
    expect(avgRecoveredValue(fu)).toBe(0);
  });

  it('averages only converted follow-ups with money', () => {
    const fu: InsightFollowUp[] = [
      { outcome: 'converted', recovered_amount: 1000 },
      { outcome: 'converted', recovered_amount: 2000 },
      { outcome: 'converted', recovered_amount: 0 },
      { outcome: 'lost', recovered_amount: 9999 },
    ];
    expect(avgRecoveredValue(fu)).toBe(1500);
  });
});

describe('computeTopFixes', () => {
  const entries: InsightEntry[] = [
    ...Array.from({ length: 5 }, () =>
      entry({ created_at: daysAgo(2), categories: { name: 'Price too high' }, shops: { name: 'MG Road' }, employee_name: 'Ravi' }),
    ),
    ...Array.from({ length: 2 }, () =>
      entry({ created_at: daysAgo(4), categories: { name: 'Size not available' }, shops: { name: 'Anna Nagar' }, employee_name: 'Kavi' }),
    ),
    // previous window baseline
    entry({ created_at: daysAgo(9), categories: { name: 'Price too high' }, shops: { name: 'MG Road' }, employee_name: 'Ravi' }),
    // outside both windows
    entry({ created_at: daysAgo(40), categories: { name: 'Price too high' }, shops: { name: 'MG Road' } }),
  ];

  it('counts only the last 7 days and ranks the biggest problem first', () => {
    const res = computeTopFixes(entries, [], NOW);
    expect(res.totalVisits).toBe(7);
    expect(res.fixes.length).toBe(3);
    expect(res.fixes[0].label).toBe('Price too high');
    expect(res.fixes[0].count).toBe(5);
    expect(res.fixes[0].changePct).toBe(400);
  });

  it('covers each dimension once before repeating', () => {
    const kinds = computeTopFixes(entries, [], NOW).fixes.map(f => f.kind);
    expect(new Set(kinds).size).toBe(3);
  });

  it('ignores missing shop/category/size values', () => {
    const res = computeTopFixes(
      [entry({ created_at: daysAgo(1) }), entry({ created_at: daysAgo(1), categories: { name: 'Unknown' } })],
      [],
      NOW,
    );
    expect(res.totalVisits).toBe(2);
    expect(res.fixes).toHaveLength(0);
  });

  it('ignores invalid dates', () => {
    const res = computeTopFixes([entry({ created_at: 'not-a-date', shops: { name: 'X' } })], [], NOW);
    expect(res.totalVisits).toBe(0);
  });

  it('includes entries exactly on the window boundary', () => {
    const res = computeTopFixes(
      [entry({ created_at: daysAgo(7), shops: { name: 'Edge' } })],
      [],
      NOW,
    );
    expect(res.totalVisits).toBe(1);
  });

  it('prices fixes from realised recovery', () => {
    const fu: InsightFollowUp[] = [{ outcome: 'converted', recovered_amount: 2000 }];
    const res = computeTopFixes(entries, fu, NOW);
    expect(res.avgValue).toBe(2000);
    expect(res.fixes[0].estimatedValue).toBe(res.fixes[0].count * 2000);
  });

  it('explains the score with components that sum to the score', () => {
    const res = computeTopFixes(entries, [], NOW);
    const fix = res.fixes[0];
    const sum = fix.breakdown.reduce((s, p) => s + p.contribution, 0);
    expect(fix.breakdown.map(p => p.key)).toEqual(['volume', 'value', 'trend', 'recency']);
    expect(Math.abs(sum - fix.score)).toBeLessThan(0.5);
  });

  it('respects tuned weights', () => {
    const onlyVolume = computeTopFixes(entries, [], NOW, {
      volume: 100, value: 0, trend: 0, recency: 0, kindMultiplier: { reason: 1, shop: 1, staff: 1 },
    });
    expect(onlyVolume.fixes[0].score).toBe(100);
    const damped = computeTopFixes(entries, [], NOW, {
      volume: 100, value: 0, trend: 0, recency: 0, kindMultiplier: { reason: 0.1, shop: 1, staff: 1 },
    });
    expect(damped.fixes[0].kind).not.toBe('reason');
  });

  it('handles an empty dataset', () => {
    const res = computeTopFixes([], [], NOW);
    expect(res.totalVisits).toBe(0);
    expect(res.fixes).toEqual([]);
  });
});

describe('entriesForFix', () => {
  const entries: InsightEntry[] = [
    entry({ created_at: daysAgo(1), shops: { name: 'MG Road' } }),
    entry({ created_at: daysAgo(3), shops: { name: 'MG Road' } }),
    entry({ created_at: daysAgo(30), shops: { name: 'MG Road' } }),
    entry({ created_at: daysAgo(1), shops: { name: 'Other' } }),
  ];

  it('filters by label and window, newest first', () => {
    const win = entriesForFix(entries, { kind: 'shop', label: 'MG Road' }, new Date(NOW.getTime() - 7 * 86400000), NOW);
    expect(win).toHaveLength(2);
    expect(new Date(win[0].created_at).getTime()).toBeGreaterThan(new Date(win[1].created_at).getTime());
  });

  it('returns full history when no window is given', () => {
    expect(entriesForFix(entries, { kind: 'shop', label: 'MG Road' })).toHaveLength(3);
  });
});

describe('computeStockGaps', () => {
  it('groups category+size and tracks shops, trend and last seen', () => {
    const rows = computeStockGaps(
      [
        entry({ created_at: daysAgo(1), categories: { name: 'Size not available' }, sizes: { size: 'XL' }, shops: { name: 'MG Road' } }),
        entry({ created_at: daysAgo(5), categories: { name: 'Size not available' }, sizes: { size: 'XL' }, shops: { name: 'Anna Nagar' } }),
        entry({ created_at: daysAgo(40), categories: { name: 'Size not available' }, sizes: { size: 'XL' }, shops: { name: 'MG Road' } }),
        entry({ created_at: daysAgo(2), categories: { name: 'Price too high' }, sizes: { size: 'M' } }),
      ],
      30,
      NOW,
    ).rows;
    const xl = rows.find(r => r.size === 'XL')!;
    expect(xl.count).toBe(2);
    expect(xl.shops.sort()).toEqual(['Anna Nagar', 'MG Road']);
    expect(xl.trend).toBe(100);
    // Price rows are excluded because stock-tagged rows exist
    expect(rows.some(r => r.category === 'Price too high')).toBe(false);
  });

  it('falls back to all visits when nothing is tagged as a stock reason', () => {
    const res = computeStockGaps(
      [entry({ created_at: daysAgo(1), categories: { name: 'Price too high' }, sizes: { size: 'M' } })],
      30,
      NOW,
    );
    expect(res.rows).toHaveLength(1);
    expect(res.gapShare).toBe(1);
  });

  it('skips rows with neither category nor size', () => {
    const res = computeStockGaps([entry({ created_at: daysAgo(1) })], 30, NOW);
    expect(res.rows).toHaveLength(0);
    expect(res.totalGapVisits).toBe(1);
  });

  it('handles an empty dataset', () => {
    const res = computeStockGaps([], 30, NOW);
    expect(res.rows).toEqual([]);
    expect(res.gapShare).toBe(0);
  });
});

describe('formatINR', () => {
  it('renders whole rupees', () => {
    expect(formatINR(1234.6)).toContain('1,235');
    expect(formatINR(NaN as any)).toContain('0');
  });
});
