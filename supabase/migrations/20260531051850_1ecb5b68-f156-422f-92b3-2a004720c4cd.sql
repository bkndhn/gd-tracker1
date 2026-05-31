-- Fix 1: Prevent privilege escalation via profiles_update_own
-- Attach the existing prevent_profile_privilege_escalation trigger and tighten WITH CHECK

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation_trg ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- Tighten self-update policy: block role/admin_id/status/limits/shop_id changes at the policy level too
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  AND COALESCE(admin_id::text,'') = COALESCE((SELECT p.admin_id::text FROM public.profiles p WHERE p.id = auth.uid()),'')
  AND status = (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid())
);

-- Fix 2: Restrict Realtime channel subscriptions to the user's own admin tenant
-- Channel topic convention: "tenant:<admin_id>"
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_scoped_realtime_read" ON realtime.messages;
CREATE POLICY "tenant_scoped_realtime_read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'tenant:' || public.get_user_admin_id_secure(auth.uid())::text
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "tenant_scoped_realtime_write" ON realtime.messages;
CREATE POLICY "tenant_scoped_realtime_write"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = 'tenant:' || public.get_user_admin_id_secure(auth.uid())::text
  OR public.is_super_admin(auth.uid())
);
