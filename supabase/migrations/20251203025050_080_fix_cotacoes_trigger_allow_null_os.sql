/*
  # Corrigir Trigger de Cotações para Permitir NULL OS

  1. Problema
    - Cotações podem existir sem OS vinculada
    - Trigger estava tentando acessar NEW.os_id que não existe na tabela cotacoes
    - Causava erro 400: "record 'new' has no field 'os_id'"

  2. Solução
    - Cotações NÃO têm os_id direto na tabela
    - OS podem ter cotação através de foreign key em OS
    - Buscar OS vinculada através da relação inversa
    - Permitir criação de cotações sem OS

  3. Comportamento
    - Se cotação tiver OS vinculada: registra log na OS
    - Se cotação não tiver OS: não registra log (cotação independente)
*/

-- Recriar trigger de cotações corrigido
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
      format('💰 ORÇAMENTO CRIADO por %s: #%s (R$ %s)',
        COALESCE(v_usuario_nome, 'Sistema'),
        NEW.numero_cotacao,
        to_char(COALESCE(NEW.valor_total, 0), 'FM999G999G990D00'))
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

    -- Valor alterado
    IF (OLD.valor_total IS DISTINCT FROM NEW.valor_total) THEN
      PERFORM criar_log_os(
        v_os_id,
        auth.uid(),
        format('💰 VALOR ORÇAMENTO ALTERADO por %s: R$ %s → R$ %s (#%s)',
          COALESCE(v_usuario_nome, 'Sistema'),
          to_char(COALESCE(OLD.valor_total, 0), 'FM999G999G990D00'),
          to_char(COALESCE(NEW.valor_total, 0), 'FM999G999G990D00'),
          NEW.numero_cotacao)
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recriar trigger
DROP TRIGGER IF EXISTS trigger_log_cotacoes_changes ON cotacoes;
CREATE TRIGGER trigger_log_cotacoes_changes
  AFTER INSERT OR UPDATE ON cotacoes
  FOR EACH ROW
  EXECUTE FUNCTION log_cotacoes_changes();