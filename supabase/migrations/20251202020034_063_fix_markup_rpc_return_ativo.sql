/*
  # Fix Markup RPC to Return 'ativo' Field

  1. Problem
    - RPC function get_markup_for_unidade_and_tipo filters by ativo = true
    - But doesn't return the 'ativo' column
    - JavaScript code checks m.ativo which is undefined
    - This breaks markup application logic

  2. Solution
    - Drop and recreate function with 'ativo' in return type
    - Add 'ativo' to RETURNS TABLE definition
    - Add m.ativo to SELECT statement
    - Now JavaScript will have access to ativo field

  3. Impact
    - Markup calculation will work correctly
    - GSPN values will be multiplied by configured markup
*/

-- Drop existing function
DROP FUNCTION IF EXISTS get_markup_for_unidade_and_tipo(uuid, text, numeric);

-- Recreate with ativo field
CREATE OR REPLACE FUNCTION get_markup_for_unidade_and_tipo(
  p_unidade_id uuid,
  p_tipo_orcamento text,
  p_valor numeric DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  nome text,
  valor_minimo numeric,
  valor_maximo numeric,
  tipo text,
  valor numeric,
  descricao text,
  ativo boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.nome,
    m.valor_minimo,
    m.valor_maximo,
    m.tipo,
    m.valor,
    m.descricao,
    m.ativo
  FROM markup_regras m
  WHERE m.ativo = true
    AND (m.unidade_id = p_unidade_id OR m.unidade_id IS NULL)
    AND m.tipo_orcamento = p_tipo_orcamento
    AND (
      p_valor IS NULL OR
      (
        (m.valor_minimo IS NULL OR p_valor >= m.valor_minimo) AND
        (m.valor_maximo IS NULL OR p_valor < m.valor_maximo)
      )
    )
  ORDER BY 
    CASE WHEN m.unidade_id IS NULL THEN 1 ELSE 0 END,
    m.valor_minimo NULLS FIRST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_markup_for_unidade_and_tipo TO authenticated;
