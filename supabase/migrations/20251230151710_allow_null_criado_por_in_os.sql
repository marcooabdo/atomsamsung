/*
  # Allow NULL for criado_por in OS table

  1. Changes
    - Alter column `criado_por` in `os` table to allow NULL values
    - This allows OS to be created without a user reference (e.g., imported from external systems)

  2. Notes
    - Existing data is preserved
    - No default value is set to maintain explicit control
*/

-- Allow criado_por to be NULL
ALTER TABLE os 
ALTER COLUMN criado_por DROP NOT NULL;
