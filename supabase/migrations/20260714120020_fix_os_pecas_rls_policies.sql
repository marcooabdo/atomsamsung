/*
# Fix os_pecas RLS policies - allow unit-based access

## Problem
The existing "FOR ALL" policy on os_pecas only allows users with types
estoque/gerente/master or the tecnico assigned to the OS to insert/update/delete parts.
This blocks other users (administrativo, diretoria, tecnico not assigned) from the same
unit from adding parts, causing "new row violates row-level security policy" errors.

## Changes
- Drop the overly-restrictive "FOR ALL" policy
- Keep and update the SELECT policy to allow all users from the same unit
- Add separate INSERT, UPDATE, DELETE policies that allow any authenticated user
  from the same unit to manage parts on OS records belonging to their unit
- Master users can manage parts on any OS regardless of unit

## Security
- RLS remains enabled
- Access is scoped by unit: users can only manage parts on OS from their own unit
- Master users have unrestricted access
*/

-- Drop the restrictive FOR ALL policy
DROP POLICY IF EXISTS "Usuários autorizados podem gerenciar peças de OS" ON os_pecas;

-- Drop existing SELECT policy to recreate with better logic
DROP POLICY IF EXISTS "Usuários podem ver peças de OS acessíveis" ON os_pecas;

-- SELECT: users from the same unit, master, or tecnico assigned
DROP POLICY IF EXISTS "os_pecas_select" ON os_pecas;
CREATE POLICY "os_pecas_select" ON os_pecas FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM os o
    JOIN usuarios u ON u.id = auth.uid()
    WHERE o.id = os_pecas.os_id
    AND (
      u.tipo = 'master'
      OR u.unidade_id = o.unidade_id
      OR u.id = o.tecnico_id
    )
  )
);

-- INSERT: users from the same unit or master
DROP POLICY IF EXISTS "os_pecas_insert" ON os_pecas;
CREATE POLICY "os_pecas_insert" ON os_pecas FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM os o
    JOIN usuarios u ON u.id = auth.uid()
    WHERE o.id = os_pecas.os_id
    AND (
      u.tipo = 'master'
      OR u.unidade_id = o.unidade_id
      OR u.id = o.tecnico_id
    )
  )
);

-- UPDATE: users from the same unit or master
DROP POLICY IF EXISTS "os_pecas_update" ON os_pecas;
CREATE POLICY "os_pecas_update" ON os_pecas FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM os o
    JOIN usuarios u ON u.id = auth.uid()
    WHERE o.id = os_pecas.os_id
    AND (
      u.tipo = 'master'
      OR u.unidade_id = o.unidade_id
      OR u.id = o.tecnico_id
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM os o
    JOIN usuarios u ON u.id = auth.uid()
    WHERE o.id = os_pecas.os_id
    AND (
      u.tipo = 'master'
      OR u.unidade_id = o.unidade_id
      OR u.id = o.tecnico_id
    )
  )
);

-- DELETE: users from the same unit or master
DROP POLICY IF EXISTS "os_pecas_delete" ON os_pecas;
CREATE POLICY "os_pecas_delete" ON os_pecas FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM os o
    JOIN usuarios u ON u.id = auth.uid()
    WHERE o.id = os_pecas.os_id
    AND (
      u.tipo = 'master'
      OR u.unidade_id = o.unidade_id
      OR u.id = o.tecnico_id
    )
  )
);