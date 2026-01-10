/*
  # Force Recalculate All OS Values

  1. Problem
    - Some OS entries have valor_total = 0 even though they have parts and services
    - This happens when triggers don't fire automatically
    - Need to force recalculation for all OS with cotacoes

  2. Solution
    - Loop through all OS that have cotacao_id (have parts/services)
    - Recalculate valor_total from cotacoes_pecas and cotacoes_servicos
    - Recalculate valor_pago from pagamentos
    - Update saldo_restante and status_pagamento

  3. Impact
    - All OS will have correct payment values
    - UI will display accurate totals
*/

DO $$
DECLARE
  v_os record;
  v_valor_total numeric;
  v_valor_pago numeric;
  v_status_pagamento status_pagamento_enum;
BEGIN
  -- Loop through all OS
  FOR v_os IN SELECT id FROM os
  LOOP
    -- Calculate total value from cotações (parts)
    SELECT COALESCE(SUM(valor_total), 0)
    INTO v_valor_total
    FROM cotacoes_pecas
    WHERE os_id = v_os.id;

    -- Add services total
    SELECT v_valor_total + COALESCE(SUM(valor_total), 0)
    INTO v_valor_total
    FROM cotacoes_servicos
    WHERE os_id = v_os.id;

    -- Calculate total paid using valor_liquido (or valor if valor_liquido is null)
    SELECT COALESCE(SUM(COALESCE(valor_liquido, valor)), 0)
    INTO v_valor_pago
    FROM pagamentos
    WHERE os_id = v_os.id;

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

    -- Update OS with calculated values (only if there are changes)
    UPDATE os
    SET 
      valor_total = v_valor_total,
      valor_pago = v_valor_pago,
      saldo_restante = GREATEST(v_valor_total - v_valor_pago, 0),
      status_pagamento = v_status_pagamento,
      updated_at = now()
    WHERE id = v_os.id
      AND (
        valor_total IS DISTINCT FROM v_valor_total OR
        valor_pago IS DISTINCT FROM v_valor_pago OR
        saldo_restante IS DISTINCT FROM GREATEST(v_valor_total - v_valor_pago, 0) OR
        status_pagamento IS DISTINCT FROM v_status_pagamento
      );
  END LOOP;

  RAISE NOTICE 'All OS values recalculated successfully';
END $$;
