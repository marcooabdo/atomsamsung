/*
  # Add WhatsApp and OS fields to gia_mural_tarefas

  ## Summary
  Adds metadata columns to support:
  - WhatsApp integration: phone number to open the conversation directly
  - OS linkage: link the task to a specific OS (service order)
  - Source tracking: identify if the task came from CONNECT/WhatsApp channel

  ## New Columns
  - `whatsapp_phone` (text, nullable) — phone number for direct WhatsApp link
  - `os_id` (uuid, nullable) — FK to `os` table (service order linked to this task)
  - `os_numero` (text, nullable) — denormalized OS number for quick display without join
  - `gia_source` (text, nullable) — source channel e.g. 'CONNECT', 'GIA', 'MANUAL'
  - `metadata` (jsonb, nullable) — flexible extra data for future use

  ## Notes
  - All columns are nullable for backwards compatibility
  - No breaking changes to existing data
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gia_mural_tarefas' AND column_name = 'whatsapp_phone'
  ) THEN
    ALTER TABLE gia_mural_tarefas ADD COLUMN whatsapp_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gia_mural_tarefas' AND column_name = 'os_id'
  ) THEN
    ALTER TABLE gia_mural_tarefas ADD COLUMN os_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gia_mural_tarefas' AND column_name = 'os_numero'
  ) THEN
    ALTER TABLE gia_mural_tarefas ADD COLUMN os_numero text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gia_mural_tarefas' AND column_name = 'gia_source'
  ) THEN
    ALTER TABLE gia_mural_tarefas ADD COLUMN gia_source text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gia_mural_tarefas' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE gia_mural_tarefas ADD COLUMN metadata jsonb;
  END IF;
END $$;
