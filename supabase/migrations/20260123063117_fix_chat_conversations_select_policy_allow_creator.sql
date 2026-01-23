/*
  # Fix chat_conversations SELECT policy to allow creator

  This migration fixes the SELECT policy on chat_conversations to allow:
  1. Users who are participants (existing behavior)
  2. Users who created the conversation (new - allows .select() right after INSERT)
  
  This solves the issue where creating a new conversation fails because the user
  tries to SELECT the conversation before becoming a participant.
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON chat_conversations;

-- Create new SELECT policy that includes creator
CREATE POLICY "Users can view conversations they participate in or created"
  ON chat_conversations
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE chat_participants.conversation_id = chat_conversations.id
        AND chat_participants.user_id = auth.uid()
    )
  );
