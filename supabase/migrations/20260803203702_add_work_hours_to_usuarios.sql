/*
# Add work hours configuration to usuarios (technicians)

1. Modified Tables
   - `usuarios`
     - `hora_inicio` (time) - Work start time (e.g. 08:00)
     - `hora_fim` (time) - Work end time (e.g. 17:00)
     - `tempo_almoco_min` (integer) - Lunch break duration in minutes (e.g. 60)

2. Notes
   - These fields allow per-technician scheduling configuration
   - Used by GIA route optimizer to calculate available work hours per day
   - Defaults: 08:00 start, 17:00 end, 60 min lunch
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'hora_inicio') THEN
    ALTER TABLE usuarios ADD COLUMN hora_inicio time DEFAULT '08:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'hora_fim') THEN
    ALTER TABLE usuarios ADD COLUMN hora_fim time DEFAULT '17:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'tempo_almoco_min') THEN
    ALTER TABLE usuarios ADD COLUMN tempo_almoco_min integer DEFAULT 60;
  END IF;
END $$;