/*
  # Fix Servicos Codigo Column

  ## Changes Made
  
  1. Make codigo column nullable or add default
  2. Update codigo to be auto-generated if not provided
  3. Make descricao nullable (optional field)
  
  ## Notes
  - codigo is no longer required for service creation
  - If not provided, it will be auto-generated from nome
*/

-- Make codigo nullable
ALTER TABLE servicos ALTER COLUMN codigo DROP NOT NULL;

-- Make descricao nullable
ALTER TABLE servicos ALTER COLUMN descricao DROP NOT NULL;

-- Add default value for codigo based on a sequence or use nome as base
-- Update existing null codigo values
UPDATE servicos SET codigo = UPPER(SUBSTRING(nome, 1, 10)) WHERE codigo IS NULL;

-- Create function to auto-generate codigo if not provided
CREATE OR REPLACE FUNCTION generate_servico_codigo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := UPPER(SUBSTRING(REGEXP_REPLACE(NEW.nome, '[^a-zA-Z0-9]', '', 'g'), 1, 10)) || '_' || SUBSTRING(NEW.id::text, 1, 4);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate codigo
DROP TRIGGER IF EXISTS trigger_generate_servico_codigo ON servicos;
CREATE TRIGGER trigger_generate_servico_codigo
  BEFORE INSERT OR UPDATE ON servicos
  FOR EACH ROW
  EXECUTE FUNCTION generate_servico_codigo();
