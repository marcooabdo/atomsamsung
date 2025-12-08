/*
  # Fix estoque_pecas RLS Policies

  ## Summary
  Removes all duplicate RLS policies from estoque_pecas and creates a single, clean set of policies.

  ## Changes
  - Drop all existing policies on estoque_pecas
  - Create single SELECT policy allowing:
    - Master/Diretoria users to see ALL parts
    - Other users to see parts from their unit only
  - Create single INSERT policy
  - Create single UPDATE policy  
  - Create single DELETE policy

  ## Security
  - Ensures proper access control without conflicts
  - Master/Diretoria can access all units
  - Regular users restricted to their own unit
*/

-- Drop ALL existing policies on estoque_pecas
DROP POLICY IF EXISTS "Estoque pode gerenciar peças" ON estoque_pecas;
DROP POLICY IF EXISTS "Estoque users can manage estoque in their unit" ON estoque_pecas;
DROP POLICY IF EXISTS "Users can delete parts in their unit or any unit if master" ON estoque_pecas;
DROP POLICY IF EXISTS "Users can insert parts in their unit or any unit if master" ON estoque_pecas;
DROP POLICY IF EXISTS "Users can update parts in their unit or any unit if master" ON estoque_pecas;
DROP POLICY IF EXISTS "Users can view estoque based on unit" ON estoque_pecas;
DROP POLICY IF EXISTS "Users can view estoque from their unit" ON estoque_pecas;
DROP POLICY IF EXISTS "Users can view parts from their unit or all units if master" ON estoque_pecas;
DROP POLICY IF EXISTS "Usuários podem ver peças de estoque de sua unidade" ON estoque_pecas;

-- Create clean SELECT policy
CREATE POLICY "View parts based on user unit"
  ON estoque_pecas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        -- Master/Diretoria can see ALL parts
        usuarios.tipo IN ('master', 'diretoria')
        -- Other users see only their unit
        OR usuarios.unidade_id = estoque_pecas.unidade_id
      )
    )
  );

-- Create clean INSERT policy
CREATE POLICY "Insert parts in accessible units"
  ON estoque_pecas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador', 'estoque')
      AND (
        -- Master/Diretoria can insert in any unit
        usuarios.tipo IN ('master', 'diretoria')
        -- Other users insert only in their unit
        OR usuarios.unidade_id = estoque_pecas.unidade_id
      )
    )
  );

-- Create clean UPDATE policy
CREATE POLICY "Update parts in accessible units"
  ON estoque_pecas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador', 'estoque')
      AND (
        usuarios.tipo IN ('master', 'diretoria')
        OR usuarios.unidade_id = estoque_pecas.unidade_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador', 'estoque')
      AND (
        usuarios.tipo IN ('master', 'diretoria')
        OR usuarios.unidade_id = estoque_pecas.unidade_id
      )
    )
  );

-- Create clean DELETE policy
CREATE POLICY "Delete parts in accessible units"
  ON estoque_pecas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador', 'estoque')
      AND (
        usuarios.tipo IN ('master', 'diretoria')
        OR usuarios.unidade_id = estoque_pecas.unidade_id
      )
    )
  );
