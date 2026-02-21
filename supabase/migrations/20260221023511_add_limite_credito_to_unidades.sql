/*
  # Add limite_credito_gspn to unidades

  ## Summary
  Adds a numeric column to store the GSPN credit limit per unit.
  This value is used by the GSPN Credit Dashboard to calculate
  how much of the credit limit is consumed by active parts.

  ## Changes
  - `unidades.limite_credito_gspn` (numeric, nullable) — the configured
    credit ceiling in BRL for Samsung GSPN parts at this unit
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unidades' AND column_name = 'limite_credito_gspn'
  ) THEN
    ALTER TABLE unidades ADD COLUMN limite_credito_gspn numeric DEFAULT NULL;
  END IF;
END $$;
