/*
  # Add WhatsApp Group Support to Atom Connect

  1. Modified Tables
    - `atom_connect_conversas`
      - `is_group` (boolean) - Whether this conversation is a WhatsApp group
      - `group_jid` (text) - The original group JID (e.g., 120363xxxxx@g.us)
    - `atom_connect_mensagens`
      - `sender_name` (text) - Name of message sender in group chats
      - `sender_phone` (text) - Phone of message sender in group chats

  2. Notes
    - Groups use the group JID as `cliente_telefone` identifier
    - Individual messages in groups track the actual sender
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'is_group'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN is_group boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'group_jid'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN group_jid text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_mensagens' AND column_name = 'sender_name'
  ) THEN
    ALTER TABLE atom_connect_mensagens ADD COLUMN sender_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_mensagens' AND column_name = 'sender_phone'
  ) THEN
    ALTER TABLE atom_connect_mensagens ADD COLUMN sender_phone text;
  END IF;
END $$;
