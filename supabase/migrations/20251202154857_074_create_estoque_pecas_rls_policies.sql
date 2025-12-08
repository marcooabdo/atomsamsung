/*
  # Create RLS Policies for estoque_pecas

  ## Summary
  Creates Row Level Security policies for the estoque_pecas table to allow proper access control.

  ## Changes
  - Add SELECT policy for estoque_pecas (view parts based on unit)
  - Add INSERT policy for estoque_pecas (insert parts in user's unit or all units for master/diretoria)
  - Add UPDATE policy for estoque_pecas (update parts in user's unit or all units for master/diretoria)  
  - Add DELETE policy for estoque_pecas (delete parts in user's unit or all units for master/diretoria)

  ## Security
  - Restricts access based on user's unidade_id
  - Master and Diretoria users with unidade_id=NULL can access all units
  - Other users can only access parts from their own unit
*/

-- SELECT policy: View parts from user's unit or all units if master/diretoria
CREATE POLICY "Users can view parts from their unit or all units if master"
  ON estoque_pecas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        -- Master/Diretoria without unit can see all
        (usuarios.tipo IN ('master', 'diretoria') AND usuarios.unidade_id IS NULL)
        -- Or user from same unit
        OR usuarios.unidade_id = estoque_pecas.unidade_id
      )
    )
  );

-- INSERT policy: Insert parts in user's unit or any unit if master/diretoria
CREATE POLICY "Users can insert parts in their unit or any unit if master"
  ON estoque_pecas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        -- Master/Diretoria without unit can insert in any unit
        (usuarios.tipo IN ('master', 'diretoria') AND usuarios.unidade_id IS NULL)
        -- Or user inserting in their own unit
        OR usuarios.unidade_id = estoque_pecas.unidade_id
      )
    )
  );

-- UPDATE policy: Update parts in user's unit or any unit if master/diretoria
CREATE POLICY "Users can update parts in their unit or any unit if master"
  ON estoque_pecas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        -- Master/Diretoria without unit can update any part
        (usuarios.tipo IN ('master', 'diretoria') AND usuarios.unidade_id IS NULL)
        -- Or user updating parts in their own unit
        OR usuarios.unidade_id = estoque_pecas.unidade_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        -- Master/Diretoria without unit can update any part
        (usuarios.tipo IN ('master', 'diretoria') AND usuarios.unidade_id IS NULL)
        -- Or user updating parts in their own unit
        OR usuarios.unidade_id = estoque_pecas.unidade_id
      )
    )
  );

-- DELETE policy: Delete parts in user's unit or any unit if master/diretoria
CREATE POLICY "Users can delete parts in their unit or any unit if master"
  ON estoque_pecas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        -- Master/Diretoria without unit can delete any part
        (usuarios.tipo IN ('master', 'diretoria') AND usuarios.unidade_id IS NULL)
        -- Or user deleting parts in their own unit
        OR usuarios.unidade_id = estoque_pecas.unidade_id
      )
    )
  );