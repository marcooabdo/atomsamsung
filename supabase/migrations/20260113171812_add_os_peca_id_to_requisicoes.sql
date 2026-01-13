/*
  # Add os_peca_id to requisicoes_pecas

  1. Changes
    - Add `os_peca_id` column to `requisicoes_pecas` table
    - This enables unique identification of GSPN parts that share the same part code

  2. Rationale
    - Multiple GSPN parts can have the same code (e.g., 3x GH96-17724A)
    - Using only `codigo_peca` causes all parts with same code to show same requisition
    - `os_peca_id` provides unique reference to each individual part from os_pecas table
*/

-- Add os_peca_id column to requisicoes_pecas
ALTER TABLE requisicoes_pecas
  ADD COLUMN IF NOT EXISTS os_peca_id uuid REFERENCES os_pecas(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_requisicoes_pecas_os_peca_id ON requisicoes_pecas(os_peca_id);

-- Add comment explaining the purpose
COMMENT ON COLUMN requisicoes_pecas.os_peca_id IS 'Reference to os_pecas table for GSPN parts - enables unique identification when multiple parts share the same code';
