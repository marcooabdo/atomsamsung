/*
  # Make os_checklist_vinculados RLS Fully Permissive for Authenticated Users

  1. Problem
    - INSERT policy was permissive but SELECT policy checked unit access
    - This caused issues because INSERT with RETURNING needs SELECT permission
    - Users from different units couldn't link checklists

  2. Solution
    - Make all policies permissive for authenticated users
    - Any authenticated user can CRUD checklist links
    - Access to OSs is already controlled by OS table RLS
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view checklist links for their unit OSs" ON os_checklist_vinculados;
DROP POLICY IF EXISTS "Authenticated users can link checklists" ON os_checklist_vinculados;
DROP POLICY IF EXISTS "Users can update checklist links for their unit OSs" ON os_checklist_vinculados;
DROP POLICY IF EXISTS "Users can delete checklist links for their unit OSs" ON os_checklist_vinculados;

-- Create simple permissive policies for authenticated users
CREATE POLICY "Authenticated users can select checklist links"
  ON os_checklist_vinculados FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert checklist links"
  ON os_checklist_vinculados FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update checklist links"
  ON os_checklist_vinculados FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete checklist links"
  ON os_checklist_vinculados FOR DELETE
  TO authenticated
  USING (true);
