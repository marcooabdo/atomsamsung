/*
  # Recriar View de Conversas com Contador de Não Lidas

  ## Objetivo
  Dropar e recriar a view chat_conversations_with_info incluindo contador de mensagens não lidas

  ## Alterações
  1. Dropar view existente
  2. Recriar com contador de mensagens não lidas
*/

-- Dropar view existente
DROP VIEW IF EXISTS chat_conversations_with_info;

-- Recriar view incluindo contador de não lidas
CREATE VIEW chat_conversations_with_info AS
SELECT 
  c.id,
  c.tipo,
  c.nome,
  c.descricao,
  c.created_by,
  c.created_at,
  c.updated_at,
  cp.user_id,
  (
    SELECT json_build_object(
      'content', cm.content,
      'message_type', cm.message_type,
      'sender_name', u.nome,
      'created_at', cm.created_at
    )
    FROM chat_messages cm
    LEFT JOIN usuarios u ON u.id = cm.sender_id
    WHERE cm.conversation_id = c.id
    ORDER BY cm.created_at DESC
    LIMIT 1
  ) as last_message,
  (
    SELECT COUNT(*)::integer
    FROM chat_messages cm
    WHERE cm.conversation_id = c.id
      AND cm.sender_id != cp.user_id
      AND NOT EXISTS (
        SELECT 1 FROM chat_message_reads cmr
        WHERE cmr.message_id = cm.id
          AND cmr.user_id = cp.user_id
      )
  ) as unread_count
FROM chat_conversations c
INNER JOIN chat_participants cp ON cp.conversation_id = c.id;
