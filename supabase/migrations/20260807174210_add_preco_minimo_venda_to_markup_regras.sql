/*
# Add minimum selling price (trava) column to markup_regras

1. Modified Tables
   - `markup_regras`
     - Added `preco_minimo_venda` (numeric, nullable) — the floor/minimum selling price.
       When calculated price (cost × multiplier) is below this value, use this value instead.

2. Important Notes
   - This column implements the "trava" business rule: a guaranteed minimum selling price
     regardless of the markup calculation result.
   - NULL means no minimum price floor applies for that rule.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'markup_regras' AND column_name = 'preco_minimo_venda'
  ) THEN
    ALTER TABLE markup_regras ADD COLUMN preco_minimo_venda numeric;
  END IF;
END $$;
