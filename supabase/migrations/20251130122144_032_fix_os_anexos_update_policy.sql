/*
  # Fix os_anexos UPDATE policy

  1. Changes
    - Add UPDATE policy to os_anexos
    - Allows authenticated users to update os_id field
    - Required for moving attachments when approving cotacao
  
  2. Security
    - Users can update attachments they created
    - Or master users (without unidade_id)
*/

CREATE POLICY "Usuários podem atualizar anexos"
  ON os_anexos
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = usuario_id
    OR EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.unidade_id IS NULL
    )
  )
  WITH CHECK (
    auth.uid() = usuario_id
    OR EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.unidade_id IS NULL
    )
  );