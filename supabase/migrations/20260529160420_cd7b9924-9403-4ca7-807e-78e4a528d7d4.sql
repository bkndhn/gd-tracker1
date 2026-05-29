-- Restore explicit Data API grants required by Supabase PostgREST
GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

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

-- Allow tenant admins to manage their own lookup rows and safely claim legacy global rows while editing them.
DROP POLICY IF EXISTS shops_admin_update ON public.shops;
CREATE POLICY shops_admin_update ON public.shops
FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND admin_id = public.get_user_admin_id_secure(auth.uid())
  )
);

DROP POLICY IF EXISTS shops_admin_delete ON public.shops;
CREATE POLICY shops_admin_delete ON public.shops
FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)
  )
);

DROP POLICY IF EXISTS categories_admin_update ON public.categories;
CREATE POLICY categories_admin_update ON public.categories
FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND admin_id = public.get_user_admin_id_secure(auth.uid())
  )
);

DROP POLICY IF EXISTS categories_admin_delete ON public.categories;
CREATE POLICY categories_admin_delete ON public.categories
FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)
  )
);

DROP POLICY IF EXISTS sizes_admin_update ON public.sizes;
CREATE POLICY sizes_admin_update ON public.sizes
FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND admin_id = public.get_user_admin_id_secure(auth.uid())
  )
);

DROP POLICY IF EXISTS sizes_admin_delete ON public.sizes;
CREATE POLICY sizes_admin_delete ON public.sizes
FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)
  )
);

DROP POLICY IF EXISTS customer_types_admin_update ON public.customer_types;
CREATE POLICY customer_types_admin_update ON public.customer_types
FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND admin_id = public.get_user_admin_id_secure(auth.uid())
  )
);

DROP POLICY IF EXISTS customer_types_admin_delete ON public.customer_types;
CREATE POLICY customer_types_admin_delete ON public.customer_types
FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)
  )
);

-- Tighten custom-field policies to authenticated admins in their tenant, with super admin override.
DROP POLICY IF EXISTS custom_fields_all ON public.custom_fields;
CREATE POLICY custom_fields_all ON public.custom_fields
FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND admin_id = public.get_user_admin_id_secure(auth.uid())
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND admin_id = public.get_user_admin_id_secure(auth.uid())
  )
);

DROP POLICY IF EXISTS custom_field_options_all ON public.custom_field_options;
CREATE POLICY custom_field_options_all ON public.custom_field_options
FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.custom_fields cf
    WHERE cf.id = custom_field_options.custom_field_id
      AND cf.admin_id = public.get_user_admin_id_secure(auth.uid())
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.custom_fields cf
    WHERE cf.id = custom_field_options.custom_field_id
      AND cf.admin_id = public.get_user_admin_id_secure(auth.uid())
  )
);

-- Ensure auth signup trigger copies selected shop and tenant metadata into profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin_id uuid;
  _role text;
  _status text;
  _shop_id uuid;
BEGIN
  _admin_id := NULLIF(NEW.raw_user_meta_data->>'admin_id', '')::uuid;
  _role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'admin');
  _shop_id := NULLIF(NEW.raw_user_meta_data->>'shop_id', '')::uuid;

  IF _admin_id IS NULL THEN
    _admin_id := NEW.id;
    _role := 'admin';
    _status := 'active';
  ELSE
    _status := 'active';
  END IF;

  INSERT INTO public.profiles(
    id,
    email,
    name,
    user_id,
    role,
    admin_id,
    shop_id,
    status
  )
  VALUES(
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), NEW.email, 'New User'),
    NEW.email,
    _role,
    _admin_id,
    _shop_id,
    _status
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    user_id = EXCLUDED.user_id,
    role = EXCLUDED.role,
    admin_id = EXCLUDED.admin_id,
    shop_id = EXCLUDED.shop_id,
    status = EXCLUDED.status,
    updated_at = now();

  RETURN NEW;
END;
$function$;