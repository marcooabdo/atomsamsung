/*
# Create rotas_cidades_km reference table

1. New Tables
  - `rotas_cidades_km`
    - `id` (uuid, primary key)
    - `unidade_id` (uuid, FK to unidades)
    - `cidade` (text, destination city name)
    - `estado` (text, destination state)
    - `distancia_km` (numeric, one-way distance in km)
    - `distancia_km_ida_volta` (numeric, round-trip distance)
    - `receita_por_os` (numeric, km * R$1.38 tariff)
    - `calculado_at` (timestamptz, when the distance was calculated)
    - `created_at` / `updated_at` timestamps

2. Constraints
  - Unique per unidade + cidade (normalized lowercase) to avoid duplicates

3. Security
  - RLS enabled with permissive policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS rotas_cidades_km (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  cidade text NOT NULL,
  estado text,
  distancia_km numeric NOT NULL DEFAULT 0,
  distancia_km_ida_volta numeric NOT NULL DEFAULT 0,
  receita_por_os numeric NOT NULL DEFAULT 0,
  calculado_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rotas_cidades_km_unidade_cidade 
  ON rotas_cidades_km (unidade_id, lower(cidade));

ALTER TABLE rotas_cidades_km ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_rotas_cidades_km" ON rotas_cidades_km;
CREATE POLICY "select_rotas_cidades_km" ON rotas_cidades_km FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_rotas_cidades_km" ON rotas_cidades_km;
CREATE POLICY "insert_rotas_cidades_km" ON rotas_cidades_km FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_rotas_cidades_km" ON rotas_cidades_km;
CREATE POLICY "update_rotas_cidades_km" ON rotas_cidades_km FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_rotas_cidades_km" ON rotas_cidades_km;
CREATE POLICY "delete_rotas_cidades_km" ON rotas_cidades_km FOR DELETE
  TO authenticated USING (true);
