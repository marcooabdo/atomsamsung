/*
  # Allow NULL in requisitada_por column

  1. Changes
    - Remove NOT NULL constraint from `os_pecas.requisitada_por`
    - Allow parts to be added without specifying who requested them
  
  2. Security
    - No changes to RLS policies
*/

ALTER TABLE os_pecas 
ALTER COLUMN requisitada_por DROP NOT NULL;
