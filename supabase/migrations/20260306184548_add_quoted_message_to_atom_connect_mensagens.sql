/*
  # Add quoted message support to Atom Connect messages

  1. Modified Tables
    - `atom_connect_mensagens`
      - `quoted_message_id` (text, nullable) - The Evolution API message_id of the quoted/replied-to message
      - `quoted_content` (text, nullable) - Preview text of the quoted message
      - `quoted_sender` (text, nullable) - Name of the sender of the quoted message
      - `quoted_type` (text, nullable) - Type of the quoted message (text, image, etc.)

  2. Notes
    - quoted_message_id stores the Evolution message_id (not the UUID) to match across incoming/outgoing
    - quoted_content stores a preview so we don't need a join to display it
    - quoted_sender stores the display name of the quoted message sender
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_mensagens' AND column_name = 'quoted_message_id'
  ) THEN
    ALTER TABLE atom_connect_mensagens ADD COLUMN quoted_message_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_mensagens' AND column_name = 'quoted_content'
  ) THEN
    ALTER TABLE atom_connect_mensagens ADD COLUMN quoted_content text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_mensagens' AND column_name = 'quoted_sender'
  ) THEN
    ALTER TABLE atom_connect_mensagens ADD COLUMN quoted_sender text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_mensagens' AND column_name = 'quoted_type'
  ) THEN
    ALTER TABLE atom_connect_mensagens ADD COLUMN quoted_type text;
  END IF;
END $$;