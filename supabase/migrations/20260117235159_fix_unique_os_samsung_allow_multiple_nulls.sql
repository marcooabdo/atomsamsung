/*
  # Fix unique constraint on numero_os_samsung to allow multiple NULL values

  1. Problem
    - Current constraint uses NULLS NOT DISTINCT which treats all NULL values as equal
    - This prevents creating multiple OS without Samsung numbers (SC/ACC type OS)
    - Only ONE OS can have numero_os_samsung = NULL
  
  2. Solution
    - Drop the existing unique_os_samsung constraint
    - Recreate it with default behavior (NULLS DISTINCT)
    - This allows multiple NULL values while keeping uniqueness for non-NULL values
  
  3. Impact
    - Multiple OS can now be created without Samsung numbers
    - OS with Samsung numbers still must be unique (no duplicates)
*/

-- Drop the existing constraint
ALTER TABLE os DROP CONSTRAINT IF EXISTS unique_os_samsung;

-- Recreate the constraint allowing multiple NULL values
-- By default, UNIQUE constraints treat NULL values as distinct
ALTER TABLE os ADD CONSTRAINT unique_os_samsung 
  UNIQUE (numero_os_samsung);
