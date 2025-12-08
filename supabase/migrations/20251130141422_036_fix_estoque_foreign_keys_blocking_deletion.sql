/*
  # Fix Estoque Foreign Keys Blocking OS Deletion

  1. Problem - ROOT CAUSE IDENTIFIED
    - `estoque_pecas.os_id` has NO ON DELETE rule (blocks deletion)
    - `estoque_transferencias.os_id` has NO ON DELETE rule (blocks deletion)
    - These are the ONLY two tables blocking OS deletion

  2. Current State (from diagnosis)
    ✅ Already correct (ON DELETE SET NULL):
      - agendamentos
      - cotacao_comentarios
      - cotacoes_pecas
      - cotacoes_servicos
      - estoque_pedidos
      - financeiro_lancamentos
    
    ✅ Already correct (ON DELETE CASCADE):
      - os_anexos
      - os_checklist
      - os_comentarios
      - os_pecas
      - requisicoes_pecas
    
    ❌ NEEDS FIX (no ON DELETE):
      - estoque_pecas
      - estoque_transferencias

  3. Solution
    - Drop existing foreign key constraints
    - Recreate with ON DELETE SET NULL
    - Keep os_id nullable (already is)

  4. Result
    - OS can be deleted successfully
    - Estoque records preserved with NULL os_id (orphaned)
    - "Refazer Orçamento" flow works correctly
*/

-- ========================================
-- 1. FIX ESTOQUE_PECAS
-- ========================================

-- Drop existing constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'estoque_pecas_os_id_fkey'
  ) THEN
    ALTER TABLE estoque_pecas
      DROP CONSTRAINT estoque_pecas_os_id_fkey;
  END IF;
END $$;

-- Recreate with ON DELETE SET NULL
ALTER TABLE estoque_pecas
  ADD CONSTRAINT estoque_pecas_os_id_fkey
  FOREIGN KEY (os_id) REFERENCES os(id) ON DELETE SET NULL;

-- ========================================
-- 2. FIX ESTOQUE_TRANSFERENCIAS
-- ========================================

-- Drop existing constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'estoque_transferencias_os_id_fkey'
  ) THEN
    ALTER TABLE estoque_transferencias
      DROP CONSTRAINT estoque_transferencias_os_id_fkey;
  END IF;
END $$;

-- Recreate with ON DELETE SET NULL
ALTER TABLE estoque_transferencias
  ADD CONSTRAINT estoque_transferencias_os_id_fkey
  FOREIGN KEY (os_id) REFERENCES os(id) ON DELETE SET NULL;

-- ========================================
-- 3. VERIFICATION
-- ========================================

-- Verify all foreign keys now have proper ON DELETE rules
DO $$
DECLARE
  missing_delete_rule_count INTEGER;
BEGIN
  -- Count foreign keys to os(id) WITHOUT ON DELETE rule
  SELECT COUNT(*)
  INTO missing_delete_rule_count
  FROM pg_constraint
  WHERE confrelid = 'os'::regclass
    AND contype = 'f'
    AND pg_get_constraintdef(oid) NOT LIKE '%ON DELETE%';
  
  IF missing_delete_rule_count > 0 THEN
    RAISE EXCEPTION 'Still have % foreign keys without ON DELETE rule', missing_delete_rule_count;
  END IF;
  
  RAISE NOTICE 'SUCCESS: All foreign keys to os(id) now have ON DELETE rules';
END $$;