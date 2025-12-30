/*
  # Fix unique constraint for numero_os_interna

  1. Changes
    - Drop existing unique constraint on numero_os_interna that doesn't allow multiple NULLs
    - Add new unique constraint that allows multiple NULL values
    - This allows Samsung OSs to be created without internal numbers initially
  
  2. Security
    - No changes to RLS policies
*/

-- Drop the existing constraint
ALTER TABLE os DROP CONSTRAINT IF EXISTS unique_os_interna;

-- Add new constraint that allows multiple NULLs
ALTER TABLE os ADD CONSTRAINT unique_os_interna UNIQUE (numero_os_interna);
