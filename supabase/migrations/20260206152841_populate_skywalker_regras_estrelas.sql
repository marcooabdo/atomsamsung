/*
  # Populate Skywalker Star Rules

  Inserts default star rules into `skywalker_regras_estrelas` based on the
  existing hardcoded values in the system:

  1. Google Reviews (both teams)
    - 1-2 reviews = 1 star, 3-4 = 2 stars, 5+ = 3 stars

  2. Vendas Store+ (both teams)
    - 4-7 units = 1 star, 8-11 = 2 stars, 12+ = 3 stars

  3. Vendas Care+ (both teams)
    - 1-3 units = 1 star, 4+ = 2 stars

  4. Instalacoes ADMS (front_office only)
    - 2-4 = 1 star, 5-7 = 2 stars, 8+ = 3 stars

  5. Conversao (inside_sales only)
    - 30-49% = 1 star, 50-69% = 2 stars, 70%+ = 3 stars

  6. Participacao/Cultura (both teams)
    - 1-2 points = 1 star, 3+ = 2 stars

  7. LP/OW Unidade (both teams)
    - 80-89% = 1 star, 90-99% = 2 stars, 100%+ = 3 stars

  Also updates max_estrelas on pilares to match the rule maximums.
*/

DO $$
DECLARE
  v_pilar_google uuid;
  v_pilar_store uuid;
  v_pilar_care uuid;
  v_pilar_instalacoes uuid;
  v_pilar_conversao uuid;
  v_pilar_participacao uuid;
  v_pilar_lp uuid;
BEGIN
  SELECT id INTO v_pilar_google FROM skywalker_pilares WHERE nome = 'Google Reviews' LIMIT 1;
  SELECT id INTO v_pilar_store FROM skywalker_pilares WHERE nome = 'Vendas Store+' LIMIT 1;
  SELECT id INTO v_pilar_care FROM skywalker_pilares WHERE nome = 'Vendas Care+' LIMIT 1;
  SELECT id INTO v_pilar_instalacoes FROM skywalker_pilares WHERE nome = 'Instalacoes ADMS' LIMIT 1;
  SELECT id INTO v_pilar_conversao FROM skywalker_pilares WHERE nome = 'Conversao' LIMIT 1;
  SELECT id INTO v_pilar_participacao FROM skywalker_pilares WHERE nome ILIKE 'Participacao%' LIMIT 1;
  SELECT id INTO v_pilar_lp FROM skywalker_pilares WHERE nome ILIKE 'LP%' LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM skywalker_regras_estrelas LIMIT 1) THEN

    -- Google Reviews (both teams): 1-2 → 1★, 3-4 → 2★, 5+ → 3★
    IF v_pilar_google IS NOT NULL THEN
      INSERT INTO skywalker_regras_estrelas (pilar_id, time, valor_minimo, valor_maximo, estrelas) VALUES
        (v_pilar_google, 'front_office', 1, 2, 1),
        (v_pilar_google, 'front_office', 3, 4, 2),
        (v_pilar_google, 'front_office', 5, NULL, 3),
        (v_pilar_google, 'inside_sales', 1, 2, 1),
        (v_pilar_google, 'inside_sales', 3, 4, 2),
        (v_pilar_google, 'inside_sales', 5, NULL, 3);
    END IF;

    -- Vendas Store+ (both teams): 4-7 → 1★, 8-11 → 2★, 12+ → 3★
    IF v_pilar_store IS NOT NULL THEN
      INSERT INTO skywalker_regras_estrelas (pilar_id, time, valor_minimo, valor_maximo, estrelas) VALUES
        (v_pilar_store, 'front_office', 4, 7, 1),
        (v_pilar_store, 'front_office', 8, 11, 2),
        (v_pilar_store, 'front_office', 12, NULL, 3),
        (v_pilar_store, 'inside_sales', 4, 7, 1),
        (v_pilar_store, 'inside_sales', 8, 11, 2),
        (v_pilar_store, 'inside_sales', 12, NULL, 3);
    END IF;

    -- Vendas Care+ (both teams): 1-3 → 1★, 4+ → 2★
    IF v_pilar_care IS NOT NULL THEN
      INSERT INTO skywalker_regras_estrelas (pilar_id, time, valor_minimo, valor_maximo, estrelas) VALUES
        (v_pilar_care, 'front_office', 1, 3, 1),
        (v_pilar_care, 'front_office', 4, NULL, 2),
        (v_pilar_care, 'inside_sales', 1, 3, 1),
        (v_pilar_care, 'inside_sales', 4, NULL, 2);
    END IF;

    -- Instalacoes ADMS (front_office only): 2-4 → 1★, 5-7 → 2★, 8+ → 3★
    IF v_pilar_instalacoes IS NOT NULL THEN
      INSERT INTO skywalker_regras_estrelas (pilar_id, time, valor_minimo, valor_maximo, estrelas) VALUES
        (v_pilar_instalacoes, 'front_office', 2, 4, 1),
        (v_pilar_instalacoes, 'front_office', 5, 7, 2),
        (v_pilar_instalacoes, 'front_office', 8, NULL, 3);
    END IF;

    -- Conversao (inside_sales only): 30-49% → 1★, 50-69% → 2★, 70%+ → 3★
    IF v_pilar_conversao IS NOT NULL THEN
      INSERT INTO skywalker_regras_estrelas (pilar_id, time, valor_minimo, valor_maximo, estrelas) VALUES
        (v_pilar_conversao, 'inside_sales', 30, 49.99, 1),
        (v_pilar_conversao, 'inside_sales', 50, 69.99, 2),
        (v_pilar_conversao, 'inside_sales', 70, NULL, 3);
    END IF;

    -- Participacao/Cultura (both teams): 1-2 → 1★, 3+ → 2★
    IF v_pilar_participacao IS NOT NULL THEN
      INSERT INTO skywalker_regras_estrelas (pilar_id, time, valor_minimo, valor_maximo, estrelas) VALUES
        (v_pilar_participacao, 'front_office', 1, 2, 1),
        (v_pilar_participacao, 'front_office', 3, NULL, 2),
        (v_pilar_participacao, 'inside_sales', 1, 2, 1),
        (v_pilar_participacao, 'inside_sales', 3, NULL, 2);
    END IF;

    -- LP/OW Unidade (both teams): 80-89% → 1★, 90-99% → 2★, 100%+ → 3★
    IF v_pilar_lp IS NOT NULL THEN
      INSERT INTO skywalker_regras_estrelas (pilar_id, time, valor_minimo, valor_maximo, estrelas) VALUES
        (v_pilar_lp, 'front_office', 80, 89.99, 1),
        (v_pilar_lp, 'front_office', 90, 99.99, 2),
        (v_pilar_lp, 'front_office', 100, NULL, 3),
        (v_pilar_lp, 'inside_sales', 80, 89.99, 1),
        (v_pilar_lp, 'inside_sales', 90, 99.99, 2),
        (v_pilar_lp, 'inside_sales', 100, NULL, 3);
    END IF;

  END IF;

  -- Update max_estrelas on pilares
  UPDATE skywalker_pilares SET max_estrelas = 3 WHERE nome = 'Google Reviews' AND (max_estrelas IS NULL OR max_estrelas = 0);
  UPDATE skywalker_pilares SET max_estrelas = 3 WHERE nome = 'Vendas Store+' AND (max_estrelas IS NULL OR max_estrelas = 0);
  UPDATE skywalker_pilares SET max_estrelas = 2 WHERE nome = 'Vendas Care+' AND (max_estrelas IS NULL OR max_estrelas = 0);
  UPDATE skywalker_pilares SET max_estrelas = 3 WHERE nome = 'Instalacoes ADMS' AND (max_estrelas IS NULL OR max_estrelas = 0);
  UPDATE skywalker_pilares SET max_estrelas = 3 WHERE nome = 'Conversao' AND (max_estrelas IS NULL OR max_estrelas = 0);
  UPDATE skywalker_pilares SET max_estrelas = 2 WHERE nome ILIKE 'Participacao%' AND (max_estrelas IS NULL OR max_estrelas = 0);
  UPDATE skywalker_pilares SET max_estrelas = 3 WHERE nome ILIKE 'LP%' AND (max_estrelas IS NULL OR max_estrelas = 0);

END $$;
