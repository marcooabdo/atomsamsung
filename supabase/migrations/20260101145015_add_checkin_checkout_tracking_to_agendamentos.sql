/*
  # Add check-in/check-out tracking to agendamentos

  1. New Columns
    - `checkin_realizado` (boolean) - Flag if check-in was done
    - `checkin_hora` (timestamptz) - Check-in timestamp
    - `checkin_latitude` (numeric) - Technician's latitude at check-in
    - `checkin_longitude` (numeric) - Technician's longitude at check-in
    - `checkout_realizado` (boolean) - Flag if check-out was done
    - `checkout_hora` (timestamptz) - Check-out timestamp
    - `checkout_latitude` (numeric) - Technician's latitude at check-out
    - `checkout_longitude` (numeric) - Technician's longitude at check-out

  2. Purpose
    - Track technician's location and time when starting/finishing service
    - Enable route verification and service time calculation
*/

ALTER TABLE agendamentos 
ADD COLUMN IF NOT EXISTS checkin_realizado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS checkin_hora timestamptz,
ADD COLUMN IF NOT EXISTS checkin_latitude numeric,
ADD COLUMN IF NOT EXISTS checkin_longitude numeric,
ADD COLUMN IF NOT EXISTS checkout_realizado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS checkout_hora timestamptz,
ADD COLUMN IF NOT EXISTS checkout_latitude numeric,
ADD COLUMN IF NOT EXISTS checkout_longitude numeric;
