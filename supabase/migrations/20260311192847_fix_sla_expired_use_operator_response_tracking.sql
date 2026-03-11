/*
  # Fix SLA Expired calculation in response metrics RPC

  1. Changes
    - Updated `sla_expired` CTE to use `ultima_resposta_cliente_at` and `ultima_resposta_operador_at`
      directly from the conversation record instead of scanning all messages
    - SLA is now only considered expired when:
      a) Client sent a message (ultima_resposta_cliente_at IS NOT NULL)
      b) No operator has responded after the client's last message
         (ultima_resposta_operador_at IS NULL OR ultima_resposta_operador_at < ultima_resposta_cliente_at)
      c) Time since client's last message exceeds v_sla_minutes

  2. Important Notes
    - This aligns the dashboard SLA count with the kanban card SLA indicator
    - When an operator responds, the SLA resets because ultima_resposta_operador_at >= ultima_resposta_cliente_at
    - When the client sends a new message, SLA starts counting again
*/

CREATE OR REPLACE FUNCTION get_atom_connect_response_metrics(p_unidade_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  v_sla_minutes int := 20;
BEGIN
  WITH conversa_first_messages AS (
    SELECT
      c.id AS conversa_id,
      c.atendente_id,
      c.cliente_nome,
      c.cliente_telefone,
      c.ultima_resposta_cliente_at,
      c.ultima_resposta_operador_at,
      c.coluna_pipeline,
      (
        SELECT m.created_at
        FROM atom_connect_mensagens m
        WHERE m.conversa_id = c.id AND m.from_me = false
        ORDER BY m.created_at ASC
        LIMIT 1
      ) AS first_client_msg,
      (
        SELECT m.created_at
        FROM atom_connect_mensagens m
        WHERE m.conversa_id = c.id AND m.from_me = true AND m.is_bot = false
        ORDER BY m.created_at ASC
        LIMIT 1
      ) AS first_operator_response
    FROM atom_connect_conversas c
    WHERE (p_unidade_id IS NULL OR c.unidade_id = p_unidade_id)
      AND c.resultado_conversa IS NULL
  ),
  first_response_times AS (
    SELECT
      conversa_id,
      atendente_id,
      EXTRACT(EPOCH FROM (first_operator_response - first_client_msg)) AS first_response_seconds
    FROM conversa_first_messages
    WHERE first_client_msg IS NOT NULL
      AND first_operator_response IS NOT NULL
      AND first_operator_response > first_client_msg
  ),
  response_pairs AS (
    SELECT
      cm.conversa_id,
      cm.from_me,
      cm.is_bot,
      cm.enviado_por,
      cm.created_at,
      c.atendente_id,
      LAG(cm.created_at) OVER (PARTITION BY cm.conversa_id ORDER BY cm.created_at) AS prev_msg_at,
      LAG(cm.from_me) OVER (PARTITION BY cm.conversa_id ORDER BY cm.created_at) AS prev_from_me
    FROM atom_connect_mensagens cm
    JOIN atom_connect_conversas c ON c.id = cm.conversa_id
    WHERE (p_unidade_id IS NULL OR c.unidade_id = p_unidade_id)
      AND c.resultado_conversa IS NULL
  ),
  between_response_times AS (
    SELECT
      conversa_id,
      COALESCE(enviado_por, atendente_id) AS responder_id,
      EXTRACT(EPOCH FROM (created_at - prev_msg_at)) AS response_seconds
    FROM response_pairs
    WHERE from_me = true
      AND is_bot = false
      AND prev_from_me = false
      AND prev_msg_at IS NOT NULL
  ),
  waiting_contacts AS (
    SELECT
      cfm.conversa_id,
      cfm.cliente_nome,
      cfm.cliente_telefone,
      cfm.ultima_resposta_cliente_at,
      cfm.ultima_resposta_cliente_at AS last_client_msg,
      cfm.ultima_resposta_operador_at AS last_operator_msg
    FROM conversa_first_messages cfm
  ),
  contacts_waiting AS (
    SELECT
      conversa_id,
      cliente_nome,
      cliente_telefone,
      last_client_msg,
      EXTRACT(EPOCH FROM (NOW() - last_client_msg)) AS waiting_seconds
    FROM waiting_contacts
    WHERE last_client_msg IS NOT NULL
      AND (last_operator_msg IS NULL OR last_client_msg > last_operator_msg)
  ),
  sla_expired AS (
    SELECT
      cfm.conversa_id,
      cfm.atendente_id
    FROM conversa_first_messages cfm
    WHERE cfm.ultima_resposta_cliente_at IS NOT NULL
      AND (
        cfm.ultima_resposta_operador_at IS NULL
        OR cfm.ultima_resposta_operador_at < cfm.ultima_resposta_cliente_at
      )
      AND EXTRACT(EPOCH FROM (NOW() - cfm.ultima_resposta_cliente_at)) > (v_sla_minutes * 60)
  ),
  per_attendant_first AS (
    SELECT
      atendente_id,
      AVG(first_response_seconds) AS avg_first_response,
      COUNT(*) AS total_conversations
    FROM first_response_times
    WHERE atendente_id IS NOT NULL
    GROUP BY atendente_id
  ),
  per_attendant_between AS (
    SELECT
      responder_id AS atendente_id,
      AVG(response_seconds) AS avg_between_response,
      COUNT(*) AS total_responses
    FROM between_response_times
    WHERE responder_id IS NOT NULL
    GROUP BY responder_id
  )
  SELECT jsonb_build_object(
    'avg_first_response_seconds', (SELECT COALESCE(AVG(first_response_seconds), 0) FROM first_response_times),
    'avg_between_response_seconds', (SELECT COALESCE(AVG(response_seconds), 0) FROM between_response_times),
    'sla_minutes', v_sla_minutes,
    'sla_expired_count', (SELECT COUNT(*) FROM sla_expired),
    'oldest_waiting', (
      SELECT jsonb_build_object(
        'conversa_id', conversa_id,
        'cliente_nome', cliente_nome,
        'cliente_telefone', cliente_telefone,
        'waiting_seconds', waiting_seconds,
        'last_client_msg', last_client_msg
      )
      FROM contacts_waiting
      ORDER BY waiting_seconds DESC
      LIMIT 1
    ),
    'all_waiting', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'conversa_id', conversa_id,
          'cliente_nome', cliente_nome,
          'cliente_telefone', cliente_telefone,
          'waiting_seconds', waiting_seconds
        ) ORDER BY waiting_seconds DESC
      ), '[]'::jsonb)
      FROM contacts_waiting
    ),
    'per_attendant', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'atendente_id', COALESCE(paf.atendente_id, pab.atendente_id),
          'avg_first_response_seconds', COALESCE(paf.avg_first_response, 0),
          'avg_between_response_seconds', COALESCE(pab.avg_between_response, 0),
          'total_conversations', COALESCE(paf.total_conversations, 0),
          'total_responses', COALESCE(pab.total_responses, 0)
        )
      ), '[]'::jsonb)
      FROM per_attendant_first paf
      FULL OUTER JOIN per_attendant_between pab ON paf.atendente_id = pab.atendente_id
    )
  ) INTO result;

  RETURN result;
END;
$$;
