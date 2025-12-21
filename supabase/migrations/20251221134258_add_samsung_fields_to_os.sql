/*
  # Adicionar campos Samsung à tabela OS

  1. Novos Campos
    - `status_garantia` (text, nullable) - Status de garantia da OS Samsung
    - `data_abertura_samsung` (text, nullable) - Data de abertura no sistema Samsung
    - `data_requisicao_samsung` (text, nullable) - Data de requisição no sistema Samsung
  
  2. Propósito
    - Armazenar informações adicionais da API Samsung GSPN
    - Facilitar rastreamento e auditoria das OS importadas
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'status_garantia'
  ) THEN
    ALTER TABLE os ADD COLUMN status_garantia text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'data_abertura_samsung'
  ) THEN
    ALTER TABLE os ADD COLUMN data_abertura_samsung text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'data_requisicao_samsung'
  ) THEN
    ALTER TABLE os ADD COLUMN data_requisicao_samsung text;
  END IF;
END $$;
