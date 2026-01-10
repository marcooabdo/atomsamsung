/*
  # Revert os_comentarios to Use CASCADE

  1. Changes:
    - Revert os_id foreign key back to CASCADE
    - Remove cotacao_id column (not needed)
    - Comments will be copied to cotacao_comentarios before deletion
    - Comments will be recreated from cotacao_comentarios when cotacao becomes OS

  2. Reasoning:
    - Simpler data model - no orphaned records
    - Comments follow the lifecycle: OS → copy to cotacao → delete OS → recreate from cotacao
    - Clean separation between OS and Cotacao comments
*/

-- Drop cotacao_id column if exists
ALTER TABLE os_comentarios
DROP COLUMN IF EXISTS cotacao_id;

-- Drop existing foreign key
ALTER TABLE os_comentarios
DROP CONSTRAINT IF EXISTS os_comentarios_os_id_fkey;

-- Drop check constraint
ALTER TABLE os_comentarios
DROP CONSTRAINT IF EXISTS os_comentarios_must_have_os_or_cotacao;

-- Make os_id NOT NULL again
ALTER TABLE os_comentarios
ALTER COLUMN os_id SET NOT NULL;

-- Recreate foreign key with CASCADE (original behavior)
ALTER TABLE os_comentarios
ADD CONSTRAINT os_comentarios_os_id_fkey
FOREIGN KEY (os_id) REFERENCES os(id) ON DELETE CASCADE;

-- Drop the index we created
DROP INDEX IF EXISTS idx_os_comentarios_cotacao;
