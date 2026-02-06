/*
  # Create AI Analysis table

  1. New Tables
    - `analises_ia`
      - `id` (uuid, primary key)
      - `unidade_id` (uuid, FK to unidades, nullable for global analyses)
      - `tipo` (text) - type of analysis (dashboard_geral, operacional, financeiro, etc.)
      - `periodo_inicio` (date) - analysis period start
      - `periodo_fim` (date) - analysis period end
      - `dados_entrada` (jsonb) - input data sent to AI
      - `resultado` (text) - AI analysis result text
      - `modelo` (text) - AI model used
      - `tokens_utilizados` (integer) - tokens consumed
      - `solicitado_por` (uuid, FK to usuarios) - who requested
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `analises_ia` table
    - Policy for authenticated users to read analyses from their unit
    - Policy for master/diretoria to read all analyses
    - Policy for authenticated users to insert analyses
*/

CREATE TABLE IF NOT EXISTS analises_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES unidades(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'dashboard_geral',
  periodo_inicio date,
  periodo_fim date,
  dados_entrada jsonb DEFAULT '{}'::jsonb,
  resultado text NOT NULL DEFAULT '',
  modelo text NOT NULL DEFAULT 'gpt-4o-mini',
  tokens_utilizados integer DEFAULT 0,
  solicitado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE analises_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own unit analyses"
  ON analises_ia
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id IS NULL
        OR u.unidade_id = analises_ia.unidade_id
      )
    )
  );

CREATE POLICY "Authenticated users can insert analyses"
  ON analises_ia
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Master can update analyses"
  ON analises_ia
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'diretoria')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'diretoria')
    )
  );

CREATE POLICY "Master can delete analyses"
  ON analises_ia
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'diretoria')
    )
  );

CREATE INDEX IF NOT EXISTS idx_analises_ia_unidade ON analises_ia(unidade_id);
CREATE INDEX IF NOT EXISTS idx_analises_ia_tipo ON analises_ia(tipo);
CREATE INDEX IF NOT EXISTS idx_analises_ia_created ON analises_ia(created_at DESC);
