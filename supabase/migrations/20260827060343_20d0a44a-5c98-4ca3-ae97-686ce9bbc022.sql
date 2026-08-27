CREATE TABLE public.user_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_id uuid,
  device_id text NOT NULL,
  device_label text,
  user_agent text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);
GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own sessions, admins read tenant sessions" ON public.user_sessions
FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid())
);

CREATE POLICY "users register own device" ON public.user_sessions
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "users update own sessions, admins revoke tenant sessions" ON public.user_sessions
FOR UPDATE TO authenticated USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid())
) WITH CHECK (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR (public.get_user_role_secure(auth.uid()) = 'admin' AND admin_id = auth.uid())
);

CREATE TRIGGER update_user_sessions_updated_at BEFORE UPDATE ON public.user_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.changelog (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version text,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.changelog TO authenticated;
GRANT ALL ON public.changelog TO service_role;
ALTER TABLE public.changelog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signed-in users read changelog" ON public.changelog
FOR SELECT TO authenticated USING (true);

-- Nightly retention purge (00:30 UTC)
SELECT cron.unschedule('retention-purge-nightly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'retention-purge-nightly'
);

SELECT cron.schedule(
  'retention-purge-nightly',
  '30 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jlmkvvhmtpuplnpunbhc.supabase.co/functions/v1/retention-purge',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'TavRhkZh1qlWaHG7XYyTvF1p3k-G7Fn-YWF86Re8J2YhvCPEC_NLQbSX8olXdZpE'
    ),
    body := jsonb_build_object('trigger', 'cron')
  );
  $$
);