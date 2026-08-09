/*
# Add phone_number_id to atom_connect_instancias

1. Modified Tables
  - `atom_connect_instancias`
    - Added `phone_number_id` (text, nullable) — The WhatsApp Business API phone number ID
      used to identify the instance by its platform-level ID (e.g. "1286267577901515").

2. Data Updates
  - Populated `phone_number` and `phone_number_id` for the Montes Claros (APIMOC) instance.

3. Important Notes
  - The `phone_number` column already exists but was null; this migration populates it.
  - `phone_number_id` is the Meta/WhatsApp Business API identifier for the phone number.
  - These fields will help correctly route incoming messages to the right instance.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_instancias' AND column_name = 'phone_number_id'
  ) THEN
    ALTER TABLE atom_connect_instancias ADD COLUMN phone_number_id text;
  END IF;
END $$;

-- Populate Montes Claros (APIMOC) instance data
UPDATE atom_connect_instancias
SET phone_number = '5538999216700',
    phone_number_id = '1286267577901515'
WHERE instance_name = 'APIMOC';
