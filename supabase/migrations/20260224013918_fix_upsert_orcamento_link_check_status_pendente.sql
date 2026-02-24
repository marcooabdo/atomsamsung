/*
  # Corrigir upsert_orcamento_link para verificar status=pendente

  ## Problema
  A função upsert_orcamento_link retornava qualquer link ativo não expirado,
  incluindo links já aprovados/rejeitados/negociando.

  ## Correção
  Adiciona filtro status='pendente' para só reutilizar links que ainda aguardam resposta do cliente.
  Links aprovados/rejeitados/negociando são ignorados e um novo link é criado.
*/

CREATE OR REPLACE FUNCTION upsert_orcamento_link(p_os_id uuid)
RETURNS TABLE(token text, link_id uuid, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
  v_link_id uuid;
  v_expires_at timestamptz;
  v_now_br timestamptz;
  existing_link record;
BEGIN
  v_now_br := timezone('America/Sao_Paulo', now());

  -- Verifica se já existe link ativo, pendente e não expirado
  SELECT ol.id, ol.token, ol.expires_at INTO existing_link
  FROM orcamento_links ol
  WHERE ol.os_id = p_os_id
    AND ol.ativo = true
    AND ol.status = 'pendente'
    AND (ol.expires_at IS NULL OR ol.expires_at > v_now_br)
  ORDER BY ol.created_at DESC
  LIMIT 1;

  IF existing_link.id IS NOT NULL THEN
    -- Retorna link existente sem criar novo
    RETURN QUERY SELECT existing_link.token, existing_link.id, existing_link.expires_at;
  ELSE
    -- Desativa links antigos
    UPDATE orcamento_links
    SET ativo = false, updated_at = v_now_br
    WHERE os_id = p_os_id AND ativo = true;

    -- Gera novo token
    v_token := generate_orcamento_token();
    v_expires_at := v_now_br + interval '72 hours';

    -- Cria novo link
    INSERT INTO orcamento_links (os_id, token, expires_at, status, ativo, created_at, updated_at)
    VALUES (p_os_id, v_token, v_expires_at, 'pendente', true, v_now_br, v_now_br)
    RETURNING id INTO v_link_id;

    -- Reseta status do orçamento na OS
    UPDATE os
    SET status_orcamento_link = 'pendente',
        mensagem_cliente_orcamento = NULL,
        updated_at = v_now_br
    WHERE id = p_os_id;

    RETURN QUERY SELECT v_token, v_link_id, v_expires_at;
  END IF;
END;
$$;
