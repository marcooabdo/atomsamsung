/*
# Fix rotas RLS policy to include administrador role

1. Modified Policies
  - Drop and recreate "Gerentes e masters podem gerenciar rotas" to also allow `administrador` type users.

2. Security
  - Users with tipo 'gerente', 'master', or 'administrador' can now INSERT/UPDATE/DELETE on rotas table.
*/

DROP POLICY IF EXISTS "Gerentes e masters podem gerenciar rotas" ON rotas;
CREATE POLICY "Gerentes e masters podem gerenciar rotas" ON rotas
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('gerente', 'master', 'administrador')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('gerente', 'master', 'administrador')
    )
  );
