/*
  # Exclude reprovada parts from OS value calculation triggers

  1. Modified Functions
    - `atualizar_valores_os` - Now excludes parts (cotacoes_pecas and os_pecas) whose PN
      has a matching reprovada requisition in requisicoes_pecas for the same OS
    - `recalcular_valores_os_desconto` - Same exclusion logic applied

  2. Business Rule
    - When a part requisition is rejected (reprovada), that part should no longer count
      toward the OS financial totals (valor_pecas, valor_total, saldo_restante, etc.)
    - This keeps the DB triggers consistent with the frontend which already filters these parts

  3. Important Notes
    - Uses a subquery to get reprovada PNs from requisicoes_pecas
    - Filters cotacoes_pecas by pn NOT IN reprovada set
    - Filters os_pecas by pn NOT IN reprovada set
*/

CREATE OR REPLACE FUNCTION atualizar_valores_os()
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

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;


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
  IF NEW.desconto_tipo IS DISTINCT FROM OLD.desconto_tipo
  OR NEW.desconto_valor IS DISTINCT FROM OLD.desconto_valor THEN

    v_tipo_orcamento := COALESCE(NEW.tipo_orcamento, 'normal');

    SELECT COALESCE(SUM(valor_total), 0) INTO v_total_pecas
    FROM cotacoes_pecas
    WHERE os_id = NEW.id
      AND pn NOT IN (
        SELECT codigo_peca FROM requisicoes_pecas
        WHERE os_id = NEW.id AND status = 'reprovada'
      );

    SELECT v_total_pecas + COALESCE(SUM(valor_total), 0) INTO v_total_pecas
    FROM os_pecas
    WHERE os_id = NEW.id
      AND pn NOT IN (
        SELECT codigo_peca FROM requisicoes_pecas
        WHERE os_id = NEW.id AND status = 'reprovada'
      );

    IF v_tipo_orcamento IN ('samsung_contigo', 'acessorios') THEN
      SELECT COALESCE(SUM(valor_total), 0) INTO v_total_servicos
      FROM os_servicos WHERE os_id = NEW.id;
    ELSE
      SELECT COALESCE(SUM(valor_total), 0) INTO v_total_servicos
      FROM cotacoes_servicos WHERE os_id = NEW.id;
    END IF;

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
$$ LANGUAGE plpgsql;
