/*
  # Fix GIA Mural Tarefas RLS - Add INSERT/UPDATE/DELETE policies

  Currently only SELECT and service_role policies exist,
  which means authenticated users cannot create tasks from the app
  (e.g., GIA Warranty closure alerts silently fail).

  1. Changes
    - Add INSERT policy for authenticated users
    - Add UPDATE policy for authenticated users
    - Add DELETE policy for master/diretoria users

  2. Security
    - INSERT: any authenticated user can create tasks for their unit (or master/diretoria for any unit)
    - UPDATE: any authenticated user can update tasks in their unit (or master/diretoria for any)
    - DELETE: only master/diretoria users can delete tasks
*/

CREATE POLICY "Authenticated users can insert gia_mural_tarefas"
  ON gia_mural_tarefas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (SELECT auth.uid())
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id IS NULL
        OR u.unidade_id = gia_mural_tarefas.unidade_id
      )
    )
  );

CREATE POLICY "Authenticated users can update gia_mural_tarefas"
  ON gia_mural_tarefas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (SELECT auth.uid())
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id IS NULL
        OR u.unidade_id = gia_mural_tarefas.unidade_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (SELECT auth.uid())
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id IS NULL
        OR u.unidade_id = gia_mural_tarefas.unidade_id
      )
    )
  );

CREATE POLICY "Master and diretoria can delete gia_mural_tarefas"
  ON gia_mural_tarefas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (SELECT auth.uid())
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id IS NULL
      )
    )
  );