/*
  # Add data_abertura_samsung and data_requisicao_samsung to OS table

  1. Changes
    - Add `data_abertura_samsung` (text) - Date the OS was opened in Samsung's system
    - Add `data_requisicao_samsung` (text) - Date the customer requested service in Samsung's system
*/

-- Add data_abertura_samsung column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'os' AND column_name = 'data_abertura_samsung'
  ) THEN
    ALTER TABLE os ADD COLUMN data_abertura_samsung text;
  END IF;
END $$;

-- Add data_requisicao_samsung column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'os' AND column_name = 'data_requisicao_samsung'
  ) THEN
    ALTER TABLE os ADD COLUMN data_requisicao_samsung text;
  END IF;
END $$;