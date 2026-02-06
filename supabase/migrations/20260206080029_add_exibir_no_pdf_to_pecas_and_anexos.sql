/*
  # Add exibir_no_pdf toggle to os_pecas and os_anexos

  1. Modified Tables
    - `os_pecas` - Added `exibir_no_pdf` (boolean, default true)
    - `os_anexos` - Added `exibir_no_pdf` (boolean, default false)

  2. Purpose
    - Allows users to control which parts appear in the printed OS PDF
    - Returned parts (devolvidas) default to showing but can be toggled off
    - Attachments default to NOT showing in PDF but can be toggled on
    - Only image attachments (fotos) should typically be toggled on for PDF
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os_pecas' AND column_name = 'exibir_no_pdf'
  ) THEN
    ALTER TABLE os_pecas ADD COLUMN exibir_no_pdf boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os_anexos' AND column_name = 'exibir_no_pdf'
  ) THEN
    ALTER TABLE os_anexos ADD COLUMN exibir_no_pdf boolean DEFAULT false;
  END IF;
END $$;
