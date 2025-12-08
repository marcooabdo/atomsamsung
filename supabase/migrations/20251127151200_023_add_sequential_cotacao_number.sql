/*
  # Add Sequential Cotacao Number Format

  1. Changes
    - Create function to generate sequential cotacao numbers in format COT-01, COT-02, etc
    - Add trigger to auto-generate cotacao number on insert
    - Backfill existing cotacoes with new format

  2. Security
    - Maintain existing RLS policies
    - Function is security definer to work with RLS
*/

-- Function to generate next cotacao number
CREATE OR REPLACE FUNCTION gerar_numero_cotacao()
RETURNS TEXT AS $$
DECLARE
  proximo_numero INTEGER;
  novo_numero TEXT;
BEGIN
  -- Get the highest number from existing cotacoes
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(numero_cotacao FROM 'COT-(\d+)')
        AS INTEGER
      )
    ),
    0
  ) + 1
  INTO proximo_numero
  FROM cotacoes
  WHERE numero_cotacao ~ '^COT-\d+$';

  -- Format as COT-XX (with leading zeros for numbers < 10)
  novo_numero := 'COT-' || LPAD(proximo_numero::TEXT, 2, '0');
  
  RETURN novo_numero;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger to use new function
CREATE OR REPLACE FUNCTION set_cotacao_numero()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if numero_cotacao is not provided or is a UUID
  IF NEW.numero_cotacao IS NULL OR NEW.numero_cotacao ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    NEW.numero_cotacao := gerar_numero_cotacao();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_set_cotacao_numero ON cotacoes;

-- Create trigger
CREATE TRIGGER trigger_set_cotacao_numero
  BEFORE INSERT ON cotacoes
  FOR EACH ROW
  EXECUTE FUNCTION set_cotacao_numero();

-- Backfill existing cotacoes with new format (only if they look like UUIDs)
DO $$
DECLARE
  cotacao_record RECORD;
  contador INTEGER := 1;
BEGIN
  FOR cotacao_record IN 
    SELECT id 
    FROM cotacoes 
    WHERE numero_cotacao ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ORDER BY created_at
  LOOP
    UPDATE cotacoes 
    SET numero_cotacao = 'COT-' || LPAD(contador::TEXT, 2, '0')
    WHERE id = cotacao_record.id;
    
    contador := contador + 1;
  END LOOP;
END $$;
