/*
  # Fix RLS Policies for cotacoes_servicos Table

  1. Problem
    - cotacoes_servicos has RLS enabled but no policies defined
    - Users cannot insert/update/delete services
    - Error: "new row violates row-level security policy"

  2. Solution
    - Create comprehensive RLS policies for all operations
    - Allow users to manage services in OS they have access to
    - Support both cotacao_id and os_id references

  3. Security
    - SELECT: Users can see services for OS in their unit
    - INSERT: Users can add services to OS in their unit
    - UPDATE: Users can update services for OS in their unit
    - DELETE: Users can delete services for OS in their unit
*/

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view cotacoes_servicos" ON cotacoes_servicos;
DROP POLICY IF EXISTS "Users can insert cotacoes_servicos" ON cotacoes_servicos;
DROP POLICY IF EXISTS "Users can update cotacoes_servicos" ON cotacoes_servicos;
DROP POLICY IF EXISTS "Users can delete cotacoes_servicos" ON cotacoes_servicos;

-- SELECT: Users can see services for OS/cotacoes they have access to
CREATE POLICY "Users can view cotacoes_servicos"
  ON cotacoes_servicos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo = 'master'
        OR u.unidade_id IS NULL
        OR (
          cotacoes_servicos.os_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM os
            WHERE os.id = cotacoes_servicos.os_id
            AND os.unidade_id = u.unidade_id
          )
        )
        OR (
          cotacoes_servicos.cotacao_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM cotacoes c
            WHERE c.id = cotacoes_servicos.cotacao_id
            AND c.unidade_id = u.unidade_id
          )
        )
      )
    )
  );

-- INSERT: Users can add services to OS/cotacoes in their unit
CREATE POLICY "Users can insert cotacoes_servicos"
  ON cotacoes_servicos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo = 'master'
        OR u.unidade_id IS NULL
        OR (
          os_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM os
            WHERE os.id = cotacoes_servicos.os_id
            AND os.unidade_id = u.unidade_id
          )
        )
        OR (
          cotacao_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM cotacoes c
            WHERE c.id = cotacoes_servicos.cotacao_id
            AND c.unidade_id = u.unidade_id
          )
        )
      )
    )
  );

-- UPDATE: Users can update services for OS/cotacoes in their unit
CREATE POLICY "Users can update cotacoes_servicos"
  ON cotacoes_servicos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo = 'master'
        OR u.unidade_id IS NULL
        OR (
          cotacoes_servicos.os_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM os
            WHERE os.id = cotacoes_servicos.os_id
            AND os.unidade_id = u.unidade_id
          )
        )
        OR (
          cotacoes_servicos.cotacao_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM cotacoes c
            WHERE c.id = cotacoes_servicos.cotacao_id
            AND c.unidade_id = u.unidade_id
          )
        )
      )
    )
  );

-- DELETE: Users can delete services for OS/cotacoes in their unit
CREATE POLICY "Users can delete cotacoes_servicos"
  ON cotacoes_servicos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo = 'master'
        OR u.unidade_id IS NULL
        OR (
          cotacoes_servicos.os_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM os
            WHERE os.id = cotacoes_servicos.os_id
            AND os.unidade_id = u.unidade_id
          )
        )
        OR (
          cotacoes_servicos.cotacao_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM cotacoes c
            WHERE c.id = cotacoes_servicos.cotacao_id
            AND c.unidade_id = u.unidade_id
          )
        )
      )
    )
  );