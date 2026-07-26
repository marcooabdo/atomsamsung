/*
# Create cron jobs for Relatório KM at 9h, 12h, 15h, 17h

Schedules automatic dispatch of the KM report (relatorio_km) at:
- 09:00 BRT (12:00 UTC)
- 12:00 BRT (15:00 UTC)
- 15:00 BRT (18:00 UTC)
- 17:00 BRT (20:00 UTC)

Monday to Friday only.
*/

SELECT cron.schedule(
  'gia-relatorio-km-09h',
  '0 12 * * 1-5',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/gia-send-relatorio',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"tipo":"relatorio_km"}'::jsonb
  )$$
);

SELECT cron.schedule(
  'gia-relatorio-km-12h',
  '0 15 * * 1-5',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/gia-send-relatorio',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"tipo":"relatorio_km"}'::jsonb
  )$$
);

SELECT cron.schedule(
  'gia-relatorio-km-15h',
  '0 18 * * 1-5',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/gia-send-relatorio',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"tipo":"relatorio_km"}'::jsonb
  )$$
);

SELECT cron.schedule(
  'gia-relatorio-km-17h',
  '0 20 * * 1-5',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/gia-send-relatorio',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"tipo":"relatorio_km"}'::jsonb
  )$$
);
