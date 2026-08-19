CREATE TABLE public.weekly_digests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL,
  period_start timestamp with time zone NOT NULL,
  period_end timestamp with time zone NOT NULL,
  headline text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  emailed_to text,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.weekly_digests TO authenticated;
GRANT ALL ON public.weekly_digests TO service_role;

ALTER TABLE public.weekly_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_digests_select_own_tenant"
ON public.weekly_digests
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR admin_id = public.get_user_admin_id_secure(auth.uid())
);

CREATE POLICY "weekly_digests_update_own_tenant"
ON public.weekly_digests
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR admin_id = public.get_user_admin_id_secure(auth.uid())
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR admin_id = public.get_user_admin_id_secure(auth.uid())
);

CREATE INDEX idx_weekly_digests_admin_created ON public.weekly_digests (admin_id, created_at DESC);

CREATE TRIGGER update_weekly_digests_updated_at
BEFORE UPDATE ON public.weekly_digests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();