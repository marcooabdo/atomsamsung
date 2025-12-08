/*
  # Add taxa_para_cliente field to cotacoes

  1. Changes
    - Add `taxa_para_cliente` boolean field to cotacoes table
    - Default is false (taxa absorvida pela empresa)
    - When true, taxa de cartão é repassada ao cliente
  
  2. Notes
    - Campo usado para calcular valor final corretamente
    - Se false: valor final = valor bruto - desconto (taxa absorvida)
    - Se true: valor final = valor bruto - desconto + taxa (repassada)
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cotacoes' AND column_name = 'taxa_para_cliente'
  ) THEN
    ALTER TABLE cotacoes 
    ADD COLUMN taxa_para_cliente boolean DEFAULT false;
  END IF;
END $$;