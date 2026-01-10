/*
  # Add tracking fields to os_pecas for GSPN preservation

  1. Problem
    - When OS is deleted and recreated from cotação, GSPN parts become orphaned
    - We need a way to reconnect GSPN parts to the new OS
    - Current solution tries to guess which parts belong to which OS

  2. Changes
    - Add `numero_os_samsung` field to `os_pecas` table
    - This allows GSPN parts to be reconnected based on Samsung OS number
    - When OS is deleted, GSPN parts retain their numero_os_samsung
    - When cotação becomes OS again, we can reconnect based on numero_os_samsung

  3. Logic
    - When GSPN parts are created by API: set numero_os_samsung
    - When OS is deleted: os_id becomes NULL but numero_os_samsung remains
    - When cotação becomes OS: reconnect parts with matching numero_os_samsung

  4. Security
    - No RLS changes needed
    - Index added for performance
*/

-- Add numero_os_samsung to os_pecas
ALTER TABLE os_pecas
ADD COLUMN IF NOT EXISTS numero_os_samsung text;

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_os_pecas_numero_os_samsung 
ON os_pecas(numero_os_samsung) 
WHERE numero_os_samsung IS NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN os_pecas.numero_os_samsung IS 'Samsung OS number - used to reconnect GSPN parts when OS is deleted and recreated from cotação.';