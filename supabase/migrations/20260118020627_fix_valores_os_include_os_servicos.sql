/*
  # Fix OS Values Calculation - Include os_servicos Table

  1. Problem
    - Trigger only sums services from cotacoes_servicos
    - OS SC/ACC services are stored in os_servicos table
    - This causes valor_total to be incorrect for SC/ACC orders

  2. Solution
    - Update trigger to sum services from BOTH tables:
      - cotacoes_servicos (normal OS)
      - os_servicos (SC/ACC OS)

  3. Impact
    - Correct valor_total for all OS types
    - SC/ACC orders will show correct totals including services
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

  -- Add services total from cotacoes_servicos
  SELECT v_valor_total + COALESCE(SUM(valor_total), 0)
  INTO v_valor_total
  FROM cotacoes_servicos
  WHERE os_id = v_os_id;

  -- Add services total from os_servicos (for SC/ACC orders)
  SELECT v_valor_total + COALESCE(SUM(valor_total), 0)
  INTO v_valor_total
  FROM os_servicos
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

-- Ensure trigger is active on os_servicos table
DROP TRIGGER IF EXISTS trigger_atualizar_valores_os_on_os_servicos ON os_servicos;
CREATE TRIGGER trigger_atualizar_valores_os_on_os_servicos
  AFTER INSERT OR UPDATE OR DELETE ON os_servicos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valores_os();