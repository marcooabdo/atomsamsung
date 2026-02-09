/*
  # Adicionar expiração de 72 horas aos links de aprovação

  1. Alterações
    - Adiciona campo `expires_at` (timestamptz) - Data/hora de expiração do link
    - Modifica função `upsert_orcamento_link` para definir expiração de 72 horas
    - Adiciona índice para performance em links ativos

  2. Notas
    - Links expiram automaticamente após 72 horas da criação
    - Links expirados não podem ser acessados pelos clientes
*/

-- Add expires_at field if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orcamento_links' AND column_name = 'expires_at') THEN
    ALTER TABLE orcamento_links ADD COLUMN expires_at timestamptz;
  END IF;
END $$;

-- Drop and recreate function to include expires_at
DROP FUNCTION IF EXISTS upsert_orcamento_link(uuid);

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
  -- Check if active and non-expired link already exists
  SELECT id, orcamento_links.token INTO existing_link
  FROM orcamento_links
  WHERE os_id = p_os_id 
    AND ativo = true
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
  
  IF existing_link.id IS NOT NULL THEN
    -- Return existing link
    RETURN QUERY SELECT existing_link.token, existing_link.id;
  ELSE
    -- Deactivate any old links for this OS
    UPDATE orcamento_links 
    SET ativo = false, updated_at = now()
    WHERE os_id = p_os_id AND ativo = true;
    
    -- Generate new token
    v_token := generate_orcamento_token();
    
    -- Create new link with 72 hour expiration
    INSERT INTO orcamento_links (os_id, token, expires_at)
    VALUES (p_os_id, v_token, now() + interval '72 hours')
    RETURNING id INTO v_link_id;
    
    RETURN QUERY SELECT v_token, v_link_id;
  END IF;
END;
$$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_orcamento_links_expires_at 
ON orcamento_links(expires_at, ativo);