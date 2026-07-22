/*
# Create GIA Group Notifications System

Sistema para a GIA enviar notificacoes automaticas em um grupo especifico de WhatsApp 
via Evolution API. Registra mensagens enviadas/recebidas e configuracoes de envio agendado.

1. New Tables
   - `gia_group_messages`
     - `id` (uuid, PK)
     - `group_jid` (text) - JID do grupo WhatsApp
     - `direction` (text) - 'incoming' ou 'outgoing'
     - `sender_phone` (text) - telefone de quem enviou
     - `sender_name` (text) - nome de quem enviou
     - `content` (text) - conteudo da mensagem
     - `message_id` (text) - ID da mensagem na Evolution API
     - `message_type` (text) - tipo: text, image, etc
     - `processed_by_ai` (boolean) - se foi processado pelo ChatGPT
     - `ai_response` (text) - resposta gerada pela IA
     - `created_at` (timestamptz)

   - `gia_group_scheduled_reports`
     - `id` (uuid, PK)
     - `report_type` (text) - tipo do relatorio (daily_summary, alerts, etc)
     - `cron_expression` (text) - expressao cron para agendamento
     - `prompt_template` (text) - template do prompt para ChatGPT
     - `is_active` (boolean) - se esta ativo
     - `last_sent_at` (timestamptz) - ultima vez enviado
     - `created_at` (timestamptz)

2. Security
   - Enable RLS on both tables
   - Permissive policies for authenticated users (sistema interno)

3. Important Notes
   - group_jid default: '120363427351181397@g.us'
   - Mensagens do phone '553491368788' sao da propria GIA (ignorar no relay)
*/

CREATE TABLE IF NOT EXISTS gia_group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_jid text NOT NULL DEFAULT '120363427351181397@g.us',
  direction text NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  sender_phone text,
  sender_name text,
  content text NOT NULL,
  message_id text UNIQUE,
  message_type text NOT NULL DEFAULT 'text',
  processed_by_ai boolean NOT NULL DEFAULT false,
  ai_response text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gia_group_scheduled_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL,
  cron_expression text,
  prompt_template text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gia_group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gia_group_scheduled_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gia_group_messages_select" ON gia_group_messages;
CREATE POLICY "gia_group_messages_select" ON gia_group_messages FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "gia_group_messages_insert" ON gia_group_messages;
CREATE POLICY "gia_group_messages_insert" ON gia_group_messages FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "gia_group_messages_update" ON gia_group_messages;
CREATE POLICY "gia_group_messages_update" ON gia_group_messages FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "gia_group_messages_delete" ON gia_group_messages;
CREATE POLICY "gia_group_messages_delete" ON gia_group_messages FOR DELETE
  TO authenticated USING (true);

DROP POLICY IF EXISTS "gia_group_scheduled_reports_select" ON gia_group_scheduled_reports;
CREATE POLICY "gia_group_scheduled_reports_select" ON gia_group_scheduled_reports FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "gia_group_scheduled_reports_insert" ON gia_group_scheduled_reports;
CREATE POLICY "gia_group_scheduled_reports_insert" ON gia_group_scheduled_reports FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "gia_group_scheduled_reports_update" ON gia_group_scheduled_reports;
CREATE POLICY "gia_group_scheduled_reports_update" ON gia_group_scheduled_reports FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "gia_group_scheduled_reports_delete" ON gia_group_scheduled_reports;
CREATE POLICY "gia_group_scheduled_reports_delete" ON gia_group_scheduled_reports FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_gia_group_messages_group_jid ON gia_group_messages(group_jid);
CREATE INDEX IF NOT EXISTS idx_gia_group_messages_created_at ON gia_group_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gia_group_messages_message_id ON gia_group_messages(message_id);
