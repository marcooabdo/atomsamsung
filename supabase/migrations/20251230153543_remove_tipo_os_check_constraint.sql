/*
  # Remove tipo_os check constraint
  
  1. Changes
    - Remove CHECK constraint on `tipo_os` column in `os` table
    - Allow any text value for `tipo_os`
*/

ALTER TABLE os DROP CONSTRAINT IF EXISTS os_tipo_os_check;
