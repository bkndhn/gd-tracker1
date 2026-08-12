import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DEFAULT_TEMPLATES, type TemplateKey } from '@/lib/whatsappFollowUp';

export const FOLLOW_UP_SETTINGS_KEY = 'wa_followup_templates';

export interface FollowUpSettings {
  templates: Record<TemplateKey, string>;
  /** Signature appended after the reply, e.g. store name / staff name */
  signature?: string;
  /** Include the anomaly hint line when a spike was detected for that shop */
  includeAnomalyNote: boolean;
}

const DEFAULTS: FollowUpSettings = {
  templates: { ...DEFAULT_TEMPLATES },
  signature: '',
  includeAnomalyNote: true,
};

/**
 * Per-admin WhatsApp follow-up settings.
 * Rows are stored in app_settings scoped by admin_id, so an admin only ever
 * reads or writes the templates that belong to their own shops/entries.
 */
export const useFollowUpTemplates = () => {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<FollowUpSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const adminId = (profile as any)?.role === 'admin' || (profile as any)?.role === 'super_admin'
    ? profile?.id
    : (profile as any)?.admin_id;

  const load = useCallback(async () => {
    if (!adminId) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', FOLLOW_UP_SETTINGS_KEY)
        .eq('admin_id', adminId)
        .maybeSingle();

      const value = (data?.value as any) || {};
      setSettings({
        templates: { ...DEFAULT_TEMPLATES, ...(value.templates || {}) },
        signature: value.signature || '',
        includeAnomalyNote: value.includeAnomalyNote ?? true,
      });
    } catch (e) {
      if (import.meta.env.DEV) console.error('useFollowUpTemplates error', e);
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (next: FollowUpSettings) => {
    if (!adminId) throw new Error('No admin context');
    const { error } = await (supabase.from('app_settings') as any).upsert(
      { key: FOLLOW_UP_SETTINGS_KEY, admin_id: adminId, value: next },
      { onConflict: 'admin_id,key' },
    );
    if (error) throw error;
    setSettings(next);
  }, [adminId]);

  return { settings, loading, save, reload: load, canEdit: !!adminId && ((profile as any)?.role === 'admin' || (profile as any)?.role === 'super_admin') };
};
