
-- Tighten shop/branch isolation on goods_damaged_entries
DROP POLICY IF EXISTS gd_entries_all ON public.goods_damaged_entries;

CREATE POLICY gd_entries_admin_all ON public.goods_damaged_entries
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

CREATE POLICY gd_entries_manager_shop ON public.goods_damaged_entries
FOR ALL TO authenticated
USING (
  public.get_user_role_secure(auth.uid()) = 'manager'
  AND admin_id = public.get_user_admin_id_secure(auth.uid())
  AND shop_id IS NOT NULL
  AND shop_id = public.get_user_shop_id_secure(auth.uid())
)
WITH CHECK (
  public.get_user_role_secure(auth.uid()) = 'manager'
  AND admin_id = public.get_user_admin_id_secure(auth.uid())
  AND shop_id IS NOT NULL
  AND shop_id = public.get_user_shop_id_secure(auth.uid())
);

CREATE POLICY gd_entries_user_own ON public.goods_damaged_entries
FOR ALL TO authenticated
USING (
  public.get_user_role_secure(auth.uid()) = 'user'
  AND admin_id = public.get_user_admin_id_secure(auth.uid())
  AND employee_id = auth.uid()
)
WITH CHECK (
  public.get_user_role_secure(auth.uid()) = 'user'
  AND admin_id = public.get_user_admin_id_secure(auth.uid())
  AND employee_id = auth.uid()
);
