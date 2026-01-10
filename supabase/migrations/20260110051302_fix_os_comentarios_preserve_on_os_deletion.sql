/*
  # Preserve os_comentarios on OS Deletion

  1. Changes:
    - Change os_id foreign key from CASCADE to SET NULL
    - Allow os_id to be NULL
    - Add cotacao_id reference for orphaned comments
    - Add check constraint to ensure at least one reference exists

  2. Reasoning:
    - Comments are historical records and must NEVER be deleted
    - When OS moves back to cotacao, comments should be transferred
    - Comments can belong to either OS or Cotacao
*/

-- Add cotacao_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os_comentarios' AND column_name = 'cotacao_id'
  ) THEN
    ALTER TABLE os_comentarios ADD COLUMN cotacao_id uuid REFERENCES cotacoes(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop existing foreign key constraint and recreate with SET NULL
ALTER TABLE os_comentarios
DROP CONSTRAINT IF EXISTS os_comentarios_os_id_fkey;

-- Allow os_id to be NULL (comments can be orphaned when OS is deleted)
ALTER TABLE os_comentarios
ALTER COLUMN os_id DROP NOT NULL;

-- Recreate foreign key with SET NULL instead of CASCADE
ALTER TABLE os_comentarios
ADD CONSTRAINT os_comentarios_os_id_fkey
FOREIGN KEY (os_id) REFERENCES os(id) ON DELETE SET NULL;

-- Add check constraint to ensure at least one reference exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'os_comentarios_must_have_os_or_cotacao'
  ) THEN
    ALTER TABLE os_comentarios
    ADD CONSTRAINT os_comentarios_must_have_os_or_cotacao
    CHECK (os_id IS NOT NULL OR cotacao_id IS NOT NULL);
  END IF;
END $$;

-- Create index on cotacao_id for performance
CREATE INDEX IF NOT EXISTS idx_os_comentarios_cotacao ON os_comentarios(cotacao_id);
