/*
  # Fix recalcular_valores_os_desconto - Include os_pecas
  
  1. Problem
    - Function only sums cotacoes_pecas and cotacoes_servicos
    - Missing os_pecas (GSPN parts) and os_servicos (SC/ACC services)
    - Results in incorrect subtotal calculation
    
  2. Solution
    - Sum BOTH cotacoes_pecas AND os_pecas for parts
    - For services, use os_servicos for SC/ACC, cotacoes_servicos otherwise
    - This matches the logic in atualizar_valores_os()
    
  3. Calculation Logic
    - SUBTOTAL = (cotacoes_pecas + os_pecas) + (correct service table)
    - DESCONTO = calculated based on tipo
    - VALOR FINAL = SUBTOTAL - DESCONTO
    - VALOR PAGO = sum of pagamentos.valor (gross amount)
    - SALDO = VALOR FINAL - VALOR PAGO
*/

CREATE OR REPLACE FUNCTION recalcular_valores_os_desconto()
RETURNS TRIGGER AS $$
DECLARE
  v_total_pecas numeric := 0;
  v_total_servicos numeric := 0;
  v_valor_bruto numeric := 0;
  v_valor_desconto numeric := 0;
  v_valor_total numeric := 0;
  v_valor_pago numeric := 0;
  v_saldo numeric := 0;
  v_status text := 'pendente';
  v_tipo_orcamento text;
BEGIN
  -- Only recalculate if discount changed
  IF NEW.desconto_tipo IS DISTINCT FROM OLD.desconto_tipo 
    OR NEW.desconto_valor IS DISTINCT FROM OLD.desconto_valor THEN

    -- Get tipo_orcamento to determine which service table to use
    v_tipo_orcamento := COALESCE(NEW.tipo_orcamento, 'normal');

    -- Sum parts from BOTH cotacoes_pecas AND os_pecas
    SELECT COALESCE(SUM(valor_total), 0) INTO v_total_pecas
    FROM cotacoes_pecas WHERE os_id = NEW.id;

    SELECT v_total_pecas + COALESCE(SUM(valor_total), 0) INTO v_total_pecas
    FROM os_pecas WHERE os_id = NEW.id;

    -- Sum services from correct table based on tipo_orcamento
    IF v_tipo_orcamento IN ('samsung_contigo', 'acessorios') THEN
      -- SC/ACC: use os_servicos
      SELECT COALESCE(SUM(valor_total), 0) INTO v_total_servicos
      FROM os_servicos WHERE os_id = NEW.id;
    ELSE
      -- Normal/LP: use cotacoes_servicos
      SELECT COALESCE(SUM(valor_total), 0) INTO v_total_servicos
      FROM cotacoes_servicos WHERE os_id = NEW.id;
    END IF;

    -- SUBTOTAL = parts + services
    v_valor_bruto := v_total_pecas + v_total_servicos;

    -- Calculate discount in R$
    IF NEW.desconto_tipo = 'percentual' AND COALESCE(NEW.desconto_valor, 0) > 0 THEN
      v_valor_desconto := ROUND(v_valor_bruto * (NEW.desconto_valor / 100), 2);
    ELSIF NEW.desconto_tipo = 'valor' AND COALESCE(NEW.desconto_valor, 0) > 0 THEN
      v_valor_desconto := NEW.desconto_valor;
    ELSE
      v_valor_desconto := 0;
    END IF;

    -- VALOR FINAL = SUBTOTAL - DESCONTO
    v_valor_total := GREATEST(v_valor_bruto - v_valor_desconto, 0);

    -- VALOR PAGO = sum of gross payment values
    SELECT COALESCE(SUM(valor), 0) INTO v_valor_pago
    FROM pagamentos WHERE os_id = NEW.id;

    -- SALDO = VALOR FINAL - VALOR PAGO
    v_saldo := v_valor_total - v_valor_pago;

    -- Determine payment status
    IF v_valor_total <= 0 THEN
      v_status := 'pendente';
    ELSIF v_valor_pago >= v_valor_total THEN
      v_status := 'pago';
    ELSIF v_valor_pago > 0 THEN
      v_status := 'parcial';
    ELSE
      v_status := 'pendente';
    END IF;

    -- Update OS with calculated values
    NEW.valor_pecas := v_total_pecas;
    NEW.valor_servicos := v_total_servicos;
    NEW.valor_desconto_calculado := v_valor_desconto;
    NEW.valor_total := v_valor_total;
    NEW.valor_pago := v_valor_pago;
    NEW.saldo_restante := v_saldo;
    NEW.status_pagamento := v_status::status_pagamento_enum;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;