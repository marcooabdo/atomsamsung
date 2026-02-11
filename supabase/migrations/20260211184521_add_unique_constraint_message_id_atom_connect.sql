/*
  # Add unique constraint on message_id for atom_connect_mensagens

  1. Changes
    - Add UNIQUE constraint on `message_id` column in `atom_connect_mensagens` table
    - This prevents duplicate messages at the database level when Evolution API
      sends the same webhook event multiple times simultaneously

  2. Important Notes
    - Uses partial unique index (WHERE message_id IS NOT NULL) to allow multiple NULL values
    - Removes any existing duplicates before adding the constraint
*/

DELETE FROM atom_connect_mensagens a
USING atom_connect_mensagens b
WHERE a.message_id IS NOT NULL
  AND a.message_id = b.message_id
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_atom_connect_mensagens_message_id_unique
  ON atom_connect_mensagens (message_id)
  WHERE message_id IS NOT NULL;
