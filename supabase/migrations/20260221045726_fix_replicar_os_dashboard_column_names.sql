/*
  # Fix replicar_os_no_dashboard — colunas corretas

  ## Problema
  A função `replicar_os_no_dashboard` usava `whatsapp_numero` e `os_numero`
  mas a tabela `gia_mural_tarefas` tem a coluna `whatsapp_phone` (não whatsapp_numero).
  Isso causava erro 400 ao criar qualquer OS manualmente.

  ## Correção
  - Substitui `whatsapp_numero` por `whatsapp_phone`
  - Adiciona `os_id` (uuid da OS) além do `os_numero`
  - Adiciona `unidade_id` para filtro por loja
*/

CREATE OR REPLACE FUNCTION replicar_os_no_dashboard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  os_final TEXT;
  zap_final TEXT;
  titulo_card TEXT;
BEGIN
  os_final := COALESCE(NEW.numero_os_samsung, NEW.numero_os_interna);
  zap_final := COALESCE(NEW.cliente_telefone, NULL);

  IF os_final IS NULL THEN
    RETURN NEW;
  END IF;

  titulo_card := 'Nova OS: ' || os_final;

  INSERT INTO gia_mural_tarefas (
    gia_source,
    prioridade,
    titulo,
    descricao,
    gia_responsavel,
    whatsapp_phone,
    os_numero,
    os_id,
    unidade_id
  )
  VALUES (
    'CONNECT',
    'normal',
    titulo_card,
    'OS criada automaticamente via Sistema. Aguardando triagem.',
    'GIA Connect',
    zap_final,
    os_final,
    NEW.id,
    NEW.unidade_id
  );

  RETURN NEW;
END;
$$;
