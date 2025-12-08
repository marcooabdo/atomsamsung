/*
  # Allow NULL os_id in requisicoes_pecas

  1. Changes
    - Change os_id column to allow NULL values
    - This allows requisições to survive when OS is deleted
    - Requisições remain linked via cotacao_id

  2. Security
    - No changes to RLS policies
*/

-- Allow os_id to be NULL (for when OS is deleted but requisição persists)
ALTER TABLE requisicoes_pecas
ALTER COLUMN os_id DROP NOT NULL;
