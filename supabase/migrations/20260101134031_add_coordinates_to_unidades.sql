/*
  # Add coordinates to unidades table

  1. Changes
    - Add `latitude` column (numeric) to store latitude coordinates
    - Add `longitude` column (numeric) to store longitude coordinates
    - Populate existing unidades with coordinates based on their addresses

  2. Coordinates Added
    - Smart Center Samsung Feira de Santana: -12.2664, -38.9663
    - Smart Center Samsung Juiz de Fora: -21.7645, -43.3467
    - Smart Center Samsung Montes Claros: -16.7349, -43.8614
    - Smart Center Samsung São Bernardo do Campo: -23.6914, -46.5648
    - Unidade Principal (São Paulo): -23.5505, -46.6333

  3. Notes
    - Coordinates are based on the addresses registered in the system
    - Latitude and longitude are stored as numeric for precise calculations
*/

-- Add coordinate columns
ALTER TABLE unidades 
ADD COLUMN IF NOT EXISTS latitude numeric(10, 7),
ADD COLUMN IF NOT EXISTS longitude numeric(10, 7);

-- Update coordinates for existing units based on their addresses
UPDATE unidades 
SET 
  latitude = -12.2664,
  longitude = -38.9663
WHERE nome = 'Smart Center Samsung Feira de Santana';

UPDATE unidades 
SET 
  latitude = -21.7645,
  longitude = -43.3467
WHERE nome = 'Smart Center Samsung Juiz de Fora';

UPDATE unidades 
SET 
  latitude = -16.7349,
  longitude = -43.8614
WHERE nome = 'Smart Center Samsung Montes Claros';

UPDATE unidades 
SET 
  latitude = -23.6914,
  longitude = -46.5648
WHERE nome = 'Smart Center Samsung São Bernardo do Campo';

UPDATE unidades 
SET 
  latitude = -23.5505,
  longitude = -46.6333
WHERE nome = 'Unidade Principal';
