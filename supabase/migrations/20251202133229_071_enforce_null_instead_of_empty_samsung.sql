/*
  # Enforce NULL Instead of Empty Strings for Samsung Number

  1. Changes
    - Add check constraint to prevent empty strings in numero_os_samsung
    - Empty strings will be rejected, forcing use of NULL for "no value"
    - This ensures the UNIQUE constraint works correctly (multiple NULLs allowed)

  2. Important Notes
    - Empty strings ('') and NULL are different in PostgreSQL
    - UNIQUE allows multiple NULLs but not multiple empty strings
    - This constraint forces consistent use of NULL for missing values
*/

-- Add check constraint to prevent empty strings
ALTER TABLE os 
ADD CONSTRAINT numero_os_samsung_not_empty 
CHECK (
  numero_os_samsung IS NULL 
  OR trim(numero_os_samsung) != ''
);
