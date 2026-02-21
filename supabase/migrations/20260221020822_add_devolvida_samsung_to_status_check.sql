/*
  # Add devolvida_samsung to estoque_pecas status check constraint

  ## Summary
  The status 'devolvida_samsung' was missing from the check constraint on estoque_pecas.
  This migration drops the old constraint and recreates it including the new status.

  ## Changes
  - Drops existing `estoque_pecas_status_check` constraint
  - Recreates it adding 'devolvida_samsung' to the allowed values
*/

ALTER TABLE estoque_pecas DROP CONSTRAINT IF EXISTS estoque_pecas_status_check;

ALTER TABLE estoque_pecas ADD CONSTRAINT estoque_pecas_status_check
  CHECK (status = ANY (ARRAY[
    'disponivel',
    'reservada',
    'vinculada_tecnico',
    'em_rota',
    'em_uso',
    'usada',
    'devolucao_pendente',
    'devolvida_nova',
    'devolvida_defeito',
    'devolvida_samsung',
    'usada_upc',
    'arquivada'
  ]));
