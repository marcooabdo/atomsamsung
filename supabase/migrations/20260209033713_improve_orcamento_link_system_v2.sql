/*
  # Melhorias no Sistema de Links de Orcamento

  1. Changes
    - Dropa e recria funcao upsert_orcamento_link para definir validade de 72h
    - Adiciona funcao para regenerar link (invalida anterior e cria novo)
    - Adiciona funcao para registrar acesso do cliente

  2. Notes
    - Links agora expiram automaticamente em 72 horas
    - Logs de acesso sao registrados nos comentarios da OS
*/

-- Drop existing function to recreate with new return type
DROP FUNCTION IF EXISTS upsert_orcamento_link(uuid);

-- Criar funcao com validade de 72 horas
CREATE OR REPLACE FUNCTION upsert_orcamento_link(p_os_id uuid)
RETURNS TABLE(token text, link_id uuid, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
  v_link_id uuid;
  v_expires_at timestamptz;
  existing_link record;
BEGIN
  -- Check if active and non-expired link already exists
  SELECT ol.id, ol.token, ol.expires_at INTO existing_link
  FROM orcamento_links ol
  WHERE ol.os_id = p_os_id 
    AND ol.ativo = true
    AND (ol.expires_at IS NULL OR ol.expires_at > now())
  LIMIT 1;
  
  IF existing_link.id IS NOT NULL THEN
    -- Return existing link
    RETURN QUERY SELECT existing_link.token, existing_link.id, existing_link.expires_at;
  ELSE
    -- Deactivate any old links
    UPDATE orcamento_links 
    SET ativo = false, updated_at = now()
    WHERE os_id = p_os_id AND ativo = true;
    
    -- Generate new token
    v_token := generate_orcamento_token();
    v_expires_at := now() + interval '72 hours';
    
    -- Create new link
    INSERT INTO orcamento_links (os_id, token, expires_at)
    VALUES (p_os_id, v_token, v_expires_at)
    RETURNING id INTO v_link_id;
    
    RETURN QUERY SELECT v_token, v_link_id, v_expires_at;
  END IF;
END;
$$;

-- Funcao para regenerar link (force new - usado quando orcamento muda)
CREATE OR REPLACE FUNCTION regenerate_orcamento_link(p_os_id uuid)
RETURNS TABLE(token text, link_id uuid, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
  v_link_id uuid;
  v_expires_at timestamptz;
BEGIN
  -- Deactivate all old links for this OS
  UPDATE orcamento_links 
  SET ativo = false, updated_at = now()
  WHERE os_id = p_os_id AND ativo = true;
  
  -- Generate new token
  v_token := generate_orcamento_token();
  v_expires_at := now() + interval '72 hours';
  
  -- Create new link
  INSERT INTO orcamento_links (os_id, token, expires_at)
  VALUES (p_os_id, v_token, v_expires_at)
  RETURNING id INTO v_link_id;
  
  RETURN QUERY SELECT v_token, v_link_id, v_expires_at;
END;
$$;

-- Funcao para registrar acesso ao link (chamada pela edge function)
CREATE OR REPLACE FUNCTION registrar_acesso_orcamento_link(p_token text, p_ip text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_link_record record;
BEGIN
  -- Find link
  SELECT ol.*, o.numero_os_interna 
  INTO v_link_record
  FROM orcamento_links ol
  JOIN os o ON o.id = ol.os_id
  WHERE ol.token = p_token AND ol.ativo = true;
  
  IF v_link_record.id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Register access in comments
  INSERT INTO os_comentarios (os_id, comentario, is_system)
  VALUES (
    v_link_record.os_id,
    '🔗 Link de orçamento acessado pelo cliente' || 
    CASE WHEN p_ip IS NOT NULL THEN ' (IP: ' || p_ip || ')' ELSE '' END,
    true
  );
  
  RETURN true;
END;
$$;

-- Adicionar campo de status de orcamento na OS se nao existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'os' AND column_name = 'status_orcamento_link'
  ) THEN
    ALTER TABLE os ADD COLUMN status_orcamento_link text DEFAULT 'pendente';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'os' AND column_name = 'mensagem_cliente_orcamento'
  ) THEN
    ALTER TABLE os ADD COLUMN mensagem_cliente_orcamento text;
  END IF;
END $$;
