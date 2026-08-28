DROP POLICY IF EXISTS custom_field_options_all ON public.custom_field_options;
CREATE POLICY custom_field_options_all ON public.custom_field_options
FOR ALL TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    get_user_role_secure(auth.uid()) = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.custom_fields cf
      WHERE cf.id = custom_field_options.custom_field_id
        AND cf.admin_id = get_user_admin_id_secure(auth.uid())
        AND cf.deleted_at IS NULL
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    get_user_role_secure(auth.uid()) = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.custom_fields cf
      WHERE cf.id = custom_field_options.custom_field_id
        AND cf.admin_id = get_user_admin_id_secure(auth.uid())
        AND cf.deleted_at IS NULL
    )
  )
);

DROP POLICY IF EXISTS anomaly_alerts_ack ON public.anomaly_alerts;
CREATE POLICY anomaly_alerts_ack ON public.anomaly_alerts
FOR UPDATE TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    admin_id = get_user_admin_id_secure(auth.uid())
    AND get_user_role_secure(auth.uid()) = ANY (ARRAY['admin','manager'])
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    admin_id = get_user_admin_id_secure(auth.uid())
    AND get_user_role_secure(auth.uid()) = ANY (ARRAY['admin','manager'])
  )
);