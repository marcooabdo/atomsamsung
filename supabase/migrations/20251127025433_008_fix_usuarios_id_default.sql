/*
  # Fix Usuarios ID Auto-generation

  ## Changes Made
  
  1. Add default UUID generation for usuarios.id
  2. Ensure all tables with UUID primary keys have proper defaults
  
  ## Notes
  - ID will be auto-generated if not provided
  - Uses gen_random_uuid() for secure random UUIDs
*/

-- Add default UUID generation for usuarios table
ALTER TABLE usuarios ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Verify and add defaults to other tables if missing
DO $$
BEGIN
  -- Check and fix unidades
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unidades' AND column_name = 'id' AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE unidades ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;

  -- Check and fix servicos
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servicos' AND column_name = 'id' AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE servicos ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;

  -- Check and fix markup_regras
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'markup_regras' AND column_name = 'id' AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE markup_regras ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;

  -- Check and fix taxas_maquina
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'taxas_maquina' AND column_name = 'id' AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE taxas_maquina ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;

  -- Check and fix formas_pagamento
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'formas_pagamento' AND column_name = 'id' AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE formas_pagamento ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;

  -- Check and fix os
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'id' AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE os ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;

  -- Check and fix cotacoes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cotacoes' AND column_name = 'id' AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE cotacoes ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;

  -- Check and fix estoque_pecas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_pecas' AND column_name = 'id' AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE estoque_pecas ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;

  -- Check and fix financeiro_lancamentos
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financeiro_lancamentos' AND column_name = 'id' AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE financeiro_lancamentos ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;
END $$;
