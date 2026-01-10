/*
  # Auto-populate numero_os_samsung in os_pecas

  1. Problem
    - When GSPN parts are created from API, they need numero_os_samsung field populated
    - This field is required to reconnect parts when OS is deleted and recreated
    - Manual population is error-prone

  2. Changes
    - Create trigger to auto-populate numero_os_samsung from os.numero_os_samsung
    - Trigger runs on INSERT and UPDATE of os_pecas
    - Only populates if os_id is present and numero_os_samsung is NULL

  3. Logic
    - When part is inserted/updated with os_id
    - Fetch numero_os_samsung from os table
    - Auto-populate the field in os_pecas

  4. Security
    - No RLS changes needed
    - Trigger runs with proper permissions
*/

-- Function to auto-populate numero_os_samsung
CREATE OR REPLACE FUNCTION auto_populate_numero_os_samsung_in_os_pecas()
RETURNS TRIGGER AS $$
BEGIN
  -- If os_id is present and numero_os_samsung is NULL, fetch from os table
  IF NEW.os_id IS NOT NULL AND NEW.numero_os_samsung IS NULL THEN
    SELECT numero_os_samsung INTO NEW.numero_os_samsung
    FROM os
    WHERE id = NEW.os_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_auto_populate_numero_os_samsung ON os_pecas;
CREATE TRIGGER trigger_auto_populate_numero_os_samsung
  BEFORE INSERT OR UPDATE ON os_pecas
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_numero_os_samsung_in_os_pecas();