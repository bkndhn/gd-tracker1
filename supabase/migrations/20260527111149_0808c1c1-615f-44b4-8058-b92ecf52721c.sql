GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT ALL ON public.shops TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sizes TO authenticated;
GRANT ALL ON public.sizes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_types TO authenticated;
GRANT ALL ON public.customer_types TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goods_damaged_entries TO authenticated;
GRANT ALL ON public.goods_damaged_entries TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gd_entry_images TO authenticated;
GRANT ALL ON public.gd_entry_images TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_fields TO authenticated;
GRANT ALL ON public.custom_fields TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_field_options TO authenticated;
GRANT ALL ON public.custom_field_options TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gd_entry_custom_values TO authenticated;
GRANT ALL ON public.gd_entry_custom_values TO service_role;

DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO authenticated;
    GRANT ALL ON public.audit_logs TO service_role;
  END IF;
END $$;