
-- 1) Add admin_id to lookup tables (nullable to keep legacy rows)
ALTER TABLE public.shops          ADD COLUMN IF NOT EXISTS admin_id uuid;
ALTER TABLE public.categories     ADD COLUMN IF NOT EXISTS admin_id uuid;
ALTER TABLE public.sizes          ADD COLUMN IF NOT EXISTS admin_id uuid;
ALTER TABLE public.customer_types ADD COLUMN IF NOT EXISTS admin_id uuid;

CREATE INDEX IF NOT EXISTS idx_shops_admin_id          ON public.shops(admin_id);
CREATE INDEX IF NOT EXISTS idx_categories_admin_id     ON public.categories(admin_id);
CREATE INDEX IF NOT EXISTS idx_sizes_admin_id          ON public.sizes(admin_id);
CREATE INDEX IF NOT EXISTS idx_customer_types_admin_id ON public.customer_types(admin_id);

-- 2) Replace SELECT policies: tenant-scoped or legacy NULL, signed in only
DROP POLICY IF EXISTS shops_select ON public.shops;
CREATE POLICY shops_select ON public.shops
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (admin_id IS NULL OR admin_id = public.get_user_admin_id_secure(auth.uid()) OR public.is_super_admin(auth.uid()))
  );

DROP POLICY IF EXISTS categories_select ON public.categories;
CREATE POLICY categories_select ON public.categories
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (admin_id IS NULL OR admin_id = public.get_user_admin_id_secure(auth.uid()) OR public.is_super_admin(auth.uid()))
  );

DROP POLICY IF EXISTS sizes_select ON public.sizes;
CREATE POLICY sizes_select ON public.sizes
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (admin_id IS NULL OR admin_id = public.get_user_admin_id_secure(auth.uid()) OR public.is_super_admin(auth.uid()))
  );

DROP POLICY IF EXISTS customer_types_select ON public.customer_types;
CREATE POLICY customer_types_select ON public.customer_types
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (admin_id IS NULL OR admin_id = public.get_user_admin_id_secure(auth.uid()) OR public.is_super_admin(auth.uid()))
  );

-- 3) Admin/super_admin CRUD policies on lookups (tenant scoped; super_admin unrestricted)
-- SHOPS
DROP POLICY IF EXISTS shops_admin_insert ON public.shops;
CREATE POLICY shops_admin_insert ON public.shops
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role_secure(auth.uid()) IN ('admin','super_admin')
    AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR public.is_super_admin(auth.uid()))
  );
DROP POLICY IF EXISTS shops_admin_update ON public.shops;
CREATE POLICY shops_admin_update ON public.shops
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid()))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid()))
  );
DROP POLICY IF EXISTS shops_admin_delete ON public.shops;
CREATE POLICY shops_admin_delete ON public.shops
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid()))
  );

-- CATEGORIES
DROP POLICY IF EXISTS categories_admin_insert ON public.categories;
CREATE POLICY categories_admin_insert ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role_secure(auth.uid()) IN ('admin','super_admin')
    AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR public.is_super_admin(auth.uid()))
  );
DROP POLICY IF EXISTS categories_admin_update ON public.categories;
CREATE POLICY categories_admin_update ON public.categories
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid()))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid()))
  );
DROP POLICY IF EXISTS categories_admin_delete ON public.categories;
CREATE POLICY categories_admin_delete ON public.categories
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid()))
  );

-- SIZES
DROP POLICY IF EXISTS sizes_admin_insert ON public.sizes;
CREATE POLICY sizes_admin_insert ON public.sizes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role_secure(auth.uid()) IN ('admin','super_admin')
    AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR public.is_super_admin(auth.uid()))
  );
DROP POLICY IF EXISTS sizes_admin_update ON public.sizes;
CREATE POLICY sizes_admin_update ON public.sizes
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid()))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid()))
  );
DROP POLICY IF EXISTS sizes_admin_delete ON public.sizes;
CREATE POLICY sizes_admin_delete ON public.sizes
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid()))
  );

-- CUSTOMER_TYPES
DROP POLICY IF EXISTS customer_types_admin_insert ON public.customer_types;
CREATE POLICY customer_types_admin_insert ON public.customer_types
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role_secure(auth.uid()) IN ('admin','super_admin')
    AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR public.is_super_admin(auth.uid()))
  );
DROP POLICY IF EXISTS customer_types_admin_update ON public.customer_types;
CREATE POLICY customer_types_admin_update ON public.customer_types
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid()))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid()))
  );
DROP POLICY IF EXISTS customer_types_admin_delete ON public.customer_types;
CREATE POLICY customer_types_admin_delete ON public.customer_types
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = public.get_user_admin_id_secure(auth.uid()))
  );

-- 4) Allow admins to manage profiles within their tenant (sub-users)
DROP POLICY IF EXISTS profiles_admin_update_tenant ON public.profiles;
CREATE POLICY profiles_admin_update_tenant ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.get_user_role_secure(auth.uid()) = 'admin'
        AND admin_id = public.get_user_admin_id_secure(auth.uid()))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (public.get_user_role_secure(auth.uid()) = 'admin'
        AND admin_id = public.get_user_admin_id_secure(auth.uid()))
  );

-- 5) Ensure GRANTs (re-grant; safe if already present)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sizes          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_types TO authenticated;
GRANT ALL ON public.shops, public.categories, public.sizes, public.customer_types TO service_role;
