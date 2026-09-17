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
      // Phase 2C: source labels from seeded custom_fields (is_standard=true) so
      // renames in Custom Field Management propagate everywhere. Fall back to
      // legacy app_settings.field_visibility labels, then defaults.
      const [cfRes, settingsRes] = await Promise.all([
        supabase
          .from('custom_fields')
          .select('name, standard_key')
          .eq('admin_id', adminId)
          .eq('is_standard', true),
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'field_visibility')
          .eq('admin_id', adminId)
          .maybeSingle(),
      ]);

      const cfMap: Record<string, string> = {};
      (cfRes.data || []).forEach((r: any) => {
        if (r.standard_key && r.name) cfMap[r.standard_key] = r.name;
      });
      const legacy = ((settingsRes.data?.value as any)?.labels) || {};

      const pick = (key: keyof FieldLabels, standardKey: string) =>
        cfMap[standardKey] || legacy[key] || DEFAULT_LABELS[key];

      setLabels({
        category: pick('category', 'category'),
        size: pick('size', 'size'),
        customer_type: pick('customer_type', 'customer_type'),
        shops: pick('shops', 'shop'),
      });
    } catch (e) {
      if (import.meta.env.DEV) console.error('useFieldLabels error', e);
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!adminId) return;
    const channelName = `fl_${adminId}_${Math.random().toString(36).substring(2, 9)}`;
    let channel: any = null;

    try {
      channel = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: `admin_id=eq.${adminId}` }, () => load())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_fields', filter: `admin_id=eq.${adminId}` }, () => load())
        .subscribe();
    } catch (err) {
      if (import.meta.env.DEV) console.error('useFieldLabels realtime subscription error', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [adminId, load]);

  return { labels, loading, reload: load };
};
