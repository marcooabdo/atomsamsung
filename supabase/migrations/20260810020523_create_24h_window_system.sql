/*
# Create 24-Hour Window Management System for ATOM CONNECT

This migration sets up the infrastructure for managing the Meta WhatsApp 24-hour
messaging window. The Meta Cloud API only allows free-form text messages within
24 hours of the last client message. Outside that window, only pre-approved
templates can be sent.

1. Modified Tables
  - `atom_connect_instancias`
    - Added `wa_business_token` (text, nullable) — Meta WhatsApp Business API access token
    - Added `wa_business_account_id` (text, nullable) — Meta WhatsApp Business Account ID
  - `atom_connect_conversas`
    - Added `ping_24h_enviado_em` (timestamptz, nullable) — When the 20h retention ping was last sent
    - Added `janela_fechada_forcada` (boolean, default false) — Force window closed after FAILED status

2. New Tables
  - `atom_connect_24h_config`
    - Per-unit configuration for 24h window automation
    - `id` (uuid, PK)
    - `unidade_id` (uuid, FK to unidades, unique)
    - `ping_ativo` (boolean, default true) — Enable/disable the automatic retention ping
    - `ping_horas` (integer, default 20) — Hours before 24h limit to send the ping
    - `ping_mensagem` (text) — The message text for the retention ping
    - `created_at`, `updated_at` (timestamptz)

3. Security
  - RLS enabled on `atom_connect_24h_config` with authenticated CRUD policies.

4. Important Notes
  - The `ultima_resposta_cliente_at` column already exists on conversas and will be
    reused as the 24h window timer (equivalent to ultima_mensagem_cliente_em).
  - The wa_business_token and wa_business_account_id on instancias allow each unit
    to have its own Meta credentials.
  - The ping_24h_enviado_em prevents duplicate ping sends.
*/

-- Add Meta credentials to instancias
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_instancias' AND column_name = 'wa_business_token'
  ) THEN
    ALTER TABLE atom_connect_instancias ADD COLUMN wa_business_token text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_instancias' AND column_name = 'wa_business_account_id'
  ) THEN
    ALTER TABLE atom_connect_instancias ADD COLUMN wa_business_account_id text;
  END IF;
END $$;

-- Add 24h tracking columns to conversas
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'ping_24h_enviado_em'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN ping_24h_enviado_em timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'janela_fechada_forcada'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN janela_fechada_forcada boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Create 24h config table
CREATE TABLE IF NOT EXISTS atom_connect_24h_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  ping_ativo boolean NOT NULL DEFAULT true,
  ping_horas integer NOT NULL DEFAULT 20,
  ping_mensagem text NOT NULL DEFAULT 'GIA - Global Intelligence Assistant:

Olá! Como nosso sistema encerra conexões inativas por segurança, seu atendimento está quase sendo pausado. Se você ainda estiver aguardando alguma aprovação ou quiser tirar alguma dúvida, é só mandar um ''SIM'' ou ''Ok'' aqui para mantermos seu histórico aberto e não encerrar seu chamado!',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_24h_config_unidade UNIQUE (unidade_id)
);

ALTER TABLE atom_connect_24h_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_24h_config" ON atom_connect_24h_config;
CREATE POLICY "select_24h_config" ON atom_connect_24h_config FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_24h_config" ON atom_connect_24h_config;
CREATE POLICY "insert_24h_config" ON atom_connect_24h_config FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_24h_config" ON atom_connect_24h_config;
CREATE POLICY "update_24h_config" ON atom_connect_24h_config FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_24h_config" ON atom_connect_24h_config;
CREATE POLICY "delete_24h_config" ON atom_connect_24h_config FOR DELETE
  TO authenticated USING (true);

-- Index for the cron job query
CREATE INDEX IF NOT EXISTS idx_conversas_24h_ping
  ON atom_connect_conversas (ultima_resposta_cliente_at)
  WHERE finalizado_at IS NULL AND ping_24h_enviado_em IS NULL;

-- Populate the APIMOC instance with the provided Meta credentials
UPDATE atom_connect_instancias
SET wa_business_token = 'EAAdSU5O791sBSE1F9lZBjNqgK8xkHo1RT3LCVoeKAj4G5Q8vgYP1ZBZB2QVZC4jZCPq5MpuDoiwdQZAJINph1A0Xb429gvWFOH5zZB0QZA7sKVGErcJ1FXjFm1vXJbICb0emwYp2jWBNo1F62VNtV7PMYGLs6zFA0BZBb460avMGr0KKA2EBLsSvWD2LZBXN0W7gZDZD',
    wa_business_account_id = '1522723482394635'
WHERE instance_name = 'APIMOC';
