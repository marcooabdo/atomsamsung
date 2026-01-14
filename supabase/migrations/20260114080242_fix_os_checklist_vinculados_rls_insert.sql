/*
  # Fix RLS Policy for os_checklist_vinculados INSERT

  1. Problem
    - Current policy blocks inserts with 403 Forbidden
    - Policy requires complex JOIN that may fail

  2. Changes
    - Drop existing INSERT policy
    - Create new simplified INSERT policy that checks:
      - User exists in usuarios table
      - User has access to the OS (either master or same unit)
    
  3. Security
    - Maintains unit isolation
    - Masters can link to any OS
    - Regular users can only link to their unit's OSs
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can link checklists to their unit OSs" ON os_checklist_vinculados;

-- Create new policy with better check
CREATE POLICY "Users can link checklists to their unit OSs"
  ON os_checklist_vinculados
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM usuarios u
      INNER JOIN os o ON o.id = os_checklist_vinculados.os_id
      WHERE u.id = auth.uid()
        AND (
          u.unidade_id IS NULL  -- Master users
          OR o.unidade_id = u.unidade_id  -- Same unit
        )
    )
  );
