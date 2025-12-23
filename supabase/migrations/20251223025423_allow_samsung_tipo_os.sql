/*
  # Allow SAMSUNG as a valid tipo_os value

  1. Changes
    - Update tipo_os check constraint on `os` table to allow 'LP', 'OW', and 'SAMSUNG'
    - Update tipo_os check constraint on `cotacoes` table to allow 'LP', 'OW', and 'SAMSUNG'
    - Ensure tipo_orcamento can be NULL for SAMSUNG type OS (already handled in previous migration)

  2. Impact
    - Allows Samsung GSPN sync to create OS records with tipo_os = 'SAMSUNG'
    - Maintains backward compatibility with existing LP and OW types
    - Enables proper tracking of Samsung-imported service orders

  3. Notes
    - Samsung OS typically don't have tipo_orcamento as they come directly from GSPN
    - The tipo_orcamento constraint was already updated in migration 20251223024425
*/

-- Drop and recreate the tipo_os constraint on the os table
ALTER TABLE os DROP CONSTRAINT IF EXISTS os_tipo_os_check;
ALTER TABLE os ADD CONSTRAINT os_tipo_os_check
  CHECK (tipo_os IN ('LP', 'OW', 'SAMSUNG'));

-- Drop and recreate the tipo_os constraint on the cotacoes table
ALTER TABLE cotacoes DROP CONSTRAINT IF EXISTS cotacoes_tipo_os_check;
ALTER TABLE cotacoes ADD CONSTRAINT cotacoes_tipo_os_check
  CHECK (tipo_os IN ('LP', 'OW', 'SAMSUNG'));
