/*
  # Fix timezone e status do link de orçamento

  1. Alterações
    - Corrige timezone para America/Sao_Paulo (-3hrs)
    - Adiciona explicitamente ativo=true no INSERT
    - Garante que status fica como 'pendente' até cliente decidir ou expirar

  2. Comportamento
    - Link criado com timezone Brasil correto
    - Link fica ativo=true por padrão
    - Status permanece 'pendente' até aprovação/reprovação ou 72h
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
  v_now_br timestamptz;
BEGIN
  -- Pega horário atual no timezone do Brasil (UTC-3)
  v_now_br := timezone('America/Sao_Paulo', now());

  -- Desativa todos os links antigos desta OS
  UPDATE orcamento_links
  SET ativo = false, updated_at = v_now_br
  WHERE os_id = p_os_id AND ativo = true;

  -- Gera novo token
  v_token := generate_orcamento_token();

  -- Calcula expiração em 72 horas no horário do Brasil
  v_expires_at := v_now_br + interval '72 hours';

  -- Cria novo link com ativo=true explicitamente
  INSERT INTO orcamento_links (
    os_id,
    token,
    expires_at,
    status,
    ativo,
    created_at,
    updated_at
  )
  VALUES (
    p_os_id,
    v_token,
    v_expires_at,
    'pendente',
    true,
    v_now_br,
    v_now_br
  )
  RETURNING orcamento_links.id INTO v_link_id;

  -- Reseta o status do orçamento na OS para pendente
  UPDATE os
  SET
    status_orcamento_link = 'pendente',
    mensagem_cliente_orcamento = NULL,
    updated_at = v_now_br
  WHERE os.id = p_os_id;

  -- Retorna com timezone correto
  RETURN QUERY SELECT v_token, v_link_id, v_expires_at;
END;
$$;