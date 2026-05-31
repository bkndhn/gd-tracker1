-- Explicitly block direct client-side profile creation.
-- Profiles are created by the trusted auth trigger / backend service role only.
DROP POLICY IF EXISTS profiles_no_direct_client_insert ON public.profiles;
CREATE POLICY profiles_no_direct_client_insert
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Allow tenant members to read active, visible custom field definitions needed for entry forms.
-- Admin/super-admin management remains controlled by the existing custom_fields_all policy.
DROP POLICY IF EXISTS custom_fields_tenant_member_select ON public.custom_fields;
CREATE POLICY custom_fields_tenant_member_select
ON public.custom_fields
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND is_visible IS TRUE
  AND (
    public.is_super_admin(auth.uid())
    OR admin_id = public.get_user_admin_id_secure(auth.uid())
  )
);

-- Allow tenant members to read active options for active, visible custom fields in their tenant.
-- Admin/super-admin management remains controlled by the existing custom_field_options_all policy.
DROP POLICY IF EXISTS custom_field_options_tenant_member_select ON public.custom_field_options;
CREATE POLICY custom_field_options_tenant_member_select
ON public.custom_field_options
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.custom_fields cf
    WHERE cf.id = custom_field_options.custom_field_id
      AND cf.deleted_at IS NULL
      AND cf.is_visible IS TRUE
      AND (
        public.is_super_admin(auth.uid())
        OR cf.admin_id = public.get_user_admin_id_secure(auth.uid())
      )
  )
);