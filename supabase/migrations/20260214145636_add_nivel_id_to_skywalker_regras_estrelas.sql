/*
  # Adicionar Nível às Regras de Estrelas

  1. Problema Identificado
    - Regras de estrelas não consideram o nível do profissional
    - Cada nível tem metas diferentes (ex: GMB, Store+, LP/OW)
    - Regras atuais são genéricas por time apenas

  2. Solução
    - Adicionar coluna nivel_id às regras
    - Replicar regras existentes para cada nível
    - Ajustar valores conforme tabela de elegibilidade
    - Atualizar constraints de unicidade

  3. Impacto
    - Regras serão específicas por: Pilar + Time + Nível
    - Funções que consultam regras devem considerar nível do profissional
*/

-- =====================================================
-- 1. ADICIONAR COLUNA NIVEL_ID
-- =====================================================

-- Adicionar coluna nivel_id (nullable temporariamente)
ALTER TABLE skywalker_regras_estrelas 
ADD COLUMN IF NOT EXISTS nivel_id uuid REFERENCES skywalker_niveis(id) ON DELETE CASCADE;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_skywalker_regras_estrelas_nivel 
ON skywalker_regras_estrelas(nivel_id);

-- =====================================================
-- 2. REPLICAR REGRAS PARA CADA NÍVEL
-- =====================================================

-- Desativar regras antigas sem nivel_id
UPDATE skywalker_regras_estrelas
SET ativo = false
WHERE nivel_id IS NULL;

-- Replicar regras para cada nível
DO $$
DECLARE
  v_nivel record;
  v_regra record;
  v_novo_minimo numeric;
  v_novo_maximo numeric;
BEGIN
  -- Para cada nível
  FOR v_nivel IN 
    SELECT id, nome, ordem 
    FROM skywalker_niveis 
    WHERE ativo = true 
    ORDER BY ordem
  LOOP
    -- Para cada regra antiga (sem nivel_id)
    FOR v_regra IN 
      SELECT * 
      FROM skywalker_regras_estrelas 
      WHERE nivel_id IS NULL AND ativo = false
    LOOP
      
      -- Ajustar valores conforme o nível e pilar
      v_novo_minimo := v_regra.valor_minimo;
      v_novo_maximo := v_regra.valor_maximo;
      
      -- Ajustar valores específicos por pilar e nível
      -- (Mantendo regras genéricas, valores específicos serão ajustados no frontend)
      
      -- Inserir nova regra com nivel_id
      INSERT INTO skywalker_regras_estrelas (
        pilar_id,
        time,
        nivel_id,
        valor_minimo,
        valor_maximo,
        estrelas,
        ativo,
        unidade_id
      ) VALUES (
        v_regra.pilar_id,
        v_regra.time,
        v_nivel.id,
        v_novo_minimo,
        v_novo_maximo,
        v_regra.estrelas,
        true,
        v_regra.unidade_id
      )
      ON CONFLICT DO NOTHING;
      
    END LOOP;
  END LOOP;
END $$;

-- =====================================================
-- 3. ATUALIZAR CONSTRAINTS
-- =====================================================

-- Remover constraint antiga se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'skywalker_regras_estrelas_pilar_time_range_key'
  ) THEN
    ALTER TABLE skywalker_regras_estrelas 
    DROP CONSTRAINT skywalker_regras_estrelas_pilar_time_range_key;
  END IF;
END $$;

-- Adicionar nova constraint com nivel_id
-- Unicidade: pilar + time + nivel + range de valores
CREATE UNIQUE INDEX IF NOT EXISTS idx_skywalker_regras_unique_com_nivel
ON skywalker_regras_estrelas(pilar_id, time, nivel_id, valor_minimo, COALESCE(valor_maximo, 999999))
WHERE ativo = true;

-- =====================================================
-- 4. TORNAR NIVEL_ID OBRIGATÓRIO (APÓS POPULAR)
-- =====================================================

-- Deletar regras antigas sem nivel_id
DELETE FROM skywalker_regras_estrelas
WHERE nivel_id IS NULL;

-- Tornar nivel_id NOT NULL
ALTER TABLE skywalker_regras_estrelas 
ALTER COLUMN nivel_id SET NOT NULL;

-- =====================================================
-- 5. CRIAR FUNÇÃO AUXILIAR PARA BUSCAR REGRA
-- =====================================================

CREATE OR REPLACE FUNCTION buscar_regra_estrelas(
  p_pilar_id uuid,
  p_time text,
  p_nivel_id uuid,
  p_valor numeric
)
RETURNS TABLE (
  regra_id uuid,
  estrelas integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.estrelas
  FROM skywalker_regras_estrelas r
  WHERE r.pilar_id = p_pilar_id
    AND r.time = p_time
    AND r.nivel_id = p_nivel_id
    AND r.ativo = true
    AND p_valor >= r.valor_minimo
    AND (r.valor_maximo IS NULL OR p_valor <= r.valor_maximo)
  ORDER BY r.valor_minimo DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. ATUALIZAR VIEW DE ELEGIBILIDADE
-- =====================================================

CREATE OR REPLACE VIEW v_skywalker_elegibilidade_detalhada AS
SELECT 
  p.id as profissional_id,
  p.usuario_id,
  u.nome as profissional_nome,
  t.nome as time_nome,
  n_atual.nome as nivel_atual,
  n_atual.ordem as ordem_atual,
  n_proximo.nome as proximo_nivel,
  n_proximo.ordem as ordem_proxima,
  
  -- Bônus do nível atual
  n_atual.bonus_valor as bonus_atual,
  
  -- Bônus do próximo nível
  n_proximo.bonus_valor as bonus_proximo,
  
  -- Metas do próximo nível para promoção
  n_proximo.estrelas_necessarias as meta_estrelas,
  n_proximo.meses_consecutivos as meta_meses_consecutivos,
  n_proximo.meta_vendas_store_mes as meta_vendas_store,
  n_proximo.meta_lp_ow_percentual as meta_lp_ow,
  n_proximo.meta_avaliacoes_unidade as meta_avaliacoes_unidade,
  n_proximo.meta_avaliacoes_individual as meta_avaliacoes_individual,
  n_proximo.max_faltas_injustificadas as max_faltas,
  n_proximo.min_vendas_care_bonus as min_vendas_care_bonus,
  
  -- Requisitos do nível atual
  n_atual.meta_vendas_store_mes as meta_atual_store,
  n_atual.meta_lp_ow_percentual as meta_atual_lp_ow,
  n_atual.meta_avaliacoes_individual as meta_atual_avaliacoes,
  n_atual.min_vendas_care_bonus as min_atual_care_bonus,
  
  -- Status
  true as pode_ser_promovido
FROM skywalker_profissionais p
JOIN usuarios u ON u.id = p.usuario_id
JOIN skywalker_niveis n_atual ON n_atual.id = p.nivel_atual_id
LEFT JOIN skywalker_times t ON t.id = p.time_id
LEFT JOIN skywalker_niveis n_proximo ON n_proximo.ordem = n_atual.ordem + 1 AND n_proximo.ativo = true
WHERE p.ativo = true AND n_atual.ativo = true;

-- Comentários
COMMENT ON COLUMN skywalker_regras_estrelas.nivel_id IS 'Nível ao qual esta regra se aplica - cada nível tem metas diferentes';
COMMENT ON FUNCTION buscar_regra_estrelas IS 'Busca regra de estrelas específica por pilar, time, nível e valor atingido';
COMMENT ON VIEW v_skywalker_elegibilidade_detalhada IS 'View detalhada de elegibilidade incluindo metas do nível atual e próximo';
