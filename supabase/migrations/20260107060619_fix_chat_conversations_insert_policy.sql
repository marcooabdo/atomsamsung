/*
  # Fix chat_conversations INSERT policy - Missing policy

  1. Problem
    - The INSERT policy for chat_conversations was removed/missing
    - Users cannot create new group conversations
    - Error 403 (Forbidden) when trying to create groups

  2. Solution
    - Restore the INSERT policy to allow authenticated users to create conversations
    - Users can create conversations where they are the creator
*/

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Users can create conversations" ON chat_conversations;

-- Recreate INSERT policy - Authenticated users can create conversations
CREATE POLICY "Users can create conversations"
  ON chat_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());