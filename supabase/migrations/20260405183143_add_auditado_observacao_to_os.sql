/*
  # Add audit observation field to OS

  1. Modified Tables
    - `os`
      - `auditado_observacao` (text) - Free-text observation for the auditor (e.g. refused quote, no repair, etc.)

  2. Notes
    - Used by ATOM AUDIT module for per-OS notes
    - Nullable, only filled when auditor adds a note
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'auditado_observacao'
  ) THEN
    ALTER TABLE os ADD COLUMN auditado_observacao text;
  END IF;
END $$;
