/*
  # Create Deslocamento KM Cache Table

  1. New Tables
    - `deslocamento_km_cache`
      - `id` (uuid, primary key)
      - `os_id` (uuid, FK to os)
      - `unidade_id` (uuid, FK to unidades)
      - `origem_cidade` (text) - base city of the unit
      - `origem_estado` (text) - base state of the unit
      - `destino_cidade` (text) - client city at time of calculation
      - `destino_estado` (text) - client state at time of calculation
      - `distancia_km` (numeric) - one-way distance in km
      - `distancia_km_ida_volta` (numeric) - round-trip distance
      - `receita_calculada` (numeric) - revenue = round-trip km * 1.38
      - `km_manual` (numeric, nullable) - manual override for km
      - `receita_manual` (numeric, nullable) - manual override for revenue
      - `erro_calculo` (boolean) - true if API failed
      - `erro_mensagem` (text) - error message from API
      - `calculado_at` (timestamptz) - when last calculated
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `deslocamento_km_cache`
    - Policies for authenticated users based on unit membership

  3. Important Notes
    - The cache is per-OS to avoid recalculating distances
    - Manual overrides (km_manual, receita_manual) take precedence
    - The erro_calculo flag helps identify OS that need city corrections
*/

CREATE TABLE IF NOT EXISTS deslocamento_km_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES os(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES unidades(id),
  origem_cidade text,
  origem_estado text,
  destino_cidade text,
  destino_estado text,
  distancia_km numeric DEFAULT 0,
  distancia_km_ida_volta numeric DEFAULT 0,
  receita_calculada numeric DEFAULT 0,
  km_manual numeric,
  receita_manual numeric,
  erro_calculo boolean DEFAULT false,
  erro_mensagem text,
  calculado_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(os_id)
);

CREATE INDEX IF NOT EXISTS idx_deslocamento_km_cache_os_id ON deslocamento_km_cache(os_id);
CREATE INDEX IF NOT EXISTS idx_deslocamento_km_cache_unidade_id ON deslocamento_km_cache(unidade_id);
CREATE INDEX IF NOT EXISTS idx_deslocamento_km_cache_destino_cidade ON deslocamento_km_cache(destino_cidade);

ALTER TABLE deslocamento_km_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read deslocamento cache for their unit"
  ON deslocamento_km_cache
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.tipo IN ('master', 'diretoria') OR u.unidade_id = deslocamento_km_cache.unidade_id)
    )
  );

CREATE POLICY "Authenticated users can insert deslocamento cache for their unit"
  ON deslocamento_km_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.tipo IN ('master', 'diretoria') OR u.unidade_id = deslocamento_km_cache.unidade_id)
    )
  );

CREATE POLICY "Authenticated users can update deslocamento cache for their unit"
  ON deslocamento_km_cache
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.tipo IN ('master', 'diretoria') OR u.unidade_id = deslocamento_km_cache.unidade_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.tipo IN ('master', 'diretoria') OR u.unidade_id = deslocamento_km_cache.unidade_id)
    )
  );

CREATE POLICY "Authenticated users can delete deslocamento cache for their unit"
  ON deslocamento_km_cache
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.tipo IN ('master', 'diretoria') OR u.unidade_id = deslocamento_km_cache.unidade_id)
    )
  );
