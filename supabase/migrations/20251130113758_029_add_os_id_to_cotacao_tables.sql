/*
  # Add OS ID to Cotação Tables

  1. Changes
    - Add `os_id` uuid column to `cotacoes_pecas` table
    - Add `os_id` uuid column to `cotacoes_servicos` table
    - Add `os_id` uuid column to `cotacao_comentarios` table
    - Add foreign key references to `os` table
    
  2. Purpose
    - Allow moving cotação data to OS instead of copying
    - Track which OS the cotação items belong to
    - Maintain data integrity with foreign key constraints
*/

-- Add os_id to cotacoes_pecas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cotacoes_pecas' AND column_name = 'os_id'
  ) THEN
    ALTER TABLE cotacoes_pecas ADD COLUMN os_id uuid REFERENCES os(id);
  END IF;
END $$;

-- Add os_id to cotacoes_servicos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cotacoes_servicos' AND column_name = 'os_id'
  ) THEN
    ALTER TABLE cotacoes_servicos ADD COLUMN os_id uuid REFERENCES os(id);
  END IF;
END $$;

-- Add os_id to cotacao_comentarios
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cotacao_comentarios' AND column_name = 'os_id'
  ) THEN
    ALTER TABLE cotacao_comentarios ADD COLUMN os_id uuid REFERENCES os(id);
  END IF;
END $$;