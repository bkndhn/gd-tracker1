CREATE TABLE public.team_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  shop_id uuid NOT NULL REFERENCES public.shops(id),
  sender_id uuid NOT NULL,
  sender_name text,
  sender_role text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.team_messages TO authenticated;
GRANT ALL ON public.team_messages TO service_role;
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX team_messages_thread_idx ON public.team_messages(admin_id, shop_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.can_access_team_thread(_admin_id uuid, _shop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN _admin_id IS DISTINCT FROM public.get_user_admin_id_secure(auth.uid()) THEN false
    WHEN public.get_user_role_secure(auth.uid()) IN ('admin','super_admin') THEN true
    WHEN public.get_user_role_secure(auth.uid()) = 'warehouse' THEN EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
        AND (p.warehouse_all_shops OR _shop_id = ANY (p.warehouse_shop_ids)))
    ELSE _shop_id IS NOT DISTINCT FROM public.get_user_shop_id_secure(auth.uid())
  END;
$$;

CREATE POLICY team_messages_select ON public.team_messages FOR SELECT TO authenticated
  USING (public.can_access_team_thread(admin_id, shop_id));
CREATE POLICY team_messages_insert ON public.team_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND length(btrim(message)) BETWEEN 1 AND 2000
    AND public.can_access_team_thread(admin_id, shop_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;