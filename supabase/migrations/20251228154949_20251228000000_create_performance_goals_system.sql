/*
  # Performance Goals and Metrics System

  1. New Tables
    - `metas_receita`
      - `id` (uuid, primary key)
      - `unidade_id` (uuid, references unidades)
      - `mes` (integer, 1-12)
      - `ano` (integer)
      - `meta_receita_lp` (numeric, default 0)
      - `meta_receita_ow` (numeric, default 0)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `indicadores_performance`
      - `id` (uuid, primary key)
      - `unidade_id` (uuid, references unidades)
      - `tempo_medio_resolucao_alvo` (integer, minutes target)
      - `taxa_aprovacao_minima` (numeric, percentage)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users with master access support
*/

-- Create metas_receita table
CREATE TABLE IF NOT EXISTS metas_receita (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES unidades(id) ON DELETE CASCADE NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano integer NOT NULL CHECK (ano >= 2020),
  meta_receita_lp numeric DEFAULT 0 NOT NULL CHECK (meta_receita_lp >= 0),
  meta_receita_ow numeric DEFAULT 0 NOT NULL CHECK (meta_receita_ow >= 0),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(unidade_id, mes, ano)
);

-- Create indicadores_performance table
CREATE TABLE IF NOT EXISTS indicadores_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES unidades(id) ON DELETE CASCADE NOT NULL UNIQUE,
  tempo_medio_resolucao_alvo integer DEFAULT 240 NOT NULL CHECK (tempo_medio_resolucao_alvo > 0), -- in minutes
  taxa_aprovacao_minima numeric DEFAULT 80 NOT NULL CHECK (taxa_aprovacao_minima >= 0 AND taxa_aprovacao_minima <= 100),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE metas_receita ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicadores_performance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for metas_receita
CREATE POLICY "Users can view metas_receita for their units"
  ON metas_receita
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
      AND (usuarios.unidade_id = metas_receita.unidade_id OR usuarios.unidade_id IS NULL)
    )
  );

CREATE POLICY "Users can insert metas_receita for their units"
  ON metas_receita
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
      AND (usuarios.unidade_id = metas_receita.unidade_id OR usuarios.unidade_id IS NULL)
    )
  );

CREATE POLICY "Users can update metas_receita for their units"
  ON metas_receita
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
      AND (usuarios.unidade_id = metas_receita.unidade_id OR usuarios.unidade_id IS NULL)
    )
  );

CREATE POLICY "Users can delete metas_receita for their units"
  ON metas_receita
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
      AND (usuarios.unidade_id = metas_receita.unidade_id OR usuarios.unidade_id IS NULL)
    )
  );

-- RLS Policies for indicadores_performance
CREATE POLICY "Users can view indicadores_performance for their units"
  ON indicadores_performance
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
      AND (usuarios.unidade_id = indicadores_performance.unidade_id OR usuarios.unidade_id IS NULL)
    )
  );

CREATE POLICY "Users can insert indicadores_performance for their units"
  ON indicadores_performance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
      AND (usuarios.unidade_id = indicadores_performance.unidade_id OR usuarios.unidade_id IS NULL)
    )
  );

CREATE POLICY "Users can update indicadores_performance for their units"
  ON indicadores_performance
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
      AND (usuarios.unidade_id = indicadores_performance.unidade_id OR usuarios.unidade_id IS NULL)
    )
  );

CREATE POLICY "Users can delete indicadores_performance for their units"
  ON indicadores_performance
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
      AND (usuarios.unidade_id = indicadores_performance.unidade_id OR usuarios.unidade_id IS NULL)
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_metas_receita_unidade ON metas_receita(unidade_id);
CREATE INDEX IF NOT EXISTS idx_metas_receita_mes_ano ON metas_receita(mes, ano);
CREATE INDEX IF NOT EXISTS idx_indicadores_performance_unidade ON indicadores_performance(unidade_id);

-- Add updated_at trigger for metas_receita
CREATE OR REPLACE FUNCTION update_metas_receita_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_metas_receita_updated_at
  BEFORE UPDATE ON metas_receita
  FOR EACH ROW
  EXECUTE FUNCTION update_metas_receita_updated_at();

-- Add updated_at trigger for indicadores_performance
CREATE OR REPLACE FUNCTION update_indicadores_performance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_indicadores_performance_updated_at
  BEFORE UPDATE ON indicadores_performance
  FOR EACH ROW
  EXECUTE FUNCTION update_indicadores_performance_updated_at();
