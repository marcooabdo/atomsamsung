/*
  # Add observacao column to atom_connect_instancias

  1. Changes
    - Add `observacao` column to `atom_connect_instancias` table
    - Column is optional (allows null values)
    - For storing notes/observations about the WhatsApp connection

  2. Purpose
    - Allow users to add descriptive notes to their WhatsApp connections
    - Useful for identifying connections when there are multiple instances
*/

ALTER TABLE atom_connect_instancias
ADD COLUMN IF NOT EXISTS observacao text;
