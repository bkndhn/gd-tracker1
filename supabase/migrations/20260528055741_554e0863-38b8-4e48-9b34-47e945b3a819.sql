
-- Ensure signup_enabled setting row exists
INSERT INTO public.app_settings (key, value, admin_id)
VALUES ('signup_enabled', 'true'::jsonb, NULL)
ON CONFLICT DO NOTHING;

-- Allow anonymous (and authenticated) users to read the public signup_enabled flag
DROP POLICY IF EXISTS app_settings_public_signup_read ON public.app_settings;
CREATE POLICY app_settings_public_signup_read
  ON public.app_settings FOR SELECT
  TO anon, authenticated
  USING (key = 'signup_enabled' AND admin_id IS NULL);

GRANT SELECT ON public.app_settings TO anon;
