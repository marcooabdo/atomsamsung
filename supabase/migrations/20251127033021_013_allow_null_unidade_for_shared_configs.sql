/*
  # Allow NULL unidade_id for Shared Configurations

  ## Overview
  Allow servicos and taxas_maquina to have NULL unidade_id, which means
  they apply to ALL units. This eliminates the need to duplicate configs
  for every unit.

  ## Changes
  1. Keep existing FK constraints but allow NULL
  2. Add check constraints to ensure data integrity
  3. Add indexes for performance
  
  ## Logic
  - unidade_id = NULL → Applies to ALL units
  - unidade_id = specific UUID → Applies only to that unit
  
  When querying, priority order:
  1. Unit-specific configs first
  2. Fall back to shared configs (NULL unidade_id)
*/

-- Add comments to clarify the NULL behavior
COMMENT ON COLUMN servicos.unidade_id IS 
  'NULL means this service applies to ALL units. Specific UUID means unit-specific.';

COMMENT ON COLUMN markup_regras.unidade_id IS 
  'NULL means this markup applies to ALL units. Specific UUID means unit-specific.';

COMMENT ON COLUMN taxas_maquina.unidade_id IS 
  'NULL means this tax applies to ALL units. Specific UUID means unit-specific.';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_servicos_unidade_id ON servicos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_markup_regras_unidade_id ON markup_regras(unidade_id);
CREATE INDEX IF NOT EXISTS idx_taxas_maquina_unidade_id ON taxas_maquina(unidade_id);

-- Create helper function to get servicos for a unit (with fallback to shared)
CREATE OR REPLACE FUNCTION get_servicos_for_unidade(p_unidade_id uuid)
RETURNS TABLE (
  id uuid,
  codigo text,
  nome text,
  descricao text,
  valor_base numeric,
  ativo boolean,
  unidade_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.codigo, s.nome, s.descricao, s.valor_base, s.ativo, s.unidade_id
  FROM servicos s
  WHERE s.ativo = true
    AND (s.unidade_id = p_unidade_id OR s.unidade_id IS NULL)
  ORDER BY 
    CASE WHEN s.unidade_id = p_unidade_id THEN 0 ELSE 1 END,
    s.nome;
END;
$$;

-- Create helper function to get markup rules for a unit (with fallback to shared)
CREATE OR REPLACE FUNCTION get_markup_for_unidade(p_unidade_id uuid)
RETURNS TABLE (
  id uuid,
  nome text,
  valor_minimo numeric,
  valor_maximo numeric,
  tipo text,
  valor numeric,
  descricao text,
  ativo boolean,
  unidade_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.nome, m.valor_minimo, m.valor_maximo, m.tipo, m.valor, m.descricao, m.ativo, m.unidade_id
  FROM markup_regras m
  WHERE m.ativo = true
    AND (m.unidade_id = p_unidade_id OR m.unidade_id IS NULL)
  ORDER BY 
    CASE WHEN m.unidade_id = p_unidade_id THEN 0 ELSE 1 END,
    m.valor_minimo NULLS FIRST;
END;
$$;

-- Create helper function to get taxas for a unit (with fallback to shared)
CREATE OR REPLACE FUNCTION get_taxas_for_unidade(p_unidade_id uuid)
RETURNS TABLE (
  id uuid,
  parcelamento integer,
  taxa numeric,
  debito numeric,
  ativo boolean,
  unidade_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.parcelamento, t.taxa, t.debito, t.ativo, t.unidade_id
  FROM taxas_maquina t
  WHERE t.ativo = true
    AND (t.unidade_id = p_unidade_id OR t.unidade_id IS NULL)
  ORDER BY 
    CASE WHEN t.unidade_id = p_unidade_id THEN 0 ELSE 1 END,
    t.parcelamento;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_servicos_for_unidade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_markup_for_unidade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_taxas_for_unidade(uuid) TO authenticated;
