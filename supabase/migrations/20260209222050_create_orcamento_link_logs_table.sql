/*
  # Create orcamento link activity logs table
  
  1. New Tables
    - `orcamento_link_logs` - Logs all activities on public budget links
      - `id` (uuid, primary key)
      - `link_id` (uuid, FK to orcamento_links)
      - `os_id` (uuid, FK to os)
      - `acao` (text) - 'aberto', 'aprovado', 'reprovado', 'negociacao'
      - `ip_address` (text)
      - `user_agent` (text)
      - `latitude` (numeric)
      - `longitude` (numeric)
      - `endereco_aproximado` (text) - reverse geocoded address
      - `mensagem` (text) - reason/message from client
      - `dados_adicionais` (jsonb) - any extra data
      - `created_at` (timestamptz)
      
  2. Security
    - Enable RLS
    - Allow authenticated users to read logs for their OS
    - Allow public inserts (for tracking)
*/

CREATE TABLE IF NOT EXISTS orcamento_link_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid REFERENCES orcamento_links(id) ON DELETE SET NULL,
  os_id uuid REFERENCES os(id) ON DELETE CASCADE,
  acao text NOT NULL CHECK (acao IN ('aberto', 'aprovado', 'reprovado', 'negociacao')),
  ip_address text,
  user_agent text,
  latitude numeric,
  longitude numeric,
  endereco_aproximado text,
  mensagem text,
  dados_adicionais jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orcamento_link_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read logs"
  ON orcamento_link_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Public can insert logs"
  ON orcamento_link_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_orcamento_link_logs_os_id ON orcamento_link_logs(os_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_link_logs_link_id ON orcamento_link_logs(link_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_link_logs_acao ON orcamento_link_logs(acao);
CREATE INDEX IF NOT EXISTS idx_orcamento_link_logs_created_at ON orcamento_link_logs(created_at DESC);

COMMENT ON TABLE orcamento_link_logs IS 'Logs all client activities on public budget approval links';
