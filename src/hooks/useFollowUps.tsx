import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type FollowUpOutcome = 'pending' | 'no_reply' | 'replied' | 'converted' | 'lost';

export const OUTCOME_LABELS: Record<FollowUpOutcome, string> = {
  pending: 'Awaiting reply',
  no_reply: 'No reply',
  replied: 'Replied',
  converted: 'Converted (purchased)',
  lost: 'Lost',
};

export interface FollowUpRow {
  id: string;
  admin_id: string;
  entry_id: string | null;
  shop_id: string | null;
  shop_name: string | null;
  phone: string;
  customer_name: string | null;
  reason_label: string | null;
  template_key: string | null;
  message: string | null;
  sent_by: string;
  sent_by_name: string | null;
  outcome: FollowUpOutcome;
  recovered_amount: number;
  outcome_note: string | null;
  next_reminder_at: string | null;
  reminder_stage: number;
  sent_at: string;
  outcome_at: string | null;
  wa_message_id?: string | null;
  delivery_status?: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | null;
  delivered_at?: string | null;
  read_at?: string | null;
  delivery_error?: string | null;
}

export interface LogFollowUpInput {
  entryId?: string | null;
  shopId?: string | null;
  shopName?: string | null;
  phone: string;
  customerName?: string | null;
  reasonLabel?: string | null;
  templateKey?: string | null;
  message: string;
  reminderDays?: number;
}

const table = () => (supabase.from('follow_ups') as any);

/** Logs an outgoing WhatsApp follow-up (audit trail of who messaged whom). */
export const useLogFollowUp = () => {
  const { profile, user, adminId } = useAuth();

  return useCallback(async (input: LogFollowUpInput): Promise<string | null> => {
    if (!adminId || !user?.id) return null;
    const days = input.reminderDays ?? 3;
    const reminder = new Date(Date.now() + days * 86400000).toISOString();
    const { data, error } = await table()
      .insert({
        admin_id: adminId,
        entry_id: input.entryId ?? null,
        shop_id: input.shopId ?? null,
        shop_name: input.shopName ?? null,
        phone: input.phone,
        customer_name: input.customerName ?? null,
        reason_label: input.reasonLabel ?? null,
        template_key: input.templateKey ?? null,
        message: input.message.slice(0, 4000),
        sent_by: user.id,
        sent_by_name: (profile as any)?.name || user.email || null,
        next_reminder_at: reminder,
      })
      .select('id')
      .maybeSingle();
    if (error) {
      if (import.meta.env.DEV) console.error('logFollowUp', error);
      return null;
    }
    return data?.id ?? null;
  }, [adminId, user?.id, user?.email, profile]);
};

export interface ShopTarget {
  id: string;
  shop_id: string | null;
  period_month: string;
  target_followups: number;
  target_recovered: number;
}

/** Loads follow-ups + shop targets for the current tenant with derived reporting. */
export const useFollowUps = (days = 180) => {
  const { adminId, profile } = useAuth();
  const [rows, setRows] = useState<FollowUpRow[]>([]);
  const [targets, setTargets] = useState<ShopTarget[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!adminId) { setLoading(false); return; }
    setLoading(true);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const [fu, tg] = await Promise.all([
      table().select('*').eq('admin_id', adminId).gte('sent_at', since).order('sent_at', { ascending: false }).limit(1000),
      (supabase.from('shop_targets') as any).select('*').eq('admin_id', adminId),
    ]);
    setRows(((fu.data as FollowUpRow[]) || []).map(r => ({ ...r, recovered_amount: Number(r.recovered_amount || 0) })));
    setTargets((tg.data as ShopTarget[]) || []);
    setLoading(false);
  }, [adminId, days]);

  useEffect(() => { load(); }, [load]);

  const updateOutcome = useCallback(async (
    id: string,
    patch: { outcome?: FollowUpOutcome; recovered_amount?: number; outcome_note?: string; next_reminder_at?: string | null },
  ) => {
    const { error } = await table()
      .update({ ...patch, outcome_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await load();
  }, [load]);

  const snoozeReminder = useCallback(async (id: string, days: number) => {
    const next = new Date(Date.now() + days * 86400000).toISOString();
    const row = rows.find(r => r.id === id);
    const { error } = await table()
      .update({ next_reminder_at: next, reminder_stage: (row?.reminder_stage ?? 0) + 1 })
      .eq('id', id);
    if (error) throw error;
    await load();
  }, [load, rows]);

  const saveTarget = useCallback(async (
    shopId: string,
    month: string,
    followups: number,
    recovered: number,
    shopName?: string,
  ) => {
    if (!adminId) return;
    const previous = targets.find(t => t.shop_id === shopId && String(t.period_month).slice(0, 7) === month.slice(0, 7));

    const { error } = await (supabase.from('shop_targets') as any).upsert(
      {
        admin_id: adminId,
        shop_id: shopId,
        period_month: month,
        target_followups: followups,
        target_recovered: recovered,
      },
      { onConflict: 'admin_id,shop_id,period_month' },
    );
    if (error) throw error;

    // Audit trail: who changed which shop's monthly target, and from what.
    try {
      const { data: me } = await supabase.auth.getUser();
      await (supabase.from('settings_audit_log') as any).insert({
        admin_id: adminId,
        setting_key: 'shop_targets',
        changed_by: me?.user?.id,
        changed_by_name: (profile as any)?.name || me?.user?.email || null,
        old_value: previous
          ? {
              shopId, shopName: shopName || null, month,
              target_followups: previous.target_followups,
              target_recovered: Number(previous.target_recovered),
            }
          : null,
        new_value: { shopId, shopName: shopName || null, month, target_followups: followups, target_recovered: recovered },
        note: shopName ? `${shopName} · ${month.slice(0, 7)}` : month.slice(0, 7),
      });
    } catch (e) {
      if (import.meta.env.DEV) console.error('shop target audit failed', e);
    }

    await load();
  }, [adminId, load, targets, profile]);


  const stats = useMemo(() => {
    const total = rows.length;
    const converted = rows.filter(r => r.outcome === 'converted');
    const recovered = converted.reduce((s, r) => s + Number(r.recovered_amount || 0), 0);
    const pending = rows.filter(r => r.outcome === 'pending').length;
    const replied = rows.filter(r => r.outcome === 'replied' || r.outcome === 'converted').length;
    return {
      total,
      pending,
      replied,
      convertedCount: converted.length,
      recovered,
      conversionRate: total ? (converted.length / total) * 100 : 0,
      replyRate: total ? (replied / total) * 100 : 0,
      avgRecovered: converted.length ? recovered / converted.length : 0,
    };
  }, [rows]);

  const dueReminders = useMemo(() => {
    const now = Date.now();
    return rows
      .filter(r => r.outcome === 'pending' && r.next_reminder_at && new Date(r.next_reminder_at).getTime() <= now)
      .sort((a, b) => new Date(a.next_reminder_at!).getTime() - new Date(b.next_reminder_at!).getTime());
  }, [rows]);

  const monthKey = new Date().toISOString().slice(0, 7) + '-01';

  const shopLeaderboard = useMemo(() => {
    const map = new Map<string, { shopId: string | null; shop: string; sent: number; converted: number; recovered: number }>();
    rows.forEach(r => {
      const key = r.shop_id || r.shop_name || 'unknown';
      const cur = map.get(key) || { shopId: r.shop_id, shop: r.shop_name || 'Unknown shop', sent: 0, converted: 0, recovered: 0 };
      cur.sent += 1;
      if (r.outcome === 'converted') { cur.converted += 1; cur.recovered += Number(r.recovered_amount || 0); }
      map.set(key, cur);
    });
    return Array.from(map.values())
      .map(v => {
        const t = targets.find(t => t.shop_id === v.shopId && String(t.period_month).slice(0, 7) === monthKey.slice(0, 7));
        return {
          ...v,
          conversionRate: v.sent ? (v.converted / v.sent) * 100 : 0,
          targetFollowups: t?.target_followups ?? 0,
          targetRecovered: Number(t?.target_recovered ?? 0),
        };
      })
      .sort((a, b) => b.recovered - a.recovered || b.converted - a.converted);
  }, [rows, targets, monthKey]);

  const staffLeaderboard = useMemo(() => {
    const map = new Map<string, { name: string; sent: number; converted: number; recovered: number }>();
    rows.forEach(r => {
      const key = r.sent_by;
      const cur = map.get(key) || { name: r.sent_by_name || 'Unknown', sent: 0, converted: 0, recovered: 0 };
      cur.sent += 1;
      if (r.outcome === 'converted') { cur.converted += 1; cur.recovered += Number(r.recovered_amount || 0); }
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.recovered - a.recovered || b.converted - a.converted);
  }, [rows]);

  /** All follow-ups for one customer phone, newest first. */
  const timelineFor = useCallback((phone: string) => {
    const digits = phone.replace(/\D/g, '').slice(-10);
    return rows.filter(r => r.phone.replace(/\D/g, '').slice(-10) === digits);
  }, [rows]);

  return {
    rows, targets, loading, reload: load,
    updateOutcome, snoozeReminder, saveTarget,
    stats, dueReminders, shopLeaderboard, staffLeaderboard, timelineFor,
    monthKey,
  };
};
