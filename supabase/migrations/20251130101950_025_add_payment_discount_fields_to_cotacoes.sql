/*
  # Adicionar campos de desconto e taxa de cartão em cotações

  1. Novas Colunas em `cotacoes`:
    - `desconto_tipo` (enum: percentual, valor)
    - `desconto_valor` (numeric)
    - `taxa_cartao` (numeric)

  2. Campos que já existem:
    - `forma_pagamento_id` (uuid)
    - `parcelamento` (integer)
    - `valor_entrada` (numeric)

  3. Motivo:
    - Campos de pagamento não estavam sendo salvos
    - Desconto e taxa de cartão não tinham colunas
*/

-- Enum para tipo de desconto
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'desconto_tipo') THEN
    CREATE TYPE desconto_tipo AS ENUM ('percentual', 'valor');
  END IF;
END $$;

-- Adicionar colunas de desconto e taxa
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cotacoes' AND column_name = 'desconto_tipo'
  ) THEN
    ALTER TABLE cotacoes ADD COLUMN desconto_tipo desconto_tipo DEFAULT 'percentual';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cotacoes' AND column_name = 'desconto_valor'
  ) THEN
    ALTER TABLE cotacoes ADD COLUMN desconto_valor numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cotacoes' AND column_name = 'taxa_cartao'
  ) THEN
    ALTER TABLE cotacoes ADD COLUMN taxa_cartao numeric(10,2) DEFAULT 0;
  END IF;
END $$;
