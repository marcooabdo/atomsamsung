/*
  # Fix OS Values Calculation - Conditional Services

  1. Problem
    - Services were duplicated in both cotacoes_servicos and os_servicos
    - Trigger was summing both tables, doubling the service values
    
  2. Logic
    - For SC/ACC (samsung_contigo/acessorios): Use ONLY os_servicos
    - For Normal/LP: Use ONLY cotacoes_servicos
    - Never sum both service tables for the same OS

  3. Calculation
    - SUBTOTAL = Parts + Services (from correct table based on tipo_orcamento)
    - VALOR FINAL = SUBTOTAL - DESCONTO
    - VALOR PAGO = sum of payment.valor (gross amount)
    - SALDO RESTANTE = VALOR FINAL - VALOR PAGO
*/

CREATE OR REPLACE FUNCTION atualizar_valores_os()
RETURNS TRIGGER AS $$
DECLARE
  v_os_id uuid;
  v_tipo_orcamento text;
  v_subtotal numeric := 0;
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

  -- Get OS type to determine which service table to use
  SELECT COALESCE(tipo_orcamento, 'normal')
  INTO v_tipo_orcamento
  FROM os 
  WHERE id = v_os_id;

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

  -- Add services from the CORRECT table based on tipo_orcamento
  IF v_tipo_orcamento IN ('samsung_contigo', 'acessorios') THEN
    -- SC/ACC: Use ONLY os_servicos
    SELECT v_subtotal + COALESCE(SUM(valor_total), 0)
    INTO v_subtotal
    FROM os_servicos
    WHERE os_id = v_os_id;
  ELSE
    -- Normal/LP: Use ONLY cotacoes_servicos
    SELECT v_subtotal + COALESCE(SUM(valor_total), 0)
    INTO v_subtotal
    FROM cotacoes_servicos
    WHERE os_id = v_os_id;
  END IF;

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