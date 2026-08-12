ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_key_key;

-- de-duplicate any existing rows sharing the same (admin_id, key)
DELETE FROM public.app_settings a
USING public.app_settings b
WHERE a.key = b.key
  AND a.admin_id IS NOT DISTINCT FROM b.admin_id
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS app_settings_admin_key_uidx
  ON public.app_settings (COALESCE(admin_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

CREATE UNIQUE INDEX IF NOT EXISTS app_settings_admin_id_key_uidx
  ON public.app_settings (admin_id, key);