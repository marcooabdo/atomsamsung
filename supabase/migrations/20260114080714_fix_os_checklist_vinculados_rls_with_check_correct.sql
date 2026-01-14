/*
  # Fix RLS Policy for os_checklist_vinculados INSERT - Correct WITH CHECK

  1. Problem
    - Current policy references os_checklist_vinculados.os_id in WITH CHECK
    - During INSERT, the row doesn't exist yet, so the subquery fails
    - Need to check against the NEW values being inserted

  2. Solution
    - Simplify policy to check if user has access to the OS being referenced
    - Use direct comparison instead of referencing the new row

  3. Security
    - Maintains unit isolation
    - Masters can link to any OS
    - Regular users can only link to their unit's OSs
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can link checklists to their unit OSs" ON os_checklist_vinculados;

-- Create new policy that checks the OS directly
CREATE POLICY "Users can link checklists to their unit OSs"
  ON os_checklist_vinculados
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM usuarios u
      WHERE u.id = auth.uid()
        AND (
          u.unidade_id IS NULL  -- Master users can link to any OS
          OR EXISTS (
            SELECT 1 FROM os o
            WHERE o.id = os_id  -- os_id from the INSERT statement
              AND o.unidade_id = u.unidade_id
          )
        )
    )
  );
