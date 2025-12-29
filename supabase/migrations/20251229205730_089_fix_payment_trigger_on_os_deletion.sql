/*
  # Fix Payment Trigger on OS Deletion

  1. Problem
    - When deleting an OS, the foreign key cascade (ON DELETE SET NULL) updates pagamentos.os_id to NULL
    - This triggers the payment trigger which tries to update the OS being deleted
    - Causes error: "column os_id does not exist" during OS deletion

  2. Solution
    - Modify atualizar_valores_os() function to check if OS exists before updating
    - Skip update if OS is being deleted
    - Prevent cascade conflict between OS deletion and payment trigger

  3. Changes
    - Add existence check before updating OS
    - Gracefully handle case where OS no longer exists
    - Function returns normally without error if OS is gone
*/

-- Drop existing triggers
DROP TRIGGER IF EXISTS trg_atualizar_valores_os_insert ON pagamentos;
DROP TRIGGER IF EXISTS trg_atualizar_valores_os_update ON pagamentos;
DROP TRIGGER IF EXISTS trg_atualizar_valores_os_delete ON pagamentos;
DROP FUNCTION IF EXISTS atualizar_valores_os() CASCADE;

-- Recreate function with OS existence check
CREATE OR REPLACE FUNCTION atualizar_valores_os()
RETURNS TRIGGER AS $$
DECLARE
  v_os_id uuid;
  v_valor_total numeric;
  v_valor_pago numeric;
  v_saldo numeric;
  v_status status_pagamento_enum;
  v_os_exists boolean;
BEGIN
  -- For UPDATE, recalculate old OS if os_id changed
  IF TG_OP = 'UPDATE' AND OLD.os_id IS NOT NULL AND OLD.os_id != NEW.os_id THEN
    -- Check if old OS still exists
    SELECT EXISTS(SELECT 1 FROM os WHERE id = OLD.os_id) INTO v_os_exists;
    
    IF v_os_exists THEN
      -- Recalculate old OS
      SELECT valor_total INTO v_valor_total
      FROM os WHERE id = OLD.os_id;
      
      SELECT COALESCE(SUM(valor_liquido), 0) INTO v_valor_pago
      FROM pagamentos WHERE os_id = OLD.os_id;
      
      v_saldo := v_valor_total - v_valor_pago;
      
      IF v_saldo <= 0 THEN
        v_status := 'pago'::status_pagamento_enum;
        v_saldo := 0;
      ELSIF v_valor_pago > 0 THEN
        v_status := 'parcial'::status_pagamento_enum;
      ELSE
        v_status := 'pendente'::status_pagamento_enum;
      END IF;
      
      UPDATE os
      SET
        valor_pago = v_valor_pago,
        saldo_restante = v_saldo,
        status_pagamento = v_status,
        updated_at = now()
      WHERE id = OLD.os_id;
    END IF;
  END IF;

  -- For DELETE, use OLD record
  IF TG_OP = 'DELETE' THEN
    v_os_id := OLD.os_id;
  ELSE
    v_os_id := NEW.os_id;
  END IF;

  -- Only process if payment is linked to an OS
  IF v_os_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Check if OS still exists before trying to update it
  SELECT EXISTS(SELECT 1 FROM os WHERE id = v_os_id) INTO v_os_exists;
  
  IF NOT v_os_exists THEN
    -- OS was deleted, skip update
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Get total value from OS
  SELECT valor_total INTO v_valor_total
  FROM os WHERE id = v_os_id;

  -- Calculate total paid from all payments
  SELECT COALESCE(SUM(valor_liquido), 0) INTO v_valor_pago
  FROM pagamentos WHERE os_id = v_os_id;

  -- Calculate remaining balance
  v_saldo := v_valor_total - v_valor_pago;

  -- Determine payment status
  IF v_saldo <= 0 THEN
    v_status := 'pago'::status_pagamento_enum;
    v_saldo := 0;
  ELSIF v_valor_pago > 0 THEN
    v_status := 'parcial'::status_pagamento_enum;
  ELSE
    v_status := 'pendente'::status_pagamento_enum;
  END IF;

  -- Update OS with payment information
  UPDATE os
  SET
    valor_pago = v_valor_pago,
    saldo_restante = v_saldo,
    status_pagamento = v_status,
    updated_at = now()
  WHERE id = v_os_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers
CREATE TRIGGER trg_atualizar_valores_os_insert
  AFTER INSERT ON pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valores_os();

CREATE TRIGGER trg_atualizar_valores_os_update
  AFTER UPDATE ON pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valores_os();

CREATE TRIGGER trg_atualizar_valores_os_delete
  AFTER DELETE ON pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valores_os();