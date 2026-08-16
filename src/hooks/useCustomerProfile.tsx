import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchCustomValueIndex } from '@/hooks/useEntryCustomValues';
import type { FollowUpRow } from '@/hooks/useFollowUps';

export const last10 = (v: string | null | undefined) => (v || '').replace(/\D/g, '').slice(-10);

export interface CustomerVisit {
  id: string;
  created_at: string;
  notes: string | null;
  employee_name: string | null;
  shop_id: string | null;
  shopName?: string;
  reason?: string;
  /** All visible field values for this visit, label -> text */
  fields: Record<string, string>;
}

export interface CustomerProfile {
  phone: string;
  visits: CustomerVisit[];
  followUps: FollowUpRow[];
  lifetimeRecovered: number;
  convertedCount: number;
  firstSeen?: string;
  lastSeen?: string;
  tags: string[];
}

const PRICE_RE = /price|cost|expensive|costly|discount|budget|offer|rate/i;
const SIZE_RE = /size|fit|stock|unavailable|out of stock|not available|variant/i;
const SERVICE_RE = /service|staff|rude|wait|queue|attention/i;

/** Derives behavioural tags from a customer's visit reasons and follow-up history. */
export function deriveTags(visits: CustomerVisit[], followUps: FollowUpRow[], recovered: number): string[] {
  const tags: string[] = [];
  const blob = [
    ...visits.map(v => `${v.reason || ''} ${Object.values(v.fields).join(' ')} ${v.notes || ''}`),
    ...followUps.map(f => f.reason_label || ''),
  ].join(' ');

  if (visits.length >= 3) tags.push('Repeat visitor');
  if (PRICE_RE.test(blob)) tags.push('Price-sensitive');
  if (SIZE_RE.test(blob)) tags.push('Size / stock gap');
  if (SERVICE_RE.test(blob)) tags.push('Service issue');
  if (recovered > 0) tags.push('Recovered before');
  if (followUps.length > 0 && followUps.every(f => f.outcome === 'no_reply')) tags.push('Never replies');
  return tags;
}

async function loadPhoneFieldIds(): Promise<string[]> {
  const { data } = await (supabase.from('custom_fields') as any)
    .select('id')
    .eq('field_type', 'phone')
    .is('deleted_at', null);
  return ((data as any[]) || []).map(r => r.id);
}

/** Full history for one customer phone number (tenant-scoped through RLS). */
export const useCustomerProfile = (phone: string | null, enabled = true) => {
  const digits = last10(phone);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled || digits.length < 10) { setProfile(null); return; }
    setLoading(true);
    try {
      const phoneFieldIds = await loadPhoneFieldIds();
      let entryIds: string[] = [];

      if (phoneFieldIds.length > 0) {
        const { data: matches } = await (supabase.from('gd_entry_custom_values') as any)
          .select('gd_entry_id, value')
          .in('custom_field_id', phoneFieldIds)
          .like('value', `%${digits}`)
          .limit(500);
        entryIds = Array.from(new Set(((matches as any[]) || []).map(m => m.gd_entry_id).filter(Boolean)));
      }

      const [entriesRes, fuRes] = await Promise.all([
        entryIds.length
          ? (supabase.from('goods_damaged_entries') as any)
              .select('id, created_at, notes, employee_name, shop_id, shops(name)')
              .in('id', entryIds)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        (supabase.from('follow_ups') as any)
          .select('*')
          .like('phone', `%${digits}`)
          .order('sent_at', { ascending: false })
          .limit(200),
      ]);

      const entries = (entriesRes.data as any[]) || [];
      const index = entries.length ? await fetchCustomValueIndex(entries.map(e => e.id)) : null;
      const reasonField = index?.fields.find(f => /reason/i.test(f.name));

      const visits: CustomerVisit[] = entries.map(e => {
        const raw = index?.valuesByEntry[e.id] || {};
        const fields: Record<string, string> = {};
        (index?.visibleFields || []).forEach(f => {
          if ((f.field_type || '') === 'phone') return;
          const val = raw[f.id];
          if (val) fields[f.name] = val;
        });
        return {
          id: e.id,
          created_at: e.created_at,
          notes: e.notes ?? null,
          employee_name: e.employee_name ?? null,
          shop_id: e.shop_id ?? null,
          shopName: e.shops?.name,
          reason: reasonField ? raw[reasonField.id] : undefined,
          fields,
        };
      });

      const followUps = ((fuRes.data as FollowUpRow[]) || []).map(f => ({
        ...f,
        recovered_amount: Number(f.recovered_amount || 0),
      }));
      const converted = followUps.filter(f => f.outcome === 'converted');
      const lifetimeRecovered = converted.reduce((s, f) => s + Number(f.recovered_amount || 0), 0);
      const dates = visits.map(v => v.created_at).filter(Boolean).sort();

      setProfile({
        phone: digits,
        visits,
        followUps,
        lifetimeRecovered,
        convertedCount: converted.length,
        firstSeen: dates[0],
        lastSeen: dates[dates.length - 1],
        tags: deriveTags(visits, followUps, lifetimeRecovered),
      });
    } finally {
      setLoading(false);
    }
  }, [digits, enabled]);

  useEffect(() => { void load(); }, [load]);

  return { profile, loading, reload: load };
};

export interface RepeatVisitorHint {
  visits: number;
  topReason?: string;
  lastVisitAt?: string;
  recovered: number;
}

/**
 * Lightweight lookup used while staff type a phone number in the visit form:
 * "this number visited 3 times, all lost on price".
 */
export const useRepeatVisitorHint = (phone: string) => {
  const digits = last10(phone);
  const [hint, setHint] = useState<RepeatVisitorHint | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (digits.length < 10) { setHint(null); return; }

    const timer = setTimeout(async () => {
      try {
        const phoneFieldIds = await loadPhoneFieldIds();
        if (phoneFieldIds.length === 0) { if (!cancelled) setHint(null); return; }

        const { data: matches } = await (supabase.from('gd_entry_custom_values') as any)
          .select('gd_entry_id')
          .in('custom_field_id', phoneFieldIds)
          .like('value', `%${digits}`)
          .limit(200);
        const entryIds = Array.from(new Set(((matches as any[]) || []).map(m => m.gd_entry_id).filter(Boolean)));
        if (entryIds.length === 0) { if (!cancelled) setHint(null); return; }

        const [entriesRes, fuRes] = await Promise.all([
          (supabase.from('goods_damaged_entries') as any)
            .select('id, created_at')
            .in('id', entryIds)
            .order('created_at', { ascending: false }),
          (supabase.from('follow_ups') as any)
            .select('recovered_amount, outcome')
            .like('phone', `%${digits}`)
            .limit(100),
        ]);

        const entries = (entriesRes.data as any[]) || [];
        if (entries.length === 0) { if (!cancelled) setHint(null); return; }

        const index = await fetchCustomValueIndex(entries.map(e => e.id));
        const reasonField = index.fields.find(f => /reason/i.test(f.name));
        const tally: Record<string, number> = {};
        if (reasonField) {
          entries.forEach(e => {
            const r = index.valuesByEntry[e.id]?.[reasonField.id];
            if (r) tally[r] = (tally[r] || 0) + 1;
          });
        }
        const topReason = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
        const recovered = ((fuRes.data as any[]) || [])
          .filter(f => f.outcome === 'converted')
          .reduce((s, f) => s + Number(f.recovered_amount || 0), 0);

        if (!cancelled) {
          setHint({ visits: entries.length, topReason, lastVisitAt: entries[0]?.created_at, recovered });
        }
      } catch {
        if (!cancelled) setHint(null);
      }
    }, 450);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [digits]);

  return hint;
};

/** Human sentence for the repeat-visitor banner. */
export const repeatHintText = (h: RepeatVisitorHint) => {
  const times = h.visits === 1 ? 'once' : `${h.visits} times`;
  const reason = h.topReason ? `, mostly lost on “${h.topReason}”` : '';
  return `This number has visited ${times}${reason}.`;
};

export const useCustomerProfileMemoKey = (phone: string | null) => useMemo(() => last10(phone), [phone]);
