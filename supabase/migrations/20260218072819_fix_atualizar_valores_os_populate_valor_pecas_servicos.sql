/*
  # Corrige atualizar_valores_os para preencher valor_pecas e valor_servicos

  ## Problema
  - A função atualizar_valores_os calculava valor_total corretamente
  - Mas nunca atualizava valor_servicos e valor_pecas na tabela os
  - Esses campos ficavam zerados em todas as OS

  ## Solução
  - Refatorar a função para calcular separadamente:
    - v_valor_pecas = soma de cotacoes_pecas + os_pecas
    - v_valor_servicos = soma de cotacoes_servicos OU os_servicos (dependendo do tipo)
  - Salvar ambos os campos + valor_total no UPDATE final
  - Executar recálculo em massa para corrigir todos os registros existentes
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

  -- Soma de peças: cotacoes_pecas + os_pecas
  SELECT COALESCE(SUM(valor_total), 0)
  INTO v_valor_pecas
  FROM cotacoes_pecas
  WHERE os_id = v_os_id;

  SELECT v_valor_pecas + COALESCE(SUM(valor_total), 0)
  INTO v_valor_pecas
  FROM os_pecas
  WHERE os_id = v_os_id;

  -- Soma de serviços: depende do tipo de orçamento
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Recalcular todos os registros existentes
DO $$
DECLARE
  r RECORD;
  v_tipo_orcamento text;
  v_valor_pecas numeric;
  v_valor_servicos numeric;
  v_subtotal numeric;
  v_desconto_tipo text;
  v_desconto_valor numeric;
  v_valor_desconto numeric;
  v_valor_total numeric;
  v_valor_pago numeric;
  v_status_pagamento status_pagamento_enum;
BEGIN
  FOR r IN SELECT id, tipo_orcamento, desconto_tipo, desconto_valor FROM os LOOP
    v_tipo_orcamento := COALESCE(r.tipo_orcamento, 'normal');

    SELECT COALESCE(SUM(valor_total), 0) INTO v_valor_pecas
    FROM cotacoes_pecas WHERE os_id = r.id;

    SELECT v_valor_pecas + COALESCE(SUM(valor_total), 0) INTO v_valor_pecas
    FROM os_pecas WHERE os_id = r.id;

    IF v_tipo_orcamento IN ('samsung_contigo', 'acessorios') THEN
      SELECT COALESCE(SUM(valor_total), 0) INTO v_valor_servicos
      FROM os_servicos WHERE os_id = r.id;
    ELSE
      SELECT COALESCE(SUM(valor_total), 0) INTO v_valor_servicos
      FROM cotacoes_servicos WHERE os_id = r.id;
    END IF;

    v_subtotal := v_valor_pecas + v_valor_servicos;
    v_desconto_tipo := COALESCE(r.desconto_tipo, 'valor');
    v_desconto_valor := COALESCE(r.desconto_valor, 0);

    IF v_desconto_tipo = 'percentual' AND v_desconto_valor > 0 THEN
      v_valor_desconto := ROUND(v_subtotal * (v_desconto_valor / 100), 2);
    ELSIF v_desconto_tipo = 'valor' AND v_desconto_valor > 0 THEN
      v_valor_desconto := v_desconto_valor;
    ELSE
      v_valor_desconto := 0;
    END IF;

    v_valor_total := GREATEST(v_subtotal - v_valor_desconto, 0);

    SELECT COALESCE(SUM(valor), 0) INTO v_valor_pago
    FROM pagamentos WHERE os_id = r.id;

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
      status_pagamento = v_status_pagamento
    WHERE id = r.id;
  END LOOP;
END $$;
