/*
  SCRIPT DE CORREÇÃO: Inconsistências de Pagamento

  Data: 2026-02-14
  Objetivo: Corrigir valores desatualizados nas OSs e forçar recálculo automático

  ATENÇÃO: Este script força os triggers a recalcular todos os valores.
  Recomenda-se backup antes de executar.
*/

-- ============================================================================
-- PARTE 1: CRIAR VIEW DE MONITORAMENTO
-- ============================================================================

DROP VIEW IF EXISTS v_os_inconsistencias CASCADE;

CREATE OR REPLACE VIEW v_os_inconsistencias AS
SELECT
  o.id,
  o.numero_os_samsung,
  o.cliente_nome,
  o.valor_total,
  o.valor_pago,
  o.saldo_restante,
  o.status_pagamento,
  o.coluna_kanban,
  o.created_at,
  -- Calcular valores corretos
  (
    COALESCE((SELECT SUM(valor_total) FROM cotacoes_pecas WHERE os_id = o.id), 0) +
    COALESCE((SELECT SUM(valor_total) FROM os_pecas WHERE os_id = o.id), 0) +
    CASE
      WHEN o.tipo_orcamento IN ('samsung_contigo', 'acessorios')
      THEN COALESCE((SELECT SUM(valor_total) FROM os_servicos WHERE os_id = o.id), 0)
      ELSE COALESCE((SELECT SUM(valor_total) FROM cotacoes_servicos WHERE os_id = o.id), 0)
    END
  ) as subtotal_real,
  -- Calcular desconto
  CASE
    WHEN o.desconto_tipo = 'percentual' AND o.desconto_valor > 0
    THEN ROUND((
      COALESCE((SELECT SUM(valor_total) FROM cotacoes_pecas WHERE os_id = o.id), 0) +
      COALESCE((SELECT SUM(valor_total) FROM os_pecas WHERE os_id = o.id), 0) +
      CASE
        WHEN o.tipo_orcamento IN ('samsung_contigo', 'acessorios')
        THEN COALESCE((SELECT SUM(valor_total) FROM os_servicos WHERE os_id = o.id), 0)
        ELSE COALESCE((SELECT SUM(valor_total) FROM cotacoes_servicos WHERE os_id = o.id), 0)
      END
    ) * (o.desconto_valor / 100), 2)
    WHEN o.desconto_tipo = 'valor' AND o.desconto_valor > 0
    THEN o.desconto_valor
    ELSE 0
  END as desconto_real,
  -- Verificações
  CASE
    WHEN o.valor_total = 0 AND o.valor_pago > 0
    THEN 'CRITICO: Pagamento sem orcamento'
    WHEN ABS(o.saldo_restante - (o.valor_total - o.valor_pago)) > 0.01
    THEN 'ERRO: Saldo calculado incorreto'
    WHEN o.valor_pago >= o.valor_total AND o.valor_total > 0 AND o.status_pagamento != 'pago'
    THEN 'ERRO: Status incorreto (deveria ser pago)'
    WHEN o.valor_pago > 0 AND o.valor_pago < o.valor_total AND o.status_pagamento != 'parcial'
    THEN 'ERRO: Status incorreto (deveria ser parcial)'
    WHEN o.valor_pago = 0 AND o.status_pagamento != 'pendente'
    THEN 'ERRO: Status incorreto (deveria ser pendente)'
    ELSE 'OK'
  END as status_validacao,
  ABS(o.valor_total - (
    COALESCE((SELECT SUM(valor_total) FROM cotacoes_pecas WHERE os_id = o.id), 0) +
    COALESCE((SELECT SUM(valor_total) FROM os_pecas WHERE os_id = o.id), 0) +
    CASE
      WHEN o.tipo_orcamento IN ('samsung_contigo', 'acessorios')
      THEN COALESCE((SELECT SUM(valor_total) FROM os_servicos WHERE os_id = o.id), 0)
      ELSE COALESCE((SELECT SUM(valor_total) FROM cotacoes_servicos WHERE os_id = o.id), 0)
    END - CASE
      WHEN o.desconto_tipo = 'percentual' AND o.desconto_valor > 0
      THEN ROUND((
        COALESCE((SELECT SUM(valor_total) FROM cotacoes_pecas WHERE os_id = o.id), 0) +
        COALESCE((SELECT SUM(valor_total) FROM os_pecas WHERE os_id = o.id), 0) +
        CASE
          WHEN o.tipo_orcamento IN ('samsung_contigo', 'acessorios')
          THEN COALESCE((SELECT SUM(valor_total) FROM os_servicos WHERE os_id = o.id), 0)
          ELSE COALESCE((SELECT SUM(valor_total) FROM cotacoes_servicos WHERE os_id = o.id), 0)
        END
      ) * (o.desconto_valor / 100), 2)
      WHEN o.desconto_tipo = 'valor' AND o.desconto_valor > 0
      THEN o.desconto_valor
      ELSE 0
    END
  )) as divergencia_valor
FROM os o
WHERE o.created_at > NOW() - INTERVAL '90 days';

COMMENT ON VIEW v_os_inconsistencias IS 'View para monitorar inconsistências de valores em OSs com pagamentos';

-- ============================================================================
-- PARTE 2: CRIAR FUNÇÃO DE VALIDAÇÃO E CORREÇÃO
-- ============================================================================

CREATE OR REPLACE FUNCTION validar_e_corrigir_valores_os(p_os_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_antes jsonb;
  v_depois jsonb;
  v_pagamento_id uuid;
BEGIN
  -- Capturar valores antes da correção
  SELECT jsonb_build_object(
    'valor_total', valor_total,
    'valor_pago', valor_pago,
    'saldo_restante', saldo_restante,
    'status_pagamento', status_pagamento,
    'valor_desconto_calculado', valor_desconto_calculado
  ) INTO v_antes
  FROM os WHERE id = p_os_id;

  -- Buscar um pagamento desta OS para forçar recálculo
  SELECT id INTO v_pagamento_id
  FROM pagamentos
  WHERE os_id = p_os_id
  LIMIT 1;

  -- Se existe pagamento, atualizar para disparar trigger
  IF v_pagamento_id IS NOT NULL THEN
    UPDATE pagamentos
    SET updated_at = NOW()
    WHERE id = v_pagamento_id;
  ELSE
    -- Se não tem pagamento mas tem valores, forçar recálculo direto
    PERFORM atualizar_valores_os_direto(p_os_id);
  END IF;

  -- Capturar valores depois da correção
  SELECT jsonb_build_object(
    'valor_total', valor_total,
    'valor_pago', valor_pago,
    'saldo_restante', saldo_restante,
    'status_pagamento', status_pagamento,
    'valor_desconto_calculado', valor_desconto_calculado
  ) INTO v_depois
  FROM os WHERE id = p_os_id;

  RETURN jsonb_build_object(
    'os_id', p_os_id,
    'antes', v_antes,
    'depois', v_depois,
    'foi_corrigido', v_antes != v_depois,
    'executado_em', NOW()
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validar_e_corrigir_valores_os IS 'Valida e corrige valores de uma OS específica, retornando antes/depois';

-- ============================================================================
-- PARTE 3: FUNÇÃO AUXILIAR PARA RECÁLCULO DIRETO
-- ============================================================================

CREATE OR REPLACE FUNCTION atualizar_valores_os_direto(p_os_id uuid)
RETURNS void AS $$
DECLARE
  v_tipo_orcamento text;
  v_subtotal numeric := 0;
  v_desconto_tipo text;
  v_desconto_valor numeric;
  v_valor_desconto numeric;
  v_valor_total numeric;
  v_valor_pago numeric;
  v_status_pagamento status_pagamento_enum;
BEGIN
  -- Get OS type
  SELECT COALESCE(tipo_orcamento, 'normal')
  INTO v_tipo_orcamento
  FROM os
  WHERE id = p_os_id;

  -- Calculate SUBTOTAL
  SELECT COALESCE(SUM(valor_total), 0)
  INTO v_subtotal
  FROM cotacoes_pecas
  WHERE os_id = p_os_id;

  SELECT v_subtotal + COALESCE(SUM(valor_total), 0)
  INTO v_subtotal
  FROM os_pecas
  WHERE os_id = p_os_id;

  -- Add services based on type
  IF v_tipo_orcamento IN ('samsung_contigo', 'acessorios') THEN
    SELECT v_subtotal + COALESCE(SUM(valor_total), 0)
    INTO v_subtotal
    FROM os_servicos
    WHERE os_id = p_os_id;
  ELSE
    SELECT v_subtotal + COALESCE(SUM(valor_total), 0)
    INTO v_subtotal
    FROM cotacoes_servicos
    WHERE os_id = p_os_id;
  END IF;

  -- Get discount
  SELECT
    COALESCE(desconto_tipo, 'valor'),
    COALESCE(desconto_valor, 0)
  INTO v_desconto_tipo, v_desconto_valor
  FROM os
  WHERE id = p_os_id;

  -- Calculate discount in R$
  IF v_desconto_tipo = 'percentual' AND v_desconto_valor > 0 THEN
    v_valor_desconto := ROUND(v_subtotal * (v_desconto_valor / 100), 2);
  ELSIF v_desconto_tipo = 'valor' AND v_desconto_valor > 0 THEN
    v_valor_desconto := v_desconto_valor;
  ELSE
    v_valor_desconto := 0;
  END IF;

  -- Calculate final value
  v_valor_total := GREATEST(v_subtotal - v_valor_desconto, 0);

  -- Calculate paid value
  SELECT COALESCE(SUM(valor), 0)
  INTO v_valor_pago
  FROM pagamentos
  WHERE os_id = p_os_id;

  -- Determine status
  IF v_valor_pago = 0 THEN
    v_status_pagamento := 'pendente'::status_pagamento_enum;
  ELSIF v_valor_pago >= v_valor_total AND v_valor_total > 0 THEN
    v_status_pagamento := 'pago'::status_pagamento_enum;
  ELSIF v_valor_pago > 0 THEN
    v_status_pagamento := 'parcial'::status_pagamento_enum;
  ELSE
    v_status_pagamento := 'pendente'::status_pagamento_enum;
  END IF;

  -- Update OS
  UPDATE os
  SET
    valor_total = v_valor_total,
    valor_pago = v_valor_pago,
    saldo_restante = GREATEST(v_valor_total - v_valor_pago, 0),
    valor_desconto_calculado = v_valor_desconto,
    status_pagamento = v_status_pagamento,
    updated_at = NOW()
  WHERE id = p_os_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION atualizar_valores_os_direto IS 'Recalcula valores de uma OS sem depender de trigger (uso interno)';

-- ============================================================================
-- PARTE 4: FUNÇÃO PARA CORRIGIR TODAS AS OSs INCONSISTENTES
-- ============================================================================

CREATE OR REPLACE FUNCTION corrigir_todas_os_inconsistentes()
RETURNS TABLE(
  os_id uuid,
  numero_os text,
  status_antes text,
  status_depois text,
  valor_antes numeric,
  valor_depois numeric,
  corrigido boolean
) AS $$
DECLARE
  v_os record;
  v_resultado jsonb;
BEGIN
  FOR v_os IN
    SELECT id, numero_os_samsung
    FROM v_os_inconsistencias
    WHERE status_validacao != 'OK'
    ORDER BY divergencia_valor DESC
  LOOP
    -- Executar correção
    SELECT validar_e_corrigir_valores_os(v_os.id) INTO v_resultado;

    -- Retornar resultado
    RETURN QUERY
    SELECT
      v_os.id,
      v_os.numero_os_samsung,
      (v_resultado->'antes'->>'status_pagamento')::text,
      (v_resultado->'depois'->>'status_pagamento')::text,
      (v_resultado->'antes'->>'valor_total')::numeric,
      (v_resultado->'depois'->>'valor_total')::numeric,
      (v_resultado->>'foi_corrigido')::boolean;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION corrigir_todas_os_inconsistentes IS 'Corrige automaticamente todas as OSs com inconsistências identificadas';

-- ============================================================================
-- PARTE 5: EXECUTAR CORREÇÕES
-- ============================================================================

-- Exibir OSs com problemas ANTES da correção
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'OSs COM INCONSISTÊNCIAS ANTES DA CORREÇÃO';
  RAISE NOTICE '========================================';
END $$;

SELECT
  numero_os_samsung,
  cliente_nome,
  valor_total,
  subtotal_real,
  divergencia_valor,
  status_validacao
FROM v_os_inconsistencias
WHERE status_validacao != 'OK'
ORDER BY divergencia_valor DESC;

-- EXECUTAR CORREÇÃO AUTOMÁTICA
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'EXECUTANDO CORREÇÕES...';
  RAISE NOTICE '========================================';
END $$;

-- Comentar a linha abaixo para apenas visualizar sem executar
-- SELECT * FROM corrigir_todas_os_inconsistentes();

-- OU executar manualmente OS por OS:
-- SELECT validar_e_corrigir_valores_os('c44c7beb-98d8-473c-8c01-d3f906845405');
-- SELECT validar_e_corrigir_valores_os('d93a89ae-3d6a-4dcb-a66e-d50cd5db0853');
-- SELECT validar_e_corrigir_valores_os('7e5a7980-b73d-4b2a-9d3e-9f2bacc5a8e1');
-- SELECT validar_e_corrigir_valores_os('4b4a803d-ce8d-46e6-824f-97504f26ad5b');

-- Forçar recálculo de TODAS as OSs dos últimos 90 dias (use com cuidado!)
-- DO $$
-- DECLARE
--   v_os record;
-- BEGIN
--   FOR v_os IN
--     SELECT DISTINCT os_id
--     FROM pagamentos
--     WHERE created_at > NOW() - INTERVAL '90 days'
--   LOOP
--     PERFORM atualizar_valores_os_direto(v_os.os_id);
--     RAISE NOTICE 'Recalculado: %', v_os.os_id;
--   END LOOP;
-- END $$;

-- ============================================================================
-- PARTE 6: VALIDAÇÃO FINAL
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VALIDAÇÃO FINAL';
  RAISE NOTICE '========================================';
END $$;

-- Estatísticas gerais
SELECT
  COUNT(*) as total_os,
  COUNT(*) FILTER (WHERE status_validacao = 'OK') as os_ok,
  COUNT(*) FILTER (WHERE status_validacao != 'OK') as os_com_problema,
  ROUND(AVG(divergencia_valor), 2) as divergencia_media
FROM v_os_inconsistencias;

-- OSs ainda com problemas (se houver)
SELECT
  'ATENÇÃO: Ainda existem ' || COUNT(*) || ' OSs com inconsistências!' as alerta
FROM v_os_inconsistencias
WHERE status_validacao != 'OK'
HAVING COUNT(*) > 0;

-- ============================================================================
-- QUERIES ÚTEIS PARA MONITORAMENTO CONTÍNUO
-- ============================================================================

/*
-- Ver todas as inconsistências
SELECT * FROM v_os_inconsistencias
WHERE status_validacao != 'OK'
ORDER BY divergencia_valor DESC;

-- Contar tipos de problemas
SELECT
  status_validacao,
  COUNT(*) as quantidade
FROM v_os_inconsistencias
GROUP BY status_validacao
ORDER BY quantidade DESC;

-- Ver OSs com pagamento mas sem orçamento
SELECT * FROM v_os_inconsistencias
WHERE status_validacao LIKE '%Pagamento sem orcamento%';

-- Forçar recálculo de uma OS específica
SELECT validar_e_corrigir_valores_os('UUID-DA-OS-AQUI');

-- Corrigir todas de uma vez (usar com cuidado!)
SELECT * FROM corrigir_todas_os_inconsistentes();
*/
