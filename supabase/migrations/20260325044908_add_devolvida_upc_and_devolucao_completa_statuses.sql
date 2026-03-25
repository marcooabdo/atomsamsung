/*
  # Add devolvida_upc and devolucao_completa statuses to estoque_pecas

  1. Changes
    - Rename status 'usada_upc' to 'devolvida_upc' (peças usadas devolvidas)
    - Add new status 'devolucao_completa' (devolução finalizada)
    - Update check constraint to include new statuses
    - Create trigger to auto-set 'devolucao_completa' when:
      - For devolvida_nova/devolvida_defeito: data_retorno_credito is filled
      - For devolvida_upc: data_coleta_transportadora is filled

  2. Modified Tables
    - estoque_pecas: updated status check constraint, renamed usada_upc rows to devolvida_upc

  3. Security
    - No RLS changes needed
*/

-- Step 1: Update existing usada_upc rows to devolvida_upc
UPDATE estoque_pecas SET status = 'devolvida_upc' WHERE status = 'usada_upc';

-- Step 2: Drop old check constraint and add new one with both old and new values
ALTER TABLE estoque_pecas DROP CONSTRAINT IF EXISTS estoque_pecas_status_check;

ALTER TABLE estoque_pecas ADD CONSTRAINT estoque_pecas_status_check CHECK (
  status IN (
    'disponivel', 'reservada', 'vinculada_tecnico', 'em_rota',
    'em_uso', 'usada', 'devolucao_pendente',
    'devolvida_nova', 'devolvida_defeito', 'devolvida_samsung',
    'usada_upc', 'devolvida_upc', 'devolucao_completa', 'arquivada'
  )
);

-- Step 3: Create trigger function for auto devolucao_completa
CREATE OR REPLACE FUNCTION auto_devolucao_completa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- For devolvida_nova or devolvida_defeito: complete when credit date is filled
  IF NEW.status IN ('devolvida_nova', 'devolvida_defeito', 'devolvida_samsung')
    AND NEW.data_retorno_credito IS NOT NULL
    AND (OLD.data_retorno_credito IS NULL OR OLD.data_retorno_credito IS DISTINCT FROM NEW.data_retorno_credito)
  THEN
    NEW.status := 'devolucao_completa';
  END IF;

  -- For devolvida_upc (usada): complete when coleta date is filled
  IF NEW.status IN ('devolvida_upc', 'usada_upc')
    AND NEW.data_coleta_transportadora IS NOT NULL
    AND (OLD.data_coleta_transportadora IS NULL OR OLD.data_coleta_transportadora IS DISTINCT FROM NEW.data_coleta_transportadora)
  THEN
    NEW.status := 'devolucao_completa';
  END IF;

  RETURN NEW;
END;
$$;

-- Step 4: Create the trigger (before update so we can modify NEW)
DROP TRIGGER IF EXISTS trg_auto_devolucao_completa ON estoque_pecas;
CREATE TRIGGER trg_auto_devolucao_completa
  BEFORE UPDATE ON estoque_pecas
  FOR EACH ROW
  EXECUTE FUNCTION auto_devolucao_completa();
