/*
# Fix Relatório KM (Dinheiro na Mesa) cron jobs and grupo_destino

1. Problem
- Cron jobs for relatorio_km are failing because they use
  current_setting('app.settings.supabase_url') which doesn't exist.
- The grupo_destino for relatorio_km was null, causing it to fall back
  to whatever group is available.

2. Changes
- Drop old broken cron jobs.
- Recreate them with hardcoded URL and service_role_key (same pattern as working cron jobs).
- Ensure grupo_destino is set to the correct group in gia_relatorios_config.

3. Important Notes
- The target group is 120363427351181397@g.us (Task Force ATOM | GG).
- Schedule: 09h, 12h, 15h, 17h BRT (12h, 15h, 18h, 20h UTC) Mon-Fri.
*/

-- Fix grupo_destino in config
UPDATE gia_relatorios_config
SET grupo_destino = '120363427351181397@g.us', updated_at = NOW()
WHERE tipo = 'relatorio_km' AND (grupo_destino IS NULL OR grupo_destino != '120363427351181397@g.us');

-- Drop old broken cron jobs
SELECT cron.unschedule('gia-relatorio-km-09h');
SELECT cron.unschedule('gia-relatorio-km-12h');
SELECT cron.unschedule('gia-relatorio-km-15h');
SELECT cron.unschedule('gia-relatorio-km-17h');

-- Recreate with hardcoded URL (same pattern as working cron jobs)
SELECT cron.schedule(
  'gia-relatorio-km-09h',
  '0 12 * * 1-5',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "relatorio_km"}'::jsonb
  );$$
);

SELECT cron.schedule(
  'gia-relatorio-km-12h',
  '0 15 * * 1-5',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "relatorio_km"}'::jsonb
  );$$
);

SELECT cron.schedule(
  'gia-relatorio-km-15h',
  '0 18 * * 1-5',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "relatorio_km"}'::jsonb
  );$$
);

SELECT cron.schedule(
  'gia-relatorio-km-17h',
  '0 20 * * 1-5',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "relatorio_km"}'::jsonb
  );$$
);
