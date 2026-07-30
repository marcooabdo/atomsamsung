/*
# Fix servicos SELECT RLS policy to support additional units

## Problem
Users with additional units (via `usuario_unidades` junction table) cannot see
services linked to those units. The current SELECT policy only checks the user's
primary `unidade_id` from the `usuarios` table.

## Changes
- DROP and recreate the SELECT policy on `servicos` to also check `usuario_unidades`.
- A user can now see services that belong to:
  1. Their primary unit (`usuarios.unidade_id`)
  2. Any additional unit they have in `usuario_unidades`
  3. Global services (unidade_id IS NULL)
  4. All services if they are master/diretoria

## Security
- Still requires authenticated role.
- Ownership check extended to include additional units.
*/

DROP POLICY IF EXISTS "Users can view servicos from their unit or global" ON servicos;

CREATE POLICY "Users can view servicos from their unit or global"
  ON servicos FOR SELECT
  TO authenticated
  USING (
    unidade_id IS NULL
    OR EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = servicos.unidade_id
        OR EXISTS (
          SELECT 1 FROM usuario_unidades uu
          WHERE uu.usuario_id = auth.uid()
          AND uu.unidade_id = servicos.unidade_id
        )
      )
    )
  );
