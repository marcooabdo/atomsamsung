/*
  # Fix os_anexos to Allow NULL os_id

  1. Changes:
    - Alter os_id to allow NULL
    - Keep cotacao_id as nullable
    - At least one of os_id or cotacao_id must be NOT NULL
  
  2. Reasoning:
    - Attachments can belong to either an OS or a Cotacao
    - Not both at the same time
    - But one must be present
*/

-- Allow os_id to be NULL
ALTER TABLE os_anexos 
ALTER COLUMN os_id DROP NOT NULL;

-- Add check constraint to ensure at least one is present
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'os_anexos_must_have_os_or_cotacao'
  ) THEN
    ALTER TABLE os_anexos 
    ADD CONSTRAINT os_anexos_must_have_os_or_cotacao 
    CHECK (os_id IS NOT NULL OR cotacao_id IS NOT NULL);
  END IF;
END $$;
