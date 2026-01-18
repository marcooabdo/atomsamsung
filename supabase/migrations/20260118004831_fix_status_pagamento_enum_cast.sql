/*
  # Corrigir cast do tipo status_pagamento para status_pagamento_enum

  O trigger atualizar_valores_os estava usando o cast errado:
  - Antes: v_status::status_pagamento (tipo inexistente)
  - Depois: v_status::status_pagamento_enum (tipo correto)
*/

CREATE OR REPLACE FUNCTION atualizar_valores_os()
RETURNS TRIGGER AS $$
DECLARE
  v_os_id uuid;
  v_total_pecas numeric := 0;
  v_total_servicos numeric := 0;
  v_valor_bruto numeric := 0;
  v_desconto_tipo text;
  v_desconto_valor numeric := 0;
  v_valor_desconto numeric := 0;
  v_valor_total numeric := 0;
  v_valor_pago numeric := 0;
  v_saldo numeric := 0;
  v_status text := 'pendente';
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_os_id := OLD.os_id;
  ELSE
    v_os_id := NEW.os_id;
  END IF;

  IF v_os_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(valor_total), 0) INTO v_total_pecas
  FROM cotacoes_pecas WHERE os_id = v_os_id;

  SELECT COALESCE(SUM(valor_total), 0) INTO v_total_servicos
  FROM cotacoes_servicos WHERE os_id = v_os_id;

  v_valor_bruto := v_total_pecas + v_total_servicos;

  SELECT desconto_tipo, COALESCE(desconto_valor, 0)
  INTO v_desconto_tipo, v_desconto_valor
  FROM os WHERE id = v_os_id;

  IF v_desconto_tipo = 'percentual' AND v_desconto_valor > 0 THEN
    v_valor_desconto := ROUND(v_valor_bruto * (v_desconto_valor / 100), 2);
  ELSIF v_desconto_tipo = 'valor' AND v_desconto_valor > 0 THEN
    v_valor_desconto := v_desconto_valor;
  ELSE
    v_valor_desconto := 0;
  END IF;

  v_valor_total := GREATEST(v_valor_bruto - v_valor_desconto, 0);

  SELECT COALESCE(SUM(valor_liquido), 0) INTO v_valor_pago
  FROM pagamentos WHERE os_id = v_os_id;

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

  UPDATE os SET
    valor_pecas = v_total_pecas,
    valor_servicos = v_total_servicos,
    valor_desconto_calculado = v_valor_desconto,
    valor_total = v_valor_total,
    valor_pago = v_valor_pago,
    saldo_restante = v_saldo,
    status_pagamento = v_status::status_pagamento_enum,
    updated_at = NOW()
  WHERE id = v_os_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
