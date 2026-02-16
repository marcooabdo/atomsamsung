/*
  # Fix recalcular_lp_ow_unidade function signature
  
  1. Changes
    - Change p_mes_referencia parameter from date to timestamptz
    - This allows the trigger to call it with NEW.created_at directly
    - No change in logic, just type compatibility
*/

-- Drop and recreate the function with correct signature
DROP FUNCTION IF EXISTS recalcular_lp_ow_unidade(uuid, date);

CREATE OR REPLACE FUNCTION recalcular_lp_ow_unidade(
  p_unidade_id uuid,
  p_mes_referencia timestamptz
) RETURNS void AS $$
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
  -- Buscar o pilar LP/OW Unidade
  SELECT id INTO v_pilar_id
  FROM skywalker_pilares
  WHERE nome = 'LP/OW Unidade'
    AND (unidade_id = p_unidade_id OR unidade_id IS NULL)
    AND ativo = true
  LIMIT 1;

  -- Se não encontrou o pilar, sair
  IF v_pilar_id IS NULL THEN
    RETURN;
  END IF;

  -- Contar total de OSs da unidade no mês
  SELECT COUNT(*) INTO v_total_os
  FROM os
  WHERE unidade_id = p_unidade_id
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', p_mes_referencia)
    AND coluna_kanban IS NOT NULL;

  -- Contar OSs fechadas
  SELECT COUNT(*) INTO v_os_fechadas
  FROM os
  WHERE unidade_id = p_unidade_id
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', p_mes_referencia)
    AND coluna_kanban = 'os_fechada';

  -- Calcular percentual manualmente para usar nas estrelas
  IF v_total_os > 0 THEN
    v_percentual := ROUND((v_os_fechadas::numeric / v_total_os::numeric) * 100, 2);
  ELSE
    v_percentual := 0;
  END IF;

  -- Atualizar ou inserir na tabela skywalker_lp_unidade
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

  -- Buscar quantas estrelas cada time ganha com esse percentual
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

  -- Distribuir estrelas para profissionais do Front Office
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

  -- Distribuir estrelas para profissionais do Inside Sales
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
$$ LANGUAGE plpgsql SECURITY DEFINER;