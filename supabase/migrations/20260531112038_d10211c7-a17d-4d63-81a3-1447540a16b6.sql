CREATE OR REPLACE FUNCTION public.ensure_current_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  auth_user record;
  profile_row public.profiles%ROWTYPE;
  requested_admin_id uuid;
  requested_shop_id uuid;
  requested_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO profile_row
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;

  IF FOUND THEN
    RETURN profile_row;
  END IF;

  SELECT id, email, raw_user_meta_data
  INTO auth_user
  FROM auth.users
  WHERE id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Authenticated user not found';
  END IF;

  requested_admin_id := NULLIF(auth_user.raw_user_meta_data->>'admin_id', '')::uuid;
  requested_shop_id := NULLIF(auth_user.raw_user_meta_data->>'shop_id', '')::uuid;
  requested_role := COALESCE(NULLIF(auth_user.raw_user_meta_data->>'role', ''), 'admin');

  IF requested_admin_id IS NULL THEN
    requested_admin_id := auth_user.id;
    requested_role := 'admin';
  ELSIF requested_role NOT IN ('manager', 'user') THEN
    requested_role := 'user';
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    name,
    user_id,
    role,
    admin_id,
    shop_id,
    status
  ) VALUES (
    auth_user.id,
    auth_user.email,
    COALESCE(NULLIF(auth_user.raw_user_meta_data->>'name', ''), auth_user.email, 'New User'),
    auth_user.email,
    requested_role,
    requested_admin_id,
    requested_shop_id,
    'active'
  )
  RETURNING * INTO profile_row;

  RETURN profile_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_current_profile() TO authenticated;

INSERT INTO public.profiles (
  id,
  email,
  name,
  user_id,
  role,
  admin_id,
  shop_id,
  status
)
SELECT
  u.id,
  u.email,
  COALESCE(NULLIF(u.raw_user_meta_data->>'name', ''), u.email, 'New User'),
  u.email,
  CASE
    WHEN NULLIF(u.raw_user_meta_data->>'admin_id', '') IS NULL THEN 'admin'
    WHEN COALESCE(NULLIF(u.raw_user_meta_data->>'role', ''), 'user') IN ('manager', 'user') THEN COALESCE(NULLIF(u.raw_user_meta_data->>'role', ''), 'user')
    ELSE 'user'
  END,
  COALESCE(NULLIF(u.raw_user_meta_data->>'admin_id', '')::uuid, u.id),
  NULLIF(u.raw_user_meta_data->>'shop_id', '')::uuid,
  'active'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);