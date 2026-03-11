/*
  # Add 'interno' flag to atom_connect_conversas

  1. Modified Tables
    - `atom_connect_conversas`
      - `is_interno` (boolean, default false) - Marks conversation as internal (employees).
        Internal conversations are excluded from all metrics, SLA tracking, and GIA auto-responses.

  2. Important Notes
    - Existing conversations default to false (not internal)
    - This flag is used by the frontend and metrics RPC to filter out internal conversations
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'is_interno'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN is_interno boolean NOT NULL DEFAULT false;
  END IF;
END $$;
