/*
  # Fix Pagamentos Audit Trigger - Incorrect Cotação Reference

  1. Problem
    - Trigger `log_pagamentos_changes()` tries to SELECT os_id FROM cotacoes
    - Table `cotacoes` does NOT have an `os_id` column
    - This causes error "column os_id does not exist" when deleting OS
    
  2. Root Cause
    - Incorrect relationship understanding in trigger
    - The correct relationship is: os.cotacao_id → cotacoes.id
    - To get OS from cotacao_id, query should be: SELECT id FROM os WHERE cotacao_id = ...

  3. Solution
    - Fix the query to use correct relationship
    - Change FROM cotacoes to FROM os
    - Add error handling to prevent audit failures from breaking operations
    - Ensure NULL checks to handle missing OS

  4. Impact
    - OS deletion will work correctly
    - Payment audit logs will be created properly
    - No more "column os_id does not exist" errors
*/

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_log_pagamentos_changes ON pagamentos;

-- Recreate function with correct relationship
CREATE OR REPLACE FUNCTION log_pagamentos_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_nome text;
  v_os_id uuid;
BEGIN
  -- Wrap in exception block to prevent audit failures from breaking operations
  BEGIN
    SELECT nome INTO v_usuario_nome FROM usuarios WHERE id = auth.uid();
    
    -- Get os_id from payment record or find OS linked to cotação
    -- FIXED: Changed to query os table instead of cotacoes table
    v_os_id := COALESCE(
      COALESCE(NEW.os_id, OLD.os_id),
      (SELECT id FROM os WHERE cotacao_id = COALESCE(NEW.cotacao_id, OLD.cotacao_id) LIMIT 1)
    );

    -- Only log if we have a valid OS
    IF v_os_id IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;

    IF (TG_OP = 'INSERT') THEN
      PERFORM criar_log_os(
        v_os_id,
        auth.uid(),
        format('💳 PAGAMENTO REGISTRADO por %s: R$ %s (%s)',
          COALESCE(v_usuario_nome, 'Sistema'),
          to_char(NEW.valor, 'FM999G999G990D00'),
          NEW.forma_pagamento)
      );
    ELSIF (TG_OP = 'DELETE') THEN
      PERFORM criar_log_os(
        v_os_id,
        auth.uid(),
        format('🗑️ PAGAMENTO EXCLUÍDO por %s: R$ %s',
          COALESCE(v_usuario_nome, 'Sistema'),
          to_char(OLD.valor, 'FM999G999G990D00'))
      );
    ELSIF (TG_OP = 'UPDATE') THEN
      IF (OLD.valor IS DISTINCT FROM NEW.valor OR OLD.forma_pagamento IS DISTINCT FROM NEW.forma_pagamento) THEN
        PERFORM criar_log_os(
          v_os_id,
          auth.uid(),
          format('💰 PAGAMENTO ALTERADO por %s: R$ %s (%s) → R$ %s (%s)',
            COALESCE(v_usuario_nome, 'Sistema'),
            to_char(OLD.valor, 'FM999G999G990D00'),
            OLD.forma_pagamento,
            to_char(NEW.valor, 'FM999G999G990D00'),
            NEW.forma_pagamento)
        );
      END IF;
    END IF;

  EXCEPTION
    WHEN OTHERS THEN
      -- Log warning but don't fail the operation
      RAISE WARNING 'Erro ao criar log de pagamento: %', SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recreate trigger
CREATE TRIGGER trigger_log_pagamentos_changes
  AFTER INSERT OR UPDATE OR DELETE ON pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION log_pagamentos_changes();