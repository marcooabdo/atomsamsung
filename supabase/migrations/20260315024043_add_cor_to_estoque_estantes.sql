/*
  # Add cor column to estoque_estantes

  Adds a `cor` (color) column to the `estoque_estantes` table to support
  color-coding of shelving units in the warehouse map editor.

  ## Changes
  - `estoque_estantes`: new column `cor` (text, default '#39FF14')
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_estantes' AND column_name = 'cor'
  ) THEN
    ALTER TABLE estoque_estantes ADD COLUMN cor text DEFAULT '#39FF14';
  END IF;
END $$;
