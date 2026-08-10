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
  notes: string;
}

export interface AnomalyAlert {
  id: string;
  metric: 'visits' | 'reason';
  shopId: string | null;
  shopName: string;
  reasonLabel: string | null;
  windowStart: Date;
  windowEnd: Date;
  actual: number;
  expected: number;
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
 * Detects spikes by comparing the most recent 7-day window for each shop
 * (overall visits and per lost-reason) against that same series' trailing
 * baseline. Everything runs client-side on RLS-scoped data.
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
        .select('id, created_at, shop_id, notes, shops(name)')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as any[];
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
      shopId: string | null;
      shopName: string;
      reasonLabel: string | null;
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
      push(`visits:${shopKey}`, { shopId: e.shop_id, shopName: e.shopName, reasonLabel: null }, b, e);
      push(
        `reason:${shopKey}:${e.reason}`,
        { shopId: e.shop_id, shopName: e.shopName, reasonLabel: e.reason },
        b,
        e,
      );
    });

    const out: AnomalyAlert[] = [];
    series.forEach((s, key) => {
      const actual = s.counts[0];
      const baseline = s.counts.slice(1);
      const expected = mean(baseline);
      const sd = stdDev(baseline);
      // needs enough volume to be meaningful
      if (actual < 5) return;
      const threshold = Math.max(expected * 1.5, expected + 2 * sd, 3);
      if (actual < threshold) return;

      const ratio = expected > 0 ? actual / expected : Infinity;
      out.push({
        id: `${key}:${Math.floor(now / 86400000)}`,
        metric: s.reasonLabel ? 'reason' : 'visits',
        shopId: s.shopId,
        shopName: s.shopName,
        reasonLabel: s.reasonLabel,
        windowStart: new Date(now - windowMs),
        windowEnd: new Date(now),
        actual,
        expected: Math.round(expected * 10) / 10,
        severity: ratio >= 2 ? 'high' : 'medium',
        entries: s.current.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      });
    });

    return out.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
      return b.actual - a.actual;
    });
  }, [rows, cvIndex]);

  return { alerts, isLoading };
};
