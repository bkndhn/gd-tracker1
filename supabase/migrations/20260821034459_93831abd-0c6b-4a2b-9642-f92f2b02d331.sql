CREATE POLICY "lsi_evidence_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'lsi-evidence'
  AND (
    public.is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
  )
);

CREATE POLICY "lsi_evidence_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'lsi-evidence'
  AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
);

CREATE POLICY "lsi_evidence_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'lsi-evidence'
  AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'lsi-evidence'
  AND (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
);

CREATE POLICY "lsi_evidence_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'lsi-evidence'
  AND (
    public.is_super_admin(auth.uid())
    OR (
      (storage.foldername(name))[1] = public.get_user_admin_id_secure(auth.uid())::text
      AND (
        owner = auth.uid()
        OR public.get_user_role_secure(auth.uid()) IN ('admin','manager','super_admin')
      )
    )
  )
);