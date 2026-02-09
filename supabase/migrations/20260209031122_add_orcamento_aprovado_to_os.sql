/*
  # Adicionar campo orcamento_aprovado à tabela OS

  1. Changes
    - Adiciona coluna `orcamento_aprovado` (boolean) à tabela `os`
    - Define valor padrão como false
    - Popula valores existentes baseado em `orcamento_aprovado_em`

  2. Notes
    - Campo necessário para sistema de aprovação de orçamento por link
    - Se já existe `orcamento_aprovado_em`, marca como aprovado
*/

-- Add orcamento_aprovado column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'os' AND column_name = 'orcamento_aprovado'
  ) THEN
    ALTER TABLE os ADD COLUMN orcamento_aprovado boolean DEFAULT false;
  END IF;
END $$;

-- Populate existing data
UPDATE os 
SET orcamento_aprovado = true 
WHERE orcamento_aprovado_em IS NOT NULL 
  AND orcamento_aprovado IS NOT true;
