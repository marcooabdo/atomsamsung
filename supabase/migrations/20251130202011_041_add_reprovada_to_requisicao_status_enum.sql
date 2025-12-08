/*
  # Add 'reprovada' status to requisicao_status enum

  1. Enum Update
    - Add 'reprovada' value to the requisicao_status enum
    - This allows requisitions to be rejected by the warehouse

  2. Notes
    - Using ALTER TYPE to add new enum value safely
    - No data migration needed as this is a new status
*/

-- Add 'reprovada' to the requisicao_status enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'reprovada' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'requisicao_status')
  ) THEN
    ALTER TYPE requisicao_status ADD VALUE 'reprovada';
  END IF;
END $$;
