DROP POLICY IF EXISTS follow_ups_select ON public.follow_ups;
CREATE POLICY follow_ups_select ON public.follow_ups
FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    admin_id = get_user_admin_id_secure(auth.uid())
    AND (
      get_user_role_secure(auth.uid()) = ANY (ARRAY['admin','super_admin'])
      OR sent_by = auth.uid()
      OR (shop_id IS NOT NULL AND shop_id = get_user_shop_id_secure(auth.uid()))
    )
  )
);

DROP POLICY IF EXISTS entry_evidence_select ON public.entry_evidence;
CREATE POLICY entry_evidence_select ON public.entry_evidence
FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    admin_id = get_user_admin_id_secure(auth.uid())
    AND (
      get_user_role_secure(auth.uid()) = ANY (ARRAY['admin','super_admin'])
      OR uploaded_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.goods_damaged_entries gde
        WHERE gde.id = entry_evidence.entry_id
          AND (
            gde.employee_id = auth.uid()
            OR (
              get_user_role_secure(auth.uid()) = 'manager'
              AND gde.shop_id IS NOT NULL
              AND gde.shop_id = get_user_shop_id_secure(auth.uid())
            )
          )
      )
    )
  )
);