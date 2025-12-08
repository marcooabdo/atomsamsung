/*
  # Add Tipo Reparo field to OS table

  1. Changes
    - Add `tipo_reparo` column to `os` table for IH repairs
    - Column stores the type of repair being performed
    
  2. Valid values
    - Troca de placa
    - Troca de painel
    - Troca de Open Cell
    - Troca de compressor
    - Troca de cesto
    - Troca de serpentina
    - Troca de peca (simples)
    
  3. Notes
    - Field is optional as it only applies to IH (In Home) service type
    - No constraint needed as validation will be handled at application level
*/

ALTER TABLE os ADD COLUMN IF NOT EXISTS tipo_reparo TEXT;

COMMENT ON COLUMN os.tipo_reparo IS 'Tipo de reparo para atendimentos IH: Troca de placa, Troca de painel, Troca de Open Cell, Troca de compressor, Troca de cesto, Troca de serpentina, Troca de peca (simples)';