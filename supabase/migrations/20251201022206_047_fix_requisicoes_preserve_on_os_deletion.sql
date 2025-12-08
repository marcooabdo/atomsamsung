/*
  # Fix requisicoes_pecas to preserve on OS deletion

  1. Changes
    - Change os_id foreign key from ON DELETE CASCADE to ON DELETE SET NULL
    - Make cotacao_id NOT NULL (requisições sempre devem ter cotação)
    - Update existing requisições to ensure cotacao_id is populated
    - Add index on cotacao_id for better query performance

  2. Behavior
    - When OS is deleted, requisições are preserved with os_id = NULL
    - Requisições remain linked to cotacao via cotacao_id
    - Pedidos no estoque mantêm vínculo com requisições
    - Peças em trânsito continuam bloqueadas na cotação

  3. Security
    - No changes to RLS policies (already secure)
*/

-- First, update any requisicoes that might have NULL cotacao_id
-- by getting cotacao_id from their OS
UPDATE requisicoes_pecas
SET cotacao_id = (
  SELECT cotacao_id FROM os WHERE os.id = requisicoes_pecas.os_id
)
WHERE cotacao_id IS NULL AND os_id IS NOT NULL;

-- Drop the existing foreign key constraint
ALTER TABLE requisicoes_pecas
DROP CONSTRAINT IF EXISTS requisicoes_pecas_os_id_fkey;

-- Recreate the foreign key with ON DELETE SET NULL
ALTER TABLE requisicoes_pecas
ADD CONSTRAINT requisicoes_pecas_os_id_fkey
FOREIGN KEY (os_id)
REFERENCES os(id)
ON DELETE SET NULL;

-- Make cotacao_id NOT NULL (all requisições must have a cotacao)
ALTER TABLE requisicoes_pecas
ALTER COLUMN cotacao_id SET NOT NULL;

-- Add index on cotacao_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_requisicoes_pecas_cotacao
ON requisicoes_pecas(cotacao_id);

-- Update the foreign key for cotacao_id to use ON DELETE CASCADE
-- (if cotação is deleted, requisições should be deleted too)
ALTER TABLE requisicoes_pecas
DROP CONSTRAINT IF EXISTS requisicoes_pecas_cotacao_id_fkey;

ALTER TABLE requisicoes_pecas
ADD CONSTRAINT requisicoes_pecas_cotacao_id_fkey
FOREIGN KEY (cotacao_id)
REFERENCES cotacoes(id)
ON DELETE CASCADE;