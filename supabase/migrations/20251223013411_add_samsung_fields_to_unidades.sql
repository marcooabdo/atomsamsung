/*
  # Add Samsung GSPN Configuration to Unidades

  1. Changes
    - Add `samsung_asccode` column to store Samsung ASC code
    - Add `samsung_token` column to store Samsung API token
    - These fields allow each unit to have its own Samsung GSPN integration config
  
  2. Notes
    - Both fields are optional (nullable) since not all units may use Samsung integration
    - Sensitive token data should be handled securely
*/

-- Add Samsung GSPN configuration fields to unidades table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unidades' AND column_name = 'samsung_asccode'
  ) THEN
    ALTER TABLE unidades ADD COLUMN samsung_asccode text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unidades' AND column_name = 'samsung_token'
  ) THEN
    ALTER TABLE unidades ADD COLUMN samsung_token text;
  END IF;
END $$;