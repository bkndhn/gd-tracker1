-- Repair tenant lookup-table RLS so soft-delete updates pass WITH CHECK
DROP POLICY IF EXISTS shops_admin_update ON public.shops;
CREATE POLICY shops_admin_update
ON public.shops
FOR UPDATE
TO authenticated
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
    AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)
  )
);

DROP POLICY IF EXISTS categories_admin_update ON public.categories;
CREATE POLICY categories_admin_update
ON public.categories
FOR UPDATE
TO authenticated
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
    AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)
  )
);

DROP POLICY IF EXISTS sizes_admin_update ON public.sizes;
CREATE POLICY sizes_admin_update
ON public.sizes
FOR UPDATE
TO authenticated
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
    AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)
  )
);

DROP POLICY IF EXISTS customer_types_admin_update ON public.customer_types;
CREATE POLICY customer_types_admin_update
ON public.customer_types
FOR UPDATE
TO authenticated
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
    AND (admin_id = public.get_user_admin_id_secure(auth.uid()) OR admin_id IS NULL)
  )
);

-- Let users/admins read image metadata for entries they can access in their tenant
DROP POLICY IF EXISTS gd_images_all ON public.gd_entry_images;
CREATE POLICY gd_images_all
ON public.gd_entry_images
FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.goods_damaged_entries gde
    WHERE gde.id = gd_entry_images.gd_entry_id
      AND (
        gde.admin_id = public.get_user_admin_id_secure(auth.uid())
        OR gde.employee_id = auth.uid()
        OR gde.shop_id = public.get_user_shop_id_secure(auth.uid())
      )
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.goods_damaged_entries gde
    WHERE gde.id = gd_entry_images.gd_entry_id
      AND (
        gde.admin_id = public.get_user_admin_id_secure(auth.uid())
        OR gde.employee_id = auth.uid()
        OR gde.shop_id = public.get_user_shop_id_secure(auth.uid())
      )
  )
);

-- Storage policies: allow the tenant folder format used by the app: {admin_id}/{entry_id}/file
DROP POLICY IF EXISTS gd_entry_images_insert_own ON storage.objects;
CREATE POLICY gd_entry_images_insert_own
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gd-entry-images'
  AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
);

DROP POLICY IF EXISTS gd_entry_images_select_own ON storage.objects;
CREATE POLICY gd_entry_images_select_own
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'gd-entry-images'
  AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
);

DROP POLICY IF EXISTS gd_entry_images_update_own ON storage.objects;
CREATE POLICY gd_entry_images_update_own
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'gd-entry-images'
  AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'gd-entry-images'
  AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
);

DROP POLICY IF EXISTS gd_entry_images_delete_own ON storage.objects;
CREATE POLICY gd_entry_images_delete_own
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'gd-entry-images'
  AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
);

DROP POLICY IF EXISTS gd_voice_notes_insert_own ON storage.objects;
CREATE POLICY gd_voice_notes_insert_own
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gd-voice-notes'
  AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
);

DROP POLICY IF EXISTS gd_voice_notes_select_own ON storage.objects;
CREATE POLICY gd_voice_notes_select_own
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'gd-voice-notes'
  AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
);

DROP POLICY IF EXISTS gd_voice_notes_update_own ON storage.objects;
CREATE POLICY gd_voice_notes_update_own
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'gd-voice-notes'
  AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'gd-voice-notes'
  AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
);

DROP POLICY IF EXISTS gd_voice_notes_delete_own ON storage.objects;
CREATE POLICY gd_voice_notes_delete_own
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'gd-voice-notes'
  AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
);