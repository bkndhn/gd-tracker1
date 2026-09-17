import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type RequirementStatus = 'requested' | 'packed' | 'moved' | 'received' | 'rejected';

export interface StockRequirement {
  id: string;
  admin_id: string;
  shop_id: string | null;
  shop_name: string | null;
  requested_by: string;
  requested_by_name: string | null;
  category: string | null;
  size: string;
  quantity: number;
  urgency: string;
  note: string | null;
  status: RequirementStatus;
  packed_by: string | null;
  packed_by_name: string | null;
  packed_at: string | null;
  packed_qty: number | null;
  packed_note: string | null;
  moved_by: string | null;
  moved_by_name: string | null;
  moved_at: string | null;
  moved_note: string | null;
  received_by: string | null;
  received_by_name: string | null;
  received_at: string | null;
  rejected_by: string | null;
  rejected_by_name: string | null;
  rejected_at: string | null;
  reject_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewRequirement {
  shop_id: string | null;
  size: string;
  category?: string | null;
  quantity: number;
  urgency: string;
  note?: string | null;
}

export const useRequirements = () => {
  const { profile, user } = useAuth();
  const [requirements, setRequirements] = useState<StockRequirement[]>([]);
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const p = profile as any;
  const role = p?.role as string | undefined;
  const tenantId = role === 'admin' || role === 'super_admin' ? p?.id : p?.admin_id;
  const isWarehouse = role === 'warehouse';
  const canFulfil = isWarehouse || role === 'admin' || role === 'super_admin';

  const fetchAll = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    try {
      const [reqRes, shopRes] = await Promise.all([
        (supabase.from('stock_requirements') as any)
          .select('*')
          .eq('admin_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase.from('shops').select('id, name').is('deleted_at', null).order('name'),
      ]);
      if (reqRes.error) throw reqRes.error;
      setRequirements((reqRes.data || []) as StockRequirement[]);
      if (!shopRes.error) setShops((shopRes.data || []) as any);
    } catch (e: any) {
      if (import.meta.env.DEV) console.error('useRequirements fetch', e);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime: keep every open session in sync
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`stock_requirements_${tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_requirements' }, () => {
        fetchAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, fetchAll]);

  const createRequirement = useCallback(async (input: NewRequirement) => {
    if (!tenantId || !user?.id) { toast.error('No account context'); return false; }
    setSaving(true);
    try {
      // Monthly cap set by the super admin for this account
      const { data: limitRow } = await supabase
        .from('profiles').select('max_requirements_monthly').eq('id', tenantId).maybeSingle();
      const cap = (limitRow as any)?.max_requirements_monthly;
      if (cap != null) {
        const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
        const { count } = await (supabase.from('stock_requirements') as any)
          .select('*', { count: 'exact', head: true })
          .eq('admin_id', tenantId)
          .gte('created_at', monthStart.toISOString());
        if ((count || 0) >= cap) {
          toast.error(`Monthly requirement limit reached (${cap}). Contact your provider to raise it.`);
          return false;
        }
      }
      const shopName = shops.find(s => s.id === input.shop_id)?.name || null;
      const { error } = await (supabase.from('stock_requirements') as any).insert({
        admin_id: tenantId,
        shop_id: input.shop_id,
        shop_name: shopName,
        requested_by: user.id,
        requested_by_name: p?.name || p?.email || null,
        category: input.category || null,
        size: input.size,
        quantity: input.quantity,
        urgency: input.urgency,
        note: input.note || null,
        status: 'requested',
      });
      if (error) throw error;
      toast.success('Requirement sent to the warehouse');
      await fetchAll();
      return true;
    } catch (e: any) {
      toast.error(e.message || 'Could not send the requirement');
      return false;
    } finally {
      setSaving(false);
    }
  }, [tenantId, user?.id, p?.name, p?.email, shops, fetchAll]);

  const updateStatus = useCallback(async (
    req: StockRequirement,
    to: RequirementStatus,
    extra: { packed_qty?: number | null; note?: string | null } = {},
  ) => {
    if (!user?.id) return false;
    const now = new Date().toISOString();
    const actorName = p?.name || p?.email || null;
    const patch: any = { status: to };

    if (to === 'packed') {
      patch.packed_by = user.id; patch.packed_by_name = actorName; patch.packed_at = now;
      patch.packed_qty = extra.packed_qty ?? req.quantity; patch.packed_note = extra.note || null;
    } else if (to === 'moved') {
      patch.moved_by = user.id; patch.moved_by_name = actorName; patch.moved_at = now;
      patch.moved_note = extra.note || null;
    } else if (to === 'received') {
      patch.received_by = user.id; patch.received_by_name = actorName; patch.received_at = now;
    } else if (to === 'rejected') {
      patch.rejected_by = user.id; patch.rejected_by_name = actorName; patch.rejected_at = now;
      patch.reject_reason = extra.note || null;
    }

    try {
      const { error } = await (supabase.from('stock_requirements') as any)
        .update(patch)
        .eq('id', req.id);
      if (error) throw error;

      await (supabase.from('stock_requirement_events') as any).insert({
        admin_id: req.admin_id,
        requirement_id: req.id,
        from_status: req.status,
        to_status: to,
        actor_id: user.id,
        actor_name: actorName,
        note: extra.note || null,
      });

      toast.success(`Marked as ${to}`);
      await fetchAll();
      return true;
    } catch (e: any) {
      toast.error(e.message || 'Could not update this requirement');
      return false;
    }
  }, [user?.id, p?.name, p?.email, fetchAll]);

  const visibleShops = useMemo(() => {
    if (!isWarehouse) return shops;
    if (p?.warehouse_all_shops) return shops;
    const ids: string[] = p?.warehouse_shop_ids || [];
    return shops.filter(s => ids.includes(s.id));
  }, [shops, isWarehouse, p?.warehouse_all_shops, p?.warehouse_shop_ids]);

  return {
    requirements, shops, visibleShops, loading, saving,
    createRequirement, updateStatus, refresh: fetchAll,
    tenantId, canFulfil, isWarehouse,
  };
};
