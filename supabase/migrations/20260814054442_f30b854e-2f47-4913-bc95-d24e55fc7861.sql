SELECT cron.unschedule('ai-weekly-digest-monday');

SELECT cron.schedule(
  'ai-weekly-digest-monday',
  '30 3 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://jlmkvvhmtpuplnpunbhc.supabase.co/functions/v1/ai-weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'TavRhkZh1qlWaHG7XYyTvF1p3k-G7Fn-YWF86Re8J2YhvCPEC_NLQbSX8olXdZpE'
    ),
    body := jsonb_build_object('trigger', 'cron')
  );
  $$
);