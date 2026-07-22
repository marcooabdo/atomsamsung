/*
# Recriar cron jobs GIA com URL e chave hardcoded

Os cron jobs anteriores usavam current_setting que retorna NULL.
Esta migração recria todos os jobs com a URL do Supabase e anon key diretamente,
já que a function gia-send-relatorio não requer JWT (verify_jwt=false).

Horários (Brasília → UTC):
- 07:30 → 10:30 | Agendamentos IH
- 08:00 → 11:00 | Pulso Operacional  
- 08:05 → 11:05 | Estoque do Dia
- 08:30 → 11:30 | Mapa de Rotas
- 09:00 → 12:00 | Abertura e Fechamento
- 09:30 → 12:30 | Limite de Crédito GSPN
- 10:00 → 13:00 | Núcleo de Peças
- 11:00 → 14:00 | Compliance e Erros
- 18:00 → 21:00 | Resumo Final do Dia

Apenas segunda a sábado (1-6).
*/

-- Remove todos os jobs antigos
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname LIKE 'gia_relatorio_%';

-- Agendamentos IH - 07:30 BRT
SELECT cron.schedule(
  'gia_relatorio_agendamentos_ih',
  '30 10 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "agendamentos_ih"}'::jsonb
  );$$
);

-- Pulso Operacional - 08:00 BRT
SELECT cron.schedule(
  'gia_relatorio_pulso_operacional',
  '0 11 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "pulso_operacional"}'::jsonb
  );$$
);

-- Estoque do Dia - 08:05 BRT
SELECT cron.schedule(
  'gia_relatorio_estoque_dia',
  '5 11 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "estoque_dia"}'::jsonb
  );$$
);

-- Mapa de Rotas - 08:30 BRT
SELECT cron.schedule(
  'gia_relatorio_mapa_rotas',
  '30 11 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "mapa_rotas"}'::jsonb
  );$$
);

-- Abertura e Fechamento - 09:00 BRT
SELECT cron.schedule(
  'gia_relatorio_abertura_fechamento',
  '0 12 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "abertura_fechamento"}'::jsonb
  );$$
);

-- Limite de Crédito GSPN - 09:30 BRT
SELECT cron.schedule(
  'gia_relatorio_limite_credito_gspn',
  '30 12 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "limite_credito_gspn"}'::jsonb
  );$$
);

-- Núcleo de Peças - 10:00 BRT
SELECT cron.schedule(
  'gia_relatorio_nucleo_pecas',
  '0 13 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "nucleo_pecas"}'::jsonb
  );$$
);

-- Compliance e Erros - 11:00 BRT
SELECT cron.schedule(
  'gia_relatorio_compliance_erros',
  '0 14 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "compliance_erros"}'::jsonb
  );$$
);

-- Resumo Final do Dia - 18:00 BRT
SELECT cron.schedule(
  'gia_relatorio_resumo_final',
  '0 21 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://tivfvkfcpntucbufplwb.supabase.co/functions/v1/gia-send-relatorio',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmZ2a2ZjcG50dWNidWZwbHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzI3MzgsImV4cCI6MjA4MjYwODczOH0.UWutV1c8BMnh7n67SqmUiz2xg3qiPomBK8WNpgKnWKY"}'::jsonb,
    body := '{"tipo": "resumo_final"}'::jsonb
  );$$
);
