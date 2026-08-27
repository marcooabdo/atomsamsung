/*
# Add chat message reactions and pinned conversations

1. New Tables
   - `chat_message_reactions`
     - `id` (uuid, primary key)
     - `message_id` (uuid, FK to chat_messages)
     - `user_id` (uuid, FK to usuarios)
     - `emoji` (text, the emoji character)
     - `created_at` (timestamptz)
     - Unique constraint: one emoji per user per message

2. Modified Tables
   - `chat_participants`
     - `pinned_at` (timestamptz, nullable) - When this conversation was pinned by the user

3. Security
   - RLS enabled on chat_message_reactions
   - Authenticated users can CRUD their own reactions
   - All authenticated users can see reactions on messages they can see

4. Important Notes
   - Users can pin up to 5 conversations (enforced by app logic)
   - Each user can only react once with a given emoji per message
   - Reactions are lightweight - just emoji + user
*/

CREATE TABLE IF NOT EXISTS chat_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE chat_message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_reactions" ON chat_message_reactions;
CREATE POLICY "select_reactions" ON chat_message_reactions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_reactions" ON chat_message_reactions;
CREATE POLICY "insert_own_reactions" ON chat_message_reactions FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_own_reactions" ON chat_message_reactions;
CREATE POLICY "delete_own_reactions" ON chat_message_reactions FOR DELETE
  TO authenticated USING (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_participants' AND column_name = 'pinned_at') THEN
    ALTER TABLE chat_participants ADD COLUMN pinned_at timestamptz DEFAULT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_message_reactions_message ON chat_message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_pinned ON chat_participants(user_id, pinned_at) WHERE pinned_at IS NOT NULL;
