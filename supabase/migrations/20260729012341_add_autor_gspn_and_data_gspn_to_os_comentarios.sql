/*
# Add autor_gspn and data_gspn columns to os_comentarios

1. Modified Tables
   - `os_comentarios`
     - `autor_gspn` (text, nullable) — name/code of who wrote the comment inside GSPN/Samsung
     - `data_gspn` (timestamptz, nullable) — actual date/time the comment was made in GSPN (differs from created_at which is import time)

2. Important Notes
   - These columns are nullable to support existing/old comments that were imported without this data.
   - data_gspn represents the REAL timestamp from Samsung's system, not when our system imported it.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'os_comentarios' AND column_name = 'autor_gspn') THEN
    ALTER TABLE os_comentarios ADD COLUMN autor_gspn text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'os_comentarios' AND column_name = 'data_gspn') THEN
    ALTER TABLE os_comentarios ADD COLUMN data_gspn timestamptz;
  END IF;
END $$;
