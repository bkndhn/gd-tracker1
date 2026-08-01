
-- 1. Restrict UPDATE/DELETE on shared (admin_id IS NULL) lookup rows to super_admin only
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['shops','categories','sizes','customer_types'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_delete', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR UPDATE TO authenticated
      USING (
        public.is_super_admin(auth.uid())
        OR (public.get_user_role_secure(auth.uid()) = 'admin'
            AND admin_id IS NOT NULL
            AND admin_id = public.get_user_admin_id_secure(auth.uid()))
      )
      WITH CHECK (
        public.is_super_admin(auth.uid())
        OR (public.get_user_role_secure(auth.uid()) = 'admin'
            AND admin_id IS NOT NULL
            AND admin_id = public.get_user_admin_id_secure(auth.uid()))
      )$f$, t || '_admin_update', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR DELETE TO authenticated
      USING (
        public.is_super_admin(auth.uid())
        OR (public.get_user_role_secure(auth.uid()) = 'admin'
            AND admin_id IS NOT NULL
            AND admin_id = public.get_user_admin_id_secure(auth.uid()))
      )$f$, t || '_admin_delete', t);
  END LOOP;
END $$;

-- 2. backup_logs: explicitly writable only by the backend (service role)
REVOKE INSERT, UPDATE, DELETE ON public.backup_logs FROM authenticated;
REVOKE ALL ON public.backup_logs FROM anon;
GRANT SELECT ON public.backup_logs TO authenticated;
GRANT ALL ON public.backup_logs TO service_role;

DROP POLICY IF EXISTS backup_logs_no_client_writes ON public.backup_logs;
CREATE POLICY backup_logs_no_client_writes
ON public.backup_logs
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (false);
