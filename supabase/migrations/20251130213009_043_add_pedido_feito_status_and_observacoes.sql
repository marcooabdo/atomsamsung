/*
  # Add pedido_feito status and observacoes to requisicoes_pecas

  1. Changes
    - Add `pedido_feito` status to requisicao_status enum
    - Add `observacoes_pedido` column to requisicoes_pecas
      - Type: text
      - Nullable: true
      - Stores notes/observations when creating an order

  2. Migration Strategy
    - Extend existing enum type
    - Add new column for order observations
    - No data migration needed (new optional fields)

  3. New Workflow
    - When "CRIAR PEDIDO" is clicked, update the requisicao status to "pedido_feito"
    - Store pedido number, observations, and estimated value in requisicoes_pecas
    - Show "VER PEDIDO" and "REFAZER PEDIDO" buttons for pedido_feito status
*/

-- Add pedido_feito to requisicao_status enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'pedido_feito' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'requisicao_status')
  ) THEN
    ALTER TYPE requisicao_status ADD VALUE 'pedido_feito';
  END IF;
END $$;

-- Add observacoes_pedido column to requisicoes_pecas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requisicoes_pecas' AND column_name = 'observacoes_pedido'
  ) THEN
    ALTER TABLE requisicoes_pecas ADD COLUMN observacoes_pedido text;
  END IF;
END $$;
