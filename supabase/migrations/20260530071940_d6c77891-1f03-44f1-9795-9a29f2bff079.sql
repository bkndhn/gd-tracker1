-- Restore explicit Data API grants for all affected existing public tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT ALL ON public.shops TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sizes TO authenticated;
GRANT ALL ON public.sizes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_types TO authenticated;
GRANT ALL ON public.customer_types TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_fields TO authenticated;
GRANT ALL ON public.custom_fields TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_field_options TO authenticated;
GRANT ALL ON public.custom_field_options TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goods_damaged_entries TO authenticated;
GRANT ALL ON public.goods_damaged_entries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gd_entry_images TO authenticated;
GRANT ALL ON public.gd_entry_images TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gd_entry_custom_values TO authenticated;
GRANT ALL ON public.gd_entry_custom_values TO service_role;

-- Ensure every tenant helper has stable, non-recursive behavior.
CREATE OR REPLACE FUNCTION public.get_user_role_secure(user_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = user_uuid
    AND deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_admin_id_secure(user_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN role IN ('admin', 'super_admin') THEN id
    ELSE admin_id
  END
  FROM public.profiles
  WHERE id = user_uuid
    AND deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.profiles
    WHERE id = user_uuid
      AND role = 'super_admin'
      AND deleted_at IS NULL
  );
$$;

-- Trigger helper: when an admin updates a legacy lookup row, claim it for that admin
-- so UPDATE WITH CHECK no longer rejects the changed row.
CREATE OR REPLACE FUNCTION public.claim_legacy_lookup_row_for_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller_role text;
  caller_admin_id uuid;
BEGIN
  caller_role := public.get_user_role_secure(auth.uid());
  caller_admin_id := public.get_user_admin_id_secure(auth.uid());

  IF public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF caller_role = 'admin' AND OLD.admin_id IS NULL THEN
    NEW.admin_id := caller_admin_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS claim_legacy_shops_before_update ON public.shops;
CREATE TRIGGER claim_legacy_shops_before_update
BEFORE UPDATE ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.claim_legacy_lookup_row_for_admin();

DROP TRIGGER IF EXISTS claim_legacy_categories_before_update ON public.categories;
CREATE TRIGGER claim_legacy_categories_before_update
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.claim_legacy_lookup_row_for_admin();

DROP TRIGGER IF EXISTS claim_legacy_sizes_before_update ON public.sizes;
CREATE TRIGGER claim_legacy_sizes_before_update
BEFORE UPDATE ON public.sizes
FOR EACH ROW
EXECUTE FUNCTION public.claim_legacy_lookup_row_for_admin();

DROP TRIGGER IF EXISTS claim_legacy_customer_types_before_update ON public.customer_types;
CREATE TRIGGER claim_legacy_customer_types_before_update
BEFORE UPDATE ON public.customer_types
FOR EACH ROW
EXECUTE FUNCTION public.claim_legacy_lookup_row_for_admin();

-- Replace lookup-table policies with tenant-aware access that supports legacy rows.
DROP POLICY IF EXISTS shops_select ON public.shops;
DROP POLICY IF EXISTS shops_admin_insert ON public.shops;
DROP POLICY IF EXISTS shops_admin_update ON public.shops;
DROP POLICY IF EXISTS shops_admin_delete ON public.shops;
CREATE POLICY shops_select ON public.shops
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND (admin_id IS NULL OR admin_id = public.get_user_admin_id_secure(auth.uid()) OR public.is_super_admin(auth.uid())));
CREATE POLICY shops_admin_insert ON public.shops
FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()) OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid())));
CREATE POLICY shops_admin_update ON public.shops
FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR (public.get_user_role_secure(auth.uid()) = 'admin' AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)))
WITH CHECK (public.is_super_admin(auth.uid()) OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid())));
CREATE POLICY shops_admin_delete ON public.shops
FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()) OR (public.get_user_role_secure(auth.uid()) = 'admin' AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)));

DROP POLICY IF EXISTS categories_select ON public.categories;
DROP POLICY IF EXISTS categories_admin_insert ON public.categories;
DROP POLICY IF EXISTS categories_admin_update ON public.categories;
DROP POLICY IF EXISTS categories_admin_delete ON public.categories;
CREATE POLICY categories_select ON public.categories
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND (admin_id IS NULL OR admin_id = public.get_user_admin_id_secure(auth.uid()) OR public.is_super_admin(auth.uid())));
CREATE POLICY categories_admin_insert ON public.categories
FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()) OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid())));
CREATE POLICY categories_admin_update ON public.categories
FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR (public.get_user_role_secure(auth.uid()) = 'admin' AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)))
WITH CHECK (public.is_super_admin(auth.uid()) OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid())));
CREATE POLICY categories_admin_delete ON public.categories
FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()) OR (public.get_user_role_secure(auth.uid()) = 'admin' AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)));

DROP POLICY IF EXISTS sizes_select ON public.sizes;
DROP POLICY IF EXISTS sizes_admin_insert ON public.sizes;
DROP POLICY IF EXISTS sizes_admin_update ON public.sizes;
DROP POLICY IF EXISTS sizes_admin_delete ON public.sizes;
CREATE POLICY sizes_select ON public.sizes
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND (admin_id IS NULL OR admin_id = public.get_user_admin_id_secure(auth.uid()) OR public.is_super_admin(auth.uid())));
CREATE POLICY sizes_admin_insert ON public.sizes
FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()) OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid())));
CREATE POLICY sizes_admin_update ON public.sizes
FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR (public.get_user_role_secure(auth.uid()) = 'admin' AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)))
WITH CHECK (public.is_super_admin(auth.uid()) OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid())));
CREATE POLICY sizes_admin_delete ON public.sizes
FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()) OR (public.get_user_role_secure(auth.uid()) = 'admin' AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)));

DROP POLICY IF EXISTS customer_types_select ON public.customer_types;
DROP POLICY IF EXISTS customer_types_admin_insert ON public.customer_types;
DROP POLICY IF EXISTS customer_types_admin_update ON public.customer_types;
DROP POLICY IF EXISTS customer_types_admin_delete ON public.customer_types;
CREATE POLICY customer_types_select ON public.customer_types
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND (admin_id IS NULL OR admin_id = public.get_user_admin_id_secure(auth.uid()) OR public.is_super_admin(auth.uid())));
CREATE POLICY customer_types_admin_insert ON public.customer_types
FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()) OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid())));
CREATE POLICY customer_types_admin_update ON public.customer_types
FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR (public.get_user_role_secure(auth.uid()) = 'admin' AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)))
WITH CHECK (public.is_super_admin(auth.uid()) OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid())));
CREATE POLICY customer_types_admin_delete ON public.customer_types
FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()) OR (public.get_user_role_secure(auth.uid()) = 'admin' AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)));

-- Custom fields/options: tenant admins manage their fields; super admin manages all.
DROP POLICY IF EXISTS custom_fields_all ON public.custom_fields;
CREATE POLICY custom_fields_all ON public.custom_fields
FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid())))
WITH CHECK (public.is_super_admin(auth.uid()) OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid())));

DROP POLICY IF EXISTS custom_field_options_all ON public.custom_field_options;
CREATE POLICY custom_field_options_all ON public.custom_field_options
FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.custom_fields cf
    WHERE cf.id = custom_field_options.custom_field_id
      AND cf.admin_id = public.get_user_admin_id_secure(auth.uid())
      AND cf.deleted_at IS NULL
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.custom_fields cf
    WHERE cf.id = custom_field_options.custom_field_id
      AND cf.admin_id = public.get_user_admin_id_secure(auth.uid())
      AND cf.deleted_at IS NULL
  )
);

-- Profiles/users: admins manage users inside their tenant; super admin sees all.
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_update_tenant ON public.profiles;
CREATE POLICY profiles_select_tenant ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR public.is_super_admin(auth.uid())
  OR (public.get_user_role_secure(auth.uid()) = 'admin' AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR id = public.get_user_admin_id_secure(auth.uid())))
);
CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_admin_update_tenant ON public.profiles
FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid()) AND id <> auth.uid())
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid()) AND id <> auth.uid() AND role IN ('manager', 'user'))
);

-- Dashboard/data-entry tables: tenant data is visible and manageable, including super admin oversight.
DROP POLICY IF EXISTS gd_entries_all ON public.goods_damaged_entries;
CREATE POLICY gd_entries_all ON public.goods_damaged_entries
FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR admin_id = public.get_user_admin_id_secure(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()) OR admin_id = public.get_user_admin_id_secure(auth.uid()));

DROP POLICY IF EXISTS gd_images_all ON public.gd_entry_images;
CREATE POLICY gd_images_all ON public.gd_entry_images
FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.goods_damaged_entries gde
    WHERE gde.id = gd_entry_images.gd_entry_id
      AND gde.admin_id = public.get_user_admin_id_secure(auth.uid())
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.goods_damaged_entries gde
    WHERE gde.id = gd_entry_images.gd_entry_id
      AND gde.admin_id = public.get_user_admin_id_secure(auth.uid())
  )
);

DROP POLICY IF EXISTS gd_custom_values_all ON public.gd_entry_custom_values;
CREATE POLICY gd_custom_values_all ON public.gd_entry_custom_values
FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.goods_damaged_entries gde
    WHERE gde.id = gd_entry_custom_values.gd_entry_id
      AND gde.admin_id = public.get_user_admin_id_secure(auth.uid())
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.goods_damaged_entries gde
    WHERE gde.id = gd_entry_custom_values.gd_entry_id
      AND gde.admin_id = public.get_user_admin_id_secure(auth.uid())
  )
);