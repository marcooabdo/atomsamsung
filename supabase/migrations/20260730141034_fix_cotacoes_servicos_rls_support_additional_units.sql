/*
# Fix cotacoes_servicos RLS policies to support additional units

## Problem
Users with additional units (via `usuario_unidades` junction table) cannot INSERT
services into `cotacoes_servicos` for OS belonging to those additional units.
The current policies only check the user's primary `unidade_id` from the `usuarios` table.

## Changes
- DROP and recreate all 4 CRUD policies on `cotacoes_servicos`.
- Each policy now also checks `usuario_unidades` so users with additional units
  can manage services for OS in those units.

## Security
- Still requires authenticated role.
- master users and users with NULL unidade_id see/manage everything.
- Other users can access rows where the linked OS or cotacao belongs to
  their primary unit OR any of their additional units.
*/

-- SELECT
DROP POLICY IF EXISTS "Users can view cotacoes_servicos" ON cotacoes_servicos;

CREATE POLICY "Users can view cotacoes_servicos"
ON cotacoes_servicos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = (SELECT auth.uid())
    AND (
      u.tipo = 'master'
      OR u.unidade_id IS NULL
      OR (
        cotacoes_servicos.os_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM os
          WHERE os.id = cotacoes_servicos.os_id
          AND (
            os.unidade_id = u.unidade_id
            OR EXISTS (SELECT 1 FROM usuario_unidades uu WHERE uu.usuario_id = u.id AND uu.unidade_id = os.unidade_id)
          )
        )
      )
      OR (
        cotacoes_servicos.cotacao_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM cotacoes c
          WHERE c.id = cotacoes_servicos.cotacao_id
          AND (
            c.unidade_id = u.unidade_id
            OR EXISTS (SELECT 1 FROM usuario_unidades uu WHERE uu.usuario_id = u.id AND uu.unidade_id = c.unidade_id)
          )
        )
      )
    )
  )
);

-- INSERT
DROP POLICY IF EXISTS "Users can insert cotacoes_servicos" ON cotacoes_servicos;

CREATE POLICY "Users can insert cotacoes_servicos"
ON cotacoes_servicos FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = (SELECT auth.uid())
    AND (
      u.tipo = 'master'
      OR u.unidade_id IS NULL
      OR (
        os_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM os
          WHERE os.id = cotacoes_servicos.os_id
          AND (
            os.unidade_id = u.unidade_id
            OR EXISTS (SELECT 1 FROM usuario_unidades uu WHERE uu.usuario_id = u.id AND uu.unidade_id = os.unidade_id)
          )
        )
      )
      OR (
        cotacao_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM cotacoes c
          WHERE c.id = cotacoes_servicos.cotacao_id
          AND (
            c.unidade_id = u.unidade_id
            OR EXISTS (SELECT 1 FROM usuario_unidades uu WHERE uu.usuario_id = u.id AND uu.unidade_id = c.unidade_id)
          )
        )
      )
    )
  )
);

-- UPDATE
DROP POLICY IF EXISTS "Users can update cotacoes_servicos" ON cotacoes_servicos;

CREATE POLICY "Users can update cotacoes_servicos"
ON cotacoes_servicos FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = (SELECT auth.uid())
    AND (
      u.tipo = 'master'
      OR u.unidade_id IS NULL
      OR (
        cotacoes_servicos.os_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM os
          WHERE os.id = cotacoes_servicos.os_id
          AND (
            os.unidade_id = u.unidade_id
            OR EXISTS (SELECT 1 FROM usuario_unidades uu WHERE uu.usuario_id = u.id AND uu.unidade_id = os.unidade_id)
          )
        )
      )
      OR (
        cotacoes_servicos.cotacao_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM cotacoes c
          WHERE c.id = cotacoes_servicos.cotacao_id
          AND (
            c.unidade_id = u.unidade_id
            OR EXISTS (SELECT 1 FROM usuario_unidades uu WHERE uu.usuario_id = u.id AND uu.unidade_id = c.unidade_id)
          )
        )
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = (SELECT auth.uid())
    AND (
      u.tipo = 'master'
      OR u.unidade_id IS NULL
      OR (
        cotacoes_servicos.os_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM os
          WHERE os.id = cotacoes_servicos.os_id
          AND (
            os.unidade_id = u.unidade_id
            OR EXISTS (SELECT 1 FROM usuario_unidades uu WHERE uu.usuario_id = u.id AND uu.unidade_id = os.unidade_id)
          )
        )
      )
      OR (
        cotacoes_servicos.cotacao_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM cotacoes c
          WHERE c.id = cotacoes_servicos.cotacao_id
          AND (
            c.unidade_id = u.unidade_id
            OR EXISTS (SELECT 1 FROM usuario_unidades uu WHERE uu.usuario_id = u.id AND uu.unidade_id = c.unidade_id)
          )
        )
      )
    )
  )
);

-- DELETE
DROP POLICY IF EXISTS "Users can delete cotacoes_servicos" ON cotacoes_servicos;

CREATE POLICY "Users can delete cotacoes_servicos"
ON cotacoes_servicos FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = (SELECT auth.uid())
    AND (
      u.tipo = 'master'
      OR u.unidade_id IS NULL
      OR (
        cotacoes_servicos.os_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM os
          WHERE os.id = cotacoes_servicos.os_id
          AND (
            os.unidade_id = u.unidade_id
            OR EXISTS (SELECT 1 FROM usuario_unidades uu WHERE uu.usuario_id = u.id AND uu.unidade_id = os.unidade_id)
          )
        )
      )
      OR (
        cotacoes_servicos.cotacao_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM cotacoes c
          WHERE c.id = cotacoes_servicos.cotacao_id
          AND (
            c.unidade_id = u.unidade_id
            OR EXISTS (SELECT 1 FROM usuario_unidades uu WHERE uu.usuario_id = u.id AND uu.unidade_id = c.unidade_id)
          )
        )
      )
    )
  )
);
