-- =============== SAVED VIEWS ===============
CREATE TABLE public.saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  name text NOT NULL,
  page text NOT NULL CHECK (page IN ('reports','dashboard')),
  scope text NOT NULL DEFAULT 'private' CHECK (scope IN ('private','shop','tenant')),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_views TO authenticated;
GRANT ALL ON public.saved_views TO service_role;
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_views_select" ON public.saved_views
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR owner_id = auth.uid()
  OR (
    admin_id = public.get_user_admin_id_secure(auth.uid())
    AND (
      scope = 'tenant'
      OR (scope = 'shop' AND shop_id IS NOT NULL AND shop_id = public.get_user_shop_id_secure(auth.uid()))
      OR (scope = 'shop' AND public.get_user_role_secure(auth.uid()) IN ('admin','super_admin'))
    )
  )
);

CREATE POLICY "saved_views_insert" ON public.saved_views
FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND admin_id = public.get_user_admin_id_secure(auth.uid())
  AND (
    scope <> 'tenant'
    OR public.get_user_role_secure(auth.uid()) IN ('admin','super_admin')
  )
);

CREATE POLICY "saved_views_update" ON public.saved_views
FOR UPDATE TO authenticated
USING (
  owner_id = auth.uid()
  OR (admin_id = public.get_user_admin_id_secure(auth.uid())
      AND public.get_user_role_secure(auth.uid()) IN ('admin','super_admin'))
)
WITH CHECK (
  admin_id = public.get_user_admin_id_secure(auth.uid())
  AND (
    scope <> 'tenant'
    OR public.get_user_role_secure(auth.uid()) IN ('admin','super_admin')
  )
);

CREATE POLICY "saved_views_delete" ON public.saved_views
FOR DELETE TO authenticated
USING (
  owner_id = auth.uid()
  OR (admin_id = public.get_user_admin_id_secure(auth.uid())
      AND public.get_user_role_secure(auth.uid()) IN ('admin','super_admin'))
);

CREATE TRIGGER update_saved_views_updated_at
BEFORE UPDATE ON public.saved_views
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_saved_views_admin_page ON public.saved_views(admin_id, page) WHERE deleted_at IS NULL;

-- =============== ANOMALY ALERTS ===============
CREATE TABLE public.anomaly_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  shop_name text,
  reason_label text,
  metric text NOT NULL DEFAULT 'visits',
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  expected_count numeric NOT NULL DEFAULT 0,
  actual_count integer NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  fingerprint text NOT NULL,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_anomaly_alerts_fingerprint ON public.anomaly_alerts(admin_id, fingerprint);

GRANT SELECT, UPDATE ON public.anomaly_alerts TO authenticated;
GRANT ALL ON public.anomaly_alerts TO service_role;
ALTER TABLE public.anomaly_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anomaly_alerts_select" ON public.anomaly_alerts
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    admin_id = public.get_user_admin_id_secure(auth.uid())
    AND (
      public.get_user_role_secure(auth.uid()) IN ('admin','super_admin')
      OR public.get_user_shop_id_secure(auth.uid()) IS NULL
      OR shop_id = public.get_user_shop_id_secure(auth.uid())
    )
  )
);

CREATE POLICY "anomaly_alerts_ack" ON public.anomaly_alerts
FOR UPDATE TO authenticated
USING (admin_id = public.get_user_admin_id_secure(auth.uid()))
WITH CHECK (admin_id = public.get_user_admin_id_secure(auth.uid()));

CREATE TRIGGER update_anomaly_alerts_updated_at
BEFORE UPDATE ON public.anomaly_alerts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============== WHATSAPP CONTACTS ===============
CREATE TABLE public.wa_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text NOT NULL,
  display_name text,
  is_approved boolean NOT NULL DEFAULT false,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_wa_contacts_phone ON public.wa_contacts(phone);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_contacts TO authenticated;
GRANT ALL ON public.wa_contacts TO service_role;
ALTER TABLE public.wa_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_contacts_admin_all" ON public.wa_contacts
FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (admin_id = public.get_user_admin_id_secure(auth.uid())
      AND public.get_user_role_secure(auth.uid()) IN ('admin','super_admin'))
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (admin_id = public.get_user_admin_id_secure(auth.uid())
      AND public.get_user_role_secure(auth.uid()) IN ('admin','super_admin'))
);

CREATE TRIGGER update_wa_contacts_updated_at
BEFORE UPDATE ON public.wa_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============== WHATSAPP SESSIONS ===============
CREATE TABLE public.wa_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  admin_id uuid,
  profile_id uuid,
  step text NOT NULL DEFAULT 'idle',
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.wa_sessions TO service_role;
ALTER TABLE public.wa_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_sessions_service_only" ON public.wa_sessions
FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE TRIGGER update_wa_sessions_updated_at
BEFORE UPDATE ON public.wa_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();