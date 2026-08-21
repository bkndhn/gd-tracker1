import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Generic per-admin setting stored in `app_settings` (scoped by admin_id + key).
 * Every save is mirrored into `settings_audit_log` so admins can see who changed
 * what, diff the values and roll back.
 */
export function useAdminSetting<T>(
  key: string,
  fallback: T,
  normalize: (raw: any) => T = (raw) => (raw ?? fallback) as T,
) {
  const { profile } = useAuth();
  const [value, setValue] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);

  const role = (profile as any)?.role;
  const adminId = role === 'admin' || role === 'super_admin' ? profile?.id : (profile as any)?.admin_id;
  const canEdit = !!adminId && (role === 'admin' || role === 'super_admin');

  const load = useCallback(async () => {
    if (!adminId) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .eq('admin_id', adminId)
        .maybeSingle();
      setValue(normalize((data as any)?.value ?? null));
    } catch (e) {
      if (import.meta.env.DEV) console.error(`useAdminSetting(${key})`, e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId, key]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (next: T, note?: string) => {
    if (!adminId) throw new Error('No admin context');
    const clean = normalize(next);

    const { data: existing } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .eq('admin_id', adminId)
      .maybeSingle();

    const { error } = await (supabase.from('app_settings') as any).upsert(
      { key, admin_id: adminId, value: clean },
      { onConflict: 'admin_id,key' },
    );
    if (error) throw error;

    setValue(clean);

    try {
      await (supabase.from('settings_audit_log') as any).insert({
        admin_id: adminId,
        setting_key: key,
        changed_by: profile?.id,
        changed_by_name: (profile as any)?.name || (profile as any)?.email || null,
        old_value: (existing as any)?.value ?? null,
        new_value: clean as any,
        note: note || null,
      });
    } catch (e) {
      if (import.meta.env.DEV) console.error('settings_audit_log insert failed', e);
    }

    return clean;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId, key, profile]);

  return { value, setLocal: setValue, loading, save, reload: load, canEdit, adminId };
}
