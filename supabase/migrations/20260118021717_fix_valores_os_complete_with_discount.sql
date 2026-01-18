/*
  # Fix OS Values Calculation - Complete with Discount

  1. Correct Logic
    - SUBTOTAL = PEÇAS + SERVIÇOS (all tables)
    - DESCONTO = discount value (if any)
    - VALOR FINAL (valor_total) = SUBTOTAL - DESCONTO
    - VALOR PAGO = SUM(pagamentos.valor) [valor bruto always]
    - SALDO RESTANTE = VALOR FINAL - VALOR PAGO

  2. Tables to Sum
    - Parts: cotacoes_pecas
    - Services: cotacoes_servicos + os_servicos (for SC/ACC)

  3. Impact
    - Correct calculation including discount
    - Correct saldo_restante based on final value
    - Payment tracking uses gross value (valor bruto)
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

-- Ensure trigger exists on os_servicos table
DROP TRIGGER IF EXISTS trigger_atualizar_valores_os_on_os_servicos ON os_servicos;
CREATE TRIGGER trigger_atualizar_valores_os_on_os_servicos
  AFTER INSERT OR UPDATE OR DELETE ON os_servicos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valores_os();

-- Ensure trigger on OS table for discount changes
DROP TRIGGER IF EXISTS trigger_atualizar_valores_os_on_os_discount ON os;
CREATE TRIGGER trigger_atualizar_valores_os_on_os_discount
  AFTER UPDATE OF desconto_tipo, desconto_valor ON os
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valores_os();