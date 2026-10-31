CREATE TABLE public.stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  item text NOT NULL DEFAULT '',
  size text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 0,
  min_qty integer NOT NULL DEFAULT 0,
  updated_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_items TO authenticated;
GRANT ALL ON public.stock_items TO service_role;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX stock_items_admin_idx ON public.stock_items(admin_id);
CREATE POLICY stock_items_select ON public.stock_items FOR SELECT TO authenticated
  USING (admin_id = public.get_user_admin_id_secure(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY stock_items_write ON public.stock_items FOR ALL TO authenticated
  USING (admin_id = public.get_user_admin_id_secure(auth.uid()) AND public.get_user_role_secure(auth.uid()) IN ('admin','manager','warehouse'))
  WITH CHECK (admin_id = public.get_user_admin_id_secure(auth.uid()) AND public.get_user_role_secure(auth.uid()) IN ('admin','manager','warehouse'));
CREATE TRIGGER stock_items_updated_at BEFORE UPDATE ON public.stock_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();