/*
  # Add exibir_no_pdf to requisicoes_pecas

  1. Changes
    - Add exibir_no_pdf column to requisicoes_pecas table
    - Default value is TRUE (all parts show in PDF by default)

  2. Purpose
    - Allow users to control which parts appear in the LP OS PDF
*/

ALTER TABLE requisicoes_pecas 
ADD COLUMN IF NOT EXISTS exibir_no_pdf boolean DEFAULT true;