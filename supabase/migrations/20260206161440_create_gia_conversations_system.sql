/*
  # Create GIA Conversations System

  1. New Tables
    - `gia_conversations`
      - `id` (uuid, primary key)
      - `usuario_id` (uuid, references usuarios)
      - `titulo` (text) - auto-generated title
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `gia_messages`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, references gia_conversations)
      - `role` (text) - 'user', 'assistant', 'system'
      - `content` (text) - message content
      - `metadata` (jsonb) - cards, tokens, etc
      - `created_at` (timestamptz)
    - `gia_memoria`
      - `id` (uuid, primary key)
      - `usuario_id` (uuid, references usuarios)
      - `chave` (text) - memory key
      - `valor` (text) - memory value
      - `categoria` (text) - category
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only access their own conversations and memories
*/

CREATE TABLE IF NOT EXISTS gia_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gia_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own GIA conversations"
  ON gia_conversations FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Users can create own GIA conversations"
  ON gia_conversations FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Users can update own GIA conversations"
  ON gia_conversations FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Users can delete own GIA conversations"
  ON gia_conversations FOR DELETE
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE TABLE IF NOT EXISTS gia_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES gia_conversations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gia_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own GIA messages"
  ON gia_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM gia_conversations
      WHERE gia_conversations.id = gia_messages.conversation_id
      AND gia_conversations.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own conversations"
  ON gia_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gia_conversations
      WHERE gia_conversations.id = gia_messages.conversation_id
      AND gia_conversations.usuario_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS gia_memoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  chave text NOT NULL,
  valor text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT 'geral',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gia_memoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own GIA memories"
  ON gia_memoria FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Users can create own GIA memories"
  ON gia_memoria FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Users can update own GIA memories"
  ON gia_memoria FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Users can delete own GIA memories"
  ON gia_memoria FOR DELETE
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_gia_conversations_usuario ON gia_conversations(usuario_id);
CREATE INDEX IF NOT EXISTS idx_gia_messages_conversation ON gia_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_gia_memoria_usuario ON gia_memoria(usuario_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gia_memoria_unique_key ON gia_memoria(usuario_id, chave);
