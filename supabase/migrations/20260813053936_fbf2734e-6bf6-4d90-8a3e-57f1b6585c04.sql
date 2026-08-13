CREATE TABLE public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  entry_id uuid REFERENCES public.goods_damaged_entries(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  shop_name text,
  phone text NOT NULL,
  customer_name text,
  reason_label text,
  template_key text,
  message text,
  channel text NOT NULL DEFAULT 'whatsapp',
  sent_by uuid NOT NULL,
  sent_by_name text,
  outcome text NOT NULL DEFAULT 'pending',
  recovered_amount numeric NOT NULL DEFAULT 0,
  outcome_note text,
  next_reminder_at timestamptz,
  reminder_stage integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  outcome_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX follow_ups_admin_sent_idx ON public.follow_ups(admin_id, sent_at DESC);
CREATE INDEX follow_ups_phone_idx ON public.follow_ups(admin_id, phone);
CREATE INDEX follow_ups_reminder_idx ON public.follow_ups(admin_id, next_reminder_at) WHERE outcome = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_ups TO authenticated;
GRANT ALL ON public.follow_ups TO service_role;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY follow_ups_select ON public.follow_ups FOR SELECT TO authenticated
USING (admin_id = public.get_user_admin_id_secure(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY follow_ups_insert ON public.follow_ups FOR INSERT TO authenticated
WITH CHECK (admin_id = public.get_user_admin_id_secure(auth.uid()) AND sent_by = auth.uid());

CREATE POLICY follow_ups_update ON public.follow_ups FOR UPDATE TO authenticated
USING (admin_id = public.get_user_admin_id_secure(auth.uid()) AND (sent_by = auth.uid() OR public.get_user_role_secure(auth.uid()) IN ('admin','super_admin','manager')))
WITH CHECK (admin_id = public.get_user_admin_id_secure(auth.uid()));

CREATE POLICY follow_ups_delete ON public.follow_ups FOR DELETE TO authenticated
USING (admin_id = public.get_user_admin_id_secure(auth.uid()) AND public.get_user_role_secure(auth.uid()) IN ('admin','super_admin'));

CREATE TRIGGER update_follow_ups_updated_at BEFORE UPDATE ON public.follow_ups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.shop_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  target_followups integer NOT NULL DEFAULT 0,
  target_recovered numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_id, shop_id, period_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_targets TO authenticated;
GRANT ALL ON public.shop_targets TO service_role;
ALTER TABLE public.shop_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY shop_targets_select ON public.shop_targets FOR SELECT TO authenticated
USING (admin_id = public.get_user_admin_id_secure(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY shop_targets_write ON public.shop_targets FOR ALL TO authenticated
USING (admin_id = public.get_user_admin_id_secure(auth.uid()) AND public.get_user_role_secure(auth.uid()) IN ('admin','super_admin'))
WITH CHECK (admin_id = public.get_user_admin_id_secure(auth.uid()) AND public.get_user_role_secure(auth.uid()) IN ('admin','super_admin'));

CREATE TRIGGER update_shop_targets_updated_at BEFORE UPDATE ON public.shop_targets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();