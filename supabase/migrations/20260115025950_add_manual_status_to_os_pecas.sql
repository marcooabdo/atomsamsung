/*
  # Add 'manual' status to os_pecas table

  1. Changes
    - Drop existing status check constraint on os_pecas table
    - Create new check constraint that includes 'manual' as a valid status option
    - This status is used for manually added parts in OW orders that follow the requisition flow

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
    - gspn
    - manual (NEW)

  3. Purpose
    - 'manual' status is for parts added manually to OW orders
    - These parts follow the same requisition flow as LP parts
    - They use os_peca_id (not cotacao_peca_id) in requisitions, just like GSPN parts
*/

-- Drop the old constraint
ALTER TABLE os_pecas DROP CONSTRAINT IF EXISTS os_pecas_status_check;

-- Add the new constraint with 'manual' included
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
    'gspn'::text,
    'manual'::text
  ]));
