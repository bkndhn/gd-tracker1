-- 1. Rotate cron credential into vault; jobs read it at runtime (no literals in source)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_secret') THEN
    PERFORM vault.update_secret((SELECT id FROM vault.secrets WHERE name='cron_secret'), encode(extensions.gen_random_bytes(32),'hex'));
  ELSE
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'), 'cron_secret', 'Shared secret for scheduled edge function calls');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.verify_cron_secret(_secret text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, vault AS $$
  SELECT _secret IS NOT NULL AND length(_secret) > 0 AND EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret' AND decrypted_secret = _secret
  );
$$;
REVOKE ALL ON FUNCTION public.verify_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO service_role;

DO $$
DECLARE j text;
BEGIN
  FOREACH j IN ARRAY ARRAY['gd-daily-gdrive-backup','ai-weekly-digest-monday','retention-purge-nightly'] LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = j) THEN PERFORM cron.unschedule(j); END IF;
  END LOOP;
END $$;

SELECT cron.schedule('gd-daily-gdrive-backup','25 18 * * *', $$
  select net.http_post(
    url := 'https://jlmkvvhmtpuplnpunbhc.supabase.co/functions/v1/backup-to-gdrive',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='cron_secret')),
    body := jsonb_build_object('trigger','cron','time',now()));
$$);
SELECT cron.schedule('ai-weekly-digest-monday','30 3 * * 1', $$
  select net.http_post(
    url := 'https://jlmkvvhmtpuplnpunbhc.supabase.co/functions/v1/ai-weekly-digest',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='cron_secret')),
    body := jsonb_build_object('trigger','cron'));
$$);
SELECT cron.schedule('retention-purge-nightly','30 0 * * *', $$
  select net.http_post(
    url := 'https://jlmkvvhmtpuplnpunbhc.supabase.co/functions/v1/retention-purge',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='cron_secret')),
    body := jsonb_build_object('trigger','cron'));
$$);
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='send-scheduled-reports-every-5min'), command := $$
  select net.http_post(
    url := 'https://jlmkvvhmtpuplnpunbhc.supabase.co/functions/v1/send-scheduled-reports',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='cron_secret')),
    body := jsonb_build_object('trigger','cron'));
$$) WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='send-scheduled-reports-every-5min');

-- 2. Admins can no longer raise their own plan / AI quotas
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
       OR NEW.custom_fields_enabled IS DISTINCT FROM OLD.custom_fields_enabled
       OR NEW.max_custom_fields IS DISTINCT FROM OLD.max_custom_fields
       OR NEW.max_options_per_field IS DISTINCT FROM OLD.max_options_per_field
       OR NEW.ai_enabled IS DISTINCT FROM OLD.ai_enabled
       OR NEW.ai_daily_limit IS DISTINCT FROM OLD.ai_daily_limit
       OR NEW.ai_monthly_limit IS DISTINCT FROM OLD.ai_monthly_limit
       OR NEW.ai_lifetime_limit IS DISTINCT FROM OLD.ai_lifetime_limit
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
       OR NEW.custom_fields_enabled IS DISTINCT FROM OLD.custom_fields_enabled
       OR NEW.max_custom_fields IS DISTINCT FROM OLD.max_custom_fields
       OR NEW.max_options_per_field IS DISTINCT FROM OLD.max_options_per_field
    THEN
      RAISE EXCEPTION 'Only super_admin can change plan limits';
    END IF;
    -- Tenant-level quotas and billing on the caller's own (tenant) row
    IF OLD.role IN ('admin','super_admin') AND (
          NEW.max_users IS DISTINCT FROM OLD.max_users
       OR NEW.max_shops IS DISTINCT FROM OLD.max_shops
       OR NEW.max_entries IS DISTINCT FROM OLD.max_entries
       OR NEW.max_images_per_entry IS DISTINCT FROM OLD.max_images_per_entry
       OR NEW.max_images_total IS DISTINCT FROM OLD.max_images_total
       OR NEW.ai_enabled IS DISTINCT FROM OLD.ai_enabled
       OR NEW.ai_daily_limit IS DISTINCT FROM OLD.ai_daily_limit
       OR NEW.ai_monthly_limit IS DISTINCT FROM OLD.ai_monthly_limit
       OR NEW.ai_lifetime_limit IS DISTINCT FROM OLD.ai_lifetime_limit
       OR NEW.subscription_amount IS DISTINCT FROM OLD.subscription_amount
       OR NEW.billing_cycle IS DISTINCT FROM OLD.billing_cycle
       OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.payment_enabled IS DISTINCT FROM OLD.payment_enabled
       OR NEW.last_payment_date IS DISTINCT FROM OLD.last_payment_date
       OR NEW.last_payment_ref IS DISTINCT FROM OLD.last_payment_ref
       OR NEW.show_plan_to_client IS DISTINCT FROM OLD.show_plan_to_client
    ) THEN
      RAISE EXCEPTION 'Only super_admin can change plan limits';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;