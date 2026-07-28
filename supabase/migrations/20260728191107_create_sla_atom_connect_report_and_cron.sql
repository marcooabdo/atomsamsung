/*
# Create SLA Atom Connect Report Configuration and Cron Jobs

1. Modified Tables
   - `gia_relatorios_config`
     - Insert new report type 'sla_atom_connect' with scheduled times 09:40, 13:20, 17:10
     - Runs Monday to Saturday
     - Uses default group (grupo_destino = NULL)

2. New Cron Jobs
   - `gia_relatorio_sla_atom_connect_0940` — fires at 12:40 UTC (09:40 BRT)
   - `gia_relatorio_sla_atom_connect_1320` — fires at 16:20 UTC (13:20 BRT)
   - `gia_relatorio_sla_atom_connect_1710` — fires at 20:10 UTC (17:10 BRT)
   - All run Monday-Saturday (1-6)
   - Each calls gia-send-relatorio with tipo: "sla_atom_connect"

3. Important Notes
   - Report monitors Atom Connect conversations where client is waiting >1 hour without operator response
   - Excludes conversations in "Finalizado (NPS)" column
   - Excludes internal conversations
   - Includes response time metrics per unit and per attendant
*/

-- Insert the report config
INSERT INTO gia_relatorios_config (tipo, nome, emoji, horario, horarios, ativo, dias_semana, template_formato)
VALUES (
  'sla_atom_connect',
  'SLA Atom Connect',
  '⚠️',
  '09:40',
  ARRAY['09:40','13:20','17:10'],
  true,
  '{1,2,3,4,5,6}',
  'Relatório de conversas aguardando resposta há mais de 1 hora no Atom Connect. Inclui métricas de tempo médio de primeiro contato e tempo entre respostas por unidade e atendente.'
)
ON CONFLICT (tipo) DO UPDATE SET
  nome = EXCLUDED.nome,
  emoji = EXCLUDED.emoji,
  horarios = EXCLUDED.horarios,
  ativo = EXCLUDED.ativo,
  dias_semana = EXCLUDED.dias_semana,
  template_formato = EXCLUDED.template_formato;

-- Unschedule existing jobs for this report (idempotent)
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname LIKE 'gia_relatorio_sla_atom_connect%';

-- Cron job: 09:40 BRT = 12:40 UTC
SELECT cron.schedule(
  'gia_relatorio_sla_atom_connect_0940',
  '40 12 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "sla_atom_connect"}'::jsonb
  );$$
);

-- Cron job: 13:20 BRT = 16:20 UTC
SELECT cron.schedule(
  'gia_relatorio_sla_atom_connect_1320',
  '20 16 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "sla_atom_connect"}'::jsonb
  );$$
);

-- Cron job: 17:10 BRT = 20:10 UTC
SELECT cron.schedule(
  'gia_relatorio_sla_atom_connect_1710',
  '10 20 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "sla_atom_connect"}'::jsonb
  );$$
);