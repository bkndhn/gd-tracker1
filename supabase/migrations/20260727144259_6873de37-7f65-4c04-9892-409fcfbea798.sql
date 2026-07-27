CREATE TABLE IF NOT EXISTS public.backup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'success',
  filename text,
  drive_file_id text,
  drive_web_link text,
  size_bytes bigint,
  took_ms integer,
  trigger_source text NOT NULL DEFAULT 'manual',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.backup_logs TO authenticated;
GRANT ALL ON public.backup_logs TO service_role;

ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS backup_logs_super_admin_read ON public.backup_logs;
CREATE POLICY backup_logs_super_admin_read
  ON public.backup_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS backup_logs_created_at_idx ON public.backup_logs (created_at DESC);

-- Reschedule the daily Google Drive backup to 23:55 IST (18:25 UTC)
SELECT cron.unschedule('gd-daily-gdrive-backup');
SELECT cron.schedule(
  'gd-daily-gdrive-backup',
  '25 18 * * *',
  $$
  select net.http_post(
    url := 'https://jlmkvvhmtpuplnpunbhc.supabase.co/functions/v1/backup-to-gdrive',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'TavRhkZh1qlWaHG7XYyTvF1p3k-G7Fn-YWF86Re8J2YhvCPEC_NLQbSX8olXdZpE'
    ),
    body := jsonb_build_object('trigger', 'cron', 'time', now())
  ) as request_id;
  $$
);