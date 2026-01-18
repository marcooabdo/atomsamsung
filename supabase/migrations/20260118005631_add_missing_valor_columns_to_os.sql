/*
  # Adicionar colunas valor_pecas, valor_servicos e saldo_restante na tabela os

  Colunas necessarias para o trigger atualizar_valores_os funcionar corretamente.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'valor_pecas'
  ) THEN
    ALTER TABLE os ADD COLUMN valor_pecas numeric(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'valor_servicos'
  ) THEN
    ALTER TABLE os ADD COLUMN valor_servicos numeric(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'saldo_restante'
  ) THEN
    ALTER TABLE os ADD COLUMN saldo_restante numeric(12,2) DEFAULT 0;
  END IF;
END $$;
