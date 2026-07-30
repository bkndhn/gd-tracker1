-- =========================================================
-- Client error reporting (Sentry-style) + release health
-- =========================================================

CREATE TABLE public.client_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_id uuid,
  release text NOT NULL DEFAULT 'unknown',
  environment text NOT NULL DEFAULT 'production',
  level text NOT NULL DEFAULT 'error',
  kind text NOT NULL DEFAULT 'exception',
  message text NOT NULL,
  stack text,
  component_stack text,
  url text,
  user_agent text,
  session_id text,
  fingerprint text NOT NULL DEFAULT 'unknown',
  breadcrumbs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.client_errors TO anon;
GRANT SELECT, INSERT ON public.client_errors TO authenticated;
GRANT ALL ON public.client_errors TO service_role;

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_errors_insert_anyone"
  ON public.client_errors FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "client_errors_select_scoped"
  ON public.client_errors FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (
      public.get_user_role_secure(auth.uid()) = 'admin'
      AND admin_id IS NOT NULL
      AND admin_id = public.get_user_admin_id_secure(auth.uid())
    )
  );

CREATE INDEX idx_client_errors_created_at ON public.client_errors (created_at DESC);
CREATE INDEX idx_client_errors_admin ON public.client_errors (admin_id, created_at DESC);
CREATE INDEX idx_client_errors_release ON public.client_errors (release, created_at DESC);
CREATE INDEX idx_client_errors_fingerprint ON public.client_errors (fingerprint, created_at DESC);


CREATE TABLE public.app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id uuid,
  release text NOT NULL DEFAULT 'unknown',
  environment text NOT NULL DEFAULT 'production',
  user_agent text,
  errored boolean NOT NULL DEFAULT false,
  crashed boolean NOT NULL DEFAULT false,
  duration_ms integer NOT NULL DEFAULT 0,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.app_sessions TO authenticated;
GRANT ALL ON public.app_sessions TO service_role;

ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_sessions_insert_own"
  ON public.app_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "app_sessions_update_own"
  ON public.app_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "app_sessions_select_scoped"
  ON public.app_sessions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR (
      public.get_user_role_secure(auth.uid()) = 'admin'
      AND admin_id IS NOT NULL
      AND admin_id = public.get_user_admin_id_secure(auth.uid())
    )
  );

CREATE INDEX idx_app_sessions_release ON public.app_sessions (release, started_at DESC);
CREATE INDEX idx_app_sessions_admin ON public.app_sessions (admin_id, started_at DESC);

CREATE TRIGGER update_app_sessions_updated_at
  BEFORE UPDATE ON public.app_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();