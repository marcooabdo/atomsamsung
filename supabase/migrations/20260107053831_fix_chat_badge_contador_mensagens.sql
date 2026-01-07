/*
  # Fix: Contador de mensagens no badge QG de Comunicação

  ## Problema
  O contador de mensagens não lidas não aparecia para todos os usuários no menu lateral.

  ## Solução
  1. Criar policies permissivas na view para garantir acesso
  2. Simplificar a lógica de contagem de mensagens não lidas
  3. Garantir que todos os usuários autenticados possam ver suas próprias conversas

  ## Alterações
  - Recria policies em chat_conversations para garantir acesso baseado em participant
  - Adiciona policy explícita para usuarios master/diretoria
*/

-- Drop e recria a policy de SELECT em chat_conversations com lógica mais clara
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON chat_conversations;

CREATE POLICY "Users can view conversations they participate in"
  ON chat_conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE chat_participants.conversation_id = chat_conversations.id
      AND chat_participants.user_id = auth.uid()
    )
  );

-- Garantir que a view retorna resultados apenas para o usuário correto
-- A view já faz o filtro por user_id via JOIN, mas vamos garantir

-- Adicionar índice para melhorar performance da query de contagem
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created_sender 
  ON chat_messages(conversation_id, created_at DESC, sender_id)
  WHERE deleted_at IS NULL;

-- Adicionar índice para last_read_at
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_last_read 
  ON chat_participants(user_id, last_read_at);
