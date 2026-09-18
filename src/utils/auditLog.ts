import { supabase } from '@/integrations/supabase/client';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'signup'
  | 'password_reset'
  | 'user_created'
  | 'create_tenant'
  | 'user_deleted'
  | 'user_paused'
  | 'user_activated'
  | 'role_changed'
  | 'limits_updated'
  | 'bulk_pause'
  | 'bulk_activate'
  | 'entry_created'
  | 'entry_deleted'
  | 'shop_created'
  | 'shop_deleted'
  | 'category_created'
  | 'category_deleted'
  | 'size_created'
  | 'size_deleted'
  | 'signup_toggle'
  | 'settings_changed'
  | 'data_export'
  | 'pii_unmask'
  | 'screen_lock'
  | 'screen_unlock';

interface AuditLogParams {
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
}

export const logAudit = async ({ action, targetType, targetId, details }: AuditLogParams) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await ((supabase as any).from('audit_logs')).insert({
      user_id: user.id,
      user_email: user.email,
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      details: details || {},
    });
  } catch (e) {
    if (import.meta.env.DEV) console.error('Audit log failed:', e);
  }
};
