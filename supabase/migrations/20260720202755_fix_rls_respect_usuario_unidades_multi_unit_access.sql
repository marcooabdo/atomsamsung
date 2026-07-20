/*
# Fix RLS Policies to Respect usuario_unidades (Multi-Unit Access)

## Problem
Users assigned additional units via the `usuario_unidades` junction table (e.g., by a Master user)
cannot see those units or their OS data. The existing RLS policies only check `usuarios.unidade_id`
(the user's primary unit) and ignore the junction table entirely.

## Solution
1. Create a STABLE helper function `user_has_access_to_unit(uuid)` that returns TRUE if the
   current authenticated user has access to the given unit via:
   - Their primary `usuarios.unidade_id`, OR
   - A row in `usuario_unidades`
   - Master/diretoria users without a primary unit see everything

2. Update RLS SELECT policies on `unidades` and `os` tables to use this function.

## Changes
- New function: `public.user_has_access_to_unit(p_unit_id uuid)` RETURNS boolean
- Modified policy: "Users can view unidades based on role" on `unidades`
- Modified policy: "Users can view OS from their unit" on `os`

## Security
- Function is SECURITY DEFINER to bypass RLS on the lookup tables themselves
- SET search_path = public for safety
- Only checks membership, does not modify data
*/

-- 1. Create helper function
CREATE OR REPLACE FUNCTION public.user_has_access_to_unit(p_unit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND (
      -- Master/diretoria without primary unit see everything
      (u.tipo IN ('master', 'diretoria') AND u.unidade_id IS NULL)
      -- Primary unit match
      OR u.unidade_id = p_unit_id
      -- Additional units via junction table
      OR EXISTS (
        SELECT 1 FROM usuario_unidades uu
        WHERE uu.usuario_id = u.id
        AND uu.unidade_id = p_unit_id
      )
    )
  );
$$;

-- 2. Fix unidades SELECT policy
DROP POLICY IF EXISTS "Users can view unidades based on role" ON unidades;
CREATE POLICY "Users can view unidades based on role" ON unidades
  FOR SELECT TO authenticated
  USING (public.user_has_access_to_unit(id));

-- 3. Fix os SELECT policy
DROP POLICY IF EXISTS "Users can view OS from their unit" ON os;
CREATE POLICY "Users can view OS from their unit" ON os
  FOR SELECT TO authenticated
  USING (
    public.user_has_access_to_unit(unidade_id)
    OR (
      EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND (
          u.id = os.tecnico_designado_id
          OR EXISTS (
            SELECT 1 FROM agendamentos a
            WHERE a.os_id = os.id AND a.tecnico_id = u.id
          )
        )
      )
    )
  );
