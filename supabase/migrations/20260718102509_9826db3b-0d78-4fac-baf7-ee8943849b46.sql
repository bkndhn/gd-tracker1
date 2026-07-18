
-- Harden profiles_update_own to use security-definer helpers (NULL-safe, no subquery bypass)
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role = public.get_user_role_secure(auth.uid())
  AND COALESCE(admin_id::text, '') = COALESCE(public.get_user_admin_id_secure(auth.uid())::text, '')
  AND COALESCE(shop_id::text, '') = COALESCE(public.get_user_shop_id_secure(auth.uid())::text, '')
  AND status = 'active'
);

-- Make gd_entry_images access explicit and consistent with entry-level scoping
DROP POLICY IF EXISTS gd_images_all ON public.gd_entry_images;

CREATE POLICY gd_images_all ON public.gd_entry_images
FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.goods_damaged_entries gde
    WHERE gde.id = gd_entry_images.gd_entry_id
      AND (
        gde.admin_id = public.get_user_admin_id_secure(auth.uid())
        OR gde.employee_id = auth.uid()
        OR (gde.shop_id IS NOT NULL AND gde.shop_id = public.get_user_shop_id_secure(auth.uid()))
      )
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.goods_damaged_entries gde
    WHERE gde.id = gd_entry_images.gd_entry_id
      AND (
        gde.admin_id = public.get_user_admin_id_secure(auth.uid())
        OR gde.employee_id = auth.uid()
        OR (gde.shop_id IS NOT NULL AND gde.shop_id = public.get_user_shop_id_secure(auth.uid()))
      )
  )
);
