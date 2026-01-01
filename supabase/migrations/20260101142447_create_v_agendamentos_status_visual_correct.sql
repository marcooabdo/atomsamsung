/*
  # Criar view de agendamentos com status visual

  1. View
    - `v_agendamentos_com_status_visual` - View para exibir agendamentos com informações da OS
*/

CREATE OR REPLACE VIEW v_agendamentos_com_status_visual AS
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
  
  -- Dados da OS
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
  o.observacoes_internas as os_observacoes,
  
  -- Dados do técnico
  u.nome as tecnico_nome,
  u.email as tecnico_email,
  
  -- Dados da unidade
  un.nome as unidade_nome,
  un.latitude as latitude,
  un.longitude as longitude
  
FROM agendamentos a
INNER JOIN os o ON o.id = a.os_id
INNER JOIN usuarios u ON u.id = a.tecnico_id
LEFT JOIN unidades un ON un.id = a.unidade_id
WHERE a.status IN ('pendente_confirmacao', 'confirmado', 'em_andamento', 'concluido');
