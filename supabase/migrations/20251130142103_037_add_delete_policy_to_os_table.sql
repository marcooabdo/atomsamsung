/*
  # Add DELETE Policy to OS Table

  1. Problem
    - Table `os` has RLS enabled but NO DELETE policy
    - When users try to delete OS (via "Refazer Orçamento"), the deletion silently fails
    - RLS blocks ALL deletes without an explicit DELETE policy
    
  2. Current State
    ✅ Has policies: SELECT, INSERT, UPDATE
    ❌ Missing policy: DELETE
    
  3. Solution
    - Add DELETE policy allowing authorized users to delete OS
    - Authorized users: master, gerente, or the assigned technician
    
  4. Security
    - Users can only delete OS from their unit (unless master)
    - Technicians can only delete their own assigned OS
    - Gerentes can delete any OS from their unit
    - Master users can delete any OS
*/

-- Create DELETE policy for OS table
CREATE POLICY "Usuários autorizados podem deletar OS"
  ON os FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        -- Master users can delete any OS
        u.tipo = 'master'
        -- Gerentes can delete OS from their unit
        OR (u.tipo = 'gerente' AND u.unidade_id = os.unidade_id)
        -- Diretoria can delete OS from their unit
        OR (u.tipo = 'diretoria' AND u.unidade_id = os.unidade_id)
        -- Technicians can delete their own assigned OS
        OR (u.tipo = 'tecnico' AND u.id = os.tecnico_id)
      )
    )
  );

-- Verify the policy was created
DO $$
DECLARE
  delete_policy_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO delete_policy_count
  FROM pg_policies
  WHERE tablename = 'os'
    AND cmd = 'DELETE';
  
  IF delete_policy_count = 0 THEN
    RAISE EXCEPTION 'DELETE policy was not created for os table';
  END IF;
  
  RAISE NOTICE 'SUCCESS: DELETE policy created for os table (% policies)', delete_policy_count;
END $$;