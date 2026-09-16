-- 1) Signup trigger must not trust client-supplied role/admin_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles(
    id, email, name, user_id, role, admin_id, shop_id, status
  )
  VALUES(
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), NEW.email, 'New User'),
    NEW.email,
    'admin',
    NEW.id,
    NULL,
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    user_id = EXCLUDED.user_id,
    updated_at = now();

  RETURN NEW;
END;
$function$;

-- 2) Same for the self-heal RPC
CREATE OR REPLACE FUNCTION public.ensure_current_profile()
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  auth_user record;
  profile_row public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO profile_row FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  IF FOUND THEN
    RETURN profile_row;
  END IF;

  SELECT id, email, raw_user_meta_data INTO auth_user
  FROM auth.users WHERE id = auth.uid() LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Authenticated user not found';
  END IF;

  INSERT INTO public.profiles (id, email, name, user_id, role, admin_id, shop_id, status)
  VALUES (
    auth_user.id,
    auth_user.email,
    COALESCE(NULLIF(auth_user.raw_user_meta_data->>'name', ''), auth_user.email, 'New User'),
    auth_user.email,
    'admin',
    auth_user.id,
    NULL,
    'active'
  )
  RETURNING * INTO profile_row;

  RETURN profile_row;
END;
$function$;

-- 3) Global settings readable only for the signup flag
DROP POLICY IF EXISTS app_settings_select_tenant ON public.app_settings;
CREATE POLICY app_settings_select_tenant
ON public.app_settings
FOR SELECT
TO authenticated
USING (
  admin_id = public.get_user_admin_id_secure(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR (admin_id IS NULL AND key = 'signup_enabled')
);