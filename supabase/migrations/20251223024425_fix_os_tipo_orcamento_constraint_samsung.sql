/*
  # Fix OS tipo_orcamento constraint for Samsung OS

  1. Changes
    - Drop existing constraint that only allows OW and LP types
    - Create new constraint that allows:
      - OW type: must have tipo_orcamento
      - LP type: must NOT have tipo_orcamento
      - SAMSUNG type: can have NULL tipo_orcamento
      - Other types: no restriction on tipo_orcamento
*/

ALTER TABLE os DROP CONSTRAINT IF EXISTS os_tipo_orcamento_check;

ALTER TABLE os ADD CONSTRAINT os_tipo_orcamento_check 
CHECK (
  (tipo_os = 'OW' AND tipo_orcamento IS NOT NULL) OR
  (tipo_os = 'LP' AND tipo_orcamento IS NULL) OR
  (tipo_os NOT IN ('OW', 'LP'))
);
