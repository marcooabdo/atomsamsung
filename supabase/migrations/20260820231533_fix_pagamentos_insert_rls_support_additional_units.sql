/*
# Fix pagamentos INSERT RLS to support additional units

1. Changes
   - Drop and recreate the INSERT policy on `pagamentos` table
   - New policy allows insert when user's primary unit matches OR user has the payment's unit in `usuario_unidades`
   - Also allows master/diretoria/administrador to insert for any unit

2. Problem
   - Users with additional units (via `usuario_unidades` junction table) were blocked from inserting payments
     for those units because the policy only checked `u.unidade_id = pagamentos.unidade_id`

3. Security
   - Maintains unit-scoped access: users can only insert payments for units they belong to
   - Elevated roles (master, diretoria, administrador) can insert for any unit
*/

DROP POLICY IF EXISTS "Users can insert pagamentos for their unit" ON pagamentos;

CREATE POLICY "Users can insert pagamentos for their unit" ON pagamentos
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = (SELECT auth.uid())
    AND (
      u.unidade_id = pagamentos.unidade_id
      OR u.tipo IN ('master', 'diretoria', 'administrador')
      OR EXISTS (
        SELECT 1 FROM usuario_unidades uu
        WHERE uu.usuario_id = u.id
        AND uu.unidade_id = pagamentos.unidade_id
      )
    )
  )
);
