/*
  # Allow NULL cotacao_id in requisicoes_pecas

  1. Changes
    - Alter column `cotacao_id` in `requisicoes_pecas` to allow NULL values
    - This enables part requisitions without requiring a quote (e.g., for LP orders)

  2. Rationale
    - LP (Laudo Particular) orders may need parts before a quote is created
    - Parts can be requisitioned either with or without an associated quote
*/

-- Allow NULL values in cotacao_id
ALTER TABLE requisicoes_pecas 
  ALTER COLUMN cotacao_id DROP NOT NULL;
