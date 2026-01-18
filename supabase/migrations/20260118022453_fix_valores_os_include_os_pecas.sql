/*
  # Fix OS Values Calculation - Include os_pecas table

  1. Problem
    - Trigger was not summing parts from os_pecas table
    - Only cotacoes_pecas was being counted

  2. Solution
    - Add os_pecas to the subtotal calculation
    - Ensure all parts sources are included

  3. Impact
    - Correct subtotal calculation for GSPN parts
    - Accurate valor_total, valor_pago, saldo_restante
*/

CREATE OR REPLACE FUNCTION atualizar_valores_os()
RETURNS TRIGGER AS $$
DECLARE
  v_os_id uuid;
  v_subtotal numeric;
  v_desconto_tipo text;
  v_desconto_valor numeric;
  v_valor_desconto numeric;
  v_valor_total numeric;
  v_valor_pago numeric;
  v_status_pagamento status_pagamento_enum;
BEGIN
  -- Determine which OS ID to update
  v_os_id := COALESCE(NEW.os_id, OLD.os_id);
  
  IF v_os_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate SUBTOTAL = parts + services
  -- Sum parts from cotacoes_pecas
  SELECT COALESCE(SUM(valor_total), 0)
  INTO v_subtotal
  FROM cotacoes_pecas
  WHERE os_id = v_os_id;

  -- Add parts from os_pecas (GSPN parts)
  SELECT v_subtotal + COALESCE(SUM(valor_total), 0)
  INTO v_subtotal
  FROM os_pecas
  WHERE os_id = v_os_id;

  -- Add services from cotacoes_servicos
  SELECT v_subtotal + COALESCE(SUM(valor_total), 0)
  INTO v_subtotal
  FROM cotacoes_servicos
  WHERE os_id = v_os_id;

  -- Add services from os_servicos (for SC/ACC orders)
  SELECT v_subtotal + COALESCE(SUM(valor_total), 0)
  INTO v_subtotal
  FROM os_servicos
  WHERE os_id = v_os_id;

  -- Get discount info from OS
  SELECT 
    COALESCE(desconto_tipo, 'valor'),
    COALESCE(desconto_valor, 0)
  INTO v_desconto_tipo, v_desconto_valor
  FROM os 
  WHERE id = v_os_id;

  -- Calculate discount value in R$
  IF v_desconto_tipo = 'percentual' AND v_desconto_valor > 0 THEN
    v_valor_desconto := ROUND(v_subtotal * (v_desconto_valor / 100), 2);
  ELSIF v_desconto_tipo = 'valor' AND v_desconto_valor > 0 THEN
    v_valor_desconto := v_desconto_valor;
  ELSE
    v_valor_desconto := 0;
  END IF;

  -- Calculate VALOR FINAL = SUBTOTAL - DESCONTO
  v_valor_total := GREATEST(v_subtotal - v_valor_desconto, 0);

  -- Calculate VALOR PAGO = sum of gross payment values (valor bruto)
  SELECT COALESCE(SUM(valor), 0)
  INTO v_valor_pago
  FROM pagamentos
  WHERE os_id = v_os_id;

  -- Determine payment status
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
  -- SALDO RESTANTE = VALOR TOTAL - VALOR PAGO
  UPDATE os
  SET 
    valor_total = v_valor_total,
    valor_pago = v_valor_pago,
    saldo_restante = GREATEST(v_valor_total - v_valor_pago, 0),
    valor_desconto_calculado = v_valor_desconto,
    status_pagamento = v_status_pagamento,
    updated_at = now()
  WHERE id = v_os_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists on os_pecas table
DROP TRIGGER IF EXISTS trigger_atualizar_valores_os_on_os_pecas ON os_pecas;
CREATE TRIGGER trigger_atualizar_valores_os_on_os_pecas
  AFTER INSERT OR UPDATE OR DELETE ON os_pecas
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valores_os();