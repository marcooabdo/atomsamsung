/*
# Create GIA Route Plans System

1. New Tables
   - `gia_planos_rota`
     - `id` (uuid, primary key)
     - `unidade_id` (uuid, FK to unidades) - which unit this plan belongs to
     - `rota_id` (uuid, FK to rotas) - which route (e.g., "Rota Rosa")
     - `tecnico_id` (uuid, FK to usuarios) - assigned technician
     - `nome_rota` (text) - route name for quick reference
     - `nome_tecnico` (text) - technician name for quick reference
     - `data_inicio` (date) - first day of the route
     - `data_fim` (date) - expected last day
     - `status` (text) - 'planejado', 'em_andamento', 'concluido', 'cancelado', 'parcial'
     - `total_os` (integer) - total OS count
     - `total_km_estimado` (numeric) - estimated total KM
     - `total_tempo_estimado_min` (integer) - estimated total time in minutes
     - `observacoes` (text) - notes
     - `criado_por` (uuid) - who requested the plan
     - `created_at`, `updated_at` (timestamptz)

   - `gia_plano_paradas`
     - `id` (uuid, primary key)
     - `plano_id` (uuid, FK to gia_planos_rota) - parent plan
     - `os_id` (uuid, FK to os) - which OS
     - `dia` (integer) - day number in the route (1, 2, 3...)
     - `data_prevista` (date) - expected date for this stop
     - `ordem` (integer) - sequence order within the day
     - `horario_previsto_chegada` (time) - expected arrival time
     - `horario_previsto_saida` (time) - expected departure time (arrival + repair time)
     - `tipo_reparo` (text) - repair type (cached from OS)
     - `tempo_estimado_min` (integer) - repair time in minutes
     - `km_da_anterior` (numeric) - KM from previous stop
     - `status` (text) - 'pendente', 'confirmado', 'em_andamento', 'concluido', 'reagendado', 'cliente_indisponivel'
     - `confirmado_cliente` (boolean) - client confirmed?
     - `confirmado_em` (timestamptz)
     - `confirmado_por` (uuid)
     - `checkin_hora` (timestamptz) - actual check-in time
     - `checkout_hora` (timestamptz) - actual checkout time
     - `desvio_minutos` (integer) - deviation from planned time
     - `os_numero_samsung` (text) - Samsung OS number (cached)
     - `os_numero_interno` (text) - Internal OS number (cached)
     - `cliente_nome` (text) - client name (cached)
     - `cliente_telefone` (text) - phone (cached)
     - `cidade` (text) - city (cached)
     - `endereco` (text) - address (cached)
     - `pecas_json` (jsonb) - parts info: [{id, pn, delivery}]
     - `created_at`, `updated_at` (timestamptz)

2. Security
   - Enable RLS on both tables
   - All authenticated users can read (shared visibility)
   - Insert/update/delete for authenticated (team management)

3. Notes
   - The paradas table caches OS info so the route plan is a self-contained snapshot
   - pecas_json stores the parts list (ID, PN, delivery) at plan creation time
   - desvio_minutos is computed during real-time tracking
*/

CREATE TABLE IF NOT EXISTS gia_planos_rota (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  rota_id uuid REFERENCES rotas(id) ON DELETE SET NULL,
  tecnico_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  nome_rota text NOT NULL,
  nome_tecnico text NOT NULL,
  data_inicio date NOT NULL,
  data_fim date,
  status text NOT NULL DEFAULT 'planejado' CHECK (status IN ('planejado', 'em_andamento', 'concluido', 'cancelado', 'parcial')),
  total_os integer NOT NULL DEFAULT 0,
  total_km_estimado numeric DEFAULT 0,
  total_tempo_estimado_min integer DEFAULT 0,
  observacoes text,
  criado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE gia_planos_rota ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_gia_planos_rota" ON gia_planos_rota;
CREATE POLICY "select_gia_planos_rota" ON gia_planos_rota FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_gia_planos_rota" ON gia_planos_rota;
CREATE POLICY "insert_gia_planos_rota" ON gia_planos_rota FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_gia_planos_rota" ON gia_planos_rota;
CREATE POLICY "update_gia_planos_rota" ON gia_planos_rota FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_gia_planos_rota" ON gia_planos_rota;
CREATE POLICY "delete_gia_planos_rota" ON gia_planos_rota FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_gia_planos_rota_unidade ON gia_planos_rota(unidade_id);
CREATE INDEX IF NOT EXISTS idx_gia_planos_rota_tecnico ON gia_planos_rota(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_gia_planos_rota_status ON gia_planos_rota(status);

-- Paradas (stops) table

CREATE TABLE IF NOT EXISTS gia_plano_paradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid NOT NULL REFERENCES gia_planos_rota(id) ON DELETE CASCADE,
  os_id uuid REFERENCES os(id) ON DELETE SET NULL,
  dia integer NOT NULL DEFAULT 1,
  data_prevista date,
  ordem integer NOT NULL DEFAULT 1,
  horario_previsto_chegada time,
  horario_previsto_saida time,
  tipo_reparo text,
  tempo_estimado_min integer NOT NULL DEFAULT 60,
  km_da_anterior numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'em_andamento', 'concluido', 'reagendado', 'cliente_indisponivel')),
  confirmado_cliente boolean NOT NULL DEFAULT false,
  confirmado_em timestamptz,
  confirmado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  checkin_hora timestamptz,
  checkout_hora timestamptz,
  desvio_minutos integer DEFAULT 0,
  os_numero_samsung text,
  os_numero_interno text,
  cliente_nome text,
  cliente_telefone text,
  cidade text,
  endereco text,
  pecas_json jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE gia_plano_paradas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_gia_plano_paradas" ON gia_plano_paradas;
CREATE POLICY "select_gia_plano_paradas" ON gia_plano_paradas FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_gia_plano_paradas" ON gia_plano_paradas;
CREATE POLICY "insert_gia_plano_paradas" ON gia_plano_paradas FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_gia_plano_paradas" ON gia_plano_paradas;
CREATE POLICY "update_gia_plano_paradas" ON gia_plano_paradas FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_gia_plano_paradas" ON gia_plano_paradas;
CREATE POLICY "delete_gia_plano_paradas" ON gia_plano_paradas FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_gia_plano_paradas_plano ON gia_plano_paradas(plano_id);
CREATE INDEX IF NOT EXISTS idx_gia_plano_paradas_os ON gia_plano_paradas(os_id);
CREATE INDEX IF NOT EXISTS idx_gia_plano_paradas_status ON gia_plano_paradas(status);
CREATE INDEX IF NOT EXISTS idx_gia_plano_paradas_data ON gia_plano_paradas(data_prevista);
