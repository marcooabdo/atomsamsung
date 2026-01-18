/*
  # Criar tabela os_servicos

  1. Nova Tabela
    - `os_servicos` - Tabela para armazenar servicos vinculados diretamente a OS
      - `id` (uuid, primary key)
      - `os_id` (uuid, FK para os)
      - `servico_id` (uuid, FK opcional para servicos cadastrados)
      - `codigo_servico` (text)
      - `descricao` (text)
      - `quantidade` (integer, default 1)
      - `valor_unitario` (numeric)
      - `valor_total` (numeric)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS
    - Policies para usuarios autenticados
*/

-- Criar tabela os_servicos
CREATE TABLE IF NOT EXISTS os_servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid REFERENCES os(id) ON DELETE CASCADE,
  servico_id uuid REFERENCES servicos(id) ON DELETE SET NULL,
  codigo_servico text,
  descricao text NOT NULL,
  quantidade integer DEFAULT 1 NOT NULL,
  valor_unitario numeric(12,2) DEFAULT 0 NOT NULL,
  valor_total numeric(12,2) DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE os_servicos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Usuarios autenticados podem ver servicos de OS"
  ON os_servicos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados podem inserir servicos em OS"
  ON os_servicos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados podem atualizar servicos de OS"
  ON os_servicos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados podem deletar servicos de OS"
  ON os_servicos FOR DELETE
  TO authenticated
  USING (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_os_servicos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_os_servicos_updated_at
  BEFORE UPDATE ON os_servicos
  FOR EACH ROW
  EXECUTE FUNCTION update_os_servicos_updated_at();

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_os_servicos_os_id ON os_servicos(os_id);
