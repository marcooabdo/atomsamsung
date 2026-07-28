/*
# Add dias_semana column to gia_relatorios_config

1. Modified Tables
   - `gia_relatorios_config`
     - `dias_semana` (integer[], default '{1,2,3,4,5}') - days of week (0=Sun, 1=Mon, ..., 6=Sat)

2. Notes
   - Default is Monday-Friday (1-5) matching the current cron schedule
   - Array of integers allows flexible day-of-week selection
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gia_relatorios_config' AND column_name = 'dias_semana'
  ) THEN
    ALTER TABLE gia_relatorios_config ADD COLUMN dias_semana integer[] NOT NULL DEFAULT '{1,2,3,4,5}';
  END IF;
END $$;
