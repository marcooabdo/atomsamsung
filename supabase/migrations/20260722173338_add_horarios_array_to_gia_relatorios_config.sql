/*
# Add multiple schedule times to GIA reports

1. Modified Tables
- `gia_relatorios_config`:
  - Add `horarios` (text[]) - array of scheduled times (e.g. ['07:30', '14:00', '18:00'])
  - Populate from existing `horario` column

2. Notes
- Keeps existing `horario` column for backward compatibility
- `horarios` allows multiple send times per day per report
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gia_relatorios_config' AND column_name = 'horarios'
  ) THEN
    ALTER TABLE gia_relatorios_config ADD COLUMN horarios text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;

-- Populate horarios from existing horario column where horarios is empty
UPDATE gia_relatorios_config
SET horarios = ARRAY[horario]
WHERE horarios = ARRAY[]::text[] OR horarios IS NULL;
