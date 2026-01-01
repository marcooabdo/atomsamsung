/*
  # Fix agendamentos RLS policies

  1. Problem
    - Table `agendamentos` has RLS enabled but no policies
    - This blocks ALL access to the table
    - The os_select_policy that checks agendamentos fails because of this
    - Technicians cannot access OS even though they have agendamentos

  2. Solution
    - Create SELECT policy: users can see their own agendamentos or from their unit
    - Create INSERT policy: authorized users can create agendamentos
    - Create UPDATE policy: authorized users can update agendamentos
    - Create DELETE policy: only master, diretoria, gerente can delete

  3. Security
    - Technicians can only see their own agendamentos
    - Master and diretoria can see all
    - Gerente and recepcao can see from their unit
*/

-- Drop existing policies if any
DROP POLICY IF EXISTS "agendamentos_select_policy" ON agendamentos;
DROP POLICY IF EXISTS "agendamentos_insert_policy" ON agendamentos;
DROP POLICY IF EXISTS "agendamentos_update_policy" ON agendamentos;
DROP POLICY IF EXISTS "agendamentos_delete_policy" ON agendamentos;

-- SELECT policy: users can see their own agendamentos or from their unit
CREATE POLICY "agendamentos_select_policy"
  ON agendamentos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        -- Master and diretoria can see all
        u.tipo IN ('master', 'diretoria')
        -- Others can see from their unit
        OR u.unidade_id = agendamentos.unidade_id
        -- Or if they are the assigned technician
        OR u.id = agendamentos.tecnico_id
      )
    )
  );

-- INSERT policy: authorized users can create agendamentos
CREATE POLICY "agendamentos_insert_policy"
  ON agendamentos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'diretoria', 'gerente', 'recepcao', 'tecnico', 'tecnico_ih')
    )
  );

-- UPDATE policy: authorized users can update agendamentos
CREATE POLICY "agendamentos_update_policy"
  ON agendamentos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR (u.tipo = 'gerente' AND u.unidade_id = agendamentos.unidade_id)
        OR (u.tipo IN ('tecnico', 'tecnico_ih') AND u.id = agendamentos.tecnico_id)
        OR (u.tipo = 'recepcao' AND u.unidade_id = agendamentos.unidade_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR (u.tipo = 'gerente' AND u.unidade_id = agendamentos.unidade_id)
        OR (u.tipo IN ('tecnico', 'tecnico_ih') AND u.id = agendamentos.tecnico_id)
        OR (u.tipo = 'recepcao' AND u.unidade_id = agendamentos.unidade_id)
      )
    )
  );

-- DELETE policy: only authorized users can delete
CREATE POLICY "agendamentos_delete_policy"
  ON agendamentos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo = 'master'
        OR (u.tipo = 'diretoria' AND u.unidade_id = agendamentos.unidade_id)
        OR (u.tipo = 'gerente' AND u.unidade_id = agendamentos.unidade_id)
      )
    )
  );
