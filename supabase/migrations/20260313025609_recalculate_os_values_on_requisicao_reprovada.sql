/*
  # Recalculate OS values when requisicao status changes to/from reprovada

  1. New Trigger
    - `trigger_recalc_os_on_requisicao_status_change` on `requisicoes_pecas`
    - Fires AFTER UPDATE of `status` column
    - When status changes to or from 'reprovada', recalculates the OS financial values
    - Uses the existing `atualizar_valores_os` pattern but adapted for requisicoes_pecas context

  2. New Function
    - `recalcular_os_valores_on_requisicao_change()` - wrapper that triggers OS value recalculation
      when a requisicao's status changes to/from reprovada

  3. Business Rule
    - Rejected parts should not count toward OS totals
    - When a requisicao is rejected or un-rejected, the OS cached values must be refreshed
*/

CREATE OR REPLACE FUNCTION recalcular_os_valores_on_requisicao_change()
RETURNS TRIGGER AS $$
DECLARE
  v_os_id uuid;
  v_tipo_orcamento text;
  v_valor_pecas numeric := 0;
  v_valor_servicos numeric := 0;
  v_subtotal numeric := 0;
  v_desconto_tipo text;
  v_desconto_valor numeric;
  v_valor_desconto numeric;
  v_valor_total numeric;
  v_valor_pago numeric;
  v_status_pagamento status_pagamento_enum;
BEGIN
  v_os_id := COALESCE(NEW.os_id, OLD.os_id);

  IF v_os_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF (OLD.status = 'reprovada' AND NEW.status = 'reprovada') THEN
    RETURN NEW;
  END IF;

  IF (OLD.status != 'reprovada' AND NEW.status != 'reprovada') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(tipo_orcamento, 'normal')
  INTO v_tipo_orcamento
  FROM os
  WHERE id = v_os_id;

  SELECT COALESCE(SUM(valor_total), 0)
  INTO v_valor_pecas
  FROM cotacoes_pecas
  WHERE os_id = v_os_id
    AND pn NOT IN (
      SELECT codigo_peca FROM requisicoes_pecas
      WHERE os_id = v_os_id AND status = 'reprovada'
    );

  SELECT v_valor_pecas + COALESCE(SUM(valor_total), 0)
  INTO v_valor_pecas
  FROM os_pecas
  WHERE os_id = v_os_id
    AND pn NOT IN (
      SELECT codigo_peca FROM requisicoes_pecas
      WHERE os_id = v_os_id AND status = 'reprovada'
    );

  IF v_tipo_orcamento IN ('samsung_contigo', 'acessorios') THEN
    SELECT COALESCE(SUM(valor_total), 0)
    INTO v_valor_servicos
    FROM os_servicos
    WHERE os_id = v_os_id;
  ELSE
    SELECT COALESCE(SUM(valor_total), 0)
    INTO v_valor_servicos
    FROM cotacoes_servicos
    WHERE os_id = v_os_id;
  END IF;

  v_subtotal := v_valor_pecas + v_valor_servicos;

  SELECT
    COALESCE(desconto_tipo, 'valor'),
    COALESCE(desconto_valor, 0)
  INTO v_desconto_tipo, v_desconto_valor
  FROM os
  WHERE id = v_os_id;

  IF v_desconto_tipo = 'percentual' AND v_desconto_valor > 0 THEN
    v_valor_desconto := ROUND(v_subtotal * (v_desconto_valor / 100), 2);
  ELSIF v_desconto_tipo = 'valor' AND v_desconto_valor > 0 THEN
    v_valor_desconto := v_desconto_valor;
  ELSE
    v_valor_desconto := 0;
  END IF;

  v_valor_total := GREATEST(v_subtotal - v_valor_desconto, 0);

  SELECT COALESCE(SUM(valor), 0)
  INTO v_valor_pago
  FROM pagamentos
  WHERE os_id = v_os_id;

  IF v_valor_pago = 0 THEN
    v_status_pagamento := 'pendente'::status_pagamento_enum;
  ELSIF v_valor_pago >= v_valor_total AND v_valor_total > 0 THEN
    v_status_pagamento := 'pago'::status_pagamento_enum;
  ELSIF v_valor_pago > 0 THEN
    v_status_pagamento := 'parcial'::status_pagamento_enum;
  ELSE
    v_status_pagamento := 'pendente'::status_pagamento_enum;
  END IF;

  UPDATE os
  SET
    valor_pecas = v_valor_pecas,
    valor_servicos = v_valor_servicos,
    valor_total = v_valor_total,
    valor_pago = v_valor_pago,
    saldo_restante = GREATEST(v_valor_total - v_valor_pago, 0),
    valor_desconto_calculado = v_valor_desconto,
    status_pagamento = v_status_pagamento,
    updated_at = now()
  WHERE id = v_os_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recalc_os_on_requisicao_status_change
  AFTER UPDATE OF status ON requisicoes_pecas
  FOR EACH ROW
  EXECUTE FUNCTION recalcular_os_valores_on_requisicao_change();
