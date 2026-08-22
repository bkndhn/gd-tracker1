DROP POLICY IF EXISTS shops_select ON public.shops;
CREATE POLICY shops_select ON public.shops FOR SELECT TO authenticated
USING (deleted_at IS NULL AND (is_super_admin(auth.uid()) OR (admin_id IS NOT NULL AND admin_id = get_user_admin_id_secure(auth.uid()))));

DROP POLICY IF EXISTS categories_select ON public.categories;
CREATE POLICY categories_select ON public.categories FOR SELECT TO authenticated
USING (deleted_at IS NULL AND (is_super_admin(auth.uid()) OR (admin_id IS NOT NULL AND admin_id = get_user_admin_id_secure(auth.uid()))));

DROP POLICY IF EXISTS sizes_select ON public.sizes;
CREATE POLICY sizes_select ON public.sizes FOR SELECT TO authenticated
USING (deleted_at IS NULL AND (is_super_admin(auth.uid()) OR (admin_id IS NOT NULL AND admin_id = get_user_admin_id_secure(auth.uid()))));

DROP POLICY IF EXISTS customer_types_select ON public.customer_types;
CREATE POLICY customer_types_select ON public.customer_types FOR SELECT TO authenticated
USING (deleted_at IS NULL AND (is_super_admin(auth.uid()) OR (admin_id IS NOT NULL AND admin_id = get_user_admin_id_secure(auth.uid()))));