/*
  # Make agendamento_checklist_vinculados RLS Fully Permissive

  1. Problem
    - RLS policies checked unit access which blocked users from different units
    - Any authenticated user should be able to link checklists

  2. Solution
    - Make all policies permissive for authenticated users
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view agendamento checklist links" ON agendamento_checklist_vinculados;
DROP POLICY IF EXISTS "Users can link checklists to agendamentos" ON agendamento_checklist_vinculados;
DROP POLICY IF EXISTS "Users can update agendamento checklist links" ON agendamento_checklist_vinculados;
DROP POLICY IF EXISTS "Users can delete agendamento checklist links" ON agendamento_checklist_vinculados;

-- Create simple permissive policies
CREATE POLICY "Authenticated users can select agendamento checklist links"
  ON agendamento_checklist_vinculados FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert agendamento checklist links"
  ON agendamento_checklist_vinculados FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update agendamento checklist links"
  ON agendamento_checklist_vinculados FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete agendamento checklist links"
  ON agendamento_checklist_vinculados FOR DELETE
  TO authenticated
  USING (true);
