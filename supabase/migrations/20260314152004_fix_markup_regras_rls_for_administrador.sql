/*
  # Fix markup_regras RLS policies for administrador users

  ## Problem
  The INSERT policy only allows administrador users to save markups when the
  markup's unidade_id exactly matches their own unidade_id. If the form sends
  null (global) or if the unit doesn't match, the insert/update is blocked.

  The UPDATE policy has no WITH CHECK clause, meaning it defaults to using
  the USING clause for both row visibility and modification check - this blocks
  administrators from updating markups that belong to their own unit if there's
  any mismatch.

  ## Changes
  1. Drop and recreate INSERT policy to ensure administrador can save for their unit
  2. Drop and recreate UPDATE policy to add proper WITH CHECK clause
  3. Non-master users always save with their own unidade_id (enforced by WITH CHECK)
*/

-- Drop existing INSERT and UPDATE policies
DROP POLICY IF EXISTS "Users can insert markup rules in their unit" ON markup_regras;
DROP POLICY IF EXISTS "Users can update markup rules in their unit" ON markup_regras;

-- New INSERT policy: master/diretoria can insert anything, gerente/administrador can only insert for their own unit
CREATE POLICY "Users can insert markup rules in their unit"
  ON markup_regras FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR (
          u.tipo IN ('gerente', 'administrador')
          AND u.unidade_id IS NOT NULL
          AND u.unidade_id = markup_regras.unidade_id
        )
      )
    )
  );

-- New UPDATE policy: master/diretoria can update all, gerente/administrador can only update their unit's markups
CREATE POLICY "Users can update markup rules in their unit"
  ON markup_regras FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR (
          u.tipo IN ('gerente', 'administrador')
          AND u.unidade_id IS NOT NULL
          AND u.unidade_id = markup_regras.unidade_id
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR (
          u.tipo IN ('gerente', 'administrador')
          AND u.unidade_id IS NOT NULL
          AND u.unidade_id = markup_regras.unidade_id
        )
      )
    )
  );
