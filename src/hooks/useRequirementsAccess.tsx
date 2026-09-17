import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdminSetting } from '@/hooks/useAdminSetting';

/**
 * Who may see the Requirements tab:
 *  - Super Admin enables the feature per tenant (`profiles.requirements_enabled` on the admin row)
 *  - the tenant admin can hide the tab for everyone (`app_settings.requirements_visible`)
 */
export const useRequirementsAccess = () => {
  const { profile } = useAuth();
  const p = profile as any;
  const role = p?.role as string | undefined;
  const tenantId = role === 'admin' || role === 'super_admin' ? p?.id : p?.admin_id;

  const { value: visible, loading: settingLoading, save, canEdit } =
    useAdminSetting<boolean>('requirements_visible', true, raw => raw !== false);

  const [tenantEnabled, setTenantEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tenantId) return;
      const { data } = await supabase
        .from('profiles')
        .select('requirements_enabled')
        .eq('id', tenantId)
        .maybeSingle();
      if (!cancelled && data) setTenantEnabled((data as any).requirements_enabled !== false);
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  return {
    enabled: tenantEnabled && visible !== false && role !== 'super_admin',
    tenantEnabled,
    visible,
    loading: settingLoading,
    save,
    canEdit,
  };
};
