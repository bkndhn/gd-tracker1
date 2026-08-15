CREATE TABLE IF NOT EXISTS public.wa_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  kind text NOT NULL DEFAULT 'message',
  phone text,
  admin_id uuid,
  follow_up_id uuid REFERENCES public.follow_ups(id) ON DELETE SET NULL,
  entry_id uuid REFERENCES public.goods_damaged_entries(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'received',
  error_message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 1,
  processed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS wa_webhook_events_event_id_key ON public.wa_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS wa_webhook_events_admin_created_idx ON public.wa_webhook_events(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wa_webhook_events_status_idx ON public.wa_webhook_events(status);

GRANT SELECT, UPDATE ON public.wa_webhook_events TO authenticated;
GRANT ALL ON public.wa_webhook_events TO service_role;

ALTER TABLE public.wa_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_webhook_events_select_tenant_admin"
ON public.wa_webhook_events FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) IN ('admin','manager')
    AND admin_id = public.get_user_admin_id_secure(auth.uid())
  )
);

CREATE POLICY "wa_webhook_events_update_tenant_admin"
ON public.wa_webhook_events FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND admin_id = public.get_user_admin_id_secure(auth.uid())
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.get_user_role_secure(auth.uid()) = 'admin'
    AND admin_id = public.get_user_admin_id_secure(auth.uid())
  )
);

CREATE TRIGGER update_wa_webhook_events_updated_at
BEFORE UPDATE ON public.wa_webhook_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.follow_ups
  ADD COLUMN IF NOT EXISTS wa_message_id text,
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS read_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS delivery_error text;

CREATE INDEX IF NOT EXISTS follow_ups_wa_message_id_idx ON public.follow_ups(wa_message_id);
CREATE INDEX IF NOT EXISTS follow_ups_phone_sent_idx ON public.follow_ups(phone, sent_at DESC);