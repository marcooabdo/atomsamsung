/*
  # Add System Policies to Samsung Sync Logs

  1. Changes
    - Add policies to allow service role (system) to insert and update sync logs
    - These policies allow Edge Functions using SERVICE_ROLE_KEY to bypass RLS checks
    - Required because SERVICE_ROLE_KEY context doesn't have auth.uid()

  2. Security
    - Policies are permissive (WITH CHECK (true)) to allow system operations
    - Only applies to authenticated context (service role is authenticated)
    - Does not affect existing user-specific policies
*/

-- Drop existing conflicting policies if they exist
DROP POLICY IF EXISTS "System can insert sync logs" ON samsung_sync_logs;
DROP POLICY IF EXISTS "System can update sync logs" ON samsung_sync_logs;

-- Policy for system/service role to insert sync logs
-- This allows Edge Functions to create log entries
CREATE POLICY "System can insert sync logs"
  ON samsung_sync_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy for system/service role to update sync logs
-- This allows Edge Functions to update log status and details
CREATE POLICY "System can update sync logs"
  ON samsung_sync_logs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
