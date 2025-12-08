/*
  # Add Cancelada Status to Requisicoes Pecas

  1. Description
    - Add 'cancelada' status to requisicao_status enum
    - Add motivo_cancelamento column to requisicoes_pecas
    - This fixes the cancellation bug where updates fail silently

  2. Changes
    - Add 'cancelada' value to requisicao_status enum
    - Add motivo_cancelamento text column
    - Add motivo_devolucao text column (if not exists)
    - Add tipo_devolucao text column (if not exists)

  3. Notes
    - Currently the enum only has: pendente, atendida, em_uso, gi_postada, devolvida, reprovada, pedido_feito, devolucao_pendente
    - Code tries to set 'cancelada' but it doesn't exist, causing silent failures
*/

-- Add 'cancelada' to requisicao_status enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'cancelada' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'requisicao_status')
  ) THEN
    ALTER TYPE requisicao_status ADD VALUE 'cancelada';
  END IF;
END $$;

-- Add motivo_cancelamento column
ALTER TABLE requisicoes_pecas 
ADD COLUMN IF NOT EXISTS motivo_cancelamento text;

-- Add motivo_devolucao column (if not exists)
ALTER TABLE requisicoes_pecas 
ADD COLUMN IF NOT EXISTS motivo_devolucao text;

-- Add tipo_devolucao column (if not exists)
ALTER TABLE requisicoes_pecas 
ADD COLUMN IF NOT EXISTS tipo_devolucao text;

-- Add comments
COMMENT ON COLUMN requisicoes_pecas.motivo_cancelamento IS 'Motivo do cancelamento da requisição';
COMMENT ON COLUMN requisicoes_pecas.motivo_devolucao IS 'Motivo da devolução da peça';
COMMENT ON COLUMN requisicoes_pecas.tipo_devolucao IS 'Tipo de devolução: nova, nova_com_defeito, usada';
