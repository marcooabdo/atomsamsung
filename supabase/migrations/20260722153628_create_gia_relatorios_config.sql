/*
# Create GIA Relatórios Config and Atom Core Settings tables

1. New Tables
- `gia_relatorios_config`: Stores the 9 GIA report templates with editable content
  - id (uuid, primary key)
  - tipo (text, unique) - report type slug
  - nome (text) - display name
  - emoji (text) - emoji for the report
  - horario (text) - scheduled time
  - ativo (boolean) - whether report is active
  - template_formato (text) - editable template/format instructions
  - created_at, updated_at (timestamptz)

- `atom_core_settings`: Stores webhook URLs, API keys, instance names, etc.
  - id (uuid, primary key)
  - chave (text, unique) - setting key
  - valor (text) - setting value
  - descricao (text) - description of the setting
  - created_at, updated_at (timestamptz)

2. Security
- RLS enabled on both tables
- Permissive policies for authenticated users
*/

-- GIA Relatórios Config
CREATE TABLE IF NOT EXISTS gia_relatorios_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text UNIQUE NOT NULL,
  nome text NOT NULL,
  emoji text DEFAULT '',
  horario text DEFAULT '08:00',
  ativo boolean DEFAULT true,
  template_formato text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE gia_relatorios_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_gia_relatorios_config" ON gia_relatorios_config;
CREATE POLICY "select_gia_relatorios_config" ON gia_relatorios_config FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_gia_relatorios_config" ON gia_relatorios_config;
CREATE POLICY "insert_gia_relatorios_config" ON gia_relatorios_config FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_gia_relatorios_config" ON gia_relatorios_config;
CREATE POLICY "update_gia_relatorios_config" ON gia_relatorios_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_gia_relatorios_config" ON gia_relatorios_config;
CREATE POLICY "delete_gia_relatorios_config" ON gia_relatorios_config FOR DELETE TO authenticated USING (true);

-- Atom Core Settings
CREATE TABLE IF NOT EXISTS atom_core_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text UNIQUE NOT NULL,
  valor text DEFAULT '',
  descricao text DEFAULT '',
  categoria text DEFAULT 'geral',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE atom_core_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_atom_core_settings" ON atom_core_settings;
CREATE POLICY "select_atom_core_settings" ON atom_core_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_atom_core_settings" ON atom_core_settings;
CREATE POLICY "insert_atom_core_settings" ON atom_core_settings FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_atom_core_settings" ON atom_core_settings;
CREATE POLICY "update_atom_core_settings" ON atom_core_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_atom_core_settings" ON atom_core_settings;
CREATE POLICY "delete_atom_core_settings" ON atom_core_settings FOR DELETE TO authenticated USING (true);

-- Seed GIA reports
INSERT INTO gia_relatorios_config (tipo, nome, emoji, horario, template_formato) VALUES
  ('pulso_operacional', 'Pulso Operacional', '🔴', '08:00', ''),
  ('estoque_dia', 'Estoque do Dia', '📦', '08:00', ''),
  ('agendamentos_ih', 'Agendamentos IH', '📅', '07:30', ''),
  ('mapa_rotas', 'Mapa de Rotas', '🗺️', '08:30', ''),
  ('abertura_fechamento', 'Abertura e Fechamento', '📊', '09:00', ''),
  ('limite_credito_gspn', 'Limite de Crédito GSPN', '💳', '09:30', ''),
  ('nucleo_pecas', 'Núcleo de Peças', '🔧', '10:00', ''),
  ('compliance_erros', 'Compliance e Erros', '⚠️', '11:00', ''),
  ('resumo_final', 'Resumo Final do Dia', '🏁', '18:00', '')
ON CONFLICT (tipo) DO NOTHING;

-- Seed Atom Core Settings
INSERT INTO atom_core_settings (chave, valor, descricao, categoria) VALUES
  ('evolution_api_url', 'https://diego-auditoria.2vhnbz.easypanel.host', 'URL da API Evolution', 'evolution'),
  ('evolution_api_key', '', 'API Key da Evolution', 'evolution'),
  ('evolution_instance_name', 'Marco', 'Nome da instância na Evolution', 'evolution'),
  ('evolution_webhook_url', '', 'URL do webhook configurada na Evolution (para este projeto receber msgs)', 'evolution'),
  ('whatsapp_group_jid', '120363427351181397@g.us', 'JID do grupo WhatsApp para relatórios GIA', 'whatsapp'),
  ('webhook_relay_url', '', 'URL do webhook relay (Advisor)', 'webhook'),
  ('erp_webhook_url', 'https://dteslxvuadvozufhoqaq.supabase.co/functions/v1/whatsapp-webhook', 'URL webhook do ERP', 'webhook'),
  ('advisor_webhook_url', 'https://rumghopkepljnlbioyll.supabase.co/functions/v1/webhook-relay', 'URL webhook do Advisor', 'webhook'),
  ('atom_samsung_webhook_url', '', 'URL webhook deste projeto (Atom Samsung)', 'webhook')
ON CONFLICT (chave) DO NOTHING;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gia_relatorios_config_updated_at ON gia_relatorios_config;
CREATE TRIGGER gia_relatorios_config_updated_at
  BEFORE UPDATE ON gia_relatorios_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS atom_core_settings_updated_at ON atom_core_settings;
CREATE TRIGGER atom_core_settings_updated_at
  BEFORE UPDATE ON atom_core_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
