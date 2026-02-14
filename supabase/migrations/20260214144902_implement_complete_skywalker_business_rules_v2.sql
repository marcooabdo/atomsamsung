/*
  # Implementar Regras de Negócio Completas do Skywalker

  1. Ajustes nos Níveis
    - Corrigir valores de bonus_valor (salário adicional):
      - Starter: R$ 0 (sem adicional)
      - Avançado: R$ 100
      - Elite: R$ 150
      - Líder Global: R$ 150

  2. Configuração de Bônus (Popular skywalker_bonus_config)
    - Percentuais de comissão sobre vendas Store+ e Care+
    - Para ambos os times: Front Office e Inside Sales
    - Requisitos mínimos de vendas Care+ por nível

  3. Adicionar Campos de Metas aos Níveis
    - Meta de vendas Store+ mensal
    - Meta de LP/OW percentual
    - Meta de avaliações GMB (unidade e individual)
    - Requisito de faltas

  4. Security
    - Manter RLS existentes
*/

-- =====================================================
-- 1. ADICIONAR CAMPOS DE METAS À TABELA NÍVEIS
-- =====================================================

DO $$
BEGIN
  -- Meta de vendas Store+ mensal
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skywalker_niveis' AND column_name = 'meta_vendas_store_mes'
  ) THEN
    ALTER TABLE skywalker_niveis ADD COLUMN meta_vendas_store_mes integer DEFAULT 0;
  END IF;

  -- Meta LP/OW percentual
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skywalker_niveis' AND column_name = 'meta_lp_ow_percentual'
  ) THEN
    ALTER TABLE skywalker_niveis ADD COLUMN meta_lp_ow_percentual numeric(5,2) DEFAULT 0;
  END IF;

  -- Meta de avaliações GMB - Unidade
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skywalker_niveis' AND column_name = 'meta_avaliacoes_unidade'
  ) THEN
    ALTER TABLE skywalker_niveis ADD COLUMN meta_avaliacoes_unidade integer DEFAULT 0;
  END IF;

  -- Meta de avaliações GMB - Individual
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skywalker_niveis' AND column_name = 'meta_avaliacoes_individual'
  ) THEN
    ALTER TABLE skywalker_niveis ADD COLUMN meta_avaliacoes_individual integer DEFAULT 0;
  END IF;

  -- Requisito de faltas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skywalker_niveis' AND column_name = 'max_faltas_injustificadas'
  ) THEN
    ALTER TABLE skywalker_niveis ADD COLUMN max_faltas_injustificadas integer DEFAULT 0;
  END IF;

  -- Requisito mínimo de vendas Care+ para receber bônus
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skywalker_niveis' AND column_name = 'min_vendas_care_bonus'
  ) THEN
    ALTER TABLE skywalker_niveis ADD COLUMN min_vendas_care_bonus integer DEFAULT 0;
  END IF;
END $$;

-- =====================================================
-- 2. ATUALIZAR VALORES DOS NÍVEIS EXISTENTES
-- =====================================================

-- Starter
UPDATE skywalker_niveis
SET 
  bonus_valor = 0,
  meta_vendas_store_mes = 6,
  meta_lp_ow_percentual = 80.00,
  meta_avaliacoes_unidade = 15,
  meta_avaliacoes_individual = 8,
  max_faltas_injustificadas = 0,
  min_vendas_care_bonus = 1
WHERE nome = 'Starter';

-- Avançado
UPDATE skywalker_niveis
SET 
  bonus_valor = 100,
  meta_vendas_store_mes = 8,
  meta_lp_ow_percentual = 90.00,
  meta_avaliacoes_unidade = 25,
  meta_avaliacoes_individual = 15,
  max_faltas_injustificadas = 0,
  min_vendas_care_bonus = 2
WHERE nome = 'Avançado';

-- Elite
UPDATE skywalker_niveis
SET 
  bonus_valor = 150,
  meta_vendas_store_mes = 12,
  meta_lp_ow_percentual = 100.00,
  meta_avaliacoes_unidade = 35,
  meta_avaliacoes_individual = 25,
  max_faltas_injustificadas = 0,
  min_vendas_care_bonus = 3
WHERE nome = 'Elite';

-- Líder Global
UPDATE skywalker_niveis
SET 
  bonus_valor = 150,
  meta_vendas_store_mes = 15,
  meta_lp_ow_percentual = 100.00,
  meta_avaliacoes_unidade = 0, -- Não tem meta específica, é por mérito
  meta_avaliacoes_individual = 0,
  max_faltas_injustificadas = 0,
  min_vendas_care_bonus = 4
WHERE nome = 'Líder Global';

-- =====================================================
-- 3. POPULAR CONFIGURAÇÃO DE BÔNUS (COMISSÕES)
-- =====================================================

-- Limpar configurações existentes
DELETE FROM skywalker_bonus_config;

-- Obter IDs dos níveis e popular configurações
DO $$
DECLARE
  v_starter_id uuid;
  v_avancado_id uuid;
  v_elite_id uuid;
  v_lider_id uuid;
  v_time text;
BEGIN
  -- Buscar IDs dos níveis
  SELECT id INTO v_starter_id FROM skywalker_niveis WHERE nome = 'Starter' LIMIT 1;
  SELECT id INTO v_avancado_id FROM skywalker_niveis WHERE nome = 'Avançado' LIMIT 1;
  SELECT id INTO v_elite_id FROM skywalker_niveis WHERE nome = 'Elite' LIMIT 1;
  SELECT id INTO v_lider_id FROM skywalker_niveis WHERE nome = 'Líder Global' LIMIT 1;

  -- Aplicar para ambos os times (Front Office e Inside Sales)
  FOREACH v_time IN ARRAY ARRAY['front_office', 'inside_sales'] LOOP
    
    -- ===== NÍVEL STARTER =====
    -- Store+ 1%
    INSERT INTO skywalker_bonus_config (nivel_id, time, tipo_venda, percentual_bonus, ativo)
    VALUES (v_starter_id, v_time, 'store_plus', 1.00, true);
    
    -- Care+ 4% (requisito: 1 venda)
    INSERT INTO skywalker_bonus_config (nivel_id, time, tipo_venda, percentual_bonus, ativo)
    VALUES (v_starter_id, v_time, 'care_plus', 4.00, true);

    -- ===== NÍVEL AVANÇADO =====
    -- Store+ 1.5%
    INSERT INTO skywalker_bonus_config (nivel_id, time, tipo_venda, percentual_bonus, ativo)
    VALUES (v_avancado_id, v_time, 'store_plus', 1.50, true);
    
    -- Care+ 8% (requisito: 2 vendas)
    INSERT INTO skywalker_bonus_config (nivel_id, time, tipo_venda, percentual_bonus, ativo)
    VALUES (v_avancado_id, v_time, 'care_plus', 8.00, true);

    -- ===== NÍVEL ELITE =====
    -- Store+ 2%
    INSERT INTO skywalker_bonus_config (nivel_id, time, tipo_venda, percentual_bonus, ativo)
    VALUES (v_elite_id, v_time, 'store_plus', 2.00, true);
    
    -- Care+ 10% (requisito: 3 vendas)
    INSERT INTO skywalker_bonus_config (nivel_id, time, tipo_venda, percentual_bonus, ativo)
    VALUES (v_elite_id, v_time, 'care_plus', 10.00, true);

    -- ===== NÍVEL LÍDER GLOBAL =====
    -- Store+ 2.5%
    INSERT INTO skywalker_bonus_config (nivel_id, time, tipo_venda, percentual_bonus, ativo)
    VALUES (v_lider_id, v_time, 'store_plus', 2.50, true);
    
    -- Care+ 15% (requisito: 4 vendas)
    INSERT INTO skywalker_bonus_config (nivel_id, time, tipo_venda, percentual_bonus, ativo)
    VALUES (v_lider_id, v_time, 'care_plus', 15.00, true);

  END LOOP;
END $$;

-- =====================================================
-- 4. CRIAR FUNÇÃO PARA CALCULAR BÔNUS DO VENDEDOR
-- =====================================================

CREATE OR REPLACE FUNCTION calcular_bonus_vendedor(
  p_profissional_id uuid,
  p_mes_referencia date
)
RETURNS TABLE (
  nivel_nome text,
  bonus_salario numeric,
  vendas_store_qtd integer,
  vendas_store_valor numeric,
  vendas_care_qtd integer,
  vendas_care_valor numeric,
  bonus_store numeric,
  bonus_care numeric,
  bonus_total numeric,
  percentual_store numeric,
  percentual_care numeric,
  requisito_care_atingido boolean
) AS $$
DECLARE
  v_nivel_id uuid;
  v_nivel_nome text;
  v_bonus_salario numeric;
  v_time text;
  v_percentual_store numeric;
  v_percentual_care numeric;
  v_min_vendas_care integer;
  v_vendas_store_qtd integer;
  v_vendas_store_valor numeric;
  v_vendas_care_qtd integer;
  v_vendas_care_valor numeric;
  v_bonus_store numeric;
  v_bonus_care numeric;
BEGIN
  -- Buscar nível atual e time do profissional
  SELECT 
    p.nivel_atual_id,
    n.nome,
    n.bonus_valor,
    n.min_vendas_care_bonus,
    t.nome
  INTO v_nivel_id, v_nivel_nome, v_bonus_salario, v_min_vendas_care, v_time
  FROM skywalker_profissionais p
  JOIN skywalker_niveis n ON n.id = p.nivel_atual_id
  LEFT JOIN skywalker_times t ON t.id = p.time_id
  WHERE p.id = p_profissional_id;

  -- Se não tiver time definido, usar front_office como padrão
  IF v_time IS NULL OR v_time = '' THEN
    v_time := 'front_office';
  ELSIF v_time ILIKE '%front%' OR v_time ILIKE '%fo%' THEN
    v_time := 'front_office';
  ELSIF v_time ILIKE '%inside%' OR v_time ILIKE '%is%' THEN
    v_time := 'inside_sales';
  ELSE
    v_time := 'front_office';
  END IF;

  -- Buscar percentuais de bônus
  SELECT percentual_bonus INTO v_percentual_store
  FROM skywalker_bonus_config
  WHERE nivel_id = v_nivel_id AND time = v_time AND tipo_venda = 'store_plus' AND ativo = true
  LIMIT 1;

  SELECT percentual_bonus INTO v_percentual_care
  FROM skywalker_bonus_config
  WHERE nivel_id = v_nivel_id AND time = v_time AND tipo_venda = 'care_plus' AND ativo = true
  LIMIT 1;

  -- Contar e somar vendas Store+
  SELECT COUNT(*), COALESCE(SUM(valor_venda), 0)
  INTO v_vendas_store_qtd, v_vendas_store_valor
  FROM skywalker_vendas_store
  WHERE profissional_id = p_profissional_id
    AND date_trunc('month', data_venda) = date_trunc('month', p_mes_referencia)
    AND status = 'enviado';

  -- Contar e somar vendas Care+
  SELECT COUNT(*), COALESCE(SUM(valor_venda), 0)
  INTO v_vendas_care_qtd, v_vendas_care_valor
  FROM skywalker_vendas_care
  WHERE profissional_id = p_profissional_id
    AND date_trunc('month', data_venda) = date_trunc('month', p_mes_referencia)
    AND status = 'ativo';

  -- Calcular bônus Store+
  v_bonus_store := v_vendas_store_valor * (COALESCE(v_percentual_store, 0) / 100);

  -- Calcular bônus Care+ (apenas se atingir requisito mínimo)
  IF v_vendas_care_qtd >= v_min_vendas_care THEN
    v_bonus_care := v_vendas_care_valor * (COALESCE(v_percentual_care, 0) / 100);
  ELSE
    v_bonus_care := 0;
  END IF;

  -- Retornar resultado
  RETURN QUERY SELECT
    v_nivel_nome,
    COALESCE(v_bonus_salario, 0),
    COALESCE(v_vendas_store_qtd, 0),
    COALESCE(v_vendas_store_valor, 0),
    COALESCE(v_vendas_care_qtd, 0),
    COALESCE(v_vendas_care_valor, 0),
    COALESCE(v_bonus_store, 0),
    COALESCE(v_bonus_care, 0),
    COALESCE(v_bonus_store, 0) + COALESCE(v_bonus_care, 0),
    COALESCE(v_percentual_store, 0),
    COALESCE(v_percentual_care, 0),
    v_vendas_care_qtd >= v_min_vendas_care;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. CRIAR VIEW PARA ELEGIBILIDADE DE PROMOÇÃO
-- =====================================================

CREATE OR REPLACE VIEW v_skywalker_elegibilidade AS
SELECT 
  p.id as profissional_id,
  p.usuario_id,
  u.nome as profissional_nome,
  n_atual.nome as nivel_atual,
  n_atual.ordem as ordem_atual,
  n_proximo.nome as proximo_nivel,
  n_proximo.ordem as ordem_proxima,
  
  -- Metas do próximo nível
  n_proximo.estrelas_necessarias as meta_estrelas,
  n_proximo.meses_consecutivos as meta_meses_consecutivos,
  n_proximo.meta_vendas_store_mes as meta_vendas_store,
  n_proximo.meta_lp_ow_percentual as meta_lp_ow,
  n_proximo.meta_avaliacoes_unidade as meta_avaliacoes_unidade,
  n_proximo.meta_avaliacoes_individual as meta_avaliacoes_individual,
  n_proximo.max_faltas_injustificadas as max_faltas,
  
  -- Status de elegibilidade (será calculado pela aplicação)
  true as pode_ser_promovido
FROM skywalker_profissionais p
JOIN usuarios u ON u.id = p.usuario_id
JOIN skywalker_niveis n_atual ON n_atual.id = p.nivel_atual_id
LEFT JOIN skywalker_niveis n_proximo ON n_proximo.ordem = n_atual.ordem + 1
WHERE p.ativo = true AND n_atual.ativo = true;

-- Comentários
COMMENT ON FUNCTION calcular_bonus_vendedor IS 'Calcula bônus total do vendedor (salário adicional + comissões Store+ e Care+) para um mês específico';
COMMENT ON VIEW v_skywalker_elegibilidade IS 'View para verificar elegibilidade de promoção de profissionais do Skywalker';
COMMENT ON COLUMN skywalker_niveis.bonus_valor IS 'Salário adicional em reais (R$) para o nível';
COMMENT ON COLUMN skywalker_niveis.meta_vendas_store_mes IS 'Meta mensal de vendas Store+ para elegibilidade de promoção';
COMMENT ON COLUMN skywalker_niveis.meta_lp_ow_percentual IS 'Meta percentual de LP/OW da unidade para elegibilidade';
COMMENT ON COLUMN skywalker_niveis.meta_avaliacoes_unidade IS 'Meta de avaliações GMB da unidade';
COMMENT ON COLUMN skywalker_niveis.meta_avaliacoes_individual IS 'Meta de avaliações GMB individual';
COMMENT ON COLUMN skywalker_niveis.max_faltas_injustificadas IS 'Máximo de faltas injustificadas permitidas (geralmente 0)';
COMMENT ON COLUMN skywalker_niveis.min_vendas_care_bonus IS 'Número mínimo de vendas Care+ para receber bônus de comissão';
