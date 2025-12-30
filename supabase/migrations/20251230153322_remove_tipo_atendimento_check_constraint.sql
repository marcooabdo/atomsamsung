/*
  # Remove tipo_atendimento check constraint
  
  1. Changes
    - Remove CHECK constraint on `tipo_atendimento` column in `os` table
    - Allow any text value for `tipo_atendimento`
*/

ALTER TABLE os DROP CONSTRAINT IF EXISTS os_tipo_atendimento_check;
