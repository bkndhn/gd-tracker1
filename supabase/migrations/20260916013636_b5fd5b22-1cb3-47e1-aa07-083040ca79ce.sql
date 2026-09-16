-- 1. Profile additions: warehouse role support + per-tenant limits
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS warehouse_shop_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS warehouse_all_shops boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requirements_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_requirements_monthly integer,
  ADD COLUMN IF NOT EXISTS max_warehouse_users integer;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin','admin','manager','user','warehouse'));

-- Guard the new privileged columns against self-escalation
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_role text;
BEGIN
  caller_role := public.get_user_role_secure(auth.uid());
  IF caller_role IS DISTINCT FROM 'super_admin' AND caller_role IS DISTINCT FROM 'admin' THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.admin_id IS DISTINCT FROM OLD.admin_id
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.max_users IS DISTINCT FROM OLD.max_users
       OR NEW.max_shops IS DISTINCT FROM OLD.max_shops
       OR NEW.max_entries IS DISTINCT FROM OLD.max_entries
       OR NEW.max_images_per_entry IS DISTINCT FROM OLD.max_images_per_entry
       OR NEW.max_images_total IS DISTINCT FROM OLD.max_images_total
       OR NEW.shop_id IS DISTINCT FROM OLD.shop_id
       OR NEW.warehouse_shop_ids IS DISTINCT FROM OLD.warehouse_shop_ids
       OR NEW.warehouse_all_shops IS DISTINCT FROM OLD.warehouse_all_shops
    THEN
      RAISE EXCEPTION 'Not allowed to change privileged fields';
    END IF;
  END IF;

  IF caller_role IS DISTINCT FROM 'super_admin' THEN
    IF NEW.role = 'super_admin' AND OLD.role IS DISTINCT FROM 'super_admin' THEN
      RAISE EXCEPTION 'Only super_admin can grant super_admin';
    END IF;
    IF NEW.requirements_enabled IS DISTINCT FROM OLD.requirements_enabled
       OR NEW.max_requirements_monthly IS DISTINCT FROM OLD.max_requirements_monthly
       OR NEW.max_warehouse_users IS DISTINCT FROM OLD.max_warehouse_users
    THEN
      RAISE EXCEPTION 'Only super_admin can change plan limits';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Custom fields can target either form
ALTER TABLE public.custom_fields
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'visit';
ALTER TABLE public.custom_fields DROP CONSTRAINT IF EXISTS custom_fields_scope_check;
ALTER TABLE public.custom_fields ADD CONSTRAINT custom_fields_scope_check
  CHECK (scope IN ('visit','requirement'));

-- 3. Requirements
CREATE TABLE IF NOT EXISTS public.stock_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  shop_id uuid REFERENCES public.shops(id),
  shop_name text,
  requested_by uuid NOT NULL,
  requested_by_name text,
  category text,
  size text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  urgency text NOT NULL DEFAULT 'normal',
  note text,
  status text NOT NULL DEFAULT 'requested',
  packed_by uuid, packed_by_name text, packed_at timestamptz, packed_qty integer, packed_note text,
  moved_by uuid, moved_by_name text, moved_at timestamptz, moved_note text,
  received_by uuid, received_by_name text, received_at timestamptz,
  rejected_by uuid, rejected_by_name text, rejected_at timestamptz, reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_requirements_status_check CHECK (status IN ('requested','packed','moved','received','rejected')),
  CONSTRAINT stock_requirements_urgency_check CHECK (urgency IN ('normal','urgent')),
  CONSTRAINT stock_requirements_qty_check CHECK (quantity > 0 AND quantity <= 100000)
);

CREATE INDEX IF NOT EXISTS idx_stock_req_admin_created ON public.stock_requirements (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_req_shop ON public.stock_requirements (shop_id);
CREATE INDEX IF NOT EXISTS idx_stock_req_status ON public.stock_requirements (admin_id, status);

CREATE TABLE IF NOT EXISTS public.stock_requirement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  requirement_id uuid NOT NULL REFERENCES public.stock_requirements(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_id uuid NOT NULL,
  actor_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_req_events_req ON public.stock_requirement_events (requirement_id, created_at);

ALTER TABLE public.gd_entry_custom_values
  ADD COLUMN IF NOT EXISTS requirement_id uuid REFERENCES public.stock_requirements(id) ON DELETE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_requirements TO authenticated;
GRANT ALL ON public.stock_requirements TO service_role;
GRANT SELECT, INSERT ON public.stock_requirement_events TO authenticated;
GRANT ALL ON public.stock_requirement_events TO service_role;

ALTER TABLE public.stock_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_requirement_events ENABLE ROW LEVEL SECURITY;

-- 4. Access helper (security definer, avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.can_access_requirement(_admin_id uuid, _shop_id uuid, _requested_by uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.is_super_admin(auth.uid()) THEN true
    WHEN _admin_id IS DISTINCT FROM public.get_user_admin_id_secure(auth.uid()) THEN false
    WHEN public.get_user_role_secure(auth.uid()) = 'admin' THEN true
    WHEN public.get_user_role_secure(auth.uid()) = 'warehouse' THEN EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.warehouse_all_shops OR _shop_id = ANY (p.warehouse_shop_ids))
    )
    WHEN public.get_user_role_secure(auth.uid()) = 'manager' THEN
      _shop_id IS NOT DISTINCT FROM public.get_user_shop_id_secure(auth.uid())
    ELSE
      _requested_by = auth.uid()
      OR (_shop_id IS NOT NULL AND _shop_id IS NOT DISTINCT FROM public.get_user_shop_id_secure(auth.uid()))
  END;
$function$;

CREATE OR REPLACE FUNCTION public.can_fulfil_requirement(_admin_id uuid, _shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.is_super_admin(auth.uid()) THEN true
    WHEN _admin_id IS DISTINCT FROM public.get_user_admin_id_secure(auth.uid()) THEN false
    WHEN public.get_user_role_secure(auth.uid()) = 'admin' THEN true
    WHEN public.get_user_role_secure(auth.uid()) = 'warehouse' THEN EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.warehouse_all_shops OR _shop_id = ANY (p.warehouse_shop_ids))
    )
    ELSE false
  END;
$function$;

CREATE POLICY "requirements_select" ON public.stock_requirements
  FOR SELECT TO authenticated
  USING (public.can_access_requirement(admin_id, shop_id, requested_by));

CREATE POLICY "requirements_insert" ON public.stock_requirements
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND admin_id = public.get_user_admin_id_secure(auth.uid())
    AND public.can_access_requirement(admin_id, shop_id, requested_by)
  );

CREATE POLICY "requirements_update" ON public.stock_requirements
  FOR UPDATE TO authenticated
  USING (public.can_access_requirement(admin_id, shop_id, requested_by))
  WITH CHECK (public.can_access_requirement(admin_id, shop_id, requested_by));

CREATE POLICY "requirements_delete_admin" ON public.stock_requirements
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.get_user_role_secure(auth.uid()) = 'admin'
        AND admin_id = public.get_user_admin_id_secure(auth.uid()))
  );

CREATE POLICY "requirement_events_select" ON public.stock_requirement_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stock_requirements r
    WHERE r.id = requirement_id
      AND public.can_access_requirement(r.admin_id, r.shop_id, r.requested_by)
  ));

CREATE POLICY "requirement_events_insert" ON public.stock_requirement_events
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.stock_requirements r
      WHERE r.id = requirement_id
        AND r.admin_id = admin_id
        AND public.can_access_requirement(r.admin_id, r.shop_id, r.requested_by)
    )
  );

CREATE TRIGGER update_stock_requirements_updated_at
  BEFORE UPDATE ON public.stock_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Enforce who may move the workflow forward
CREATE OR REPLACE FUNCTION public.validate_requirement_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('packed','moved','rejected') THEN
      IF NOT public.can_fulfil_requirement(OLD.admin_id, OLD.shop_id) THEN
        RAISE EXCEPTION 'Only warehouse staff or admins can update fulfilment status';
      END IF;
    END IF;
    IF OLD.status IN ('received','rejected') THEN
      RAISE EXCEPTION 'This requirement is already closed';
    END IF;
  END IF;
  NEW.admin_id := OLD.admin_id;
  NEW.requested_by := OLD.requested_by;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_requirement_transition_trg
  BEFORE UPDATE ON public.stock_requirements
  FOR EACH ROW EXECUTE FUNCTION public.validate_requirement_transition();