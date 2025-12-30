/*
  # Remove tipo_orcamento check constraint
  
  1. Changes
    - Remove CHECK constraint on `tipo_orcamento` column in `os` table
    - Allow any text value for `tipo_orcamento`
*/

ALTER TABLE os DROP CONSTRAINT IF EXISTS os_tipo_orcamento_check;
