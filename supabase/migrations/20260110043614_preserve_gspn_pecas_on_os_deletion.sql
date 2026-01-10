/*
  # Preserve GSPN parts when OS is deleted

  1. Problem
    - The `os_pecas` table has `os_id uuid REFERENCES os(id) ON DELETE CASCADE`
    - When an OS is moved to cotação, ALL parts are deleted including GSPN parts from API
    - GSPN parts from Samsung API must NEVER be deleted
    - When cotação is converted back to OS, GSPN parts are lost

  2. Changes
    - Make os_id nullable in os_pecas
    - Change ON DELETE CASCADE to ON DELETE SET NULL
    - This allows GSPN parts to survive OS deletion
    - Parts with status='gspn' will be preserved with os_id=NULL

  3. Logic
    - When OS is deleted, os_id is set to NULL instead of deleting the part
    - GSPN parts (status='gspn') remain in database
    - When cotação is converted back to OS, GSPN parts can be reconnected
    - Regular parts can be cleaned up if needed (os_id=NULL and status!='gspn')

  4. Security
    - No RLS changes needed
    - Foreign key still validates os_id when present
*/

-- Drop the existing foreign key constraint
ALTER TABLE os_pecas
DROP CONSTRAINT IF EXISTS os_pecas_os_id_fkey;

-- Make os_id nullable
ALTER TABLE os_pecas
ALTER COLUMN os_id DROP NOT NULL;

-- Re-add the foreign key with ON DELETE SET NULL
ALTER TABLE os_pecas
ADD CONSTRAINT os_pecas_os_id_fkey
FOREIGN KEY (os_id) REFERENCES os(id) ON DELETE SET NULL;

-- Add helpful comment
COMMENT ON COLUMN os_pecas.os_id IS 'OS ID - nullable to preserve GSPN parts when OS is deleted. Parts with status=gspn must be preserved.';