/*
  # Add fields to track budget approval state
  
  1. New Columns
    - `valor_quando_aprovado` - The total value when budget was approved
    - `versao_quando_aprovado` - The budget version when approved
    
  2. Purpose
    - Track if budget was modified after approval
    - If valor_total != valor_quando_aprovado OR versao_orcamento != versao_quando_aprovado
      then budget needs re-approval
*/

ALTER TABLE os ADD COLUMN IF NOT EXISTS valor_quando_aprovado numeric;
ALTER TABLE os ADD COLUMN IF NOT EXISTS versao_quando_aprovado integer;

COMMENT ON COLUMN os.valor_quando_aprovado IS 'Total value at the time of budget approval';
COMMENT ON COLUMN os.versao_quando_aprovado IS 'Budget version at the time of approval';
