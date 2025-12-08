/*
  # Fix estoque_pecas SELECT Policy for Master Users

  ## Summary
  Fixes the SELECT policy to properly allow master/diretoria users to see ALL parts regardless of unit.

  ## Changes
  - Drop existing SELECT policy
  - Create new SELECT policy with proper logic:
    - Master/Diretoria users see ALL parts (no unit restriction)
    - Other users see only parts from their unit

  ## Security
  - Master and Diretoria users have full visibility
  - Regular users restricted to their own unit
*/

-- Drop current SELECT policy
DROP POLICY IF EXISTS "View parts based on user unit" ON estoque_pecas;

-- Create corrected SELECT policy
CREATE POLICY "View parts based on user type and unit"
  ON estoque_pecas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        -- Master/Diretoria users see ALL parts (no unit check)
        usuarios.tipo IN ('master', 'diretoria')
        -- Other users see only their unit parts
        OR (usuarios.unidade_id IS NOT NULL AND usuarios.unidade_id = estoque_pecas.unidade_id)
      )
    )
  );
