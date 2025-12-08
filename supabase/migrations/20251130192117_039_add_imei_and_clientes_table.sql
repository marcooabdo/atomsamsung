/*
  # Add IMEI field and Clientes table

  1. Changes to existing tables
    - Add `aparelho_imei` column to `os` table (nullable text)
    - Add `aparelho_imei` column to `cotacoes` table (nullable text)

  2. New Tables
    - `clientes`
      - `id` (uuid, primary key)
      - `cpf_cnpj` (text, unique, indexed for fast lookup)
      - `nome` (text)
      - `telefone` (text, nullable)
      - `email` (text, nullable)
      - `endereco` (text, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  3. Security
    - Enable RLS on `clientes` table
    - Add policies for authenticated users to read and manage clients
*/

-- Add IMEI field to os table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'aparelho_imei'
  ) THEN
    ALTER TABLE os ADD COLUMN aparelho_imei text;
  END IF;
END $$;

-- Add IMEI field to cotacoes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cotacoes' AND column_name = 'aparelho_imei'
  ) THEN
    ALTER TABLE cotacoes ADD COLUMN aparelho_imei text;
  END IF;
END $$;

-- Create clientes table
CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf_cnpj text UNIQUE NOT NULL,
  nome text NOT NULL,
  telefone text,
  email text,
  endereco text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for fast CPF/CNPJ lookup
CREATE INDEX IF NOT EXISTS idx_clientes_cpf_cnpj ON clientes(cpf_cnpj);

-- Enable RLS on clientes table
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view all clients
CREATE POLICY "Authenticated users can view clients"
  ON clientes
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert clients
CREATE POLICY "Authenticated users can insert clients"
  ON clientes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update clients
CREATE POLICY "Authenticated users can update clients"
  ON clientes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Only master users can delete clients
CREATE POLICY "Master users can delete clients"
  ON clientes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'master'
    )
  );
