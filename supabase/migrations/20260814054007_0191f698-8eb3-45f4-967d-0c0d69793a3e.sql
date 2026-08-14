SELECT cron.unschedule('ai-weekly-digest-monday') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'ai-weekly-digest-monday'
);

SELECT cron.schedule(
  'ai-weekly-digest-monday',
  '30 3 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://jlmkvvhmtpuplnpunbhc.supabase.co/functions/v1/ai-weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);