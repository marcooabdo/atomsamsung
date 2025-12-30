/*
  # Add numero_tecnico field to usuarios table

  1. Changes
    - Add `numero_tecnico` column to usuarios table (nullable text field)
    - This field stores the technician number for Samsung API integration
    - Used to match Samsung Engineer field with internal users
*/

-- Add numero_tecnico column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'numero_tecnico'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN numero_tecnico text;
  END IF;
END $$;
