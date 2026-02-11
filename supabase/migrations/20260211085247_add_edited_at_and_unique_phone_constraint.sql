/*
  # Add edited_at column and unique phone constraint

  1. Changes
    - Add `edited_at` column to `atom_connect_mensagens` table for message editing tracking
    - Add unique constraint on `cliente_telefone` + `unidade_id` in `atom_connect_conversas` to prevent duplicate conversations

  2. Notes
    - The edited_at column will be null for messages that were never edited
    - The unique constraint ensures only one conversation per phone number per unit
*/

-- Add edited_at column to mensagens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_mensagens' AND column_name = 'edited_at'
  ) THEN
    ALTER TABLE atom_connect_mensagens ADD COLUMN edited_at timestamptz NULL;
  END IF;
END $$;

-- Add unique constraint to prevent duplicate phone numbers in same unit
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'atom_connect_conversas_telefone_unidade_unique'
  ) THEN
    ALTER TABLE atom_connect_conversas
    ADD CONSTRAINT atom_connect_conversas_telefone_unidade_unique
    UNIQUE (cliente_telefone, unidade_id);
  END IF;
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Duplicate phone numbers exist, skipping constraint creation';
END $$;
