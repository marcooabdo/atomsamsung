/*
# Add meta_media_id column to atom_connect_mensagens

1. Modified Tables
   - `atom_connect_mensagens`: Added `meta_media_id` (text, nullable) to store
     the Meta Graph API media ID for Cloud API media downloads and retries.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_mensagens' AND column_name = 'meta_media_id'
  ) THEN
    ALTER TABLE atom_connect_mensagens ADD COLUMN meta_media_id text;
  END IF;
END $$;