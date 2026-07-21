/*
# Fix requisicoes_pecas permissions for additional units

## Problem
Users with additional units (via usuario_unidades junction table) cannot create
requisitions for OS belonging to those additional units. The RPC function
`inserir_requisicao_peca` and the RLS INSERT policy only check the user's
primary `unidade_id`, ignoring the `usuario_unidades` junction table.

## Changes
1. Replace the `inserir_requisicao_peca` function to also check `usuario_unidades`
2. Update the RLS INSERT policy on `requisicoes_pecas` to use `user_has_access_to_unit()`
3. Update the RLS UPDATE policy to also check additional units
4. Update the RLS DELETE policy to also check additional units

## Security
- Master and diretoria users retain full access
- Regular users can now create/update/delete requisitions for OS in their
  primary unit OR any additional unit assigned via `usuario_unidades`
*/

-- 1. Fix the RPC function to support additional units
CREATE OR REPLACE FUNCTION inserir_requisicao_peca(
  p_os_id uuid,
  p_cotacao_peca_id uuid DEFAULT NULL,
  p_codigo_peca text DEFAULT 'N/A',
  p_descricao text DEFAULT 'Peça',
  p_quantidade_requisitada integer DEFAULT 1,
  p_valor_peca numeric DEFAULT NULL,
  p_numero_os_samsung text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unidade_id uuid;
  v_requisitado_por uuid;
  v_requisicao_id uuid;
  v_user_tipo text;
BEGIN
  -- Get current user ID
  v_requisitado_por := auth.uid();

  -- Get OS unidade_id
  SELECT unidade_id INTO v_unidade_id
  FROM os
  WHERE id = p_os_id;

  IF v_unidade_id IS NULL THEN
    RAISE EXCEPTION 'OS não encontrada: %', p_os_id;
  END IF;

  -- If authenticated user, validate permissions
  IF v_requisitado_por IS NOT NULL THEN
    SELECT tipo INTO v_user_tipo
    FROM usuarios
    WHERE id = v_requisitado_por;

    IF v_user_tipo IS NULL THEN
      RAISE EXCEPTION 'Usuário não encontrado';
    END IF;

    -- Check if user has permission (master/diretoria always allowed)
    IF v_user_tipo NOT IN ('master', 'diretoria') THEN
      -- Must be from same unit (primary OR additional)
      IF NOT EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = v_requisitado_por
        AND unidade_id = v_unidade_id
      ) AND NOT EXISTS (
        SELECT 1 FROM usuario_unidades
        WHERE usuario_id = v_requisitado_por
        AND unidade_id = v_unidade_id
      ) THEN
        RAISE EXCEPTION 'Usuário não tem permissão para requisitar peças desta OS';
      END IF;
    END IF;
  END IF;

  -- Insert requisicao
  INSERT INTO requisicoes_pecas (
    os_id,
    cotacao_peca_id,
    codigo_peca,
    descricao,
    quantidade_requisitada,
    valor_peca,
    status,
    requisitado_por,
    unidade_id,
    numero_os_samsung
  ) VALUES (
    p_os_id,
    p_cotacao_peca_id,
    p_codigo_peca,
    p_descricao,
    p_quantidade_requisitada,
    p_valor_peca,
    'pendente',
    v_requisitado_por,
    v_unidade_id,
    COALESCE(p_numero_os_samsung, (SELECT numero_os_samsung FROM os WHERE id = p_os_id))
  )
  RETURNING id INTO v_requisicao_id;

  RETURN v_requisicao_id;
END;
$$;

-- 2. Fix INSERT policy to support additional units
DROP POLICY IF EXISTS "requisicoes_insert_policy" ON requisicoes_pecas;
CREATE POLICY "requisicoes_insert_policy" ON requisicoes_pecas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
    OR user_has_access_to_unit(unidade_id)
  );

-- 3. Fix UPDATE policy to support additional units
DROP POLICY IF EXISTS "Estoque atualiza requisições" ON requisicoes_pecas;
CREATE POLICY "Estoque atualiza requisições" ON requisicoes_pecas
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        usuarios.tipo IN ('master', 'diretoria', 'estoque')
        OR user_has_access_to_unit(requisicoes_pecas.unidade_id)
      )
    )
  );

-- 4. Fix DELETE policy to support additional units
DROP POLICY IF EXISTS "Usuários podem deletar requisições pendentes" ON requisicoes_pecas;
CREATE POLICY "Usuários podem deletar requisições pendentes" ON requisicoes_pecas
  FOR DELETE
  TO authenticated
  USING (
    status = 'pendente'
    AND (
      EXISTS (
        SELECT 1 FROM usuarios
        WHERE usuarios.id = auth.uid()
        AND usuarios.tipo IN ('master', 'diretoria')
      )
      OR user_has_access_to_unit(requisicoes_pecas.unidade_id)
    )
  );
