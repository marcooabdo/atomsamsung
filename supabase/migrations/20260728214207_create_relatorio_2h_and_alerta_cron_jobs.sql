/*
# Create Relatório 2 Horas Report + Alerta Individual Cron Jobs

1. Modified Tables
   - `gia_relatorios_config`
     - Insert report type 'relatorio_2h' with scheduled times 09:30, 14:30, 17:30
     - Runs Monday to Friday
     - Uses default group (grupo_destino = NULL)

2. New Cron Jobs — Full Report
   - `gia_relatorio_2h_0930` — fires at 12:30 UTC (09:30 BRT)
   - `gia_relatorio_2h_1430` — fires at 17:30 UTC (14:30 BRT)
   - `gia_relatorio_2h_1730` — fires at 20:30 UTC (17:30 BRT)
   - All run Monday-Friday (1-5)
   - Each calls gia-send-relatorio with tipo: "relatorio_2h"

3. New Cron Jobs — Individual Alerts (every 10 minutes during business hours)
   - `gia_alerta_2h_check` — fires every 10 minutes from 09:00-18:00 BRT (12:00-21:00 UTC)
   - Runs Monday-Friday (1-5)
   - Calls gia-alerta-2h edge function directly

4. Important Notes
   - Full report: shows ALL OS with >2h in their current column, grouped by unit and column (pipeline order)
   - Individual alert: sends one WhatsApp message per OS when it crosses the 2h threshold
   - Both exclude columns: Return Handling, Instalação Inicial, Trade-up, Service Handling, OS Fechada, Aguardando Peça, Peça em Trânsito
   - Individual alerts are sent only once per OS per column (tracked in gia_alertas_2h_enviados table)
*/

-- Insert the report config
INSERT INTO gia_relatorios_config (tipo, nome, emoji, horario, horarios, ativo, dias_semana, template_formato)
VALUES (
  'relatorio_2h',
  'Relatório 2 Horas',
  '⏱️',
  '09:30',
  ARRAY['09:30','14:30','17:30'],
  true,
  '{1,2,3,4,5}',
  'Relatório de OS paradas na etapa há mais de 2 horas. Agrupa por unidade e coluna do pipeline, mostra tempo na etapa. Exclui Return Handling, Instalação Inicial, Trade-up, Service Handling, OS Fechada, Aguardando Peça e Peça em Trânsito.'
)
ON CONFLICT (tipo) DO UPDATE SET
  nome = EXCLUDED.nome,
  emoji = EXCLUDED.emoji,
  horarios = EXCLUDED.horarios,
  ativo = EXCLUDED.ativo,
  dias_semana = EXCLUDED.dias_semana,
  template_formato = EXCLUDED.template_formato;

-- Unschedule existing jobs for this report (idempotent)
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname LIKE 'gia_relatorio_2h%';
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname LIKE 'gia_alerta_2h%';

-- Full Report Cron Jobs --

-- 09:30 BRT = 12:30 UTC
SELECT cron.schedule(
  'gia_relatorio_2h_0930',
  '30 12 * * 1-5',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "relatorio_2h"}'::jsonb
  );$$
);

-- 14:30 BRT = 17:30 UTC
SELECT cron.schedule(
  'gia_relatorio_2h_1430',
  '30 17 * * 1-5',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "relatorio_2h"}'::jsonb
  );$$
);

-- 17:30 BRT = 20:30 UTC
SELECT cron.schedule(
  'gia_relatorio_2h_1730',
  '30 20 * * 1-5',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "relatorio_2h"}'::jsonb
  );$$
);

-- Individual Alert Cron Job (every 10 minutes 09:00-18:00 BRT = 12:00-21:00 UTC, Mon-Fri) --
SELECT cron.schedule(
  'gia_alerta_2h_check',
  '*/10 12-20 * * 1-5',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-alerta-2h',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{}'::jsonb
  );$$
);