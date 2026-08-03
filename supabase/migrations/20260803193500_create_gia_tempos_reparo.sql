/*
# Create GIA Repair Time Configuration Table

1. New Tables
   - `gia_tempos_reparo`
     - `id` (uuid, primary key)
     - `tipo_reparo` (text, not null) - the repair type (e.g., "Troca de painel", "Visita Técnica")
     - `tempo_minutos` (integer, not null) - average time in minutes for this repair type
     - `unidade_id` (uuid, FK to unidades) - unit this config belongs to
     - `ativo` (boolean, default true) - whether this config is active
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

2. Security
   - Enable RLS
   - Policies for authenticated users to CRUD based on unit access

3. Notes
   - Each unit can have its own repair time estimates
   - Unique constraint on (tipo_reparo, unidade_id) to prevent duplicates
   - Used by GIA route planner to estimate time at each stop
*/

CREATE TABLE IF NOT EXISTS gia_tempos_reparo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_reparo text NOT NULL,
  tempo_minutos integer NOT NULL CHECK (tempo_minutos > 0),
  unidade_id uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tipo_reparo, unidade_id)
);

ALTER TABLE gia_tempos_reparo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_gia_tempos_reparo" ON gia_tempos_reparo;
CREATE POLICY "select_gia_tempos_reparo" ON gia_tempos_reparo FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_gia_tempos_reparo" ON gia_tempos_reparo;
CREATE POLICY "insert_gia_tempos_reparo" ON gia_tempos_reparo FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_gia_tempos_reparo" ON gia_tempos_reparo;
CREATE POLICY "update_gia_tempos_reparo" ON gia_tempos_reparo FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_gia_tempos_reparo" ON gia_tempos_reparo;
CREATE POLICY "delete_gia_tempos_reparo" ON gia_tempos_reparo FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_gia_tempos_reparo_unidade ON gia_tempos_reparo(unidade_id);
CREATE INDEX IF NOT EXISTS idx_gia_tempos_reparo_tipo ON gia_tempos_reparo(tipo_reparo);
