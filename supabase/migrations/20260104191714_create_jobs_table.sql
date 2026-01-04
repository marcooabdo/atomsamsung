/*
  # Create Jobs Table

  1. New Tables
    - `jobs`
      - `id` (uuid, primary key)
      - `unidade_id` (uuid, FK to unidades, nullable for master jobs)
      - `os_ids` (uuid[], optional array of OS IDs)
      - `modulo` (text, module name like "pipeline_operacional")
      - `status` (text, job status like "processando", "concluido", "erro")
      - `is_running` (boolean, indicates if job is currently running)
      - `created_at` (timestamp, when job was created)
      - `finished_at` (timestamp, when job finished, nullable)
      - `error_message` (text, error details if any, nullable)
      - `metadata` (jsonb, additional job data, nullable)
  
  2. Security
    - Enable RLS on `jobs` table
    - Master users can see all jobs
    - Regular users can only see jobs from their unit
    - Service role (n8n) can create and update jobs

  3. Indexes
    - Index on `unidade_id` for filtering
    - Index on `is_running` for active job queries
    - Composite index on `unidade_id, is_running` for performance
*/

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID REFERENCES unidades(id) ON DELETE CASCADE,
  os_ids UUID[],
  modulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processando',
  is_running BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_jobs_unidade ON jobs(unidade_id);
CREATE INDEX IF NOT EXISTS idx_jobs_is_running ON jobs(is_running);
CREATE INDEX IF NOT EXISTS idx_jobs_unidade_running ON jobs(unidade_id, is_running);
CREATE INDEX IF NOT EXISTS idx_jobs_finished_at ON jobs(finished_at) WHERE finished_at IS NOT NULL;

CREATE POLICY "Master users can see all jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'master'
    )
  );

CREATE POLICY "Users can see jobs from their unit"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    unidade_id = (
      SELECT unidade_id
      FROM usuarios
      WHERE usuarios.id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role can update jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete old jobs"
  ON jobs FOR DELETE
  TO authenticated
  USING (true);
