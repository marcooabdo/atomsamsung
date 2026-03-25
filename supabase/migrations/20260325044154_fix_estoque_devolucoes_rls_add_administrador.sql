/*
  # Fix estoque_devolucoes RLS to include administrador role

  1. Changes
    - Drop existing policies that exclude administrador
    - Recreate with administrador included in allowed roles
  
  2. Security
    - administrador users can now see and manage devoluções
    - All other existing role access remains unchanged
*/

DO $$ BEGIN
  DROP POLICY IF EXISTS "Técnicos e estoque podem gerenciar devoluções" ON estoque_devolucoes;
  DROP POLICY IF EXISTS "Usuários autorizados podem ver devoluções" ON estoque_devolucoes;
END $$;

CREATE POLICY "Usuários autorizados podem ver devoluções"
  ON estoque_devolucoes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (SELECT auth.uid())
      AND usuarios.tipo IN ('estoque', 'tecnico', 'gerente', 'master', 'administrador', 'diretoria')
    )
  );

CREATE POLICY "Usuários autorizados podem inserir devoluções"
  ON estoque_devolucoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (SELECT auth.uid())
      AND usuarios.tipo IN ('estoque', 'tecnico', 'gerente', 'master', 'administrador')
    )
  );

CREATE POLICY "Usuários autorizados podem atualizar devoluções"
  ON estoque_devolucoes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (SELECT auth.uid())
      AND usuarios.tipo IN ('estoque', 'tecnico', 'gerente', 'master', 'administrador')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (SELECT auth.uid())
      AND usuarios.tipo IN ('estoque', 'tecnico', 'gerente', 'master', 'administrador')
    )
  );

CREATE POLICY "Usuários autorizados podem deletar devoluções"
  ON estoque_devolucoes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (SELECT auth.uid())
      AND usuarios.tipo IN ('estoque', 'tecnico', 'gerente', 'master', 'administrador')
    )
  );
