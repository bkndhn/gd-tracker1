DROP POLICY IF EXISTS app_settings_all ON public.app_settings;
CREATE POLICY app_settings_all ON public.app_settings
  FOR ALL
  TO authenticated
  USING (public.get_user_role_secure(auth.uid()) IN ('admin','super_admin'))
  WITH CHECK (public.get_user_role_secure(auth.uid()) IN ('admin','super_admin'));