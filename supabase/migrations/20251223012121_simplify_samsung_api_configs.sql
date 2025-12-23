/*
  # Simplificar configuração Samsung API

  1. Alterações
    - Remover campo `token_dev` (não usado)
    - Remover campo `ambiente_ativo` (não necessário)
    - Renomear `token_prod` para `token_api` (mais claro)
    - Adicionar campos de empresa Samsung (Company, Country, Lang)
  
  2. Propósito
    - Simplificar configuração por unidade
    - Cada unidade tem seu próprio AscCode e Token API
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'samsung_api_configs' AND column_name = 'token_prod'
  ) THEN
    ALTER TABLE samsung_api_configs RENAME COLUMN token_prod TO token_api;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'samsung_api_configs' AND column_name = 'token_dev'
  ) THEN
    ALTER TABLE samsung_api_configs DROP COLUMN token_dev;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'samsung_api_configs' AND column_name = 'ambiente_ativo'
  ) THEN
    ALTER TABLE samsung_api_configs DROP COLUMN ambiente_ativo;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'samsung_api_configs' AND column_name = 'company_code'
  ) THEN
    ALTER TABLE samsung_api_configs ADD COLUMN company_code text DEFAULT 'C820';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'samsung_api_configs' AND column_name = 'country_code'
  ) THEN
    ALTER TABLE samsung_api_configs ADD COLUMN country_code text DEFAULT 'BR';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'samsung_api_configs' AND column_name = 'language_code'
  ) THEN
    ALTER TABLE samsung_api_configs ADD COLUMN language_code text DEFAULT 'EN';
  END IF;
END $$;
