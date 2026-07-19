
-- AI quotas + usage tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_daily_limit INTEGER,
  ADD COLUMN IF NOT EXISTS ai_monthly_limit INTEGER,
  ADD COLUMN IF NOT EXISTS ai_lifetime_limit INTEGER;

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  user_id UUID NOT NULL,
  mode TEXT,
  context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_admin_time ON public.ai_usage_log (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_time ON public.ai_usage_log (user_id, created_at DESC);

GRANT SELECT ON public.ai_usage_log TO authenticated;
GRANT ALL ON public.ai_usage_log TO service_role;

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_super_admin_read" ON public.ai_usage_log;
CREATE POLICY "ai_usage_super_admin_read" ON public.ai_usage_log
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "ai_usage_admin_read_own_tenant" ON public.ai_usage_log;
CREATE POLICY "ai_usage_admin_read_own_tenant" ON public.ai_usage_log
  FOR SELECT TO authenticated
  USING (admin_id = public.get_user_admin_id_secure(auth.uid()));
