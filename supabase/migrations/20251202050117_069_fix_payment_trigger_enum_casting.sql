/*
  # Fix Payment Trigger Enum Casting

  1. Problem
    - The trigger `atualizar_valores_os()` was using `text` type for status
    - This caused "type status_pagamento_enum but expression is of type text" error
    - The UPDATE statement needs explicit casting to enum type

  2. Solution
    - Recreate trigger function with proper enum type declaration
    - Add explicit casting when updating status_pagamento
    - Ensure trigger only fires when os_id is NOT NULL (skip cotacao-only payments)

  3. Changes
    - Change v_status from `text` to `status_pagamento_enum`
    - Add explicit cast: `status_pagamento = v_status::status_pagamento_enum`
    - Add NULL check for os_id before processing
*/

-- Drop all existing triggers first
DROP TRIGGER IF EXISTS trigger_atualizar_valores_os ON pagamentos;
DROP TRIGGER IF EXISTS trg_atualizar_valores_os_insert ON pagamentos;
DROP TRIGGER IF EXISTS trg_atualizar_valores_os_update ON pagamentos;
DROP TRIGGER IF EXISTS trg_atualizar_valores_os_delete ON pagamentos;

-- Now drop function with CASCADE to remove any remaining dependencies
DROP FUNCTION IF EXISTS atualizar_valores_os() CASCADE;

-- Recreate function with proper enum type
CREATE OR REPLACE FUNCTION atualizar_valores_os()
RETURNS TRIGGER AS $$
DECLARE
  v_os_id uuid;
  v_valor_total numeric;
  v_valor_pago numeric;
  v_saldo numeric;
  v_status status_pagamento_enum;
BEGIN
  -- Only process if payment is linked to an OS
  IF NEW.os_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_os_id := NEW.os_id;

  -- Get total value from OS
  SELECT valor_total INTO v_valor_total
  FROM os
  WHERE id = v_os_id;

  -- Calculate total paid from all payments
  SELECT COALESCE(SUM(valor_liquido), 0) INTO v_valor_pago
  FROM pagamentos
  WHERE os_id = v_os_id;

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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger for INSERT
CREATE TRIGGER trg_atualizar_valores_os_insert
  AFTER INSERT ON pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valores_os();
