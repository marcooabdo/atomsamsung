/*
# Add resultado_visita to agendamentos view

1. Modified Views
  - `v_agendamentos_com_status_visual` - added `resultado_visita` column from the `agendamentos` table
    so the agenda calendar cards can display the technician's visit outcome.

2. Important Notes
  - DROP + CREATE because adding a column in the middle changes existing column positions,
    which CREATE OR REPLACE does not allow.
  - Uses security_invoker = true to maintain existing security model.
*/

DROP VIEW IF EXISTS v_agendamentos_com_status_visual;

CREATE VIEW v_agendamentos_com_status_visual
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.os_id,
  a.tecnico_id,
  a.rota_id,
  a.data_agendamento,
  a.horario_inicio,
  a.horario_fim,
  a.status,
  a.confirmado_com_cliente,
  a.observacao,
  a.unidade_id,
  a.gi_postado,
  a.peca_confirmada_usada,
  a.checkout_observacoes,
  a.checkout_checklist_completo,
  a.ordem_sugerida,
  a.distancia_estimada,
  a.checkout_pendente,
  a.created_at,
  a.updated_at,
  o.numero_os_interna,
  o.numero_os_samsung,
  o.tipo_atendimento,
  o.tipo_os,
  o.tipo_reparo,
  o.cliente_nome,
  o.cliente_telefone,
  o.cliente_endereco,
  o.cliente_bairro,
  o.cliente_cidade,
  o.cliente_estado,
  o.cliente_cep,
  o.aparelho_marca,
  o.aparelho_modelo,
  o.defeito_relatado,
  o.coluna_kanban,
  o.observacoes_internas AS os_observacoes,
  u.nome AS tecnico_nome,
  u.email AS tecnico_email,
  un.nome AS unidade_nome,
  un.latitude,
  un.longitude,
  a.resultado_visita
FROM agendamentos a
JOIN os o ON o.id = a.os_id
JOIN usuarios u ON u.id = a.tecnico_id
LEFT JOIN unidades un ON un.id = a.unidade_id
WHERE a.status = ANY (ARRAY['pendente_confirmacao','confirmado','em_andamento','concluido']);
