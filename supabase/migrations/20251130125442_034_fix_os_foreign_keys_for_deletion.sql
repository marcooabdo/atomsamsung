/*
  # Fix OS Foreign Keys for Proper Deletion
  
  1. Problem
    - Multiple tables have REFERENCES os(id) without ON DELETE CASCADE or SET NULL
    - This prevents OS deletion when "Refazer Orçamento" is clicked
    - Card appears in both Kanban and Cotações (duplicated)
    
  2. Tables to Fix
    - estoque_pedidos.os_id → Make nullable, add ON DELETE SET NULL
    - agendamentos.os_id → Make nullable, add ON DELETE SET NULL
    - financeiro_lancamentos.os_id → Add ON DELETE SET NULL
    - cotacoes_pecas.os_id → Add ON DELETE SET NULL
    - cotacoes_servicos.os_id → Add ON DELETE SET NULL
    
  3. Purpose
    - Allow OS to be deleted when moving back to Cotações
    - Preserve data in related tables by setting os_id to NULL
    - Ensure "Refazer Orçamento" moves card (not copies)
*/

-- Fix estoque_pedidos: make os_id nullable and add ON DELETE SET NULL
DO $$
BEGIN
  -- Drop existing foreign key constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'estoque_pedidos' 
    AND constraint_name LIKE '%os_id%'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    DECLARE
      constraint_name_var text;
    BEGIN
      SELECT constraint_name INTO constraint_name_var
      FROM information_schema.table_constraints 
      WHERE table_name = 'estoque_pedidos' 
      AND constraint_name LIKE '%os_id%'
      AND constraint_type = 'FOREIGN KEY'
      LIMIT 1;
      
      IF constraint_name_var IS NOT NULL THEN
        EXECUTE 'ALTER TABLE estoque_pedidos DROP CONSTRAINT ' || constraint_name_var;
      END IF;
    END;
  END IF;
  
  -- Make os_id nullable
  ALTER TABLE estoque_pedidos ALTER COLUMN os_id DROP NOT NULL;
  
  -- Recreate foreign key WITH ON DELETE SET NULL
  ALTER TABLE estoque_pedidos 
    ADD CONSTRAINT estoque_pedidos_os_id_fkey 
    FOREIGN KEY (os_id) REFERENCES os(id) ON DELETE SET NULL;
END $$;

-- Fix agendamentos: make os_id nullable and add ON DELETE SET NULL
DO $$
BEGIN
  -- Drop existing foreign key constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'agendamentos' 
    AND constraint_name LIKE '%os_id%'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    DECLARE
      constraint_name_var text;
    BEGIN
      SELECT constraint_name INTO constraint_name_var
      FROM information_schema.table_constraints 
      WHERE table_name = 'agendamentos' 
      AND constraint_name LIKE '%os_id%'
      AND constraint_type = 'FOREIGN KEY'
      LIMIT 1;
      
      IF constraint_name_var IS NOT NULL THEN
        EXECUTE 'ALTER TABLE agendamentos DROP CONSTRAINT ' || constraint_name_var;
      END IF;
    END;
  END IF;
  
  -- Make os_id nullable
  ALTER TABLE agendamentos ALTER COLUMN os_id DROP NOT NULL;
  
  -- Recreate foreign key WITH ON DELETE SET NULL
  ALTER TABLE agendamentos 
    ADD CONSTRAINT agendamentos_os_id_fkey 
    FOREIGN KEY (os_id) REFERENCES os(id) ON DELETE SET NULL;
END $$;

-- Fix financeiro_lancamentos: add ON DELETE SET NULL
DO $$
BEGIN
  -- Drop existing foreign key constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'financeiro_lancamentos' 
    AND constraint_name LIKE '%os_id%'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    DECLARE
      constraint_name_var text;
    BEGIN
      SELECT constraint_name INTO constraint_name_var
      FROM information_schema.table_constraints 
      WHERE table_name = 'financeiro_lancamentos' 
      AND constraint_name LIKE '%os_id%'
      AND constraint_type = 'FOREIGN KEY'
      LIMIT 1;
      
      IF constraint_name_var IS NOT NULL THEN
        EXECUTE 'ALTER TABLE financeiro_lancamentos DROP CONSTRAINT ' || constraint_name_var;
        
        -- Recreate foreign key WITH ON DELETE SET NULL
        ALTER TABLE financeiro_lancamentos 
          ADD CONSTRAINT financeiro_lancamentos_os_id_fkey 
          FOREIGN KEY (os_id) REFERENCES os(id) ON DELETE SET NULL;
      END IF;
    END;
  END IF;
END $$;

-- Fix cotacoes_pecas: add ON DELETE SET NULL
DO $$
BEGIN
  -- Drop existing foreign key constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'cotacoes_pecas' 
    AND constraint_name LIKE '%os_id%'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    DECLARE
      constraint_name_var text;
    BEGIN
      SELECT constraint_name INTO constraint_name_var
      FROM information_schema.table_constraints 
      WHERE table_name = 'cotacoes_pecas' 
      AND constraint_name LIKE '%os_id%'
      AND constraint_type = 'FOREIGN KEY'
      LIMIT 1;
      
      IF constraint_name_var IS NOT NULL THEN
        EXECUTE 'ALTER TABLE cotacoes_pecas DROP CONSTRAINT ' || constraint_name_var;
        
        -- Recreate foreign key WITH ON DELETE SET NULL
        ALTER TABLE cotacoes_pecas 
          ADD CONSTRAINT cotacoes_pecas_os_id_fkey 
          FOREIGN KEY (os_id) REFERENCES os(id) ON DELETE SET NULL;
      END IF;
    END;
  END IF;
END $$;

-- Fix cotacoes_servicos: add ON DELETE SET NULL
DO $$
BEGIN
  -- Drop existing foreign key constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'cotacoes_servicos' 
    AND constraint_name LIKE '%os_id%'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    DECLARE
      constraint_name_var text;
    BEGIN
      SELECT constraint_name INTO constraint_name_var
      FROM information_schema.table_constraints 
      WHERE table_name = 'cotacoes_servicos' 
      AND constraint_name LIKE '%os_id%'
      AND constraint_type = 'FOREIGN KEY'
      LIMIT 1;
      
      IF constraint_name_var IS NOT NULL THEN
        EXECUTE 'ALTER TABLE cotacoes_servicos DROP CONSTRAINT ' || constraint_name_var;
        
        -- Recreate foreign key WITH ON DELETE SET NULL
        ALTER TABLE cotacoes_servicos 
          ADD CONSTRAINT cotacoes_servicos_os_id_fkey 
          FOREIGN KEY (os_id) REFERENCES os(id) ON DELETE SET NULL;
      END IF;
    END;
  END IF;
END $$;