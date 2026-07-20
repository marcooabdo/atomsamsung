/*
# Fix OS INSERT/UPDATE/DELETE Policies for Multi-Unit Access

## Problem
Users with additional units (via usuario_unidades) can now SEE OS from those units,
but cannot INSERT, UPDATE, or DELETE them because the write policies still only check
the primary unit.

## Solution
Update INSERT, UPDATE, DELETE policies on `os` table to use user_has_access_to_unit().
Also fix the agendamentos INSERT/UPDATE/DELETE policies.

## Modified Policies
- `os`: INSERT, UPDATE, DELETE policies
- `agendamentos`: INSERT, UPDATE, DELETE policies
*/

-- OS INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert OS in their unit" ON os;
CREATE POLICY "Authenticated users can insert OS in their unit" ON os
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_access_to_unit(unidade_id));

-- OS UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update OS in their unit" ON os;
CREATE POLICY "Authenticated users can update OS in their unit" ON os
  FOR UPDATE TO authenticated
  USING (public.user_has_access_to_unit(unidade_id))
  WITH CHECK (public.user_has_access_to_unit(unidade_id));

-- OS DELETE policy
DROP POLICY IF EXISTS "Only master/gerente can delete OS" ON os;
CREATE POLICY "Only master/gerente can delete OS" ON os
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'diretoria', 'gerente')
    )
    AND public.user_has_access_to_unit(unidade_id)
  );

-- agendamentos INSERT policy
DROP POLICY IF EXISTS "agendamentos_insert_policy" ON agendamentos;
CREATE POLICY "agendamentos_insert_policy" ON agendamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_access_to_unit(unidade_id));

-- agendamentos UPDATE policy
DROP POLICY IF EXISTS "agendamentos_update_policy" ON agendamentos;
CREATE POLICY "agendamentos_update_policy" ON agendamentos
  FOR UPDATE TO authenticated
  USING (
    public.user_has_access_to_unit(unidade_id)
    OR EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid() AND u.id = agendamentos.tecnico_id
    )
  )
  WITH CHECK (
    public.user_has_access_to_unit(unidade_id)
    OR EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid() AND u.id = agendamentos.tecnico_id
    )
  );

-- agendamentos DELETE policy
DROP POLICY IF EXISTS "agendamentos_delete_policy" ON agendamentos;
CREATE POLICY "agendamentos_delete_policy" ON agendamentos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'diretoria', 'gerente', 'administrador')
    )
    AND public.user_has_access_to_unit(unidade_id)
  );
