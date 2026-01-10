/*
  # Fix Payment Trigger - Use valor_liquido instead of valor

  1. Problem
    - Trigger is summing `valor` field which contains valor_bruto
    - This causes duplication because valor_bruto is already saved separately
    - Should sum `valor_liquido` which is the actual net amount received

  2. Solution
    - Update trigger to sum valor_liquido (or valor_bruto if valor_liquido is null)
    - This ensures correct payment tracking

  3. Impact
    - Payment calculations will be accurate
    - No more duplicated values in OS totals
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

  -- Calculate total paid using valor_liquido (or valor if valor_liquido is null for backwards compatibility)
  SELECT COALESCE(SUM(COALESCE(valor_liquido, valor)), 0)
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
