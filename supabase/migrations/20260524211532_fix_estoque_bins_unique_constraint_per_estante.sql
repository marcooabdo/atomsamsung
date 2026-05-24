/*
  # Fix estoque_bins unique constraint to be scoped per estante

  ## Problem
  The `estoque_bins` table had a UNIQUE constraint on `codigo` globally across the entire
  table. This meant bin codes like "A1", "A2", "B1", etc. could only exist once in the
  whole database. Creating a second shelf would fail with a duplicate key error because
  every shelf uses the same coordinate codes (A1-D6, etc.).

  ## Solution
  - Drop the global unique constraint on `codigo`
  - Add a composite unique constraint on `(estante_id, codigo)` so bin codes only need
    to be unique within the same shelf

  ## Impact
  - Creating new shelves now works correctly
  - Each shelf can have its own A1, B2, etc. bins independently
  - Existing data is unaffected (the old single global constraint was already broken
    by any second shelf created, so existing duplicates may need no cleanup)
*/

-- Drop the global unique constraint on codigo
ALTER TABLE estoque_bins DROP CONSTRAINT IF EXISTS estoque_bins_codigo_key;

-- Add a composite unique constraint: codigo must be unique per estante only
ALTER TABLE estoque_bins ADD CONSTRAINT estoque_bins_estante_codigo_unique UNIQUE (estante_id, codigo);
