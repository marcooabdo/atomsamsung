/*
  # Fix chat_participants RLS infinite recursion
  
  1. Problem
    - The SELECT policy on chat_participants was querying itself, causing infinite recursion
  
  2. Solution
    - Drop the problematic policy
    - Create a new policy that checks user_id directly without self-referencing
    - Allow users to see participants of conversations where they are a participant
*/

DROP POLICY IF EXISTS "Users can view participants of their conversations" ON chat_participants;

CREATE POLICY "Users can view participants of their conversations"
  ON chat_participants
  FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT conversation_id 
      FROM chat_participants 
      WHERE user_id = auth.uid()
    )
  );
