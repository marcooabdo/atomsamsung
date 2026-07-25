/*
# Create Controle LP Prazo Report Configuration and Cron Jobs

1. Data Changes
   - Inserts new report type "controle_lp_prazo" into `gia_relatorios_config`
   - Report shows all LP OS grouped by unit with deadline tracking (CI=3d, IH 5d/7d)
   - Sent 4x daily: 9:10, 12:10, 15:10, 17:10 (BRT) Monday-Saturday

2. Cron Jobs
   - gia_relatorio_controle_lp_0910: fires at 12:10 UTC (9:10 BRT)
   - gia_relatorio_controle_lp_1210: fires at 15:10 UTC (12:10 BRT)
   - gia_relatorio_controle_lp_1510: fires at 18:10 UTC (15:10 BRT)
   - gia_relatorio_controle_lp_1710: fires at 20:10 UTC (17:10 BRT)

3. Important Notes
   - Uses same default group as other GIA reports
   - Days are calendar days (dias corridos)
   - CI = 3 days, IH models starting with QN/UN/W = 7 days, IH other = 5 days
   - Excludes OS in: reparo_concluido, service_handling, return_handling, trade_up, instalacao_inicial, os_fechada
*/

-- Insert report config (idempotent)
INSERT INTO gia_relatorios_config (tipo, nome, emoji, horario, ativo, template_formato)
VALUES (
  'controle_lp_prazo',
  'Controle LP - Prazo',
  '📋',
  '09:10, 12:10, 15:10, 17:10',
  true,
  'Relatório de controle de prazo LP. CI=3 dias, IH 5 dias (REF/RT/AC), IH 7 dias (QN/UN/W-TV). Agrupa por unidade. Mostra cada OS com modelo, etapa, dias aberta e destaca atrasadas.'
)
ON CONFLICT (tipo) DO UPDATE SET
  nome = EXCLUDED.nome,
  emoji = EXCLUDED.emoji,
  horario = EXCLUDED.horario,
  ativo = EXCLUDED.ativo,
  template_formato = EXCLUDED.template_formato;

-- Remove old cron jobs if they exist
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname LIKE 'gia_relatorio_controle_lp_%';

-- 9:10 BRT = 12:10 UTC (Monday-Saturday)
SELECT cron.schedule(
  'gia_relatorio_controle_lp_0910',
  '10 12 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "controle_lp_prazo"}'::jsonb
  );$$
);

-- 12:10 BRT = 15:10 UTC (Monday-Saturday)
SELECT cron.schedule(
  'gia_relatorio_controle_lp_1210',
  '10 15 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "controle_lp_prazo"}'::jsonb
  );$$
);

-- 15:10 BRT = 18:10 UTC (Monday-Saturday)
SELECT cron.schedule(
  'gia_relatorio_controle_lp_1510',
  '10 18 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "controle_lp_prazo"}'::jsonb
  );$$
);

-- 17:10 BRT = 20:10 UTC (Monday-Saturday)
SELECT cron.schedule(
  'gia_relatorio_controle_lp_1710',
  '10 20 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "controle_lp_prazo"}'::jsonb
  );$$
);