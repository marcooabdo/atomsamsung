/*
# Create Validação OW Report Configuration and Cron Jobs

1. Modified Tables
   - `gia_relatorios_config`
     - Insert new report type 'validacao_ow' with scheduled times 09:40, 13:20, 17:10
     - Runs Monday to Saturday
     - Uses default group (grupo_destino = NULL)

2. New Cron Jobs
   - `gia_relatorio_validacao_ow_0940` — fires at 12:40 UTC (09:40 BRT)
   - `gia_relatorio_validacao_ow_1320` — fires at 16:20 UTC (13:20 BRT)
   - `gia_relatorio_validacao_ow_1710` — fires at 20:10 UTC (17:10 BRT)
   - All run Monday-Saturday (1-6)
   - Each calls gia-send-relatorio with tipo: "validacao_ow"

3. Important Notes
   - Report monitors OW service orders that have no services registered in os_servicos table
   - Shows Samsung OS number (fallback to internal), kanban column, budget status, profit calculation
   - One message per unit, max 40 OS per message
   - Alerts when an OW OS may actually be LP and needs conversion
*/

-- Insert the report config
INSERT INTO gia_relatorios_config (tipo, nome, emoji, horario, horarios, ativo, dias_semana, template_formato)
VALUES (
  'validacao_ow',
  'Validação OW',
  '⚠️',
  '09:40',
  ARRAY['09:40','13:20','17:10'],
  true,
  '{1,2,3,4,5,6}',
  'Relatório de OS OW sem serviço adicionado. Inclui status do orçamento, valor total vs custo GSPN com cálculo de lucro e margem percentual. Alerta OS que podem ser LP e precisam ser convertidas.'
)
ON CONFLICT (tipo) DO UPDATE SET
  nome = EXCLUDED.nome,
  emoji = EXCLUDED.emoji,
  horarios = EXCLUDED.horarios,
  ativo = EXCLUDED.ativo,
  dias_semana = EXCLUDED.dias_semana,
  template_formato = EXCLUDED.template_formato;

-- Unschedule existing jobs for this report (idempotent)
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname LIKE 'gia_relatorio_validacao_ow%';

-- Cron job: 09:40 BRT = 12:40 UTC
SELECT cron.schedule(
  'gia_relatorio_validacao_ow_0940',
  '40 12 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "validacao_ow"}'::jsonb
  );$$
);

-- Cron job: 13:20 BRT = 16:20 UTC
SELECT cron.schedule(
  'gia_relatorio_validacao_ow_1320',
  '20 16 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "validacao_ow"}'::jsonb
  );$$
);

-- Cron job: 17:10 BRT = 20:10 UTC
SELECT cron.schedule(
  'gia_relatorio_validacao_ow_1710',
  '10 20 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "validacao_ow"}'::jsonb
  );$$
);