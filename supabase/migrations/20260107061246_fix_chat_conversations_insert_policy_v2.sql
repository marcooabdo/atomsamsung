/*
  # Fix chat_conversations INSERT policy - Version 2
  
  1. Problem
    - INSERT policy exists but still returns 403 Forbidden
    - Need to ensure policy allows authenticated users to create conversations
  
  2. Solution
    - Drop and recreate INSERT policy with proper checks
    - Ensure user is authenticated and matches created_by field
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can create conversations" ON chat_conversations;

-- Recreate INSERT policy with explicit authentication check
CREATE POLICY "Users can create conversations"
  ON chat_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
  );

-- Grant INSERT permission to authenticated users
GRANT INSERT ON chat_conversations TO authenticated;