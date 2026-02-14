/*
  # Criar RPC para Buscar Regras do Profissional

  1. Funcionalidade
    - Retorna as regras de estrelas aplicáveis a um profissional específico
    - Considera o nível atual e time do profissional
    - Facilita o frontend a mostrar as metas corretas

  2. Uso
    - SELECT * FROM get_regras_profissional('uuid-do-profissional')
*/

-- Função para buscar regras aplicáveis ao profissional
CREATE OR REPLACE FUNCTION get_regras_profissional(p_profissional_id uuid)
RETURNS TABLE (
  pilar_id uuid,
  pilar_nome text,
  time_nome text,
  nivel_nome text,
  valor_minimo numeric,
  valor_maximo numeric,
  estrelas integer,
  descricao text
) AS $$
DECLARE
  v_nivel_id uuid;
  v_time text;
BEGIN
  -- Buscar nível e time do profissional
  SELECT 
    p.nivel_atual_id,
    CASE
      WHEN t.nome ILIKE '%front%' OR t.nome ILIKE '%fo%' THEN 'front_office'
      WHEN t.nome ILIKE '%inside%' OR t.nome ILIKE '%is%' THEN 'inside_sales'
      ELSE 'front_office'
    END
  INTO v_nivel_id, v_time
  FROM skywalker_profissionais p
  LEFT JOIN skywalker_times t ON t.id = p.time_id
  WHERE p.id = p_profissional_id;

  -- Se não encontrou o profissional, retornar vazio
  IF v_nivel_id IS NULL THEN
    RETURN;
  END IF;

  -- Retornar regras aplicáveis
  RETURN QUERY
  SELECT 
    r.pilar_id,
    pi.nome as pilar_nome,
    r.time as time_nome,
    n.nome as nivel_nome,
    r.valor_minimo,
    r.valor_maximo,
    r.estrelas,
    CASE
      WHEN r.valor_maximo IS NULL THEN 
        format('%s ou mais = %s estrela(s)', r.valor_minimo, r.estrelas)
      ELSE
        format('%s a %s = %s estrela(s)', r.valor_minimo, r.valor_maximo, r.estrelas)
    END as descricao
  FROM skywalker_regras_estrelas r
  JOIN skywalker_pilares pi ON pi.id = r.pilar_id
  JOIN skywalker_niveis n ON n.id = r.nivel_id
  WHERE r.nivel_id = v_nivel_id
    AND r.time = v_time
    AND r.ativo = true
  ORDER BY pi.nome, r.valor_minimo;
END;
$$ LANGUAGE plpgsql;

-- Função para buscar metas de promoção do profissional
CREATE OR REPLACE FUNCTION get_metas_promocao(p_profissional_id uuid)
RETURNS TABLE (
  nivel_atual text,
  proximo_nivel text,
  meta_estrelas integer,
  meta_meses_consecutivos integer,
  meta_vendas_store_mes integer,
  meta_lp_ow_percentual numeric,
  meta_avaliacoes_unidade integer,
  meta_avaliacoes_individual integer,
  max_faltas integer,
  min_vendas_care_bonus integer,
  bonus_atual numeric,
  bonus_proximo numeric,
  pode_promover boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n_atual.nome,
    n_proximo.nome,
    n_proximo.estrelas_necessarias,
    n_proximo.meses_consecutivos,
    n_proximo.meta_vendas_store_mes,
    n_proximo.meta_lp_ow_percentual,
    n_proximo.meta_avaliacoes_unidade,
    n_proximo.meta_avaliacoes_individual,
    n_proximo.max_faltas_injustificadas,
    n_proximo.min_vendas_care_bonus,
    n_atual.bonus_valor,
    n_proximo.bonus_valor,
    n_proximo.id IS NOT NULL
  FROM skywalker_profissionais p
  JOIN skywalker_niveis n_atual ON n_atual.id = p.nivel_atual_id
  LEFT JOIN skywalker_niveis n_proximo 
    ON n_proximo.ordem = n_atual.ordem + 1 
    AND n_proximo.ativo = true
  WHERE p.id = p_profissional_id
    AND p.ativo = true;
END;
$$ LANGUAGE plpgsql;

-- Comentários
COMMENT ON FUNCTION get_regras_profissional IS 'Retorna todas as regras de estrelas aplicáveis ao profissional com base em seu nível e time';
COMMENT ON FUNCTION get_metas_promocao IS 'Retorna as metas necessárias para o profissional ser promovido ao próximo nível';
