/*
  # Fix chat_messages RLS to use helper function
  
  1. Problem
    - The policies on chat_messages query chat_participants
    - This can cause cross-table recursion issues
  
  2. Solution
    - Use the is_chat_participant function to avoid recursion
*/

DROP POLICY IF EXISTS "Users can view messages from their conversations" ON chat_messages;

CREATE POLICY "Users can view messages from their conversations"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (is_chat_participant(conversation_id));

DROP POLICY IF EXISTS "Users can send messages to their conversations" ON chat_messages;

CREATE POLICY "Users can send messages to their conversations"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    is_chat_participant(conversation_id)
  );
