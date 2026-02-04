/*
  # Fix Unidades - Allow NULL in cidade and estado fields

  1. Changes
    - Remove NOT NULL constraint from `cidade` column in unidades table
    - Remove NOT NULL constraint from `estado` column in unidades table
  
  2. Reason
    - The form has more detailed fields (uf, cidade, rua, bairro, etc)
    - Not all fields are always filled when creating a new unit
    - This allows flexible data entry while maintaining data integrity
*/

-- Remove NOT NULL constraint from cidade
ALTER TABLE unidades 
  ALTER COLUMN cidade DROP NOT NULL;

-- Remove NOT NULL constraint from estado
ALTER TABLE unidades 
  ALTER COLUMN estado DROP NOT NULL;
