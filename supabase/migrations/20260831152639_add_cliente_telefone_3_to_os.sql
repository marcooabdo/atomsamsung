/*
# Add cliente_telefone_3 column to OS table

1. Modified Tables
   - `os`: Added `cliente_telefone_3` (text, nullable) - Third phone number for the client

2. Notes
   - Follows the same pattern as `cliente_telefone_2`
   - No RLS changes needed (existing OS policies cover all columns)
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'cliente_telefone_3'
  ) THEN
    ALTER TABLE os ADD COLUMN cliente_telefone_3 text;
  END IF;
END $$;
