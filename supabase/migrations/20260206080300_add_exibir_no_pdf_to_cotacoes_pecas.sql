/*
  # Add exibir_no_pdf to cotacoes_pecas

  1. Modified Tables
    - `cotacoes_pecas` - Added `exibir_no_pdf` (boolean, default true)

  2. Purpose
    - Consistent with os_pecas toggle for PDF visibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cotacoes_pecas' AND column_name = 'exibir_no_pdf'
  ) THEN
    ALTER TABLE cotacoes_pecas ADD COLUMN exibir_no_pdf boolean DEFAULT true;
  END IF;
END $$;
