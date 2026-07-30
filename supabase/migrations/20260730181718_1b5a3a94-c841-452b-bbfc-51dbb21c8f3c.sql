-- Revoke default PUBLIC/anon execute on internal SECURITY DEFINER helpers
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'update_updated_at_column',
        'get_user_role_secure',
        'get_user_admin_id_secure',
        'is_super_admin',
        'get_user_shop_id_secure',
        'prevent_profile_privilege_escalation',
        'handle_new_user',
        'claim_legacy_lookup_row_for_admin',
        'ensure_current_profile',
        'can_access_gd_storage_path',
        'validate_gd_entry_custom_value',
        'has_role'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
  END LOOP;
END $$;

-- Re-grant only what the client legitimately calls
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('ensure_current_profile', 'can_access_gd_storage_path')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.sig);
  END LOOP;
END $$;