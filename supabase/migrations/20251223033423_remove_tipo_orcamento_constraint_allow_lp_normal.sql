/*
  # Remove tipo_orcamento constraint to allow LP with normal budget

  1. Changes
    - Removes the constraint that forces LP to have NULL tipo_orcamento
    - Allows both LP and OW to have tipo_orcamento = 'normal'
  
  2. Reasoning
    - Samsung OS can be both LP (In Warranty) and OW (Out of Warranty)
    - All Samsung OS should have tipo_orcamento = 'normal' regardless of warranty status
*/

-- Drop the existing constraint that prevents LP from having tipo_orcamento
ALTER TABLE os DROP CONSTRAINT IF EXISTS os_tipo_orcamento_check;

-- Add new constraint that allows tipo_orcamento for both OW and LP
ALTER TABLE os ADD CONSTRAINT os_tipo_orcamento_check 
  CHECK (
    (tipo_os = 'OW' AND tipo_orcamento IS NOT NULL) OR
    (tipo_os = 'LP' AND tipo_orcamento IS NOT NULL) OR
    (tipo_os NOT IN ('OW', 'LP'))
  );
