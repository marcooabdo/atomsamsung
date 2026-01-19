/*
  # Permitir que todos vejam todas as unidades

  1. Changes
    - Adiciona política para permitir que qualquer usuário autenticado veja todas as unidades
    - Necessário para o chat mostrar a unidade de cada contato

  2. Security
    - Apenas SELECT é permitido para todos
    - INSERT/UPDATE/DELETE continuam restritos
*/

CREATE POLICY "All authenticated users can view all unidades"
  ON unidades
  FOR SELECT
  TO authenticated
  USING (true);
