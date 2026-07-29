/*
# Create OW Simples report config

1. Changes
  - Inserts a new entry in `gia_relatorios_config` for the "ow_simples" report type.
  - This report is on-demand only (no cron schedule), triggered via GIA chat.
  - Target units: Montes Claros, Feira de Santana, Juiz de Fora.

2. Important Notes
  - No cron jobs are created — this report is sent only when manually requested through GIA.
  - Uses the same grupo_destino as validacao_ow (the operational WhatsApp group).
*/

INSERT INTO gia_relatorios_config (tipo, nome, ativo, horarios, dias_semana, grupo_destino)
VALUES (
  'ow_simples',
  'Relatório OW Simples',
  true,
  ARRAY[]::text[],
  ARRAY[]::int[],
  (SELECT grupo_destino FROM gia_relatorios_config WHERE tipo = 'validacao_ow' LIMIT 1)
)
ON CONFLICT (tipo) DO UPDATE SET
  nome = EXCLUDED.nome,
  ativo = EXCLUDED.ativo;
