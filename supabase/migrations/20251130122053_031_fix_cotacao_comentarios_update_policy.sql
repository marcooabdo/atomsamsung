/*
  # Fix cotacao_comentarios UPDATE policy

  1. Changes
    - Add UPDATE policy to cotacao_comentarios
    - Allows authenticated users to update os_id field
    - Required for moving comments when approving cotacao
  
  2. Security
    - Users can only update their own comments
    - Or system comments (is_system = true)
*/

CREATE POLICY "Usuários autenticados podem atualizar comentários"
  ON cotacao_comentarios
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = usuario_id OR is_system = true)
  WITH CHECK (auth.uid() = usuario_id OR is_system = true);