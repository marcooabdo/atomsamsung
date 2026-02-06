/*
  # Sistema de Metas de Performance

  1. Nova Tabela
    - `metas_performance`
      - `id` (uuid, primary key)
      - `unidade_id` (uuid, referência para unidades)
      - `ano` (integer) - Ano da meta
      - `mes` (integer) - Mês da meta (1-12)
      - `meta_receita_lp` (numeric) - Meta de receita para OS tipo LP
      - `meta_receita_ow` (numeric) - Meta de receita para OS tipo OW
      - `meta_eficiencia_operacional` (numeric) - Meta de eficiência em dias/horas
      - `meta_taxa_aprovacao` (numeric) - Meta de taxa de aprovação em porcentagem
      - `criado_por` (uuid, referência para usuarios)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `metas_performance` table
    - Add policies for authenticated users based on unit access
*/

CREATE TABLE IF NOT EXISTS metas_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes >= 1 AND mes <= 12),
  meta_receita_lp numeric DEFAULT 0,
  meta_receita_ow numeric DEFAULT 0,
  meta_eficiencia_operacional numeric DEFAULT 0,
  meta_taxa_aprovacao numeric DEFAULT 0,
  criado_por uuid NOT NULL REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(unidade_id, ano, mes)
);

ALTER TABLE metas_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view metas of their unit"
  ON metas_performance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        usuarios.unidade_id = metas_performance.unidade_id
        OR usuarios.tipo IN ('master', 'diretoria')
        OR usuarios.unidade_id IS NULL
      )
    )
  );

CREATE POLICY "Managers can insert metas for their unit"
  ON metas_performance FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        (usuarios.unidade_id = metas_performance.unidade_id AND usuarios.tipo IN ('gerente', 'master', 'diretoria'))
        OR usuarios.tipo IN ('master', 'diretoria')
        OR usuarios.unidade_id IS NULL
      )
    )
  );

CREATE POLICY "Managers can update metas for their unit"
  ON metas_performance FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        (usuarios.unidade_id = metas_performance.unidade_id AND usuarios.tipo IN ('gerente', 'master', 'diretoria'))
        OR usuarios.tipo IN ('master', 'diretoria')
        OR usuarios.unidade_id IS NULL
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        (usuarios.unidade_id = metas_performance.unidade_id AND usuarios.tipo IN ('gerente', 'master', 'diretoria'))
        OR usuarios.tipo IN ('master', 'diretoria')
        OR usuarios.unidade_id IS NULL
      )
    )
  );

CREATE POLICY "Managers can delete metas for their unit"
  ON metas_performance FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        (usuarios.unidade_id = metas_performance.unidade_id AND usuarios.tipo IN ('gerente', 'master', 'diretoria'))
        OR usuarios.tipo IN ('master', 'diretoria')
        OR usuarios.unidade_id IS NULL
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_metas_performance_unidade_ano_mes 
  ON metas_performance(unidade_id, ano, mes);
