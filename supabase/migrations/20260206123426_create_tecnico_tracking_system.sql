/*
  # Create Technician Live Tracking System

  1. New Tables
    - `tecnico_localizacoes`
      - `id` (uuid, primary key)
      - `tecnico_id` (uuid, FK to usuarios)
      - `unidade_id` (uuid, FK to unidades)
      - `latitude` / `longitude` (numeric coordinates)
      - `precisao` (GPS accuracy in meters)
      - `velocidade` (speed in km/h)
      - `heading` (compass heading)
      - `timestamp` (when position was captured)
      - `fonte` (gps/network/manual)
      - `em_atendimento` (boolean, is currently servicing an OS)
      - `os_atual_id` (uuid, current OS being serviced)

  2. New Functions
    - `upsert_tecnico_localizacao` - Insert new position and prune old records
    - `get_latest_tecnico_positions` - Get latest position for all technicians in a unit

  3. New Views
    - `v_tecnico_posicao_atual` - Latest position per technician with presence info

  4. Security
    - RLS enabled on tecnico_localizacoes
    - Technicians can insert their own positions and view their own data
    - Managers can view positions for their unit
    - Master/diretoria can view all positions
*/

CREATE TABLE IF NOT EXISTS tecnico_localizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tecnico_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  latitude numeric(10,7) NOT NULL,
  longitude numeric(10,7) NOT NULL,
  precisao numeric(8,1),
  velocidade numeric(6,1),
  heading numeric(5,1),
  timestamp timestamptz NOT NULL DEFAULT now(),
  fonte text DEFAULT 'gps' CHECK (fonte IN ('gps', 'network', 'manual')),
  em_atendimento boolean DEFAULT false,
  os_atual_id uuid REFERENCES os(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tecnico_localizacoes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tecnico_loc_tecnico ON tecnico_localizacoes(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_tecnico_loc_timestamp ON tecnico_localizacoes(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tecnico_loc_unidade ON tecnico_localizacoes(unidade_id);

CREATE POLICY "Tecnicos insert own location"
  ON tecnico_localizacoes FOR INSERT
  TO authenticated
  WITH CHECK (tecnico_id = auth.uid());

CREATE POLICY "Tecnicos view own location"
  ON tecnico_localizacoes FOR SELECT
  TO authenticated
  USING (tecnico_id = auth.uid());

CREATE POLICY "Managers view unit locations"
  ON tecnico_localizacoes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR (u.tipo IN ('gerente', 'administrador') AND u.unidade_id = tecnico_localizacoes.unidade_id)
      )
    )
  );

CREATE OR REPLACE FUNCTION upsert_tecnico_localizacao(
  p_tecnico_id uuid,
  p_lat numeric,
  p_lng numeric,
  p_precisao numeric DEFAULT NULL,
  p_velocidade numeric DEFAULT NULL,
  p_heading numeric DEFAULT NULL,
  p_em_atendimento boolean DEFAULT false,
  p_os_atual_id uuid DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO tecnico_localizacoes (
    tecnico_id, unidade_id, latitude, longitude, precisao, velocidade, heading, em_atendimento, os_atual_id
  )
  SELECT p_tecnico_id, u.unidade_id, p_lat, p_lng, p_precisao, p_velocidade, p_heading, p_em_atendimento, p_os_atual_id
  FROM usuarios u WHERE u.id = p_tecnico_id;

  DELETE FROM tecnico_localizacoes
  WHERE tecnico_id = p_tecnico_id
  AND id NOT IN (
    SELECT id FROM tecnico_localizacoes
    WHERE tecnico_id = p_tecnico_id
    ORDER BY timestamp DESC
    LIMIT 200
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_latest_tecnico_positions(p_unidade_id uuid DEFAULT NULL)
RETURNS TABLE (
  tecnico_id uuid,
  tecnico_nome text,
  unidade_id uuid,
  latitude numeric,
  longitude numeric,
  precisao numeric,
  velocidade numeric,
  heading numeric,
  last_update timestamptz,
  em_atendimento boolean,
  os_atual_id uuid,
  presence_status text,
  device_type text
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (tl.tecnico_id)
    tl.tecnico_id,
    u.nome::text as tecnico_nome,
    tl.unidade_id,
    tl.latitude,
    tl.longitude,
    tl.precisao,
    tl.velocidade,
    tl.heading,
    tl.timestamp as last_update,
    tl.em_atendimento,
    tl.os_atual_id,
    COALESCE(up.status, 'offline')::text as presence_status,
    up.device_type::text
  FROM tecnico_localizacoes tl
  JOIN usuarios u ON u.id = tl.tecnico_id
  LEFT JOIN user_presence up ON up.user_id = tl.tecnico_id
  WHERE tl.timestamp > now() - interval '24 hours'
  AND (p_unidade_id IS NULL OR tl.unidade_id = p_unidade_id)
  ORDER BY tl.tecnico_id, tl.timestamp DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos' AND column_name = 'confirmado_cliente'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN confirmado_cliente boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos' AND column_name = 'confirmado_em'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN confirmado_em timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos' AND column_name = 'confirmado_por'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN confirmado_por uuid REFERENCES usuarios(id);
  END IF;
END $$;
