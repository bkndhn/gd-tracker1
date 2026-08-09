import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type SavedViewPage = 'reports' | 'dashboard';
export type SavedViewScope = 'private' | 'shop' | 'tenant';

export interface SavedView {
  id: string;
  name: string;
  page: SavedViewPage;
  scope: SavedViewScope;
  filters: Record<string, any>;
  is_default: boolean;
  owner_id: string;
  shop_id: string | null;
  created_at: string;
}

export function useSavedViews(page: SavedViewPage) {
  const { user, profile, isAdmin, isSuperAdmin, adminId, userShopId } = useAuth();
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);

  const tenantId = (profile as any)?.role === 'admin' ? profile?.id : adminId;

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const { data, error } = await (supabase.from('saved_views') as any)
        .select('*')
        .eq('page', page)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setViews((data || []) as SavedView[]);
    } catch (e) {
      if (import.meta.env.DEV) console.error('useSavedViews load', e);
    } finally {
      setLoading(false);
    }
  }, [page, user?.id]);

  useEffect(() => { load(); }, [load]);

  const saveView = useCallback(
    async (name: string, filters: Record<string, any>, scope: SavedViewScope, isDefault: boolean) => {
      if (!user?.id || !tenantId) return null;
      const trimmed = name.trim();
      if (!trimmed) { toast.error('Please name the view'); return null; }
      if (scope === 'tenant' && !isAdmin && !isSuperAdmin) {
        toast.error('Only admins can share with the whole organisation');
        return null;
      }
      try {
        if (isDefault) {
          await (supabase.from('saved_views') as any)
            .update({ is_default: false })
            .eq('owner_id', user.id)
            .eq('page', page);
        }
        const { data, error } = await (supabase.from('saved_views') as any)
          .insert({
            admin_id: tenantId,
            owner_id: user.id,
            shop_id: scope === 'shop' ? userShopId ?? null : null,
            name: trimmed,
            page,
            scope,
            filters,
            is_default: isDefault,
          })
          .select()
          .single();
        if (error) throw error;
        await load();
        toast.success('View saved');
        return data as SavedView;
      } catch (e: any) {
        toast.error(e?.message || 'Could not save view');
        return null;
      }
    },
    [user?.id, tenantId, isAdmin, isSuperAdmin, userShopId, page, load],
  );

  const deleteView = useCallback(async (id: string) => {
    try {
      const { error } = await (supabase.from('saved_views') as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setViews(prev => prev.filter(v => v.id !== id));
      toast.success('View deleted');
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete view');
    }
  }, []);

  const setDefaultView = useCallback(async (id: string) => {
    if (!user?.id) return;
    try {
      await (supabase.from('saved_views') as any)
        .update({ is_default: false })
        .eq('owner_id', user.id)
        .eq('page', page);
      await (supabase.from('saved_views') as any).update({ is_default: true }).eq('id', id);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Could not update default view');
    }
  }, [user?.id, page, load]);

  const defaultView = views.find(v => v.is_default && v.owner_id === user?.id) || null;

  return { views, loading, saveView, deleteView, setDefaultView, defaultView, reload: load, canShareTenant: isAdmin || isSuperAdmin, hasShop: !!userShopId };
}
