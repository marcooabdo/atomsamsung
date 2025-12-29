/*
  # Add Unidade to Configuration Tables

  ## Changes Made
  
  1. Servicos Table
    - Add unidade_id column (uuid, references unidades)
    - Allow NULL for global services (Master/Diretoria can create global)
  
  2. Markup_Regras Table
    - Add unidade_id column (uuid, references unidades)
    - Allow NULL for global markup rules
  
  3. Taxas_Maquina Table
    - Add unidade_id column (uuid, references unidades)
    - Add debito column (numeric, for debit card rate)
    - Allow NULL for global rates
  
  4. Update RLS Policies
    - Users see config from their unit + global (NULL unidade_id)
    - Master/Diretoria see all
    - Only Master/Diretoria can create global configs
  
  5. Notes
    - NULL unidade_id = global configuration (visible to all)
    - Specific unidade_id = unit-specific configuration
*/

-- Add unidade_id to servicos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servicos' AND column_name = 'unidade_id'
  ) THEN
    ALTER TABLE servicos ADD COLUMN unidade_id uuid REFERENCES unidades(id);
  END IF;
END $$;

-- Add unidade_id to markup_regras
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'markup_regras' AND column_name = 'unidade_id'
  ) THEN
    ALTER TABLE markup_regras ADD COLUMN unidade_id uuid REFERENCES unidades(id);
  END IF;
END $$;

-- Add unidade_id and debito to taxas_maquina
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'taxas_maquina' AND column_name = 'unidade_id'
  ) THEN
    ALTER TABLE taxas_maquina ADD COLUMN unidade_id uuid REFERENCES unidades(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'taxas_maquina' AND column_name = 'debito'
  ) THEN
    ALTER TABLE taxas_maquina ADD COLUMN debito numeric(5,2) DEFAULT 0;
  END IF;
END $$;

-- Update RLS policies for servicos
DROP POLICY IF EXISTS "All users can view servicos" ON servicos;
DROP POLICY IF EXISTS "Master and Diretoria can manage servicos" ON servicos;

CREATE POLICY "Users can view servicos from their unit or global"
  ON servicos FOR SELECT
  TO authenticated
  USING (
    unidade_id IS NULL OR
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = servicos.unidade_id
      )
    )
  );

CREATE POLICY "Users can insert servicos in their unit"
  ON servicos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        (u.tipo IN ('master', 'diretoria') AND (unidade_id IS NULL OR unidade_id IS NOT NULL))
        OR (u.tipo IN ('gerente', 'administrador') AND u.unidade_id = servicos.unidade_id)
      )
    )
  );

CREATE POLICY "Users can update servicos in their unit"
  ON servicos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR (u.tipo IN ('gerente', 'administrador') AND u.unidade_id = servicos.unidade_id)
      )
    )
  );

CREATE POLICY "Master and Diretoria can delete servicos"
  ON servicos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
  );

-- Update RLS policies for markup_regras
DROP POLICY IF EXISTS "All users can view markup rules" ON markup_regras;
DROP POLICY IF EXISTS "Master and Diretoria can manage markup rules" ON markup_regras;

CREATE POLICY "Users can view markup rules from their unit or global"
  ON markup_regras FOR SELECT
  TO authenticated
  USING (
    unidade_id IS NULL OR
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = markup_regras.unidade_id
      )
    )
  );

CREATE POLICY "Users can insert markup rules in their unit"
  ON markup_regras FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        (u.tipo IN ('master', 'diretoria') AND (unidade_id IS NULL OR unidade_id IS NOT NULL))
        OR (u.tipo IN ('gerente', 'administrador') AND u.unidade_id = markup_regras.unidade_id)
      )
    )
  );

CREATE POLICY "Users can update markup rules in their unit"
  ON markup_regras FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR (u.tipo IN ('gerente', 'administrador') AND u.unidade_id = markup_regras.unidade_id)
      )
    )
  );

CREATE POLICY "Master and Diretoria can delete markup rules"
  ON markup_regras FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
  );

-- Update RLS policies for taxas_maquina
DROP POLICY IF EXISTS "All users can view taxas" ON taxas_maquina;
DROP POLICY IF EXISTS "Master and Diretoria can manage taxas" ON taxas_maquina;

CREATE POLICY "Users can view taxas from their unit or global"
  ON taxas_maquina FOR SELECT
  TO authenticated
  USING (
    unidade_id IS NULL OR
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = taxas_maquina.unidade_id
      )
    )
  );

CREATE POLICY "Users can insert taxas in their unit"
  ON taxas_maquina FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        (u.tipo IN ('master', 'diretoria') AND (unidade_id IS NULL OR unidade_id IS NOT NULL))
        OR (u.tipo IN ('gerente', 'administrador') AND u.unidade_id = taxas_maquina.unidade_id)
      )
    )
  );

CREATE POLICY "Users can update taxas in their unit"
  ON taxas_maquina FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR (u.tipo IN ('gerente', 'administrador') AND u.unidade_id = taxas_maquina.unidade_id)
      )
    )
  );

CREATE POLICY "Master and Diretoria can delete taxas"
  ON taxas_maquina FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
  );

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_servicos_unidade ON servicos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_markup_regras_unidade ON markup_regras(unidade_id);
CREATE INDEX IF NOT EXISTS idx_taxas_maquina_unidade ON taxas_maquina(unidade_id);

-- Update existing records to have unidade_id = NULL (global)
-- This makes existing data accessible to all units
UPDATE servicos SET unidade_id = NULL WHERE unidade_id IS NULL;
UPDATE markup_regras SET unidade_id = NULL WHERE unidade_id IS NULL;
UPDATE taxas_maquina SET unidade_id = NULL WHERE unidade_id IS NULL;