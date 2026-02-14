/*
  # Sistema Automático de LP/OW Unidade para Skywalker

  1. Funcionalidades
    - Contabiliza automaticamente OSs abertas e fechadas por unidade
    - Calcula percentual de fechamento (Meta LP/OW)
    - Atualiza skywalker_lp_unidade automaticamente
    - Distribui estrelas para todos os profissionais da unidade
    
  2. Triggers
    - Monitora mudanças em coluna_kanban de OS
    - Recalcula quando OS muda para 'os_fechada'
    - Recalcula quando OS é deletada
    
  3. Lógica
    - Meta LP: Total de OSs da unidade no mês
    - Realizado LP: OSs com coluna_kanban = 'os_fechada'
    - Percentual: Calculado automaticamente pela coluna generated
    - Estrelas baseadas nas regras configuradas em skywalker_regras_estrelas
*/

-- Função para recalcular LP/OW de uma unidade em um mês específico
CREATE OR REPLACE FUNCTION recalcular_lp_ow_unidade(
  p_unidade_id uuid,
  p_mes_referencia date
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
    AND coluna_kanban IS NOT NULL; -- Só conta OSs que entraram no Kanban

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
  -- Nota: percentual_atingido é calculado automaticamente
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
    '00000000-0000-0000-0000-000000000001', -- ID do usuário SYSTEM
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

-- Trigger para recalcular quando OS muda de status
CREATE OR REPLACE FUNCTION trigger_recalcular_lp_ow() 
RETURNS TRIGGER AS $$
BEGIN
  -- Recalcular para a unidade e mês da OS
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM recalcular_lp_ow_unidade(NEW.unidade_id, NEW.created_at);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM recalcular_lp_ow_unidade(OLD.unidade_id, OLD.created_at);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger na tabela OS
DROP TRIGGER IF EXISTS trigger_os_update_lp_ow ON os;
CREATE TRIGGER trigger_os_update_lp_ow
  AFTER INSERT OR UPDATE OF coluna_kanban OR DELETE ON os
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalcular_lp_ow();

-- Criar índice único na tabela skywalker_lp_unidade para evitar duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_skywalker_lp_unidade_unique 
  ON skywalker_lp_unidade (unidade_id, mes_referencia);

-- Adicionar constraint UNIQUE se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'skywalker_lp_unidade_unidade_mes_unique'
  ) THEN
    ALTER TABLE skywalker_lp_unidade
      ADD CONSTRAINT skywalker_lp_unidade_unidade_mes_unique 
      UNIQUE (unidade_id, mes_referencia);
  END IF;
END $$;

-- Processar dados históricos (últimos 3 meses)
DO $$
DECLARE
  v_unidade RECORD;
  v_mes date;
BEGIN
  -- Para cada unidade
  FOR v_unidade IN 
    SELECT DISTINCT id FROM unidades WHERE ativa = true
  LOOP
    -- Processar últimos 3 meses
    FOR v_mes IN
      SELECT DISTINCT DATE_TRUNC('month', created_at)::date as mes
      FROM os
      WHERE unidade_id = v_unidade.id
        AND created_at >= DATE_TRUNC('month', NOW() - INTERVAL '3 months')
      ORDER BY mes DESC
    LOOP
      PERFORM recalcular_lp_ow_unidade(v_unidade.id, v_mes);
    END LOOP;
  END LOOP;
END $$;
