import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface FieldLabels {
  category: string;
  size: string;
  customer_type: string;
  shops: string;
}

export const DEFAULT_LABELS: FieldLabels = {
  category: 'Category',
  size: 'Size',
  customer_type: 'Customer Type',
  shops: 'Shop',
};

export const useFieldLabels = () => {
  const { profile } = useAuth();
  const [labels, setLabels] = useState<FieldLabels>(DEFAULT_LABELS);
  const [loading, setLoading] = useState(true);

  const adminId = (profile as any)?.role === 'admin' ? profile?.id : (profile as any)?.admin_id;

  const load = useCallback(async () => {
    if (!adminId) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'field_visibility')
        .eq('admin_id', adminId)
        .maybeSingle();
      if (data?.value) {
        const v = data.value as any;
        const l = v.labels || {};
        setLabels({
          category: l.category || DEFAULT_LABELS.category,
          size: l.size || DEFAULT_LABELS.size,
          customer_type: l.customer_type || DEFAULT_LABELS.customer_type,
          shops: l.shops || DEFAULT_LABELS.shops,
        });
      }
    } catch (e) {
      if (import.meta.env.DEV) console.error('useFieldLabels error', e);
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!adminId) return;
    const ch = supabase
      .channel(`field-labels-${adminId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: `admin_id=eq.${adminId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [adminId, load]);

  return { labels, loading, reload: load };
};
