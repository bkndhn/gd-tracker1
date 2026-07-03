
-- 1. Move pg_net out of public (drop + recreate in extensions schema)
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;

-- 2. Fix get_user_shop_id_secure to exclude soft-deleted
CREATE OR REPLACE FUNCTION public.get_user_shop_id_secure(user_uuid uuid)
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT shop_id FROM public.profiles
  WHERE id = user_uuid AND deleted_at IS NULL LIMIT 1;
$$;

-- 3. Tighten profiles self-update
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND admin_id IS NOT DISTINCT FROM (SELECT admin_id FROM public.profiles WHERE id = auth.uid())
    AND shop_id IS NOT DISTINCT FROM (SELECT shop_id FROM public.profiles WHERE id = auth.uid())
    AND status IS NOT DISTINCT FROM (SELECT status FROM public.profiles WHERE id = auth.uid())
  );

-- 4. Fix gd_entry_custom_values RLS to match sibling policies
DROP POLICY IF EXISTS gd_custom_values_all ON public.gd_entry_custom_values;
CREATE POLICY gd_custom_values_all ON public.gd_entry_custom_values
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.goods_damaged_entries gde
      WHERE gde.id = gd_entry_custom_values.gd_entry_id
        AND (gde.admin_id = public.get_user_admin_id_secure(auth.uid())
          OR gde.employee_id = auth.uid()
          OR gde.shop_id = public.get_user_shop_id_secure(auth.uid())
          OR public.is_super_admin(auth.uid())))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.goods_damaged_entries gde
      WHERE gde.id = gd_entry_custom_values.gd_entry_id
        AND (gde.admin_id = public.get_user_admin_id_secure(auth.uid())
          OR gde.employee_id = auth.uid()
          OR gde.shop_id = public.get_user_shop_id_secure(auth.uid())
          OR public.is_super_admin(auth.uid())))
  );

-- 5. Restrict scheduled_email_reports to admins/super_admins only
DROP POLICY IF EXISTS scheduled_email_reports_tenant_all ON public.scheduled_email_reports;
DROP POLICY IF EXISTS scheduled_email_reports_admin_all ON public.scheduled_email_reports;
CREATE POLICY scheduled_email_reports_admin_all ON public.scheduled_email_reports
  FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (admin_id = public.get_user_admin_id_secure(auth.uid())
        AND public.get_user_role_secure(auth.uid()) IN ('admin','super_admin'))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (admin_id = public.get_user_admin_id_secure(auth.uid())
        AND public.get_user_role_secure(auth.uid()) IN ('admin','super_admin'))
  );
