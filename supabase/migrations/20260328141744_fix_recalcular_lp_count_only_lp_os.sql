/*
  # Corrige função recalcular_lp_ow_unidade para contar apenas OS do tipo LP

  ## Problema
  A função contava TODAS as OS da unidade (meta_lp = total geral de OS),
  quando deveria contar apenas OS do tipo_os = 'LP'.

  ## Correção
  - meta_lp = total de OS LP do mês
  - realizado_lp = OS LP fechadas no mês
  - percentual = (lp_fechadas / total_lp) * 100
*/

CREATE OR REPLACE FUNCTION recalcular_lp_ow_unidade(
  p_unidade_id uuid,
  p_mes_referencia timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_os integer;
  v_os_fechadas integer;
  v_percentual numeric;
  v_pilar_id uuid;
  v_profissionais_front RECORD;
  v_profissionais_inside RECORD;
  v_estrelas_front integer;
  v_estrelas_inside integer;
BEGIN
  SELECT id INTO v_pilar_id
  FROM skywalker_pilares
  WHERE nome = 'LP/OW Unidade'
    AND (unidade_id = p_unidade_id OR unidade_id IS NULL)
    AND ativo = true
  LIMIT 1;

  IF v_pilar_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_total_os
  FROM os
  WHERE unidade_id = p_unidade_id
    AND tipo_os = 'LP'
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', p_mes_referencia)
    AND coluna_kanban IS NOT NULL;

  SELECT COUNT(*) INTO v_os_fechadas
  FROM os
  WHERE unidade_id = p_unidade_id
    AND tipo_os = 'LP'
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', p_mes_referencia)
    AND coluna_kanban = 'os_fechada';

  IF v_total_os > 0 THEN
    v_percentual := ROUND((v_os_fechadas::numeric / v_total_os::numeric) * 100, 2);
  ELSE
    v_percentual := 0;
  END IF;

  INSERT INTO skywalker_lp_unidade (
    id,
    unidade_id,
    mes_referencia,
    meta_lp,
    realizado_lp,
    observacao,
    lancado_por,
    created_at
  ) VALUES (
    gen_random_uuid(),
    p_unidade_id,
    DATE_TRUNC('month', p_mes_referencia)::date,
    v_total_os,
    v_os_fechadas,
    'Atualizado automaticamente pelo sistema',
    '00000000-0000-0000-0000-000000000001',
    NOW()
  )
  ON CONFLICT (unidade_id, mes_referencia)
  DO UPDATE SET
    meta_lp = v_total_os,
    realizado_lp = v_os_fechadas,
    observacao = 'Atualizado automaticamente pelo sistema em ' || NOW()::text;

  SELECT COALESCE(MAX(estrelas), 0) INTO v_estrelas_front
  FROM skywalker_regras_estrelas
  WHERE pilar_id = v_pilar_id
    AND time = 'Front Office'
    AND v_percentual >= valor_minimo
    AND v_percentual <= valor_maximo
    AND ativo = true;

  SELECT COALESCE(MAX(estrelas), 0) INTO v_estrelas_inside
  FROM skywalker_regras_estrelas
  WHERE pilar_id = v_pilar_id
    AND time = 'Inside Sales'
    AND v_percentual >= valor_minimo
    AND v_percentual <= valor_maximo
    AND ativo = true;

  FOR v_profissionais_front IN
    SELECT p.id as profissional_id
    FROM skywalker_profissionais p
    JOIN skywalker_times t ON t.id = p.time_id
    WHERE p.unidade_id = p_unidade_id
      AND t.codigo = 'front_office'
      AND p.ativo = true
  LOOP
    INSERT INTO skywalker_estrelas_mes (
      id,
      profissional_id,
      mes_referencia,
      pilar_id,
      valor_metrica,
      estrelas_conquistadas,
      calculado_em
    ) VALUES (
      gen_random_uuid(),
      v_profissionais_front.profissional_id,
      DATE_TRUNC('month', p_mes_referencia)::date,
      v_pilar_id,
      v_percentual,
      v_estrelas_front,
      NOW()
    )
    ON CONFLICT (profissional_id, mes_referencia, pilar_id)
    DO UPDATE SET
      valor_metrica = v_percentual,
      estrelas_conquistadas = v_estrelas_front,
      calculado_em = NOW();
  END LOOP;

  FOR v_profissionais_inside IN
    SELECT p.id as profissional_id
    FROM skywalker_profissionais p
    JOIN skywalker_times t ON t.id = p.time_id
    WHERE p.unidade_id = p_unidade_id
      AND t.codigo = 'inside_sales'
      AND p.ativo = true
  LOOP
    INSERT INTO skywalker_estrelas_mes (
      id,
      profissional_id,
      mes_referencia,
      pilar_id,
      valor_metrica,
      estrelas_conquistadas,
      calculado_em
    ) VALUES (
      gen_random_uuid(),
      v_profissionais_inside.profissional_id,
      DATE_TRUNC('month', p_mes_referencia)::date,
      v_pilar_id,
      v_percentual,
      v_estrelas_inside,
      NOW()
    )
    ON CONFLICT (profissional_id, mes_referencia, pilar_id)
    DO UPDATE SET
      valor_metrica = v_percentual,
      estrelas_conquistadas = v_estrelas_inside,
      calculado_em = NOW();
  END LOOP;

END;
$$;
