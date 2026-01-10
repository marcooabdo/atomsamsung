/*
  # Add is_gspn field to cotacoes_pecas

  1. Changes:
    - Add is_gspn boolean field to cotacoes_pecas
    - Default to false for manual parts
    - GSPN parts should be marked as true

  2. Reasoning:
    - Need to identify parts that come from Samsung GSPN API
    - GSPN parts should not be deletable (no trash icon)
    - GSPN parts can be edited (price can be changed)
    - Visual indicator helps users understand the source
*/

-- Add is_gspn field if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cotacoes_pecas' AND column_name = 'is_gspn'
  ) THEN
    ALTER TABLE cotacoes_pecas ADD COLUMN is_gspn boolean DEFAULT false;
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_cotacoes_pecas_is_gspn ON cotacoes_pecas(is_gspn);
