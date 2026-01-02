/*
  # Add GSPN status to os_pecas table

  1. Changes
    - Drop existing status check constraint on os_pecas table
    - Create new check constraint that includes 'gspn' as a valid status option
  
  2. Valid Status Values (after migration)
    - requisitada
    - aprovada
    - em_transito
    - disponivel
    - vinculada_tecnico
    - em_uso
    - usada
    - devolvida
    - cancelada
    - gspn (NEW)
*/

-- Drop the old constraint
ALTER TABLE os_pecas DROP CONSTRAINT IF EXISTS os_pecas_status_check;

-- Add the new constraint with 'gspn' included
ALTER TABLE os_pecas ADD CONSTRAINT os_pecas_status_check 
  CHECK (status = ANY (ARRAY[
    'requisitada'::text,
    'aprovada'::text,
    'em_transito'::text,
    'disponivel'::text,
    'vinculada_tecnico'::text,
    'em_uso'::text,
    'usada'::text,
    'devolvida'::text,
    'cancelada'::text,
    'gspn'::text
  ]));
