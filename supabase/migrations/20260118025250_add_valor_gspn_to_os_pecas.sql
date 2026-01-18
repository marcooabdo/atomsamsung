/*
  # Add valor_gspn to os_pecas table
  
  1. Changes
    - Add valor_gspn column to os_pecas to store original GSPN value before markup
    - This allows showing comparison between GSPN price and charged price
    
  2. Purpose
    - For OW/SC/ACC orders, show the original GSPN value vs final value with markup
    - Helps with transparency and verification of pricing
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'os_pecas' 
    AND column_name = 'valor_gspn'
  ) THEN
    ALTER TABLE os_pecas 
    ADD COLUMN valor_gspn numeric(10,2) DEFAULT 0;
    
    COMMENT ON COLUMN os_pecas.valor_gspn IS 'Original GSPN value before markup (for comparison)';
  END IF;
END $$;