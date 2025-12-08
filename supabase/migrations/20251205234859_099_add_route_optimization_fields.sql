/*
  # Add Route Optimization Fields

  1. Changes to usuarios table
    - Add `endereco_base_cep` (text) - CEP do endereço base do técnico
    - Add `endereco_base_rua` (text) - Rua do endereço base
    - Add `endereco_base_numero` (text) - Número do endereço base
    - Add `endereco_base_cidade` (text) - Cidade do endereço base
    - Add `endereco_base_estado` (text) - Estado do endereço base
    - Add `endereco_base_lat` (numeric) - Latitude do endereço base
    - Add `endereco_base_lng` (numeric) - Longitude do endereço base
    - Add `permite_pernoite` (boolean) - Se o técnico pode pernoitar em rotas
    - Add `raio_atuacao_km` (integer) - Raio de atuação preferencial em km
    - Add `tempo_medio_ih_minutos` (integer) - Tempo médio para serviços IH
    - Add `tempo_medio_ci_minutos` (integer) - Tempo médio para serviços CI
    - Add `tempo_deslocamento_minutos_por_km` (numeric) - Tempo médio de deslocamento por km
    - Add `dias_trabalho` (text[]) - Array com dias da semana que trabalha

  2. Changes to unidades table
    - Add `lat_base` (numeric) - Latitude da base da unidade
    - Add `lng_base` (numeric) - Longitude da base da unidade
    - Add `endereco_base` (text) - Endereço completo da base

  3. Changes to agendamentos table
    - Add `ordem_na_rota` (integer) - Ordem de sequência na rota otimizada
    - Add `distancia_da_base_km` (numeric) - Distância da base em km
    - Add `tempo_deslocamento_minutos` (integer) - Tempo estimado de deslocamento
    - Add `lat` (numeric) - Latitude do endereço da OS
    - Add `lng` (numeric) - Longitude do endereço da OS

  4. New Tables
    - `otimizacao_rotas_historico` - Histórico de otimizações executadas
    - `cache_distancias` - Cache de distâncias calculadas entre pontos

  5. Security
    - Enable RLS on new tables
    - Add appropriate policies for authenticated users
*/

-- Add fields to usuarios table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'endereco_base_cep'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN endereco_base_cep text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'endereco_base_rua'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN endereco_base_rua text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'endereco_base_numero'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN endereco_base_numero text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'endereco_base_cidade'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN endereco_base_cidade text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'endereco_base_estado'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN endereco_base_estado text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'endereco_base_lat'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN endereco_base_lat numeric(10, 7);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'endereco_base_lng'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN endereco_base_lng numeric(10, 7);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'permite_pernoite'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN permite_pernoite boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'raio_atuacao_km'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN raio_atuacao_km integer DEFAULT 50;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'tempo_medio_ih_minutos'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN tempo_medio_ih_minutos integer DEFAULT 120;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'tempo_medio_ci_minutos'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN tempo_medio_ci_minutos integer DEFAULT 180;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'tempo_deslocamento_minutos_por_km'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN tempo_deslocamento_minutos_por_km numeric(4, 2) DEFAULT 2.5;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'dias_trabalho'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN dias_trabalho text[] DEFAULT ARRAY['seg', 'ter', 'qua', 'qui', 'sex'];
  END IF;
END $$;

-- Add fields to unidades table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unidades' AND column_name = 'lat_base'
  ) THEN
    ALTER TABLE unidades ADD COLUMN lat_base numeric(10, 7);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unidades' AND column_name = 'lng_base'
  ) THEN
    ALTER TABLE unidades ADD COLUMN lng_base numeric(10, 7);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unidades' AND column_name = 'endereco_base'
  ) THEN
    ALTER TABLE unidades ADD COLUMN endereco_base text;
  END IF;
END $$;

-- Add fields to agendamentos table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos' AND column_name = 'ordem_na_rota'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN ordem_na_rota integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos' AND column_name = 'distancia_da_base_km'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN distancia_da_base_km numeric(8, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos' AND column_name = 'tempo_deslocamento_minutos'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN tempo_deslocamento_minutos integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos' AND column_name = 'lat'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN lat numeric(10, 7);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos' AND column_name = 'lng'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN lng numeric(10, 7);
  END IF;
END $$;

-- Create otimizacao_rotas_historico table
CREATE TABLE IF NOT EXISTS otimizacao_rotas_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES unidades(id),
  executado_por uuid NOT NULL REFERENCES usuarios(id),
  executado_em timestamptz DEFAULT now(),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  rotas_incluidas text[] NOT NULL,
  numero_os_otimizadas integer NOT NULL,
  numero_tecnicos_envolvidos integer NOT NULL,
  distancia_total_antes_km numeric(10, 2),
  distancia_total_depois_km numeric(10, 2),
  tempo_total_antes_minutos integer,
  tempo_total_depois_minutos integer,
  melhoria_percentual numeric(5, 2),
  detalhes jsonb,
  aplicado boolean DEFAULT false,
  aplicado_em timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE otimizacao_rotas_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view optimization history of their unit"
  ON otimizacao_rotas_historico
  FOR SELECT
  TO authenticated
  USING (
    unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo = 'master')
  );

CREATE POLICY "Users can insert optimization history"
  ON otimizacao_rotas_historico
  FOR INSERT
  TO authenticated
  WITH CHECK (
    unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo = 'master')
  );

CREATE POLICY "Users can update optimization history"
  ON otimizacao_rotas_historico
  FOR UPDATE
  TO authenticated
  USING (
    unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo = 'master')
  );

-- Create cache_distancias table
CREATE TABLE IF NOT EXISTS cache_distancias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ponto_a_lat numeric(10, 7) NOT NULL,
  ponto_a_lng numeric(10, 7) NOT NULL,
  ponto_b_lat numeric(10, 7) NOT NULL,
  ponto_b_lng numeric(10, 7) NOT NULL,
  distancia_km numeric(8, 2) NOT NULL,
  tempo_minutos integer NOT NULL,
  fonte text NOT NULL,
  calculado_em timestamptz DEFAULT now(),
  valido_ate timestamptz DEFAULT (now() + interval '30 days'),
  UNIQUE(ponto_a_lat, ponto_a_lng, ponto_b_lat, ponto_b_lng)
);

ALTER TABLE cache_distancias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read distance cache"
  ON cache_distancias
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert distance cache"
  ON cache_distancias
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agendamentos_ordem_rota ON agendamentos(ordem_na_rota) WHERE ordem_na_rota IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agendamentos_lat_lng ON agendamentos(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cache_distancias_pontos ON cache_distancias(ponto_a_lat, ponto_a_lng, ponto_b_lat, ponto_b_lng);
CREATE INDEX IF NOT EXISTS idx_cache_distancias_validade ON cache_distancias(valido_ate);
CREATE INDEX IF NOT EXISTS idx_otimizacao_historico_unidade ON otimizacao_rotas_historico(unidade_id);
CREATE INDEX IF NOT EXISTS idx_otimizacao_historico_data ON otimizacao_rotas_historico(data_inicio, data_fim);
