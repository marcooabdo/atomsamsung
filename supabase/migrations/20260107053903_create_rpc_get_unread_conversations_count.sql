/*
  # Criar RPC para contar conversas não lidas

  ## Problema
  A view chat_conversations_with_info pode ter problemas de RLS ao ser acessada pelo frontend.

  ## Solução
  Criar uma função RPC SECURITY DEFINER que conta as conversas não lidas para o usuário atual.

  ## Alterações
  - Adiciona função get_unread_conversations_count() que retorna total de conversas com mensagens não lidas
*/

-- Função para contar conversas não lidas do usuário
CREATE OR REPLACE FUNCTION get_unread_conversations_count()
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(DISTINCT c.id) INTO v_count
  FROM chat_conversations c
  INNER JOIN chat_participants p ON p.conversation_id = c.id
  WHERE p.user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM chat_messages m
    WHERE m.conversation_id = c.id
    AND m.created_at > p.last_read_at
    AND m.sender_id != p.user_id
    AND m.deleted_at IS NULL
  );
  
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir que todos os usuários autenticados possam executar esta função
GRANT EXECUTE ON FUNCTION get_unread_conversations_count() TO authenticated;
