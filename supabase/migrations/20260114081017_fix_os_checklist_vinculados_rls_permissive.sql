/*
  # Fix RLS Policy for os_checklist_vinculados - Permissive Policy

  1. Problem
    - Previous policies keep failing because WITH CHECK cannot properly
      reference the new row's values in subqueries
    - The os_checklist_vinculados.os_id reference doesn't work in INSERT context

  2. Solution
    - Create a simple permissive policy for authenticated users
    - The security is already enforced at the OS level (users can only see/access
      OSs from their unit anyway)
    - Add a trigger to validate the insert instead

  3. Security
    - Authenticated users can only INSERT if they have access to the OS
    - This is enforced by a BEFORE INSERT trigger
*/

-- Drop ALL existing INSERT policies to start fresh
DROP POLICY IF EXISTS "Users can link checklists to their unit OSs" ON os_checklist_vinculados;

-- Create a simple policy that allows authenticated users to insert
-- The actual validation will be done by a trigger
CREATE POLICY "Authenticated users can link checklists"
  ON os_checklist_vinculados
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create a trigger function to validate the insert
CREATE OR REPLACE FUNCTION validate_os_checklist_vinculados_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_user_unidade_id uuid;
  v_os_unidade_id uuid;
BEGIN
  -- Get user's unidade_id
  SELECT unidade_id INTO v_user_unidade_id
  FROM usuarios
  WHERE id = auth.uid();

  -- If user not found, deny
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found in usuarios table';
  END IF;

  -- If user is master (unidade_id IS NULL), allow
  IF v_user_unidade_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get OS's unidade_id
  SELECT unidade_id INTO v_os_unidade_id
  FROM os
  WHERE id = NEW.os_id;

  -- If OS not found, deny
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS not found';
  END IF;

  -- Check if user has access to this OS's unit
  IF v_os_unidade_id = v_user_unidade_id THEN
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'You do not have access to this OS';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS validate_os_checklist_vinculados_insert_trigger ON os_checklist_vinculados;

CREATE TRIGGER validate_os_checklist_vinculados_insert_trigger
  BEFORE INSERT ON os_checklist_vinculados
  FOR EACH ROW
  EXECUTE FUNCTION validate_os_checklist_vinculados_insert();
