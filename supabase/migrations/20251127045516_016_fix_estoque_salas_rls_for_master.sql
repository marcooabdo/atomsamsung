/*
  # Fix RLS para Estoque Salas - Permitir Master Users

  ## Problema
  Usuários master (com unidade_id NULL) não conseguem criar salas
  pois a política RLS verifica `unidade_id = usuario.unidade_id`
  e NULL = NULL resulta em false no SQL.

  ## Solução
  Ajustar políticas para permitir:
  - Usuários master podem criar salas em qualquer unidade
  - Usuários de unidade específica podem criar apenas na sua unidade

  ## Mudanças
  - DROP das políticas antigas de INSERT, UPDATE, DELETE
  - CREATE de novas políticas que consideram tipo de usuário
*/

-- Drop políticas antigas de INSERT
DROP POLICY IF EXISTS "Users can insert salas in their unit" ON estoque_salas;
DROP POLICY IF EXISTS "Users can update salas in their unit" ON estoque_salas;
DROP POLICY IF EXISTS "Users can delete salas in their unit" ON estoque_salas;

-- Nova política INSERT: Master pode criar em qualquer unidade
CREATE POLICY "Users can insert salas"
  ON estoque_salas FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Master ou Diretoria podem criar em qualquer unidade
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
    OR
    -- Usuário de unidade específica só pode criar na sua unidade
    (
      unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );

-- Nova política UPDATE: Master pode editar qualquer sala
CREATE POLICY "Users can update salas"
  ON estoque_salas FOR UPDATE
  TO authenticated
  USING (
    -- Master ou Diretoria podem editar qualquer sala
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
    OR
    -- Usuário de unidade específica só pode editar salas da sua unidade
    (
      unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    -- Mesmas regras para o WITH CHECK
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
    OR
    (
      unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );

-- Nova política DELETE: Master pode deletar qualquer sala
CREATE POLICY "Users can delete salas"
  ON estoque_salas FOR DELETE
  TO authenticated
  USING (
    -- Master ou Diretoria podem deletar qualquer sala
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
    OR
    -- Usuário de unidade específica só pode deletar salas da sua unidade
    (
      unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );

-- Atualizar política SELECT para ser consistente
DROP POLICY IF EXISTS "Users can view salas from their unit" ON estoque_salas;

CREATE POLICY "Users can view salas"
  ON estoque_salas FOR SELECT
  TO authenticated
  USING (
    -- Master ou Diretoria podem ver todas as salas
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
    OR
    -- Usuário de unidade específica só vê salas da sua unidade
    (
      unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );