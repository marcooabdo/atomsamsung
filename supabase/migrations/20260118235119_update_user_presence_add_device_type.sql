/*
  # Atualizar Sistema de Presença

  ## Objetivo
  Adicionar device_type e criar funções para gerenciar presença online
  
  ## Alterações
  1. Adicionar coluna device_type
  2. Criar funções de heartbeat e offline
  3. Criar tabela de mensagens lidas
*/

-- Adicionar device_type se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_presence' AND column_name = 'device_type'
  ) THEN
    ALTER TABLE user_presence ADD COLUMN device_type text CHECK (device_type IN ('web', 'mobile'));
  END IF;
END $$;

-- Função para atualizar presença (heartbeat)
CREATE OR REPLACE FUNCTION update_user_presence(
  p_user_id uuid,
  p_device_type text DEFAULT 'web'
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_presence (user_id, status, last_seen_at, device_type)
  VALUES (p_user_id, 'online', now(), p_device_type)
  ON CONFLICT (user_id) 
  DO UPDATE SET
    status = 'online',
    last_seen_at = now(),
    device_type = EXCLUDED.device_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para marcar como offline
CREATE OR REPLACE FUNCTION set_user_offline(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE user_presence
  SET status = 'offline', last_seen_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tabela para rastrear mensagens lidas por usuário
CREATE TABLE IF NOT EXISTS chat_message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_chat_message_reads_message ON chat_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_reads_user ON chat_message_reads(user_id);

-- RLS
ALTER TABLE chat_message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view message reads in their conversations" ON chat_message_reads;
CREATE POLICY "Users can view message reads in their conversations"
  ON chat_message_reads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_messages cm
      INNER JOIN chat_participants cp ON cp.conversation_id = cm.conversation_id
      WHERE cm.id = message_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can mark messages as read" ON chat_message_reads;
CREATE POLICY "Users can mark messages as read"
  ON chat_message_reads FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM chat_messages cm
      INNER JOIN chat_participants cp ON cp.conversation_id = cm.conversation_id
      WHERE cm.id = message_id AND cp.user_id = auth.uid()
    )
  );

-- Habilitar realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'chat_message_reads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_message_reads;
  END IF;
END $$;

-- Função para marcar todas mensagens de uma conversa como lidas
CREATE OR REPLACE FUNCTION mark_conversation_as_read(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS void AS $$
BEGIN
  INSERT INTO chat_message_reads (message_id, user_id)
  SELECT cm.id, p_user_id
  FROM chat_messages cm
  WHERE cm.conversation_id = p_conversation_id
    AND cm.sender_id != p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM chat_message_reads cmr
      WHERE cmr.message_id = cm.id AND cmr.user_id = p_user_id
    )
  ON CONFLICT (message_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
