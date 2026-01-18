/*
  # Fix Payment Values - Use Valor Bruto for Payment Tracking

  1. Problem
    - Trigger is using valor_liquido (net value after tax) for valor_pago
    - This is incorrect - valor_pago should show the full payment amount
    - Tax should only be deducted in profit calculations, not in payment tracking

  2. Solution
    - Update trigger to use `valor` (valor_bruto) for summing payments
    - valor_pago = sum of full payment amounts
    - saldo_restante = valor_total - valor_pago (without tax deduction)
    - Tax information is preserved for profit calculations

  3. Impact
    - Payment tracking will show correct amounts paid
    - Saldo restante will reflect actual remaining balance
    - Tax is only relevant for internal profit analysis
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

  -- Calculate total paid using VALOR BRUTO (valor field)
  -- Tax is tracked separately for profit calculation, not for payment tracking
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