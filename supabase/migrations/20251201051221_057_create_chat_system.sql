/*
  # Sistema de Chat Interno Corporativo

  ## Visão Geral
  Sistema completo de chat interno estilo WhatsApp para comunicação da equipe Samsung.
  Suporta conversas diretas (1-1), grupos, envio de arquivos, emojis e confirmação de leitura.

  ## 1. Tabelas Principais

  ### 1.1. chat_conversations
  - Armazena todas as conversas (diretas e grupos)
  - Campos: id, tipo (direct/group), nome, descrição, foto_url
  - created_at, updated_at (atualizado a cada nova mensagem)

  ### 1.2. chat_participants
  - Vincula usuários às conversas
  - Campos: conversation_id, user_id, role (admin/member)
  - last_read_at para controle de mensagens não lidas

  ### 1.3. chat_messages
  - Armazena todas as mensagens enviadas
  - Campos: conversation_id, sender_id, content, message_type
  - Suporte a texto, imagem, documento e áudio
  - Soft delete (deleted_at)

  ### 1.4. chat_message_reads
  - Rastreamento de leitura de mensagens
  - Usado para "visto" em conversas diretas
  - Lista de visualizações em grupos

  ### 1.5. user_presence
  - Controle de status online/offline
  - Campos: user_id, status, last_seen_at

  ## 2. Security
  - RLS habilitado em todas as tabelas
  - Usuários só acessam conversas que participam
  - Apenas admins editam configurações de grupo
  - Master e Diretoria têm acesso total
*/

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. CONVERSAS (DIRETAS E GRUPOS)
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('direct', 'group')),
  nome text, -- NULL para conversas diretas, nome do grupo para grupos
  descricao text,
  foto_url text,
  created_by uuid REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_chat_conversations_tipo ON chat_conversations(tipo);
CREATE INDEX idx_chat_conversations_updated_at ON chat_conversations(updated_at DESC);

-- =====================================================
-- 2. PARTICIPANTES DAS CONVERSAS
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  last_read_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_chat_participants_conversation ON chat_participants(conversation_id);
CREATE INDEX idx_chat_participants_user ON chat_participants(user_id);
CREATE INDEX idx_chat_participants_composite ON chat_participants(user_id, conversation_id);

-- =====================================================
-- 3. MENSAGENS
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES usuarios(id),
  content text,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'audio')),
  file_url text,
  file_name text,
  file_size integer,
  reply_to_message_id uuid REFERENCES chat_messages(id),
  created_at timestamptz DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- =====================================================
-- 4. LEITURA DE MENSAGENS
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX idx_chat_message_reads_message ON chat_message_reads(message_id);
CREATE INDEX idx_chat_message_reads_user ON chat_message_reads(user_id);

-- =====================================================
-- 5. PRESENÇA DE USUÁRIOS (ONLINE/OFFLINE)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_presence (
  user_id uuid PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
  last_seen_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_user_presence_status ON user_presence(status);
CREATE INDEX idx_user_presence_last_seen ON user_presence(last_seen_at DESC);

-- =====================================================
-- TRIGGERS PARA ATUALIZAR TIMESTAMPS
-- =====================================================

-- Atualizar updated_at em conversas quando nova mensagem é enviada
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_timestamp
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_timestamp();

-- Atualizar updated_at em user_presence
CREATE OR REPLACE FUNCTION update_user_presence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_presence_timestamp
BEFORE UPDATE ON user_presence
FOR EACH ROW
EXECUTE FUNCTION update_user_presence_timestamp();

-- =====================================================
-- VIEW: CONVERSAS COM INFORMAÇÕES DE NÃO LIDAS
-- =====================================================

CREATE OR REPLACE VIEW chat_conversations_with_info AS
SELECT 
  c.id,
  c.tipo,
  c.nome,
  c.descricao,
  c.foto_url,
  c.created_by,
  c.created_at,
  c.updated_at,
  p.user_id,
  p.role,
  p.last_read_at,
  (
    SELECT COUNT(*)
    FROM chat_messages m
    WHERE m.conversation_id = c.id
    AND m.created_at > p.last_read_at
    AND m.sender_id != p.user_id
    AND m.deleted_at IS NULL
  ) as unread_count,
  (
    SELECT json_build_object(
      'id', lm.id,
      'content', CASE WHEN lm.deleted_at IS NULL THEN lm.content ELSE 'Mensagem removida' END,
      'message_type', lm.message_type,
      'sender_id', lm.sender_id,
      'sender_name', u.nome,
      'created_at', lm.created_at
    )
    FROM chat_messages lm
    LEFT JOIN usuarios u ON u.id = lm.sender_id
    WHERE lm.conversation_id = c.id
    ORDER BY lm.created_at DESC
    LIMIT 1
  ) as last_message
FROM chat_conversations c
INNER JOIN chat_participants p ON p.conversation_id = c.id;

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- Policies para chat_conversations
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

CREATE POLICY "Users can create conversations"
  ON chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group admins can update group info"
  ON chat_conversations FOR UPDATE
  TO authenticated
  USING (
    tipo = 'group' AND (
      EXISTS (
        SELECT 1 FROM chat_participants
        WHERE chat_participants.conversation_id = chat_conversations.id
        AND chat_participants.user_id = auth.uid()
        AND chat_participants.role = 'admin'
      )
      OR EXISTS (
        SELECT 1 FROM usuarios
        WHERE usuarios.id = auth.uid()
        AND usuarios.tipo IN ('master', 'diretoria')
      )
    )
  );

-- Policies para chat_participants
CREATE POLICY "Users can view participants of their conversations"
  ON chat_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_participants cp
      WHERE cp.conversation_id = chat_participants.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join conversations"
  ON chat_participants FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their own participant record"
  ON chat_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can remove participants from groups"
  ON chat_participants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations c
      INNER JOIN chat_participants cp ON cp.conversation_id = c.id
      WHERE c.id = chat_participants.conversation_id
      AND c.tipo = 'group'
      AND cp.user_id = auth.uid()
      AND cp.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretoria')
    )
    OR user_id = auth.uid() -- Usuário pode sair do grupo
  );

-- Policies para chat_messages
CREATE POLICY "Users can view messages from their conversations"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE chat_participants.conversation_id = chat_messages.conversation_id
      AND chat_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their conversations"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM chat_participants
      WHERE chat_participants.conversation_id = chat_messages.conversation_id
      AND chat_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages"
  ON chat_messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
  ON chat_messages FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());

-- Policies para chat_message_reads
CREATE POLICY "Users can view read receipts for their conversations"
  ON chat_message_reads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_messages m
      INNER JOIN chat_participants p ON p.conversation_id = m.conversation_id
      WHERE m.id = chat_message_reads.message_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can mark messages as read"
  ON chat_message_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policies para user_presence
CREATE POLICY "Users can view presence of users in their conversations"
  ON user_presence FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_participants p1
      INNER JOIN chat_participants p2 ON p2.conversation_id = p1.conversation_id
      WHERE p1.user_id = auth.uid()
      AND p2.user_id = user_presence.user_id
    )
  );

CREATE POLICY "Users can update their own presence"
  ON user_presence FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own presence status"
  ON user_presence FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- FUNÇÕES AUXILIARES
-- =====================================================

-- Função para criar conversa direta entre dois usuários
CREATE OR REPLACE FUNCTION create_direct_conversation(
  user1_id uuid,
  user2_id uuid
)
RETURNS uuid AS $$
DECLARE
  existing_conversation_id uuid;
  new_conversation_id uuid;
BEGIN
  -- Verificar se já existe conversa direta entre os dois usuários
  SELECT c.id INTO existing_conversation_id
  FROM chat_conversations c
  WHERE c.tipo = 'direct'
  AND EXISTS (
    SELECT 1 FROM chat_participants p1
    WHERE p1.conversation_id = c.id AND p1.user_id = user1_id
  )
  AND EXISTS (
    SELECT 1 FROM chat_participants p2
    WHERE p2.conversation_id = c.id AND p2.user_id = user2_id
  )
  AND (
    SELECT COUNT(*) FROM chat_participants
    WHERE conversation_id = c.id
  ) = 2;

  IF existing_conversation_id IS NOT NULL THEN
    RETURN existing_conversation_id;
  END IF;

  -- Criar nova conversa
  INSERT INTO chat_conversations (tipo, created_by)
  VALUES ('direct', user1_id)
  RETURNING id INTO new_conversation_id;

  -- Adicionar participantes
  INSERT INTO chat_participants (conversation_id, user_id, role)
  VALUES 
    (new_conversation_id, user1_id, 'member'),
    (new_conversation_id, user2_id, 'member');

  RETURN new_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para marcar mensagens como lidas
CREATE OR REPLACE FUNCTION mark_messages_as_read(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS void AS $$
BEGIN
  -- Atualizar last_read_at do participante
  UPDATE chat_participants
  SET last_read_at = now()
  WHERE conversation_id = p_conversation_id
  AND user_id = p_user_id;

  -- Inserir registros de leitura para mensagens não lidas
  INSERT INTO chat_message_reads (message_id, user_id)
  SELECT m.id, p_user_id
  FROM chat_messages m
  WHERE m.conversation_id = p_conversation_id
  AND m.sender_id != p_user_id
  AND m.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM chat_message_reads r
    WHERE r.message_id = m.id AND r.user_id = p_user_id
  )
  ON CONFLICT (message_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;