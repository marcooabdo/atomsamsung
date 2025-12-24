/*
  # Fix atualizar_valores_os - Correct Enum Type Casting

  1. Problem
    - Function assigns text values to status_pagamento field
    - Field is of type status_pagamento_enum, not text
    - Causes error: "column status_pagamento is of type status_pagamento_enum but expression is of type text"
    - Prevents payments and parts from being saved when moving OS in kanban

  2. Solution
    - Add explicit cast to status_pagamento_enum type
    - Use ::status_pagamento_enum syntax for type casting

  3. Impact
    - Payments will save correctly
    - Parts will be linked correctly
    - OS status will update properly when moving in kanban
*/

CREATE OR REPLACE FUNCTION atualizar_valores_os()
RETURNS TRIGGER AS $$
DECLARE
  v_os_id uuid;
  v_valor_total numeric;
  v_valor_pago numeric;
  v_status_pagamento status_pagamento_enum;
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

  -- Determine payment status with proper enum casting
  IF v_valor_pago = 0 THEN
    v_status_pagamento := 'pendente'::status_pagamento_enum;
  ELSIF v_valor_pago >= v_valor_total AND v_valor_total > 0 THEN
    v_status_pagamento := 'pago'::status_pagamento_enum;
  ELSIF v_valor_pago > 0 THEN
    v_status_pagamento := 'parcial'::status_pagamento_enum;
  ELSE
    v_status_pagamento := 'pendente'::status_pagamento_enum;
  END IF;

  -- Update OS with calculated values
  UPDATE os
  SET 
    valor_total = v_valor_total,
    valor_pago = v_valor_pago,
    saldo_restante = GREATEST(v_valor_total - v_valor_pago, 0),
    status_pagamento = v_status_pagamento,
    updated_at = now()
  WHERE id = v_os_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
