/*
  # Create Samsung Sync Logs System

  1. New Tables
    - `samsung_sync_logs`
      - `id` (uuid, primary key) - Unique identifier for each sync log entry
      - `unidade_id` (uuid) - Reference to the unit that performed the sync
      - `config_id` (uuid, nullable) - Optional reference to old samsung_api_configs (for backward compatibility)
      - `status` (enum) - Current status of the sync (em_progresso, concluido, erro, concluido_com_erros)
      - `iniciado_em` (timestamptz) - When the sync started
      - `finalizado_em` (timestamptz, nullable) - When the sync finished
      - `executado_por` (uuid) - User who initiated the sync
      - `total_os_encontradas` (integer, nullable) - Total number of OS found in Samsung API
      - `total_os_criadas` (integer, nullable) - Total number of OS created in our system
      - `total_os_ignoradas` (integer, nullable) - Total number of OS ignored (already existed)
      - `mensagem_erro` (text, nullable) - Error message if sync failed
      - `detalhes` (jsonb, nullable) - Additional details about the sync
      - `created_at` (timestamptz) - Record creation timestamp

  2. Security
    - Enable RLS on `samsung_sync_logs` table
    - Add policies for authenticated users to manage their own unit's sync logs
    - Master and diretoria users can see all sync logs
*/

-- Create enum for sync status
DO $$ BEGIN
  CREATE TYPE samsung_sync_status AS ENUM ('em_progresso', 'concluido', 'erro', 'concluido_com_erros');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create samsung_sync_logs table
CREATE TABLE IF NOT EXISTS samsung_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES unidades(id) ON DELETE CASCADE NOT NULL,
  config_id uuid,
  status samsung_sync_status NOT NULL DEFAULT 'em_progresso',
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  executado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  total_os_encontradas integer,
  total_os_criadas integer,
  total_os_ignoradas integer,
  mensagem_erro text,
  detalhes jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE samsung_sync_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own unit sync logs" ON samsung_sync_logs;
DROP POLICY IF EXISTS "Master and diretoria can view all sync logs" ON samsung_sync_logs;
DROP POLICY IF EXISTS "Users can create sync logs for own unit" ON samsung_sync_logs;
DROP POLICY IF EXISTS "Master and diretoria can create sync logs for any unit" ON samsung_sync_logs;
DROP POLICY IF EXISTS "Users can update own unit sync logs" ON samsung_sync_logs;
DROP POLICY IF EXISTS "Master and diretoria can update all sync logs" ON samsung_sync_logs;
DROP POLICY IF EXISTS "System can manage sync logs" ON samsung_sync_logs;

-- Policy for system operations (service role)
CREATE POLICY "System can manage sync logs"
  ON samsung_sync_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy for users to view logs from their own unit
CREATE POLICY "Users can view own unit sync logs"
  ON samsung_sync_logs
  FOR SELECT
  TO authenticated
  USING (
    unidade_id IN (
      SELECT unidade_id
      FROM usuarios
      WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_samsung_sync_logs_unidade_id ON samsung_sync_logs(unidade_id);
CREATE INDEX IF NOT EXISTS idx_samsung_sync_logs_status ON samsung_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_samsung_sync_logs_created_at ON samsung_sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_samsung_sync_logs_executado_por ON samsung_sync_logs(executado_por);