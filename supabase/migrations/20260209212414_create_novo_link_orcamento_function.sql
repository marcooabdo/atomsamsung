/*
  # Funcao para criar novo link de orcamento (sempre)
  
  1. Alteracoes
    - Cria funcao `criar_novo_link_orcamento` que SEMPRE cria um novo link
    - Desativa todos os links anteriores da OS
    - Reseta o status do orcamento na OS para pendente
    
  2. Comportamento
    - Desativa links antigos (ativo = false)
    - Gera novo token
    - Reseta status_orcamento_link para 'pendente'
    - Limpa mensagem_cliente_orcamento
*/

CREATE OR REPLACE FUNCTION criar_novo_link_orcamento(p_os_id uuid)
RETURNS TABLE (token text, id uuid, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
  v_link_id uuid;
  v_expires_at timestamptz;
BEGIN
  -- Desativa todos os links antigos desta OS
  UPDATE orcamento_links 
  SET ativo = false, updated_at = now()
  WHERE os_id = p_os_id AND ativo = true;

  -- Gera novo token
  v_token := generate_orcamento_token();
  v_expires_at := now() + interval '72 hours';

  -- Cria novo link
  INSERT INTO orcamento_links (os_id, token, expires_at, status)
  VALUES (p_os_id, v_token, v_expires_at, 'pendente')
  RETURNING orcamento_links.id INTO v_link_id;

  -- Reseta o status do orcamento na OS
  UPDATE os 
  SET 
    status_orcamento_link = 'pendente',
    mensagem_cliente_orcamento = NULL,
    updated_at = now()
  WHERE os.id = p_os_id;

  RETURN QUERY SELECT v_token, v_link_id, v_expires_at;
END;
$$;