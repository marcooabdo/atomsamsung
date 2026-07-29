/*
# Add status_gspn and motivo_gspn columns to os_comentarios

1. Modified Tables
   - `os_comentarios`
     - `status_gspn` (text, nullable) — OS status description in GSPN at the time the comment was made
     - `motivo_gspn` (text, nullable) — reason/motive for the status at that time

2. Important Notes
   - These columns are nullable to support existing/old comments imported before this migration.
   - Used alongside autor_gspn and data_gspn (added in a previous migration) to provide full context of GSPN comments.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'os_comentarios' AND column_name = 'status_gspn') THEN
    ALTER TABLE os_comentarios ADD COLUMN status_gspn text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'os_comentarios' AND column_name = 'motivo_gspn') THEN
    ALTER TABLE os_comentarios ADD COLUMN motivo_gspn text;
  END IF;
END $$;
