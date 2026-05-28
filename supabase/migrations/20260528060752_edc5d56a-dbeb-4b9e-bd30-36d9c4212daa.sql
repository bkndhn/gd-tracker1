
-- 1) Prevent privilege escalation on profiles via trigger
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
BEGIN
  caller_role := public.get_user_role_secure(auth.uid());
  IF caller_role IS DISTINCT FROM 'super_admin' AND caller_role IS DISTINCT FROM 'admin' THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.admin_id IS DISTINCT FROM OLD.admin_id
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.max_users IS DISTINCT FROM OLD.max_users
       OR NEW.max_shops IS DISTINCT FROM OLD.max_shops
       OR NEW.max_entries IS DISTINCT FROM OLD.max_entries
       OR NEW.max_images_per_entry IS DISTINCT FROM OLD.max_images_per_entry
       OR NEW.max_images_total IS DISTINCT FROM OLD.max_images_total
       OR NEW.shop_id IS DISTINCT FROM OLD.shop_id
    THEN
      RAISE EXCEPTION 'Not allowed to change privileged fields';
    END IF;
  END IF;
  -- Even admins cannot change role to super_admin unless they are super_admin
  IF caller_role IS DISTINCT FROM 'super_admin' AND NEW.role = 'super_admin' AND OLD.role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only super_admin can grant super_admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 2) Tighten lookup-table SELECT policies to authenticated users
DROP POLICY IF EXISTS categories_select ON public.categories;
CREATE POLICY categories_select ON public.categories
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS sizes_select ON public.sizes;
CREATE POLICY sizes_select ON public.sizes
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS customer_types_select ON public.customer_types;
CREATE POLICY customer_types_select ON public.customer_types
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS shops_select ON public.shops;
CREATE POLICY shops_select ON public.shops
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

REVOKE SELECT ON public.categories, public.sizes, public.customer_types, public.shops FROM anon;

-- 3) Restrict custom_field_options to tenant of parent custom_field
DROP POLICY IF EXISTS custom_field_options_all ON public.custom_field_options;
CREATE POLICY custom_field_options_all ON public.custom_field_options
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_fields cf
      WHERE cf.id = custom_field_options.custom_field_id
        AND cf.admin_id = public.get_user_admin_id_secure(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.custom_fields cf
      WHERE cf.id = custom_field_options.custom_field_id
        AND cf.admin_id = public.get_user_admin_id_secure(auth.uid())
    )
  );

-- 4) Restrict gd_entry_custom_values via parent goods_damaged_entries
DROP POLICY IF EXISTS gd_custom_values_all ON public.gd_entry_custom_values;
CREATE POLICY gd_custom_values_all ON public.gd_entry_custom_values
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goods_damaged_entries gde
      WHERE gde.id = gd_entry_custom_values.gd_entry_id
        AND gde.admin_id = public.get_user_admin_id_secure(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.goods_damaged_entries gde
      WHERE gde.id = gd_entry_custom_values.gd_entry_id
        AND gde.admin_id = public.get_user_admin_id_secure(auth.uid())
    )
  );

-- 5) Restrict gd_entry_images via parent goods_damaged_entries
DROP POLICY IF EXISTS gd_images_all ON public.gd_entry_images;
CREATE POLICY gd_images_all ON public.gd_entry_images
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goods_damaged_entries gde
      WHERE gde.id = gd_entry_images.gd_entry_id
        AND gde.admin_id = public.get_user_admin_id_secure(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.goods_damaged_entries gde
      WHERE gde.id = gd_entry_images.gd_entry_id
        AND gde.admin_id = public.get_user_admin_id_secure(auth.uid())
    )
  );

-- 6) Storage policies for private buckets (tenant-scoped via folder = admin_id)
DROP POLICY IF EXISTS "gd_entry_images_select_own" ON storage.objects;
CREATE POLICY "gd_entry_images_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'gd-entry-images'
    AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
  );

DROP POLICY IF EXISTS "gd_entry_images_insert_own" ON storage.objects;
CREATE POLICY "gd_entry_images_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gd-entry-images'
    AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
  );

DROP POLICY IF EXISTS "gd_entry_images_update_own" ON storage.objects;
CREATE POLICY "gd_entry_images_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'gd-entry-images'
    AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
  );

DROP POLICY IF EXISTS "gd_entry_images_delete_own" ON storage.objects;
CREATE POLICY "gd_entry_images_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'gd-entry-images'
    AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
  );

DROP POLICY IF EXISTS "gd_voice_notes_select_own" ON storage.objects;
CREATE POLICY "gd_voice_notes_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'gd-voice-notes'
    AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
  );

DROP POLICY IF EXISTS "gd_voice_notes_insert_own" ON storage.objects;
CREATE POLICY "gd_voice_notes_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gd-voice-notes'
    AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
  );

DROP POLICY IF EXISTS "gd_voice_notes_update_own" ON storage.objects;
CREATE POLICY "gd_voice_notes_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'gd-voice-notes'
    AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
  );

DROP POLICY IF EXISTS "gd_voice_notes_delete_own" ON storage.objects;
CREATE POLICY "gd_voice_notes_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'gd-voice-notes'
    AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
  );

-- 7) Fix function search_path mutable on update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 8) Revoke EXECUTE on SECURITY DEFINER helpers from anon to address public-executable findings
REVOKE EXECUTE ON FUNCTION public.get_user_role_secure(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_admin_id_secure(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_shop_id_secure(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role_secure(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_admin_id_secure(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_shop_id_secure(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
