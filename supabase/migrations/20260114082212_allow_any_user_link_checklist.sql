/*
  # Allow Any Authenticated User to Link Checklists

  1. Change
    - Remove unit-based restriction for linking checklists
    - Any authenticated user can link checklists to any OS they can see in pipeline

  2. Security
    - Users can only see OSs they have access to (enforced by OS table RLS)
    - If they can see the OS in the pipeline, they can link checklists to it
*/

-- Drop the restrictive trigger
DROP TRIGGER IF EXISTS validate_os_checklist_vinculados_insert_trigger ON os_checklist_vinculados;
DROP FUNCTION IF EXISTS validate_os_checklist_vinculados_insert();

-- The policy is already permissive (WITH CHECK (true))
-- So no changes needed there
