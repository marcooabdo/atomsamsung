/*
  # Fix Remaining OS Foreign Keys for Deletion

  1. Problem
    - `agendamentos.os_id` and `estoque_pedidos.os_id` are NOT NULL without ON DELETE
    - This blocks OS deletion even with manual UPDATE attempts
    - Causes error: "OS ainda existe no banco após tentativa de deleção"

  2. Changes
    - Make `agendamentos.os_id` nullable
    - Add ON DELETE SET NULL to agendamentos foreign key
    - Make `estoque_pedidos.os_id` nullable
    - Add ON DELETE SET NULL to estoque_pedidos foreign key

  3. Result
    - OS can be deleted successfully
    - Related records are preserved with NULL os_id (orphaned records)
    - Enables proper "refazer orçamento" flow (OS → Cotação transfer)

  4. Security
    - RLS policies remain unchanged
    - Only structural changes to foreign key constraints
*/

-- ========================================
-- 1. FIX AGENDAMENTOS
-- ========================================

-- Make os_id nullable
ALTER TABLE agendamentos
  ALTER COLUMN os_id DROP NOT NULL;

-- Drop existing constraint if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'agendamentos_os_id_fkey'
    AND table_name = 'agendamentos'
  ) THEN
    ALTER TABLE agendamentos
      DROP CONSTRAINT agendamentos_os_id_fkey;
  END IF;
END $$;

-- Recreate foreign key WITH ON DELETE SET NULL
ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_os_id_fkey
  FOREIGN KEY (os_id) REFERENCES os(id) ON DELETE SET NULL;

-- ========================================
-- 2. FIX ESTOQUE_PEDIDOS
-- ========================================

-- Make os_id nullable
ALTER TABLE estoque_pedidos
  ALTER COLUMN os_id DROP NOT NULL;

-- Drop existing constraint if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'estoque_pedidos_os_id_fkey'
    AND table_name = 'estoque_pedidos'
  ) THEN
    ALTER TABLE estoque_pedidos
      DROP CONSTRAINT estoque_pedidos_os_id_fkey;
  END IF;
END $$;

-- Recreate foreign key WITH ON DELETE SET NULL
ALTER TABLE estoque_pedidos
  ADD CONSTRAINT estoque_pedidos_os_id_fkey
  FOREIGN KEY (os_id) REFERENCES os(id) ON DELETE SET NULL;

-- ========================================
-- 3. VERIFICATION
-- ========================================

-- Verify both constraints were created successfully
DO $$
DECLARE
  agendamentos_fk_exists BOOLEAN;
  estoque_pedidos_fk_exists BOOLEAN;
BEGIN
  -- Check agendamentos FK
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'agendamentos'
      AND kcu.column_name = 'os_id'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) INTO agendamentos_fk_exists;

  -- Check estoque_pedidos FK
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'estoque_pedidos'
      AND kcu.column_name = 'os_id'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) INTO estoque_pedidos_fk_exists;

  IF NOT agendamentos_fk_exists OR NOT estoque_pedidos_fk_exists THEN
    RAISE EXCEPTION 'Foreign key constraints not created properly';
  END IF;

  RAISE NOTICE 'Successfully fixed OS foreign keys for deletion';
END $$;