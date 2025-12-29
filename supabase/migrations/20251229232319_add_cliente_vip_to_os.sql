/*
  # Add cliente_vip column to OS table

  1. Changes
    - Add `cliente_vip` (boolean, default false) - Indicates if customer is VIP (Samsung Elite Service)
*/

-- Add cliente_vip column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'os' AND column_name = 'cliente_vip'
  ) THEN
    ALTER TABLE os ADD COLUMN cliente_vip boolean DEFAULT false;
  END IF;
END $$;