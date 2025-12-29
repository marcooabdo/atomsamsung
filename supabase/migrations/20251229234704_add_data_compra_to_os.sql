/*
  # Add data_compra to OS table

  1. Changes
    - Add `data_compra` (text) - Purchase date of the device from Samsung
*/

-- Add data_compra column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'os' AND column_name = 'data_compra'
  ) THEN
    ALTER TABLE os ADD COLUMN data_compra text;
  END IF;
END $$;