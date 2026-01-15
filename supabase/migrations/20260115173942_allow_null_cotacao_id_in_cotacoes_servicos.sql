/*
  # Allow NULL cotacao_id in cotacoes_servicos

  1. Problem
    - cotacao_id has NOT NULL constraint
    - Services can be added directly to OS (using os_id) without a cotacao
    - Error: "null value in column 'cotacao_id' violates not-null constraint"

  2. Solution
    - Remove NOT NULL constraint from cotacao_id
    - Add CHECK constraint to ensure at least one reference exists (cotacao_id OR os_id)
    
  3. Notes
    - Services must be linked to either a cotacao OR an OS
    - Both can be filled (service from cotacao moved to OS)
*/

-- Remove NOT NULL constraint from cotacao_id
ALTER TABLE cotacoes_servicos ALTER COLUMN cotacao_id DROP NOT NULL;

-- Add check constraint to ensure at least one reference exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cotacoes_servicos_reference_check'
  ) THEN
    ALTER TABLE cotacoes_servicos 
    ADD CONSTRAINT cotacoes_servicos_reference_check 
    CHECK (cotacao_id IS NOT NULL OR os_id IS NOT NULL);
  END IF;
END $$;