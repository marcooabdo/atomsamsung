/*
# Criar cron jobs para envio automático dos relatórios GIA

Agenda os 9 relatórios nos horários corretos (horário de Brasília convertido para UTC):
- 07:30 BRT (10:30 UTC) → Agendamentos IH
- 08:00 BRT (11:00 UTC) → Pulso Operacional
- 08:05 BRT (11:05 UTC) → Estoque do Dia
- 08:30 BRT (11:30 UTC) → Mapa de Rotas
- 09:00 BRT (12:00 UTC) → Abertura e Fechamento
- 09:30 BRT (12:30 UTC) → Limite de Crédito GSPN
- 10:00 BRT (13:00 UTC) → Núcleo de Peças
- 11:00 BRT (14:00 UTC) → Compliance e Erros
- 18:00 BRT (21:00 UTC) → Resumo Final do Dia

Cada job chama a edge function gia-send-relatorio com o tipo específico.
Executa apenas de segunda a sábado.
*/

-- Remove jobs antigos se existirem
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname LIKE 'gia_relatorio_%';

-- Agendamentos IH - 07:30 BRT (10:30 UTC) seg-sab
SELECT cron.schedule(
  'gia_relatorio_agendamentos_ih',
  '30 10 * * 1-6',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/gia-send-relatorio',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"tipo": "agendamentos_ih"}'::jsonb
  );$$
);

-- Pulso Operacional - 08:00 BRT (11:00 UTC) seg-sab
SELECT cron.schedule(
  'gia_relatorio_pulso_operacional',
  '0 11 * * 1-6',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/gia-send-relatorio',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"tipo": "pulso_operacional"}'::jsonb
  );$$
);

-- Estoque do Dia - 08:05 BRT (11:05 UTC) seg-sab
SELECT cron.schedule(
  'gia_relatorio_estoque_dia',
  '5 11 * * 1-6',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/gia-send-relatorio',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"tipo": "estoque_dia"}'::jsonb
  );$$
);

-- Mapa de Rotas - 08:30 BRT (11:30 UTC) seg-sab
SELECT cron.schedule(
  'gia_relatorio_mapa_rotas',
  '30 11 * * 1-6',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/gia-send-relatorio',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"tipo": "mapa_rotas"}'::jsonb
  );$$
);

-- Abertura e Fechamento - 09:00 BRT (12:00 UTC) seg-sab
SELECT cron.schedule(
  'gia_relatorio_abertura_fechamento',
  '0 12 * * 1-6',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/gia-send-relatorio',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"tipo": "abertura_fechamento"}'::jsonb
  );$$
);

-- Limite de Crédito GSPN - 09:30 BRT (12:30 UTC) seg-sab
SELECT cron.schedule(
  'gia_relatorio_limite_credito_gspn',
  '30 12 * * 1-6',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/gia-send-relatorio',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"tipo": "limite_credito_gspn"}'::jsonb
  );$$
);

-- Núcleo de Peças - 10:00 BRT (13:00 UTC) seg-sab
SELECT cron.schedule(
  'gia_relatorio_nucleo_pecas',
  '0 13 * * 1-6',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/gia-send-relatorio',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"tipo": "nucleo_pecas"}'::jsonb
  );$$
);

-- Compliance e Erros - 11:00 BRT (14:00 UTC) seg-sab
SELECT cron.schedule(
  'gia_relatorio_compliance_erros',
  '0 14 * * 1-6',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/gia-send-relatorio',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"tipo": "compliance_erros"}'::jsonb
  );$$
);

-- Resumo Final do Dia - 18:00 BRT (21:00 UTC) seg-sab
SELECT cron.schedule(
  'gia_relatorio_resumo_final',
  '0 21 * * 1-6',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/gia-send-relatorio',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"tipo": "resumo_final"}'::jsonb
  );$$
);
