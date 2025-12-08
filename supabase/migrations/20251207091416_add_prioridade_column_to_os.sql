/*
  # Adicionar coluna de prioridade na tabela OS

  1. Descrição
    - Adiciona coluna `prioridade` na tabela `os`
    - Valores possíveis: 'baixa', 'normal', 'alta', 'urgente'
    - Valor padrão: 'normal'

  2. Alterações
    - Adiciona coluna `prioridade` do tipo text com constraint CHECK
*/

-- Adicionar coluna prioridade
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'prioridade'
  ) THEN
    ALTER TABLE os ADD COLUMN prioridade text DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente'));
  END IF;
END $$;

-- Criar índice para melhor performance em queries
CREATE INDEX IF NOT EXISTS idx_os_prioridade ON os(prioridade);
