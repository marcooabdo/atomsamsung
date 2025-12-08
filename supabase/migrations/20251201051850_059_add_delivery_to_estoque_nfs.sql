/*
  # Adicionar campo delivery à tabela estoque_nfs

  ## Alterações
  1. Adiciona coluna delivery à tabela estoque_nfs
     - Campo texto para armazenar o delivery extraído do infCpl da NF
     - Extraído da terceira opção: "DELIVERY: XXXX"
  
  ## Notas
  - O delivery é o mesmo para todos os itens de uma NF
  - Será extraído do XML da DANFE durante a consulta
*/

-- Adicionar coluna delivery
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_nfs' AND column_name = 'delivery'
  ) THEN
    ALTER TABLE estoque_nfs ADD COLUMN delivery text;
  END IF;
END $$;

-- Criar índice para facilitar buscas por delivery
CREATE INDEX IF NOT EXISTS idx_estoque_nfs_delivery ON estoque_nfs(delivery);