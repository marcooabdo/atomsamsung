/*
  # Fix atualizar_valores_os Function - Correct Column Names

  1. Problem
    - Function tries to use `preco_cobrado` field from cotacoes_pecas
    - This field doesn't exist in the table
    - Causes error: "column 'preco_cobrado' does not exist"
    - Prevents payment insertion

  2. Correct Column Names
    - cotacoes_pecas: `valor_total` (already calculated = valor_final_unitario * quantidade)
    - cotacoes_servicos: `valor_total` (already calculated = valor_unitario * quantidade)

  3. Solution
    - Update function to use correct column names
    - Sum valor_total directly instead of calculating
    - Also fix references to `valor_pago` which should be calculated from pagamentos

  4. Impact
    - Payment insertion will work correctly
    - OS totals will be calculated accurately
    - Triggers will execute without errors
*/

CREATE OR REPLACE FUNCTION atualizar_valores_os()
RETURNS TRIGGER AS $$
DECLARE
  v_os_id uuid;
  v_valor_total numeric;
  v_valor_pago numeric;
BEGIN
  -- Determine which OS ID to update
  v_os_id := COALESCE(NEW.os_id, OLD.os_id);
  
  IF v_os_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate total value from cotações (parts)
  SELECT COALESCE(SUM(valor_total), 0)
  INTO v_valor_total
  FROM cotacoes_pecas
  WHERE os_id = v_os_id;

  -- Add services total
  SELECT v_valor_total + COALESCE(SUM(valor_total), 0)
  INTO v_valor_total
  FROM cotacoes_servicos
  WHERE os_id = v_os_id;

  -- Calculate total paid
  SELECT COALESCE(SUM(valor), 0)
  INTO v_valor_pago
  FROM pagamentos
  WHERE os_id = v_os_id;

  -- Update OS with calculated values
  UPDATE os
  SET 
    valor_total = v_valor_total,
    valor_pago = v_valor_pago,
    saldo_restante = GREATEST(v_valor_total - v_valor_pago, 0),
    status_pagamento = CASE
      WHEN v_valor_pago = 0 THEN 'pendente'
      WHEN v_valor_pago >= v_valor_total AND v_valor_total > 0 THEN 'pago'
      WHEN v_valor_pago > 0 THEN 'parcial'
      ELSE 'pendente'
    END,
    updated_at = now()
  WHERE id = v_os_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers to ensure they're using the updated function
DROP TRIGGER IF EXISTS trg_atualizar_valores_os_insert ON pagamentos;
CREATE TRIGGER trg_atualizar_valores_os_insert
  AFTER INSERT ON pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valores_os();

DROP TRIGGER IF EXISTS trg_atualizar_valores_os_update ON pagamentos;
CREATE TRIGGER trg_atualizar_valores_os_update
  AFTER UPDATE ON pagamentos
  FOR EACH ROW
  WHEN (OLD.valor IS DISTINCT FROM NEW.valor OR OLD.os_id IS DISTINCT FROM NEW.os_id)
  EXECUTE FUNCTION atualizar_valores_os();

DROP TRIGGER IF EXISTS trg_atualizar_valores_os_delete ON pagamentos;
CREATE TRIGGER trg_atualizar_valores_os_delete
  AFTER DELETE ON pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valores_os();

-- Also add triggers for cotacoes_pecas and cotacoes_servicos to update OS when items change
DROP TRIGGER IF EXISTS trg_atualizar_valores_os_pecas_insert ON cotacoes_pecas;
CREATE TRIGGER trg_atualizar_valores_os_pecas_insert
  AFTER INSERT ON cotacoes_pecas
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valores_os();

DROP TRIGGER IF EXISTS trg_atualizar_valores_os_pecas_update ON cotacoes_pecas;
CREATE TRIGGER trg_atualizar_valores_os_pecas_update
  AFTER UPDATE ON cotacoes_pecas
  FOR EACH ROW
  WHEN (OLD.valor_total IS DISTINCT FROM NEW.valor_total OR OLD.os_id IS DISTINCT FROM NEW.os_id)
  EXECUTE FUNCTION atualizar_valores_os();

DROP TRIGGER IF EXISTS trg_atualizar_valores_os_pecas_delete ON cotacoes_pecas;
CREATE TRIGGER trg_atualizar_valores_os_pecas_delete
  AFTER DELETE ON cotacoes_pecas
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valores_os();

DROP TRIGGER IF EXISTS trg_atualizar_valores_os_servicos_insert ON cotacoes_servicos;
CREATE TRIGGER trg_atualizar_valores_os_servicos_insert
  AFTER INSERT ON cotacoes_servicos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valores_os();

DROP TRIGGER IF EXISTS trg_atualizar_valores_os_servicos_update ON cotacoes_servicos;
CREATE TRIGGER trg_atualizar_valores_os_servicos_update
  AFTER UPDATE ON cotacoes_servicos
  FOR EACH ROW
  WHEN (OLD.valor_total IS DISTINCT FROM NEW.valor_total OR OLD.os_id IS DISTINCT FROM NEW.os_id)
  EXECUTE FUNCTION atualizar_valores_os();

DROP TRIGGER IF EXISTS trg_atualizar_valores_os_servicos_delete ON cotacoes_servicos;
CREATE TRIGGER trg_atualizar_valores_os_servicos_delete
  AFTER DELETE ON cotacoes_servicos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valores_os();
