/*
  # Add lat/lng coordinates to OS table

  1. Modified Tables
    - `os`
      - `lat` (numeric 10,8) - latitude coordinate for route optimization
      - `lng` (numeric 11,8) - longitude coordinate for route optimization
      - `ordem_visita` (integer) - visit order within a route

  2. Indexes
    - Spatial index on lat/lng for route queries

  3. Notes
    - These columns are used by the route optimizer to plan technician routes
    - Geocoding happens when OS is assigned to a route column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'lat'
  ) THEN
    ALTER TABLE os ADD COLUMN lat numeric(10,8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'lng'
  ) THEN
    ALTER TABLE os ADD COLUMN lng numeric(11,8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'ordem_visita'
  ) THEN
    ALTER TABLE os ADD COLUMN ordem_visita integer;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_os_lat_lng ON os(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_os_coluna_kanban_unidade ON os(coluna_kanban, unidade_id);
