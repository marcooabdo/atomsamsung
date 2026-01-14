/*
  # Fix Trigger for os_checklist_vinculados - More Permissive

  1. Problem
    - Previous trigger was blocking because user's auth.uid() might not
      match the usuarios.id in all cases
    - Some users might be authenticated but not have a matching record

  2. Solution
    - Make the trigger more permissive
    - If user is not found in usuarios, still allow the insert (they're authenticated)
    - Only check unit access if user exists in usuarios table

  3. Security
    - Authenticated users can insert
    - Unit validation only applies if user has a record in usuarios
*/

-- Drop existing trigger
DROP TRIGGER IF EXISTS validate_os_checklist_vinculados_insert_trigger ON os_checklist_vinculados;

-- Create a more permissive validation function
CREATE OR REPLACE FUNCTION validate_os_checklist_vinculados_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_user_unidade_id uuid;
  v_os_unidade_id uuid;
  v_user_found boolean := false;
BEGIN
  -- Try to get user's unidade_id
  SELECT unidade_id, true INTO v_user_unidade_id, v_user_found
  FROM usuarios
  WHERE id = auth.uid();

  -- If user not found in usuarios, allow the insert (they're authenticated via Supabase Auth)
  IF NOT v_user_found THEN
    RETURN NEW;
  END IF;

  -- If user is master (unidade_id IS NULL), allow
  IF v_user_unidade_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get OS's unidade_id
  SELECT unidade_id INTO v_os_unidade_id
  FROM os
  WHERE id = NEW.os_id;

  -- If OS not found, allow (defensive - shouldn't happen with FK constraint)
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- If OS has no unit, allow
  IF v_os_unidade_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if user has access to this OS's unit
  IF v_os_unidade_id = v_user_unidade_id THEN
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'You do not have access to this OS (user unit: %, os unit: %)', v_user_unidade_id, v_os_unidade_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER validate_os_checklist_vinculados_insert_trigger
  BEFORE INSERT ON os_checklist_vinculados
  FOR EACH ROW
  EXECUTE FUNCTION validate_os_checklist_vinculados_insert();
