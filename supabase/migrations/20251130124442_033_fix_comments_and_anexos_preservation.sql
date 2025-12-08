/*
  # Fix Comments and Anexos Preservation
  
  1. Problem
    - Comments are lost when moving between Cotações and Kanban
    - Anexos are lost when deleting OS
    - os_anexos.os_id is NOT NULL, preventing creation from cotação
    
  2. Changes to os_anexos
    - Make os_id nullable (allow NULL)
    - Add CHECK constraint to ensure either os_id OR cotacao_id is present
    - Keep CASCADE on both foreign keys for proper cleanup
    
  3. Changes to cotacao_comentarios
    - os_id already nullable (from previous migration)
    - Remove CASCADE from os_id foreign key to prevent deletion
    - Keep CASCADE on cotacao_id for proper cleanup
    
  4. Purpose
    - Preserve all comments when moving back to cotações
    - Preserve all anexos when moving back to cotações
    - Allow anexos to be created from cotação without OS
    - Maintain data integrity with proper constraints
*/

-- Fix os_anexos: make os_id nullable and add constraint
DO $$
BEGIN
  -- Drop the existing NOT NULL constraint on os_id
  ALTER TABLE os_anexos ALTER COLUMN os_id DROP NOT NULL;
  
  -- Add CHECK constraint to ensure at least one ID is present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'os_anexos' AND constraint_name = 'os_anexos_require_id_check'
  ) THEN
    ALTER TABLE os_anexos ADD CONSTRAINT os_anexos_require_id_check 
      CHECK (os_id IS NOT NULL OR cotacao_id IS NOT NULL);
  END IF;
END $$;

-- Fix cotacao_comentarios: remove CASCADE from os_id foreign key
DO $$
BEGIN
  -- Drop existing foreign key constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'cotacao_comentarios' 
    AND constraint_name LIKE '%os_id%'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    -- Get the exact constraint name
    DECLARE
      constraint_name_var text;
    BEGIN
      SELECT constraint_name INTO constraint_name_var
      FROM information_schema.table_constraints 
      WHERE table_name = 'cotacao_comentarios' 
      AND constraint_name LIKE '%os_id%'
      AND constraint_type = 'FOREIGN KEY'
      LIMIT 1;
      
      IF constraint_name_var IS NOT NULL THEN
        EXECUTE 'ALTER TABLE cotacao_comentarios DROP CONSTRAINT ' || constraint_name_var;
        
        -- Recreate foreign key WITHOUT CASCADE
        ALTER TABLE cotacao_comentarios 
          ADD CONSTRAINT cotacao_comentarios_os_id_fkey 
          FOREIGN KEY (os_id) REFERENCES os(id) ON DELETE SET NULL;
      END IF;
    END;
  END IF;
END $$;

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_cotacao_comentarios_cotacao_id 
  ON cotacao_comentarios(cotacao_id);
CREATE INDEX IF NOT EXISTS idx_cotacao_comentarios_os_id 
  ON cotacao_comentarios(os_id);
CREATE INDEX IF NOT EXISTS idx_os_anexos_cotacao_id 
  ON os_anexos(cotacao_id);