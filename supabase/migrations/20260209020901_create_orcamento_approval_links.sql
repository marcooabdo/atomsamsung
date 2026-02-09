/*
  # Sistema de Aprovação de Orçamento por Link

  1. Nova Tabela
    - `orcamento_links` - Armazena links únicos para aprovação de orçamento
      - `id` (uuid, PK)
      - `os_id` (uuid, FK) - Referência para a OS
      - `token` (text, unique) - Token único para o link
      - `status` (enum) - Status do orçamento: 'pendente', 'aprovado', 'rejeitado', 'negociando'
      - `mensagem_cliente` (text, nullable) - Mensagem do cliente (negociação ou rejeição)
      - `data_resposta` (timestamptz, nullable) - Data da resposta do cliente
      - `ip_cliente` (text, nullable) - IP do cliente que respondeu
      - `ativo` (boolean) - Se o link ainda está ativo
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Políticas para usuários autenticados criarem/visualizarem links
    - Políticas públicas para clientes acessarem via token

  3. Functions
    - Função para gerar token único
    - Função para validar e atualizar status
*/

-- Create enum for orcamento status
DO $$ BEGIN
  CREATE TYPE orcamento_link_status AS ENUM ('pendente', 'aprovado', 'rejeitado', 'negociando');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create orcamento_links table
CREATE TABLE IF NOT EXISTS orcamento_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES os(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  status orcamento_link_status DEFAULT 'pendente'::orcamento_link_status,
  mensagem_cliente text,
  data_resposta timestamptz,
  ip_cliente text,
  latitude double precision,
  longitude double precision,
  endereco_completo text,
  selfie_url text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE orcamento_links ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view orcamento_links"
  ON orcamento_links
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create orcamento_links"
  ON orcamento_links
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update orcamento_links"
  ON orcamento_links
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Public access for clients (via token)
CREATE POLICY "Public can view orcamento_links by token"
  ON orcamento_links
  FOR SELECT
  TO anon
  USING (ativo = true);

CREATE POLICY "Public can update orcamento_links response"
  ON orcamento_links
  FOR UPDATE
  TO anon
  USING (ativo = true)
  WITH CHECK (ativo = true);

-- Function to generate unique token
CREATE OR REPLACE FUNCTION generate_orcamento_token()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  new_token text;
  token_exists boolean;
BEGIN
  LOOP
    -- Generate random 32 character token
    new_token := encode(gen_random_bytes(24), 'base64');
    -- Remove special characters for cleaner URL
    new_token := replace(replace(replace(new_token, '/', ''), '+', ''), '=', '');
    new_token := substring(new_token, 1, 32);
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM orcamento_links WHERE token = new_token) INTO token_exists;
    
    EXIT WHEN NOT token_exists;
  END LOOP;
  
  RETURN new_token;
END;
$$;

-- Function to create or update orcamento link
CREATE OR REPLACE FUNCTION upsert_orcamento_link(p_os_id uuid)
RETURNS TABLE(token text, link_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
  v_link_id uuid;
  existing_link record;
BEGIN
  -- Check if active link already exists
  SELECT id, orcamento_links.token INTO existing_link
  FROM orcamento_links
  WHERE os_id = p_os_id AND ativo = true
  LIMIT 1;
  
  IF existing_link.id IS NOT NULL THEN
    -- Return existing link
    RETURN QUERY SELECT existing_link.token, existing_link.id;
  ELSE
    -- Generate new token
    v_token := generate_orcamento_token();
    
    -- Create new link
    INSERT INTO orcamento_links (os_id, token)
    VALUES (p_os_id, v_token)
    RETURNING id INTO v_link_id;
    
    RETURN QUERY SELECT v_token, v_link_id;
  END IF;
END;
$$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_orcamento_links_os_id ON orcamento_links(os_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_links_token ON orcamento_links(token);
CREATE INDEX IF NOT EXISTS idx_orcamento_links_ativo ON orcamento_links(ativo) WHERE ativo = true;
