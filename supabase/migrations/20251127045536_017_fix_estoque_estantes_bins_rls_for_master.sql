/*
  # Fix RLS para Estoque Estantes e Bins - Permitir Master Users

  ## Problema
  Mesma situação das salas: usuários master não conseguem criar
  estantes e bins devido às políticas RLS.

  ## Solução
  Ajustar políticas de estantes e bins para permitir master users

  ## Mudanças
  - Atualizar políticas de estoque_estantes
  - Atualizar políticas de estoque_bins
*/

-- ============================================
-- ESTOQUE_ESTANTES
-- ============================================

DROP POLICY IF EXISTS "Users can insert estantes in their unit" ON estoque_estantes;
DROP POLICY IF EXISTS "Users can update estantes in their unit" ON estoque_estantes;
DROP POLICY IF EXISTS "Users can delete estantes in their unit" ON estoque_estantes;
DROP POLICY IF EXISTS "Users can view estantes from their unit" ON estoque_estantes;

-- SELECT
CREATE POLICY "Users can view estantes"
  ON estoque_estantes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
    OR
    EXISTS (
      SELECT 1 FROM estoque_salas s
      WHERE s.id = estoque_estantes.sala_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );

-- INSERT
CREATE POLICY "Users can insert estantes"
  ON estoque_estantes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
    OR
    EXISTS (
      SELECT 1 FROM estoque_salas s
      WHERE s.id = estoque_estantes.sala_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );

-- UPDATE
CREATE POLICY "Users can update estantes"
  ON estoque_estantes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
    OR
    EXISTS (
      SELECT 1 FROM estoque_salas s
      WHERE s.id = estoque_estantes.sala_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
    OR
    EXISTS (
      SELECT 1 FROM estoque_salas s
      WHERE s.id = estoque_estantes.sala_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );

-- DELETE
CREATE POLICY "Users can delete estantes"
  ON estoque_estantes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
    OR
    EXISTS (
      SELECT 1 FROM estoque_salas s
      WHERE s.id = estoque_estantes.sala_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );

-- ============================================
-- ESTOQUE_BINS
-- ============================================

DROP POLICY IF EXISTS "Users can insert bins in their unit" ON estoque_bins;
DROP POLICY IF EXISTS "Users can update bins in their unit" ON estoque_bins;
DROP POLICY IF EXISTS "Users can delete bins in their unit" ON estoque_bins;
DROP POLICY IF EXISTS "Users can view bins from their unit" ON estoque_bins;

-- SELECT
CREATE POLICY "Users can view bins"
  ON estoque_bins FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
    OR
    EXISTS (
      SELECT 1 FROM estoque_estantes e
      JOIN estoque_salas s ON e.sala_id = s.id
      WHERE e.id = estoque_bins.estante_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );

-- INSERT
CREATE POLICY "Users can insert bins"
  ON estoque_bins FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
    OR
    EXISTS (
      SELECT 1 FROM estoque_estantes e
      JOIN estoque_salas s ON e.sala_id = s.id
      WHERE e.id = estoque_bins.estante_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );

-- UPDATE
CREATE POLICY "Users can update bins"
  ON estoque_bins FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
    OR
    EXISTS (
      SELECT 1 FROM estoque_estantes e
      JOIN estoque_salas s ON e.sala_id = s.id
      WHERE e.id = estoque_bins.estante_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
    OR
    EXISTS (
      SELECT 1 FROM estoque_estantes e
      JOIN estoque_salas s ON e.sala_id = s.id
      WHERE e.id = estoque_bins.estante_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );

-- DELETE
CREATE POLICY "Users can delete bins"
  ON estoque_bins FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
    OR
    EXISTS (
      SELECT 1 FROM estoque_estantes e
      JOIN estoque_salas s ON e.sala_id = s.id
      WHERE e.id = estoque_bins.estante_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );