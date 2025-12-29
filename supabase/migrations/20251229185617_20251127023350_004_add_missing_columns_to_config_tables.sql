/*
  # Add Missing Columns to Configuration Tables

  ## Changes Made
  
  1. Unidades Table
    - Add `cep` column (text, nullable)
    - Add `numero` column (text, nullable) for property number
  
  2. Servicos Table
    - Add `nome` column (text, not null) for service name
    - Migrate `descricao` data to `nome` if needed
    - Keep `descricao` for longer description
    - Rename `valor_padrao` to `valor_base` for consistency
  
  3. Notes
    - All existing data preserved
    - Nullable fields for optional information
*/

-- Add missing columns to unidades
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unidades' AND column_name = 'cep'
  ) THEN
    ALTER TABLE unidades ADD COLUMN cep text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unidades' AND column_name = 'numero'
  ) THEN
    ALTER TABLE unidades ADD COLUMN numero text;
  END IF;
END $$;

-- Add/update columns for servicos
DO $$
BEGIN
  -- Add nome column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servicos' AND column_name = 'nome'
  ) THEN
    ALTER TABLE servicos ADD COLUMN nome text;
    
    -- Copy codigo to nome for existing records
    UPDATE servicos SET nome = codigo WHERE nome IS NULL;
    
    -- Make nome NOT NULL after populating
    ALTER TABLE servicos ALTER COLUMN nome SET NOT NULL;
  END IF;

  -- Add valor_base if it doesn't exist (rename valor_padrao)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servicos' AND column_name = 'valor_base'
  ) THEN
    -- If valor_padrao exists, rename it
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'servicos' AND column_name = 'valor_padrao'
    ) THEN
      ALTER TABLE servicos RENAME COLUMN valor_padrao TO valor_base;
    ELSE
      -- Otherwise create it
      ALTER TABLE servicos ADD COLUMN valor_base numeric(10,2) DEFAULT 0 NOT NULL;
    END IF;
  END IF;
END $$;

-- Add senha column to usuarios if it doesn't exist (for password management)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'senha'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN senha text;
  END IF;
END $$;