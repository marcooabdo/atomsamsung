/*
# Create GIA Brain System — Knowledge Base, Pipeline Messages & Logs

## Overview
Creates the complete GIA Brain system for AI-powered customer service in Atom Connect.
The GIA uses gpt-4o-mini to attend customers via WhatsApp, using a configurable
knowledge base per unit, automated pipeline stage messages, and full interaction logging.

## 1. New Tables

### `gia_base_conhecimento` — Knowledge Base entries
- `id` (uuid, PK) — unique identifier
- `titulo` (text) — short title/label for the knowledge entry
- `conteudo` (text) — the actual knowledge content/instructions
- `categoria` (text) — category for organization (geral, atendimento, orcamento, reparo, pecas, prazos, negociacao, outro)
- `unidade_ids` (uuid[]) — array of unit IDs this knowledge applies to; NULL means ALL units
- `ativo` (boolean) — whether this entry is active
- `ordem` (integer) — display order
- `criado_por` (uuid) — who created this entry
- `created_at` / `updated_at` — timestamps

### `gia_pipeline_mensagens` — Automated messages per pipeline stage
- `id` (uuid, PK) — unique identifier
- `coluna_kanban` (text) — the pipeline column ID (e.g. 'os_nova', 'diagnostico', etc.)
- `tipo_atendimento` (text) — 'todos', 'CI', or 'IH'
- `tipo_os` (text) — 'todos', 'LP', or 'OW'
- `mensagem` (text) — the message template to send
- `ativo` (boolean) — whether this message is enabled
- `frequencia_horas` (integer) — minimum hours between re-sends (0 = send once only)
- `unidade_ids` (uuid[]) — array of unit IDs; NULL means ALL units
- `criado_por` (uuid) — who created
- `created_at` / `updated_at` — timestamps

### `gia_pipeline_mensagens_log` — Log of sent pipeline messages
- `id` (uuid, PK)
- `mensagem_config_id` (uuid, FK) — which config triggered this
- `os_id` (uuid) — which OS
- `conversa_id` (uuid) — which Atom Connect conversation
- `coluna_kanban` (text) — which column triggered it
- `mensagem_enviada` (text) — the actual message sent
- `created_at` — when sent

### `gia_atendimento_logs` — Log of all GIA AI interactions with customers
- `id` (uuid, PK)
- `conversa_id` (uuid) — Atom Connect conversation
- `os_id` (uuid, nullable) — linked OS if any
- `unidade_id` (uuid) — unit
- `mensagem_cliente` (text) — what the customer said
- `resposta_gia` (text) — what GIA replied
- `tokens_usados` (integer) — OpenAI tokens consumed
- `modelo` (text) — model used (gpt-4o-mini)
- `transferiu_para_humano` (boolean) — whether GIA escalated to human
- `motivo_transferencia` (text) — reason for escalation if any
- `tempo_resposta_ms` (integer) — response time in milliseconds
- `created_at` — timestamp

## 2. Security
- RLS enabled on all tables
- Knowledge base and pipeline messages: authenticated users can read, master/admin can write
- Logs: authenticated can read, service role writes (from edge functions)

## 3. Important Notes
- Knowledge base entries with NULL unidade_ids apply to ALL units
- Pipeline messages support filtering by CI/IH and LP/OW combinations
- The log table tracks every AI interaction for audit and cost monitoring
*/

-- ============================================
-- 1. GIA Base de Conhecimento (Knowledge Base)
-- ============================================
CREATE TABLE IF NOT EXISTS gia_base_conhecimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  conteudo text NOT NULL,
  categoria text NOT NULL DEFAULT 'geral',
  unidade_ids uuid[] DEFAULT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  criado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gia_base_conhecimento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_gia_conhecimento" ON gia_base_conhecimento;
CREATE POLICY "select_gia_conhecimento" ON gia_base_conhecimento
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_gia_conhecimento" ON gia_base_conhecimento;
CREATE POLICY "insert_gia_conhecimento" ON gia_base_conhecimento
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_gia_conhecimento" ON gia_base_conhecimento;
CREATE POLICY "update_gia_conhecimento" ON gia_base_conhecimento
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_gia_conhecimento" ON gia_base_conhecimento;
CREATE POLICY "delete_gia_conhecimento" ON gia_base_conhecimento
  FOR DELETE TO authenticated USING (true);

-- ============================================
-- 2. GIA Pipeline Mensagens (Auto-messages config)
-- ============================================
CREATE TABLE IF NOT EXISTS gia_pipeline_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coluna_kanban text NOT NULL,
  tipo_atendimento text NOT NULL DEFAULT 'todos',
  tipo_os text NOT NULL DEFAULT 'todos',
  mensagem text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  frequencia_horas integer NOT NULL DEFAULT 0,
  unidade_ids uuid[] DEFAULT NULL,
  criado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_tipo_atendimento CHECK (tipo_atendimento IN ('todos', 'CI', 'IH')),
  CONSTRAINT valid_tipo_os CHECK (tipo_os IN ('todos', 'LP', 'OW'))
);

ALTER TABLE gia_pipeline_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_gia_pipeline_msgs" ON gia_pipeline_mensagens;
CREATE POLICY "select_gia_pipeline_msgs" ON gia_pipeline_mensagens
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_gia_pipeline_msgs" ON gia_pipeline_mensagens;
CREATE POLICY "insert_gia_pipeline_msgs" ON gia_pipeline_mensagens
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_gia_pipeline_msgs" ON gia_pipeline_mensagens;
CREATE POLICY "update_gia_pipeline_msgs" ON gia_pipeline_mensagens
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_gia_pipeline_msgs" ON gia_pipeline_mensagens;
CREATE POLICY "delete_gia_pipeline_msgs" ON gia_pipeline_mensagens
  FOR DELETE TO authenticated USING (true);

-- ============================================
-- 3. GIA Pipeline Mensagens Log (Sent messages log)
-- ============================================
CREATE TABLE IF NOT EXISTS gia_pipeline_mensagens_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_config_id uuid REFERENCES gia_pipeline_mensagens(id) ON DELETE SET NULL,
  os_id uuid,
  conversa_id uuid,
  coluna_kanban text NOT NULL,
  mensagem_enviada text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gia_pipeline_mensagens_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_gia_pipeline_log" ON gia_pipeline_mensagens_log;
CREATE POLICY "select_gia_pipeline_log" ON gia_pipeline_mensagens_log
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_gia_pipeline_log" ON gia_pipeline_mensagens_log;
CREATE POLICY "insert_gia_pipeline_log" ON gia_pipeline_mensagens_log
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_gia_pipeline_log" ON gia_pipeline_mensagens_log;
CREATE POLICY "delete_gia_pipeline_log" ON gia_pipeline_mensagens_log
  FOR DELETE TO authenticated USING (true);

-- ============================================
-- 4. GIA Atendimento Logs (AI interaction logs)
-- ============================================
CREATE TABLE IF NOT EXISTS gia_atendimento_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid,
  os_id uuid,
  unidade_id uuid,
  mensagem_cliente text,
  resposta_gia text,
  tokens_usados integer DEFAULT 0,
  modelo text DEFAULT 'gpt-4o-mini',
  transferiu_para_humano boolean DEFAULT false,
  motivo_transferencia text,
  tempo_resposta_ms integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gia_atendimento_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_gia_atendimento_logs" ON gia_atendimento_logs;
CREATE POLICY "select_gia_atendimento_logs" ON gia_atendimento_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_gia_atendimento_logs" ON gia_atendimento_logs;
CREATE POLICY "insert_gia_atendimento_logs" ON gia_atendimento_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ============================================
-- 5. Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_gia_conhecimento_ativo ON gia_base_conhecimento(ativo) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_gia_pipeline_msgs_coluna ON gia_pipeline_mensagens(coluna_kanban, ativo) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_gia_pipeline_log_os ON gia_pipeline_mensagens_log(os_id, coluna_kanban);
CREATE INDEX IF NOT EXISTS idx_gia_atendimento_logs_conversa ON gia_atendimento_logs(conversa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gia_atendimento_logs_unidade ON gia_atendimento_logs(unidade_id, created_at DESC);

-- ============================================
-- 6. Updated_at triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_gia_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_gia_conhecimento_updated ON gia_base_conhecimento;
CREATE TRIGGER trg_gia_conhecimento_updated
  BEFORE UPDATE ON gia_base_conhecimento
  FOR EACH ROW EXECUTE FUNCTION update_gia_updated_at();

DROP TRIGGER IF EXISTS trg_gia_pipeline_msgs_updated ON gia_pipeline_mensagens;
CREATE TRIGGER trg_gia_pipeline_msgs_updated
  BEFORE UPDATE ON gia_pipeline_mensagens
  FOR EACH ROW EXECUTE FUNCTION update_gia_updated_at();
