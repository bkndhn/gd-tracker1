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
  custom_values?: Record<string, string>;
}

export interface NewRequirement {
  shop_id: string | null;
  size: string;
  category?: string | null;
  quantity: number;
  urgency: string;
  note?: string | null;
  custom_values?: Record<string, string>;
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
      const rawData = (reqRes.data || []) as StockRequirement[];

      // Strict role-based data isolation (defense-in-depth on client side)
      let roleFiltered = rawData;
      if (role === 'super_admin' || role === 'admin') {
        // Admins see all requirements across all shops
        roleFiltered = rawData;
      } else if (role === 'warehouse') {
        // Warehouse staff: can view all shops if warehouse_all_shops, or only assigned shops
        if (p?.warehouse_all_shops) {
          roleFiltered = rawData;
        } else {
          const allowedIds: string[] = p?.warehouse_shop_ids || [];
          roleFiltered = rawData.filter(r => r.shop_id && allowedIds.includes(r.shop_id));
        }
      } else if (role === 'manager') {
        // Shop Manager: strictly isolated to requirements for their managed shop
        roleFiltered = rawData.filter(r => p?.shop_id && r.shop_id === p.shop_id);
      } else {
        // Shop Staff / User: strictly isolated to requirements for their assigned shop or requested by themselves
        roleFiltered = rawData.filter(r =>
          r.requested_by === user?.id || (p?.shop_id && r.shop_id === p.shop_id)
        );
      }

      setRequirements(roleFiltered);
      if (!shopRes.error) setShops((shopRes.data || []) as any);
    } catch (e: any) {
      if (import.meta.env.DEV) console.error('useRequirements fetch', e);
    } finally {
      setLoading(false);
    }
  }, [tenantId, role, p?.shop_id, p?.warehouse_all_shops, p?.warehouse_shop_ids, user?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Listen for local tab cross-component updates (instant 0ms sync)
  useEffect(() => {
    const handleLocalUpdate = () => {
      fetchAll();
    };
    window.addEventListener('gd:requirement_updated', handleLocalUpdate);
    return () => {
      window.removeEventListener('gd:requirement_updated', handleLocalUpdate);
    };
  }, [fetchAll]);

  // Realtime: keep every open session in sync with unique channel ID
  useEffect(() => {
    if (!tenantId) return;
    const channelName = `stock_req_${tenantId}_${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_requirements' }, () => {
        fetchAll();
      })
      .subscribe();
    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
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
      const { data: createdReq, error } = await (supabase.from('stock_requirements') as any).insert({
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
      }).select().single();

      if (error) throw error;

      if (input.custom_values && Object.keys(input.custom_values).length > 0 && createdReq?.id) {
        try {
          const cvRows = Object.entries(input.custom_values)
            .filter(([_, val]) => Boolean(val && String(val).trim()))
            .map(([fieldId, val]) => ({
              requirement_id: createdReq.id,
              custom_field_id: fieldId,
              value: String(val),
            }));
          if (cvRows.length > 0) {
            await (supabase.from('gd_entry_custom_values') as any).insert(cvRows);
          }
        } catch (cvErr) {
          if (import.meta.env.DEV) console.error('Failed to save requirement custom values', cvErr);
        }
      }

      if (createdReq) {
        setRequirements(prev => [createdReq, ...prev]);
        window.dispatchEvent(new CustomEvent('gd:requirement_updated', { detail: createdReq }));
      }

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
    const patch: any = { status: to, updated_at: now };

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

    // 0ms Optimistic UI Update: update local state immediately so user sees it with zero lag
    const previousReqs = requirements;
    setRequirements(prev => prev.map(item => item.id === req.id ? { ...item, ...patch } : item));
    window.dispatchEvent(new CustomEvent('gd:requirement_updated', { detail: { id: req.id, patch } }));

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

      // Automatically deduct from warehouse inventory when packed
      if (to === 'packed') {
        try {
          const { data: invRow } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'warehouse_inventory')
            .eq('admin_id', req.admin_id)
            .maybeSingle();
          if (invRow?.value && Array.isArray(invRow.value)) {
            const packedCount = patch.packed_qty ?? req.quantity;
            const normSize = req.size.trim().toLowerCase();
            const updatedInv = (invRow.value as any[]).map(item => {
              if (String(item.size).trim().toLowerCase() === normSize) {
                return { ...item, on_hand: Math.max(0, (item.on_hand || 0) - packedCount), updated_at: now };
              }
              return item;
            });
            await (supabase.from('app_settings') as any).upsert({
              key: 'warehouse_inventory',
              admin_id: req.admin_id,
              value: updatedInv,
            }, { onConflict: 'admin_id,key' });
          }
        } catch (invErr) {
          if (import.meta.env.DEV) console.error('Failed to deduct packed inventory', invErr);
        }
      }

      toast.success(`Marked as ${to}`);
      await fetchAll();
      return true;
    } catch (e: any) {
      // Rollback on error
      setRequirements(previousReqs);
      window.dispatchEvent(new CustomEvent('gd:requirement_updated', { detail: { rollback: true } }));
      toast.error(e.message || 'Could not update this requirement');
      return false;
    }
  }, [user?.id, p?.name, p?.email, requirements, fetchAll]);

  const undoStatus = useCallback(async (req: StockRequirement, reason?: string) => {
    if (!user?.id) return false;
    const now = new Date().toISOString();
    const actorName = p?.name || p?.email || 'Admin';

    // Revert to requested status and clear transition timestamps and actors
    const patch: any = {
      status: 'requested',
      updated_at: now,
      packed_by: null,
      packed_by_name: null,
      packed_at: null,
      packed_qty: null,
      packed_note: null,
      moved_by: null,
      moved_by_name: null,
      moved_at: null,
      moved_note: null,
      received_by: null,
      received_by_name: null,
      received_at: null,
      rejected_by: null,
      rejected_by_name: null,
      rejected_at: null,
      reject_reason: null,
    };

    const previousReqs = requirements;
    setRequirements(prev => prev.map(item => item.id === req.id ? { ...item, ...patch } : item));
    window.dispatchEvent(new CustomEvent('gd:requirement_updated', { detail: { id: req.id, patch } }));

    try {
      const { error } = await (supabase.from('stock_requirements') as any)
        .update(patch)
        .eq('id', req.id);
      if (error) throw error;

      await (supabase.from('stock_requirement_events') as any).insert({
        admin_id: req.admin_id,
        requirement_id: req.id,
        from_status: req.status,
        to_status: 'requested',
        actor_id: user.id,
        actor_name: actorName,
        note: reason ? `Admin Undo: ${reason}` : `Admin Undo (reverted from ${req.status})`,
      });

      // If it was packed previously, restore the inventory quantity
      if (req.packed_qty || (req.status === 'packed' && req.quantity)) {
        try {
          const { data: invRow } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'warehouse_inventory')
            .eq('admin_id', req.admin_id)
            .maybeSingle();
          if (invRow?.value && Array.isArray(invRow.value)) {
            const restoreCount = req.packed_qty ?? req.quantity;
            const normSize = req.size.trim().toLowerCase();
            const updatedInv = (invRow.value as any[]).map(item => {
              if (String(item.size).trim().toLowerCase() === normSize) {
                return { ...item, on_hand: (item.on_hand || 0) + restoreCount, updated_at: now };
              }
              return item;
            });
            await (supabase.from('app_settings') as any).upsert({
              key: 'warehouse_inventory',
              admin_id: req.admin_id,
              value: updatedInv,
            }, { onConflict: 'admin_id,key' });
          }
        } catch (invErr) {
          if (import.meta.env.DEV) console.error('Failed to restore packed inventory on undo', invErr);
        }
      }

      toast.success('Requirement reverted to Requested status');
      await fetchAll();
      return true;
    } catch (e: any) {
      setRequirements(previousReqs);
      window.dispatchEvent(new CustomEvent('gd:requirement_updated', { detail: { rollback: true } }));
      toast.error(e.message || 'Could not undo requirement');
      return false;
    }
  }, [user?.id, p?.name, p?.email, requirements, fetchAll]);

  const visibleShops = useMemo(() => {
    if (role === 'super_admin' || role === 'admin') return shops;
    if (isWarehouse) {
      if (p?.warehouse_all_shops) return shops;
      const ids: string[] = p?.warehouse_shop_ids || [];
      return shops.filter(s => ids.includes(s.id));
    }
    if ((role === 'manager' || role === 'user') && p?.shop_id) {
      return shops.filter(s => s.id === p.shop_id);
    }
    return shops;
  }, [shops, role, isWarehouse, p?.warehouse_all_shops, p?.warehouse_shop_ids, p?.shop_id]);

  return {
    requirements, shops, visibleShops, loading, saving,
    createRequirement, updateStatus, undoStatus, refresh: fetchAll,
    tenantId, canFulfil, isWarehouse,
  };
};
