/*
# Create hourly cron job for 24h retention ping

Runs every hour to check for conversations approaching the 24-hour window limit
and sends the retention ping message via the whatsapp-24h-ping edge function.

1. New Cron Job
  - `whatsapp-24h-ping` — runs every hour at minute 0
  - Calls the edge function via pg_net HTTP POST

2. Important Notes
  - The edge function handles all logic: finding eligible conversations,
    checking config per unit, and sending messages via Evolution API.
  - Uses pg_net for async HTTP calls from within the database.
*/

SELECT cron.unschedule('whatsapp-24h-ping') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-24h-ping'
);

SELECT cron.schedule(
  'whatsapp-24h-ping',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/whatsapp-24h-ping',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY'
    ),
    body := '{}'::jsonb
  );
  $$
);
