/*
  # Create system_secrets table for secure API key storage

  1. New Tables
    - `system_secrets`
      - `id` (uuid, primary key)
      - `key` (text, unique) - the secret name (e.g., 'OPENAI_API_KEY')
      - `value` (text) - the secret value
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `system_secrets` table
    - Only master users can read/manage secrets
    - Edge functions access via service role key
*/

CREATE TABLE IF NOT EXISTS system_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master users can view secrets"
  ON system_secrets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'master'
    )
  );

CREATE POLICY "Master users can insert secrets"
  ON system_secrets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'master'
    )
  );

CREATE POLICY "Master users can update secrets"
  ON system_secrets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'master'
    )
  );

CREATE POLICY "Master users can delete secrets"
  ON system_secrets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'master'
    )
  );