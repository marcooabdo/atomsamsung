/*
# Add grupo_destino column to gia_relatorios_config

1. Modified Tables
   - `gia_relatorios_config`
     - Added `grupo_destino` (text, nullable) - WhatsApp group JID where this report should be sent

2. Purpose
   - Each report type can now be routed to a specific WhatsApp group
   - The edge function should read this column to determine the destination group
   - If null, falls back to the default group configured in the function

3. Important Notes
   - The "estoque_dia" report is set to go to group 120363427351181397@g.us
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gia_relatorios_config' AND column_name = 'grupo_destino'
  ) THEN
    ALTER TABLE gia_relatorios_config ADD COLUMN grupo_destino text;
  END IF;
END $$;

-- Set estoque_dia to the correct group
UPDATE gia_relatorios_config 
SET grupo_destino = '120363427351181397@g.us'
WHERE tipo = 'estoque_dia';