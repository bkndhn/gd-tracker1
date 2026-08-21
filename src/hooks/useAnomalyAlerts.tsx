import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCustomValueIndex, stdValue } from '@/hooks/useEntryCustomValues';

export interface AnomalyEntry {
  id: string;
  created_at: string;
  shop_id: string | null;
  shopName: string;
  reason: string;
  size: string;
  notes: string;
}

export interface AnomalyAlert {
  id: string;
  /** which slice of the data moved */
  metric: 'visits' | 'reason' | 'size';
  /** spike = more lost value than usual, drop = unusually quiet */
  direction: 'spike' | 'drop';
  title: string;
  shopId: string | null;
  shopName: string;
  reasonLabel: string | null;
  sizeLabel: string | null;
  windowStart: Date;
  windowEnd: Date;
  actual: number;
  expected: number;
  /** estimated rupees of lost value in the current window */
  valueAtStake: number;
  /** difference in rupees vs the baseline (negative for drops) */
  valueDelta: number;
  severity: 'high' | 'medium';
  entries: AnomalyEntry[];
}

const WINDOW_DAYS = 7;
const BASELINE_WINDOWS = 4; // trailing windows used for the baseline
const LOOKBACK_DAYS = WINDOW_DAYS * (BASELINE_WINDOWS + 1);
const DISMISS_KEY = 'anomaly-dismissed-v1';

export function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function dismissAnomaly(id: string) {
  const next = Array.from(new Set([...getDismissed(), id])).slice(-200);
  localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('anomaly-dismissed'));
}

export function clearDismissedAnomalies() {
  localStorage.removeItem(DISMISS_KEY);
  window.dispatchEvent(new CustomEvent('anomaly-dismissed'));
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map(v => (v - m) ** 2)));
}

/**
 * Detects sudden spikes AND drops by comparing the most recent 7-day window for
 * each shop (overall visits, per lost-reason and per size) against that same
 * series' trailing baseline. Counts are converted to lost value using the
 * tenant's average recovered amount so alerts are expressed in rupees.
 * Everything runs client-side on RLS-scoped data.
 */
export const useAnomalyAlerts = () => {
  const { user } = useAuth();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['anomaly-source', user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();
      const { data, error } = await supabase
        .from('goods_damaged_entries')
        .select('id, created_at, shop_id, notes, shops(name), sizes(size)')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: avgValue = 0 } = useQuery({
    queryKey: ['anomaly-avg-value', user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data } = await supabase
        .from('follow_ups')
        .select('recovered_amount, outcome')
        .eq('outcome', 'converted')
        .gt('recovered_amount', 0)
        .limit(500);
      const vals = (data || []).map((r: any) => Number(r.recovered_amount || 0)).filter(n => n > 0);
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    },
  });

  const entryIds = useMemo(() => rows.map(r => r.id), [rows]);
  const { data: cvIndex } = useCustomValueIndex(entryIds);

  const alerts = useMemo<AnomalyAlert[]>(() => {
    if (!rows.length) return [];

    const now = Date.now();
    const windowMs = WINDOW_DAYS * 86400000;

    const entries: AnomalyEntry[] = rows.map(r => ({
      id: r.id,
      created_at: r.created_at,
      shop_id: r.shop_id,
      shopName: r.shops?.name || stdValue(cvIndex, r.id, 'shop') || 'Unknown shop',
      reason: stdValue(cvIndex, r.id, 'category') || 'Unspecified',
      size: r.sizes?.size || stdValue(cvIndex, r.id, 'size') || 'Unspecified',
      notes: r.notes || '',
    }));

    // bucket index 0 = current window, 1..N = trailing baseline windows
    const bucketOf = (iso: string) => {
      const diff = now - new Date(iso).getTime();
      if (diff < 0) return 0;
      const b = Math.floor(diff / windowMs);
      return b > BASELINE_WINDOWS ? -1 : b;
    };

    type Series = {
      metric: AnomalyAlert['metric'];
      shopId: string | null;
      shopName: string;
      reasonLabel: string | null;
      sizeLabel: string | null;
      counts: number[];
      current: AnomalyEntry[];
    };
    const series = new Map<string, Series>();

    const push = (key: string, seed: Omit<Series, 'counts' | 'current'>, bucket: number, e: AnomalyEntry) => {
      let s = series.get(key);
      if (!s) {
        s = { ...seed, counts: new Array(BASELINE_WINDOWS + 1).fill(0), current: [] };
        series.set(key, s);
      }
      s.counts[bucket] += 1;
      if (bucket === 0) s.current.push(e);
    };

    entries.forEach(e => {
      const b = bucketOf(e.created_at);
      if (b < 0) return;
      const shopKey = e.shop_id || e.shopName;
      push(
        `visits:${shopKey}`,
        { metric: 'visits', shopId: e.shop_id, shopName: e.shopName, reasonLabel: null, sizeLabel: null },
        b, e,
      );
      push(
        `reason:${shopKey}:${e.reason}`,
        { metric: 'reason', shopId: e.shop_id, shopName: e.shopName, reasonLabel: e.reason, sizeLabel: null },
        b, e,
      );
      if (e.size && e.size !== 'Unspecified') {
        push(
          `size:${shopKey}:${e.size}`,
          { metric: 'size', shopId: e.shop_id, shopName: e.shopName, reasonLabel: null, sizeLabel: e.size },
          b, e,
        );
      }
    });

    const out: AnomalyAlert[] = [];
    const dayStamp = Math.floor(now / 86400000);

    series.forEach((s, key) => {
      const actual = s.counts[0];
      const baseline = s.counts.slice(1);
      const expected = mean(baseline);
      const sd = stdDev(baseline);
      const rounded = Math.round(expected * 10) / 10;

      const scopeLabel = s.reasonLabel
        ? `"${s.reasonLabel}"`
        : s.sizeLabel
          ? `size ${s.sizeLabel}`
          : 'non-purchase visits';

      const base = {
        metric: s.metric,
        shopId: s.shopId,
        shopName: s.shopName,
        reasonLabel: s.reasonLabel,
        sizeLabel: s.sizeLabel,
        windowStart: new Date(now - windowMs),
        windowEnd: new Date(now),
        actual,
        expected: rounded,
        valueAtStake: actual * avgValue,
        valueDelta: Math.round((actual - expected) * avgValue),
        entries: s.current.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      };

      // Spike: unusually high lost volume/value
      if (actual >= 5) {
        const threshold = Math.max(expected * 1.5, expected + 2 * sd, 3);
        if (actual >= threshold) {
          const ratio = expected > 0 ? actual / expected : Infinity;
          out.push({
            ...base,
            id: `${key}:spike:${dayStamp}`,
            direction: 'spike',
            title: `Spike in ${scopeLabel}`,
            severity: ratio >= 2 ? 'high' : 'medium',
          });
          return;
        }
      }

      // Drop: the series was consistently busy and has now fallen away
      if (expected >= 5 && actual <= expected * 0.5) {
        const ratio = expected > 0 ? actual / expected : 0;
        out.push({
          ...base,
          id: `${key}:drop:${dayStamp}`,
          direction: 'drop',
          title: `Sudden drop in ${scopeLabel}`,
          severity: ratio <= 0.25 ? 'high' : 'medium',
        });
      }
    });

    return out.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
      return Math.abs(b.valueDelta) - Math.abs(a.valueDelta) || b.actual - a.actual;
    });
  }, [rows, cvIndex, avgValue]);

  return { alerts, isLoading, avgValue };
};
