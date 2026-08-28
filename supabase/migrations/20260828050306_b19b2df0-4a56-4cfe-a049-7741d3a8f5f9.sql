-- Images: restrict cross-employee access to managers/admins
DROP POLICY IF EXISTS gd_images_all ON public.gd_entry_images;
CREATE POLICY gd_images_all ON public.gd_entry_images
FOR ALL TO authenticated
USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.goods_damaged_entries gde
    WHERE gde.id = gd_entry_images.gd_entry_id
      AND (
        gde.employee_id = auth.uid()
        OR (
          get_user_role_secure(auth.uid()) = ANY (ARRAY['admin','super_admin','manager'])
          AND gde.admin_id = get_user_admin_id_secure(auth.uid())
          AND (
            get_user_role_secure(auth.uid()) = ANY (ARRAY['admin','super_admin'])
            OR (gde.shop_id IS NOT NULL AND gde.shop_id = get_user_shop_id_secure(auth.uid()))
          )
        )
      )
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.goods_damaged_entries gde
    WHERE gde.id = gd_entry_images.gd_entry_id
      AND (
        gde.employee_id = auth.uid()
        OR (
          get_user_role_secure(auth.uid()) = ANY (ARRAY['admin','super_admin','manager'])
          AND gde.admin_id = get_user_admin_id_secure(auth.uid())
          AND (
            get_user_role_secure(auth.uid()) = ANY (ARRAY['admin','super_admin'])
            OR (gde.shop_id IS NOT NULL AND gde.shop_id = get_user_shop_id_secure(auth.uid()))
          )
        )
      )
  )
);

-- Custom values: same scoping
DROP POLICY IF EXISTS gd_custom_values_all ON public.gd_entry_custom_values;
CREATE POLICY gd_custom_values_all ON public.gd_entry_custom_values
FOR ALL TO authenticated
USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.goods_damaged_entries gde
    WHERE gde.id = gd_entry_custom_values.gd_entry_id
      AND (
        gde.employee_id = auth.uid()
        OR (
          get_user_role_secure(auth.uid()) = ANY (ARRAY['admin','super_admin','manager'])
          AND gde.admin_id = get_user_admin_id_secure(auth.uid())
          AND (
            get_user_role_secure(auth.uid()) = ANY (ARRAY['admin','super_admin'])
            OR (gde.shop_id IS NOT NULL AND gde.shop_id = get_user_shop_id_secure(auth.uid()))
          )
        )
      )
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.goods_damaged_entries gde
    WHERE gde.id = gd_entry_custom_values.gd_entry_id
      AND (
        gde.employee_id = auth.uid()
        OR (
          get_user_role_secure(auth.uid()) = ANY (ARRAY['admin','super_admin','manager'])
          AND gde.admin_id = get_user_admin_id_secure(auth.uid())
          AND (
            get_user_role_secure(auth.uid()) = ANY (ARRAY['admin','super_admin'])
            OR (gde.shop_id IS NOT NULL AND gde.shop_id = get_user_shop_id_secure(auth.uid()))
          )
        )
      )
  )
);

-- Anomaly alerts: tenant-wide visibility only for admin/manager roles
DROP POLICY IF EXISTS anomaly_alerts_select ON public.anomaly_alerts;
CREATE POLICY anomaly_alerts_select ON public.anomaly_alerts
FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    admin_id = get_user_admin_id_secure(auth.uid())
    AND (
      get_user_role_secure(auth.uid()) = ANY (ARRAY['admin','super_admin','manager'])
      OR (shop_id IS NOT NULL AND shop_id = get_user_shop_id_secure(auth.uid()))
    )
  )
);