/*
# Fix os_pecas RLS policies to support additional units

## Problem
Users with additional units (via usuario_unidades junction table) cannot INSERT,
UPDATE, or DELETE os_pecas because the policies only check the user's primary
unidade_id. The SELECT policy already uses user_has_access_to_unit() which
checks both primary and additional units, but INSERT/UPDATE/DELETE do not.

## Changes
- Drop and recreate INSERT policy to use user_has_access_to_unit()
- Drop and recreate UPDATE policy to use user_has_access_to_unit()
- Drop and recreate DELETE policy to use user_has_access_to_unit()

## Security
- Master users retain full access
- Technicians assigned to the OS retain access
- Users with primary OR additional unit matching the OS unit now have access
*/

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
      OR u.id = o.tecnico_id
      OR user_has_access_to_unit(o.unidade_id)
    )
  )
);

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
      OR u.id = o.tecnico_id
      OR user_has_access_to_unit(o.unidade_id)
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
      OR u.id = o.tecnico_id
      OR user_has_access_to_unit(o.unidade_id)
    )
  )
);

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
      OR u.id = o.tecnico_id
      OR user_has_access_to_unit(o.unidade_id)
    )
  )
);