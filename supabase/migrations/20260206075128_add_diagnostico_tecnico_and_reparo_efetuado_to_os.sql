/*
  # Add diagnostico_tecnico and reparo_efetuado to OS table

  1. New Columns
    - `os.diagnostico_tecnico` (text) - Stores the last technical analysis/diagnostic
    - `os.reparo_efetuado` (text) - Stores the repair description when OS moves to OQC

  2. Purpose
    - diagnostico_tecnico: Automatically populated when technician completes analysis (moves from DIAGNOSTICO)
    - reparo_efetuado: Automatically populated when OS moves to OQC (Controle de Qualidade)
    - Both are also logged as comments for audit trail
    - Always stores the latest value (overwritten on subsequent updates)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'diagnostico_tecnico'
  ) THEN
    ALTER TABLE os ADD COLUMN diagnostico_tecnico text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'reparo_efetuado'
  ) THEN
    ALTER TABLE os ADD COLUMN reparo_efetuado text;
  END IF;
END $$;
