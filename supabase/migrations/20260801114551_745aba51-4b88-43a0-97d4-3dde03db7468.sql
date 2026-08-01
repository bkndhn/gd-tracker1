DROP POLICY IF EXISTS "app_settings_all" ON public.app_settings;

CREATE POLICY "app_settings_select_tenant"
ON public.app_settings
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR admin_id IS NULL
  OR admin_id = public.get_user_admin_id_secure(auth.uid())
);

CREATE POLICY "app_settings_insert_tenant"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND admin_id IS NOT NULL
    AND admin_id = public.get_user_admin_id_secure(auth.uid())
  )
);

CREATE POLICY "app_settings_update_tenant"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND admin_id IS NOT NULL
    AND admin_id = public.get_user_admin_id_secure(auth.uid())
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND admin_id IS NOT NULL
    AND admin_id = public.get_user_admin_id_secure(auth.uid())
  )
);

CREATE POLICY "app_settings_delete_tenant"
ON public.app_settings
FOR DELETE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND admin_id IS NOT NULL
    AND admin_id = public.get_user_admin_id_secure(auth.uid())
  )
);