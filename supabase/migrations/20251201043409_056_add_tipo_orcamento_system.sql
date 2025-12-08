/*
  # Add Tipo de Orçamento System

  1. Changes
    - Add `tipo_orcamento` column to `os` table (only for OW type)
    - Add `tipo_orcamento` column to `cotacoes` table
    - Add `tipo_orcamento` column to `markup_regras` table
    - Create triggers to sync tipo_orcamento between OS and Cotacao
    - Update RPC function for markup calculation
    - Create logs for tipo_orcamento changes

  2. Tipo Options
    - 'normal': Orçamento Normal
    - 'acessorios': Acessórios
    - 'samsung_contigo': Samsung Contigo

  3. Rules
    - OS LP: tipo_orcamento must be NULL
    - OS OW: tipo_orcamento must be NOT NULL
    - Markup rules are now per unidade + tipo_orcamento
*/

-- Add tipo_orcamento to os table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'tipo_orcamento'
  ) THEN
    ALTER TABLE os ADD COLUMN tipo_orcamento text CHECK (tipo_orcamento IN ('normal', 'acessorios', 'samsung_contigo'));
  END IF;
END $$;

-- Add constraint: OW must have tipo_orcamento, LP must not
ALTER TABLE os DROP CONSTRAINT IF EXISTS os_tipo_orcamento_check;
ALTER TABLE os ADD CONSTRAINT os_tipo_orcamento_check CHECK (
  (tipo_os = 'OW' AND tipo_orcamento IS NOT NULL) OR
  (tipo_os = 'LP' AND tipo_orcamento IS NULL)
);

-- Add tipo_orcamento to cotacoes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cotacoes' AND column_name = 'tipo_orcamento'
  ) THEN
    ALTER TABLE cotacoes ADD COLUMN tipo_orcamento text CHECK (tipo_orcamento IN ('normal', 'acessorios', 'samsung_contigo'));
  END IF;
END $$;

-- Add tipo_orcamento to markup_regras (required field)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'markup_regras' AND column_name = 'tipo_orcamento'
  ) THEN
    ALTER TABLE markup_regras ADD COLUMN tipo_orcamento text NOT NULL DEFAULT 'normal' CHECK (tipo_orcamento IN ('normal', 'acessorios', 'samsung_contigo'));
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_markup_regras_unidade_tipo 
ON markup_regras(unidade_id, tipo_orcamento, valor_minimo, valor_maximo) 
WHERE ativo = true;

-- Update existing OS OW to have tipo_orcamento = 'normal'
UPDATE os
SET tipo_orcamento = 'normal'
WHERE tipo_os = 'OW' AND tipo_orcamento IS NULL;

-- Sync tipo_orcamento to existing cotacoes (OS has cotacao_id referencing cotacoes)
UPDATE cotacoes c
SET tipo_orcamento = o.tipo_orcamento
FROM os o
WHERE o.cotacao_id = c.id
  AND o.tipo_orcamento IS NOT NULL
  AND c.tipo_orcamento IS NULL;

-- Function to sync tipo_orcamento from OS to Cotacao
CREATE OR REPLACE FUNCTION sync_tipo_orcamento_to_cotacao()
RETURNS TRIGGER AS $$
BEGIN
  -- When OS tipo_orcamento is set/changed, update cotacao if exists
  IF NEW.tipo_orcamento IS DISTINCT FROM OLD.tipo_orcamento AND NEW.cotacao_id IS NOT NULL THEN
    UPDATE cotacoes
    SET tipo_orcamento = NEW.tipo_orcamento
    WHERE id = NEW.cotacao_id;
    
    -- Log the change
    IF OLD.tipo_orcamento IS NOT NULL AND NEW.tipo_orcamento IS NOT NULL THEN
      INSERT INTO os_comentarios (os_id, usuario_id, comentario, is_system)
      VALUES (
        NEW.id,
        auth.uid(),
        '🔄 Tipo de orçamento alterado: ' || OLD.tipo_orcamento || ' → ' || NEW.tipo_orcamento,
        true
      );
    ELSIF NEW.tipo_orcamento IS NOT NULL THEN
      INSERT INTO os_comentarios (os_id, usuario_id, comentario, is_system)
      VALUES (
        NEW.id,
        auth.uid(),
        '🏷️ Tipo de orçamento definido: ' || NEW.tipo_orcamento,
        true
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for OS updates
DROP TRIGGER IF EXISTS trigger_sync_tipo_orcamento ON os;
CREATE TRIGGER trigger_sync_tipo_orcamento
  AFTER UPDATE OF tipo_orcamento
  ON os
  FOR EACH ROW
  EXECUTE FUNCTION sync_tipo_orcamento_to_cotacao();

-- Function to sync tipo_orcamento from Cotacao to OS when cotacao is created
CREATE OR REPLACE FUNCTION sync_tipo_orcamento_from_cotacao()
RETURNS TRIGGER AS $$
BEGIN
  -- When cotacao is created/updated and linked to OS, sync tipo
  IF NEW.tipo_orcamento IS NOT NULL THEN
    UPDATE os
    SET tipo_orcamento = NEW.tipo_orcamento
    WHERE cotacao_id = NEW.id
      AND tipo_orcamento IS DISTINCT FROM NEW.tipo_orcamento;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for cotacao creation/update
DROP TRIGGER IF EXISTS trigger_sync_tipo_orcamento_from_cotacao ON cotacoes;
CREATE TRIGGER trigger_sync_tipo_orcamento_from_cotacao
  AFTER INSERT OR UPDATE OF tipo_orcamento
  ON cotacoes
  FOR EACH ROW
  EXECUTE FUNCTION sync_tipo_orcamento_from_cotacao();

-- Update RPC function to get markup with tipo_orcamento filter
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
  descricao text
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
    m.descricao
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_markup_for_unidade_and_tipo TO authenticated;
