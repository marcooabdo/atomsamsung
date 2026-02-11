/*
  # Add typing status fields to atom_connect_conversas

  1. New Columns
    - `cliente_digitando` (text, nullable) - Stores typing status: 'typing', 'recording', or null
    - `cliente_digitando_at` (timestamptz, nullable) - When the status was last updated

  2. Purpose
    - Show real-time typing/recording indicator in chat
    - Status is ephemeral and cleared when message is sent
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'cliente_digitando'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN cliente_digitando text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'cliente_digitando_at'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN cliente_digitando_at timestamptz;
  END IF;
END $$;
