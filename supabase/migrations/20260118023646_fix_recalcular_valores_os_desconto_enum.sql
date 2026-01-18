/*
  # Fix recalcular_valores_os_desconto - Use correct enum type
  
  1. Problem
    - Function uses ::status_pagamento (does not exist)
    - Should use ::status_pagamento_enum
    
  2. Solution
    - Update function to use correct enum type
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
BEGIN
  IF NEW.desconto_tipo IS DISTINCT FROM OLD.desconto_tipo 
    OR NEW.desconto_valor IS DISTINCT FROM OLD.desconto_valor THEN

    SELECT COALESCE(SUM(valor_total), 0) INTO v_total_pecas
    FROM cotacoes_pecas WHERE os_id = NEW.id;

    SELECT COALESCE(SUM(valor_total), 0) INTO v_total_servicos
    FROM cotacoes_servicos WHERE os_id = NEW.id;

    v_valor_bruto := v_total_pecas + v_total_servicos;

    IF NEW.desconto_tipo = 'percentual' AND COALESCE(NEW.desconto_valor, 0) > 0 THEN
      v_valor_desconto := ROUND(v_valor_bruto * (NEW.desconto_valor / 100), 2);
    ELSIF NEW.desconto_tipo = 'valor' AND COALESCE(NEW.desconto_valor, 0) > 0 THEN
      v_valor_desconto := NEW.desconto_valor;
    ELSE
      v_valor_desconto := 0;
    END IF;

    v_valor_total := GREATEST(v_valor_bruto - v_valor_desconto, 0);

    SELECT COALESCE(SUM(valor), 0) INTO v_valor_pago
    FROM pagamentos WHERE os_id = NEW.id;

    v_saldo := v_valor_total - v_valor_pago;

    IF v_valor_total <= 0 THEN
      v_status := 'pendente';
    ELSIF v_valor_pago >= v_valor_total THEN
      v_status := 'pago';
    ELSIF v_valor_pago > 0 THEN
      v_status := 'parcial';
    ELSE
      v_status := 'pendente';
    END IF;

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