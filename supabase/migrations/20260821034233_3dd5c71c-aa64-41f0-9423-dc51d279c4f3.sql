CREATE TABLE public.entry_evidence (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL,
  entry_id uuid NOT NULL REFERENCES public.goods_damaged_entries(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  caption text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entry_evidence TO authenticated;
GRANT ALL ON public.entry_evidence TO service_role;

ALTER TABLE public.entry_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entry_evidence_select" ON public.entry_evidence
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR admin_id = public.get_user_admin_id_secure(auth.uid())
);

CREATE POLICY "entry_evidence_insert" ON public.entry_evidence
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND admin_id = public.get_user_admin_id_secure(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.goods_damaged_entries ge
    WHERE ge.id = entry_id
      AND ge.admin_id = public.get_user_admin_id_secure(auth.uid())
  )
);

CREATE POLICY "entry_evidence_update" ON public.entry_evidence
FOR UPDATE TO authenticated
USING (
  admin_id = public.get_user_admin_id_secure(auth.uid())
  AND (uploaded_by = auth.uid() OR public.get_user_role_secure(auth.uid()) IN ('admin','manager','super_admin'))
)
WITH CHECK (admin_id = public.get_user_admin_id_secure(auth.uid()));

CREATE POLICY "entry_evidence_delete" ON public.entry_evidence
FOR DELETE TO authenticated
USING (
  admin_id = public.get_user_admin_id_secure(auth.uid())
  AND (uploaded_by = auth.uid() OR public.get_user_role_secure(auth.uid()) IN ('admin','manager','super_admin'))
);

CREATE INDEX idx_entry_evidence_entry ON public.entry_evidence(entry_id);
CREATE INDEX idx_entry_evidence_admin ON public.entry_evidence(admin_id);

CREATE TRIGGER update_entry_evidence_updated_at
BEFORE UPDATE ON public.entry_evidence
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.settings_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL,
  setting_key text NOT NULL,
  changed_by uuid NOT NULL,
  changed_by_name text,
  old_value jsonb,
  new_value jsonb NOT NULL,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.settings_audit_log TO authenticated;
GRANT ALL ON public.settings_audit_log TO service_role;

ALTER TABLE public.settings_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_audit_select" ON public.settings_audit_log
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    admin_id = public.get_user_admin_id_secure(auth.uid())
    AND public.get_user_role_secure(auth.uid()) IN ('admin','super_admin')
  )
);

CREATE POLICY "settings_audit_insert" ON public.settings_audit_log
FOR INSERT TO authenticated
WITH CHECK (
  changed_by = auth.uid()
  AND admin_id = public.get_user_admin_id_secure(auth.uid())
  AND public.get_user_role_secure(auth.uid()) IN ('admin','super_admin')
);

CREATE INDEX idx_settings_audit_admin_key ON public.settings_audit_log(admin_id, setting_key, created_at DESC);