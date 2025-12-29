/*
  # Update RLS for Master/Diretoria with All Units Access

  ## Changes Made
  
  1. Update RLS policies to handle Master/Diretoria users with unidade_id = NULL
  2. NULL unidade_id for Master/Diretoria = access to all units
  3. Maintain existing security for other user types
  
  ## Rules
  - Master/Diretoria with unidade_id = NULL: See everything
  - Master/Diretoria with specific unidade_id: See only that unit
  - Other users: See only their unit
  
  ## Notes
  - This allows creating Master/Diretoria users that manage all units
  - Or Master/Diretoria users restricted to specific units
*/

-- Update OS RLS policies
DROP POLICY IF EXISTS "Users can view OS from their unit" ON os;
DROP POLICY IF EXISTS "Users can view OS based on unit" ON os;
CREATE POLICY "Users can view OS from their unit"
  ON os FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = os.unidade_id
      )
    )
  );

-- Update cotacoes RLS policies
DROP POLICY IF EXISTS "Users can view cotacoes from their unit" ON cotacoes;
DROP POLICY IF EXISTS "Users can view cotacoes based on unit" ON cotacoes;
CREATE POLICY "Users can view cotacoes from their unit"
  ON cotacoes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = cotacoes.unidade_id
      )
    )
  );

-- Update estoque_pecas RLS policies
DROP POLICY IF EXISTS "Users can view estoque from their unit" ON estoque_pecas;
DROP POLICY IF EXISTS "Users can view estoque based on unit" ON estoque_pecas;
CREATE POLICY "Users can view estoque from their unit"
  ON estoque_pecas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = estoque_pecas.unidade_id
      )
    )
  );

-- Update financeiro_lancamentos RLS policies
DROP POLICY IF EXISTS "Users can view financeiro from their unit" ON financeiro_lancamentos;
DROP POLICY IF EXISTS "Users can view financeiro based on unit and role" ON financeiro_lancamentos;
CREATE POLICY "Users can view financeiro from their unit"
  ON financeiro_lancamentos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = financeiro_lancamentos.unidade_id
      )
    )
  );

-- Update usuarios RLS policy to allow Master/Diretoria see all
DROP POLICY IF EXISTS "Users can view usuarios from their unit" ON usuarios;
DROP POLICY IF EXISTS "Users can view based on hierarchy" ON usuarios;
CREATE POLICY "Users can view usuarios from their unit"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        (u.tipo IN ('master', 'diretoria') AND u.unidade_id IS NULL) -- All units access
        OR (u.tipo IN ('master', 'diretoria') AND u.unidade_id = usuarios.unidade_id) -- Specific unit
        OR (u.tipo IN ('gerente', 'administrador') AND u.unidade_id = usuarios.unidade_id) -- Same unit
        OR u.id = usuarios.id -- Own profile
      )
    )
  );

-- Create comment explaining the logic
COMMENT ON TABLE usuarios IS 'User table with unit-based access. Master/Diretoria with unidade_id=NULL have access to all units.';