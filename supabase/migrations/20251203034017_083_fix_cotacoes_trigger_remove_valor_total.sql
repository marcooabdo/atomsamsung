/*
  # Corrigir Trigger de Cotações - Remover Acesso a valor_total

  1. Problema
    - Trigger log_cotacoes_changes tenta acessar OLD.valor_total e NEW.valor_total
    - Tabela cotacoes NÃO possui coluna valor_total
    - Causa erro 400: "record 'old' has no field 'valor_total'"
    - Impede mover orçamento de volta para cotações

  2. Solução
    - Remover verificação de valor_total do trigger
    - Cotações não armazenam valor total diretamente
    - Valor total é calculado a partir de cotacoes_pecas e cotacoes_servicos
    - Não é necessário registrar mudanças de valor_total pois não existe

  3. Comportamento
    - Registra criação de orçamento (sem valor)
    - Registra envio de orçamento
    - Registra mudança de status
    - NÃO registra mudança de valor (coluna não existe)
*/

-- Recriar trigger de cotações sem acesso a valor_total
CREATE OR REPLACE FUNCTION log_cotacoes_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_nome text;
  v_os_id uuid;
BEGIN
  SELECT nome INTO v_usuario_nome FROM usuarios WHERE id = auth.uid();

  -- Buscar OS vinculada (pode não existir)
  -- OS tem cotacao_id, não o contrário
  IF (TG_OP = 'INSERT') THEN
    SELECT id INTO v_os_id FROM os WHERE cotacao_id = NEW.id LIMIT 1;
  ELSE
    SELECT id INTO v_os_id FROM os WHERE cotacao_id = COALESCE(NEW.id, OLD.id) LIMIT 1;
  END IF;

  -- Se não houver OS vinculada, não registrar log (cotação independente)
  IF v_os_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF (TG_OP = 'INSERT') THEN
    PERFORM criar_log_os(
      v_os_id,
      auth.uid(),
      format('💰 ORÇAMENTO CRIADO por %s: #%s',
        COALESCE(v_usuario_nome, 'Sistema'),
        NEW.numero_cotacao)
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Orçamento enviado
    IF (OLD.orcamento_enviado = false AND NEW.orcamento_enviado = true) THEN
      PERFORM criar_log_os(
        v_os_id,
        auth.uid(),
        format('📧 ORÇAMENTO ENVIADO por %s: #%s',
          COALESCE(v_usuario_nome, 'Sistema'),
          NEW.numero_cotacao)
      );
    END IF;

    -- Status da cotação
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      PERFORM criar_log_os(
        v_os_id,
        auth.uid(),
        format('📊 STATUS ORÇAMENTO por %s: %s → %s (#%s)',
          COALESCE(v_usuario_nome, 'Sistema'),
          OLD.status,
          NEW.status,
          NEW.numero_cotacao)
      );
    END IF;

    -- REMOVIDO: Verificação de valor_total (coluna não existe em cotacoes)
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger já existe, não precisa recriar
COMMENT ON FUNCTION log_cotacoes_changes IS 'Registra logs de cotações apenas quando vinculadas a OS. Não acessa valor_total pois coluna não existe.';