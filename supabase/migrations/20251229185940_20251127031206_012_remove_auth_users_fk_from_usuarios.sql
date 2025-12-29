/*
  # Remove Foreign Key to auth.users from usuarios table

  ## Problem
  The usuarios.id column has a foreign key constraint to auth.users.id
  This prevents creating usuarios records without first creating auth users.

  ## Solution
  Remove the foreign key constraint to allow independent user management.
  The table will still store UUID ids but won't require auth.users entries.

  ## Changes
  1. Drop the foreign key constraint usuarios_id_fkey
  2. Keep all other constraints and structure intact
  3. Preserve all existing data (unidades and usuarios)

  ## Note
  This allows the application to manage its own user records independently
  from Supabase Auth, which is appropriate for internal user management.
*/

-- Drop the foreign key constraint from usuarios.id to auth.users.id
ALTER TABLE usuarios 
DROP CONSTRAINT IF EXISTS usuarios_id_fkey;

-- Verify the constraint was removed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'usuarios_id_fkey' 
    AND table_name = 'usuarios'
  ) THEN
    RAISE EXCEPTION 'Failed to remove usuarios_id_fkey constraint';
  END IF;
END $$;