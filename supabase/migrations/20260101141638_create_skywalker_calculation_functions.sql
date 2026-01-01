/*
  # Funções de Cálculo Automático do Skywalker

  1. Função para calcular estrelas de um profissional em um mês
  2. Função para recalcular todas as estrelas
  3. Função para verificar elegibilidade de promoção
*/

-- ====================
-- CALCULAR ESTRELAS DE UM PROFISSIONAL EM UM MÊS
-- ====================

CREATE OR REPLACE FUNCTION calcular_estrelas_profissional(
  p_profissional_id uuid,
  p_mes_referencia date
) RETURNS void AS $$
DECLARE
  v_time text;
  v_pilar record;
  v_valor_metrica numeric;
  v_estrelas integer;
BEGIN
  -- Pegar o time do profissional
  SELECT time INTO v_time
  FROM skywalker_profissionais
  WHERE id = p_profissional_id;

  -- Para cada pilar ativo aplicável ao time do profissional
  FOR v_pilar IN 
    SELECT p.id, p.nome, p.tipo_metrica
    FROM skywalker_pilares p
    WHERE p.ativo = true
      AND v_time = ANY(p.time_aplicavel)
    ORDER BY p.ordem
  LOOP
    v_valor_metrica := 0;
    v_estrelas := 0;

    -- Calcular o valor da métrica conforme o pilar
    CASE v_pilar.nome
      WHEN 'Google Reviews' THEN
        SELECT COALESCE(SUM(quantidade), 0) INTO v_valor_metrica
        FROM skywalker_google_reviews
        WHERE profissional_id = p_profissional_id
          AND mes_referencia = p_mes_referencia
          AND status = 'aprovado';

      WHEN 'Vendas Store+' THEN
        SELECT COALESCE(SUM(quantidade), 0) INTO v_valor_metrica
        FROM skywalker_vendas_store
        WHERE profissional_id = p_profissional_id
          AND mes_referencia = p_mes_referencia;

      WHEN 'Vendas Care+' THEN
        SELECT COALESCE(SUM(quantidade), 0) INTO v_valor_metrica
        FROM skywalker_vendas_care
        WHERE profissional_id = p_profissional_id
          AND mes_referencia = p_mes_referencia;

      WHEN 'Instalações ADMS' THEN
        SELECT COALESCE(SUM(quantidade), 0) INTO v_valor_metrica
        FROM skywalker_instalacoes
        WHERE profissional_id = p_profissional_id
          AND mes_referencia = p_mes_referencia;

      WHEN 'Conversão' THEN
        SELECT COALESCE(AVG(taxa_conversao), 0) INTO v_valor_metrica
        FROM skywalker_conversoes
        WHERE profissional_id = p_profissional_id
          AND mes_referencia = p_mes_referencia;

      WHEN 'Participação/Cultura' THEN
        -- Calcular pontuação de participação (positivos menos negativos)
        SELECT COALESCE(
          SUM(CASE 
            WHEN impacto = 'positivo' THEN quantidade
            WHEN impacto = 'negativo' THEN -quantidade
            ELSE 0
          END), 0
        ) INTO v_valor_metrica
        FROM skywalker_participacao
        WHERE profissional_id = p_profissional_id
          AND mes_referencia = p_mes_referencia;

      WHEN 'LP/OW Unidade' THEN
        -- Pegar percentual atingido da unidade
        SELECT COALESCE(lp.percentual_atingido, 0) INTO v_valor_metrica
        FROM skywalker_lp_unidade lp
        JOIN skywalker_profissionais sp ON sp.unidade_id = lp.unidade_id
        WHERE sp.id = p_profissional_id
          AND lp.mes_referencia = p_mes_referencia;

      ELSE
        v_valor_metrica := 0;
    END CASE;

    -- Calcular estrelas com base nas regras
    SELECT COALESCE(MAX(r.estrelas), 0) INTO v_estrelas
    FROM skywalker_regras_estrelas r
    WHERE r.pilar_id = v_pilar.id
      AND r.time = v_time
      AND r.ativo = true
      AND v_valor_metrica >= r.valor_minimo
      AND (r.valor_maximo IS NULL OR v_valor_metrica <= r.valor_maximo);

    -- Inserir ou atualizar estrelas do mês
    INSERT INTO skywalker_estrelas_mes (
      profissional_id,
      mes_referencia,
      pilar_id,
      valor_metrica,
      estrelas_conquistadas,
      calculado_em
    ) VALUES (
      p_profissional_id,
      p_mes_referencia,
      v_pilar.id,
      v_valor_metrica,
      v_estrelas,
      now()
    )
    ON CONFLICT (profissional_id, mes_referencia, pilar_id)
    DO UPDATE SET
      valor_metrica = EXCLUDED.valor_metrica,
      estrelas_conquistadas = EXCLUDED.estrelas_conquistadas,
      calculado_em = EXCLUDED.calculado_em;

  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ====================
-- RECALCULAR TODAS AS ESTRELAS DE UM MÊS
-- ====================

CREATE OR REPLACE FUNCTION recalcular_estrelas_mes(
  p_mes_referencia date
) RETURNS integer AS $$
DECLARE
  v_profissional record;
  v_count integer := 0;
BEGIN
  FOR v_profissional IN 
    SELECT id FROM skywalker_profissionais WHERE ativo = true
  LOOP
    PERFORM calcular_estrelas_profissional(v_profissional.id, p_mes_referencia);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ====================
-- VERIFICAR ELEGIBILIDADE PARA PROMOÇÃO
-- ====================

CREATE OR REPLACE FUNCTION verificar_elegibilidade_promocao(
  p_profissional_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_nivel_atual record;
  v_estrelas_mes record;
  v_meses_validos integer := 0;
  v_total_estrelas integer;
  v_pode_subir boolean := false;
  v_proximo_nivel record;
  v_travas jsonb := '[]'::jsonb;
  v_estrelas_google integer;
  v_estrelas_participacao integer;
BEGIN
  -- Pegar nível atual do profissional
  SELECT n.* INTO v_nivel_atual
  FROM skywalker_profissionais sp
  JOIN skywalker_niveis n ON n.id = sp.nivel_atual_id
  WHERE sp.id = p_profissional_id;

  -- Pegar próximo nível
  SELECT * INTO v_proximo_nivel
  FROM skywalker_niveis
  WHERE ordem = COALESCE(v_nivel_atual.ordem, 0) + 1
  AND ativo = true;

  IF v_proximo_nivel.id IS NULL THEN
    RETURN jsonb_build_object(
      'pode_subir', false,
      'motivo', 'Já está no nível máximo',
      'nivel_atual', v_nivel_atual.nome,
      'proximo_nivel', null
    );
  END IF;

  -- Verificar meses consecutivos válidos
  FOR v_estrelas_mes IN
    SELECT 
      mes_referencia,
      SUM(estrelas_conquistadas) as total_estrelas
    FROM skywalker_estrelas_mes
    WHERE profissional_id = p_profissional_id
      AND mes_referencia >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '12 months'
    GROUP BY mes_referencia
    ORDER BY mes_referencia DESC
  LOOP
    IF v_estrelas_mes.total_estrelas >= v_proximo_nivel.estrelas_necessarias THEN
      v_meses_validos := v_meses_validos + 1;
    ELSE
      EXIT; -- Quebrou a sequência
    END IF;
  END LOOP;

  -- Pegar estrelas do mês atual
  SELECT COALESCE(SUM(estrelas_conquistadas), 0) INTO v_total_estrelas
  FROM skywalker_estrelas_mes
  WHERE profissional_id = p_profissional_id
    AND mes_referencia = DATE_TRUNC('month', CURRENT_DATE);

  -- Verificar travas (Google e Participação devem ter pelo menos 1 estrela)
  SELECT COALESCE(estrelas_conquistadas, 0) INTO v_estrelas_google
  FROM skywalker_estrelas_mes sem
  JOIN skywalker_pilares sp ON sp.id = sem.pilar_id
  WHERE sem.profissional_id = p_profissional_id
    AND sem.mes_referencia = DATE_TRUNC('month', CURRENT_DATE)
    AND sp.nome = 'Google Reviews';

  SELECT COALESCE(estrelas_conquistadas, 0) INTO v_estrelas_participacao
  FROM skywalker_estrelas_mes sem
  JOIN skywalker_pilares sp ON sp.id = sem.pilar_id
  WHERE sem.profissional_id = p_profissional_id
    AND sem.mes_referencia = DATE_TRUNC('month', CURRENT_DATE)
    AND sp.nome = 'Participação/Cultura';

  IF v_estrelas_google < 1 THEN
    v_travas := v_travas || jsonb_build_object(
      'pilar', 'Google Reviews',
      'minimo', 1,
      'atual', v_estrelas_google
    );
  END IF;

  IF v_estrelas_participacao < 1 THEN
    v_travas := v_travas || jsonb_build_object(
      'pilar', 'Participação/Cultura',
      'minimo', 1,
      'atual', v_estrelas_participacao
    );
  END IF;

  -- Verificar se pode subir
  v_pode_subir := (
    v_meses_validos >= v_proximo_nivel.meses_consecutivos
    AND jsonb_array_length(v_travas) = 0
  );

  RETURN jsonb_build_object(
    'pode_subir', v_pode_subir,
    'nivel_atual', v_nivel_atual.nome,
    'proximo_nivel', v_proximo_nivel.nome,
    'estrelas_necessarias', v_proximo_nivel.estrelas_necessarias,
    'meses_necessarios', v_proximo_nivel.meses_consecutivos,
    'meses_validos', v_meses_validos,
    'estrelas_mes_atual', v_total_estrelas,
    'travas', v_travas
  );
END;
$$ LANGUAGE plpgsql;
