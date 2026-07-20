/*
# Update Related Tables RLS to Respect usuario_unidades

## Problem
Tables like agendamentos, cotacoes, pagamentos, os_comentarios, os_anexos, os_pecas,
and requisicoes_pecas have RLS policies that only check the user's primary unit.
Users with additional units (via usuario_unidades) cannot see data from those units.

## Solution
Update SELECT policies on all related tables to use the `user_has_access_to_unit()` helper
function created in the previous migration, which checks both primary unit and usuario_unidades.

## Modified Policies
- `agendamentos`: "agendamentos_select_policy" 
- `cotacoes`: "Users can view cotacoes from their unit"
- `pagamentos`: "Usuários veem pagamentos da unidade"
- `os_pecas`: "os_pecas_select"
- `requisicoes_pecas`: "Usuários veem requisições da unidade"
- `os_comentarios`: "Users can manage os_comentarios for accessible OS"
- `os_anexos`: "Users can manage os_anexos for accessible OS"
- `cotacoes_pecas`: "Usuários podem ver peças de cotações acessíveis"
- `cotacoes_servicos`: "Users can view cotacoes_servicos"
*/

-- 1. agendamentos SELECT policy
DROP POLICY IF EXISTS "agendamentos_select_policy" ON agendamentos;
CREATE POLICY "agendamentos_select_policy" ON agendamentos
  FOR SELECT TO authenticated
  USING (
    public.user_has_access_to_unit(unidade_id)
    OR (
      EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid() AND u.id = agendamentos.tecnico_id
      )
    )
  );

-- 2. cotacoes SELECT policy
DROP POLICY IF EXISTS "Users can view cotacoes from their unit" ON cotacoes;
CREATE POLICY "Users can view cotacoes from their unit" ON cotacoes
  FOR SELECT TO authenticated
  USING (public.user_has_access_to_unit(unidade_id));

-- 3. pagamentos SELECT policy
DROP POLICY IF EXISTS "Usuários veem pagamentos da unidade" ON pagamentos;
CREATE POLICY "Usuários veem pagamentos da unidade" ON pagamentos
  FOR SELECT TO authenticated
  USING (public.user_has_access_to_unit(unidade_id));

-- 4. os_pecas SELECT policy
DROP POLICY IF EXISTS "os_pecas_select" ON os_pecas;
CREATE POLICY "os_pecas_select" ON os_pecas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM os o
      WHERE o.id = os_pecas.os_id
      AND public.user_has_access_to_unit(o.unidade_id)
    )
    OR EXISTS (
      SELECT 1 FROM os o
      JOIN usuarios u ON u.id = auth.uid()
      WHERE o.id = os_pecas.os_id
      AND u.id = o.tecnico_id
    )
  );

-- 5. requisicoes_pecas - update the unit-based policy
DROP POLICY IF EXISTS "Usuários veem requisições da unidade" ON requisicoes_pecas;
CREATE POLICY "Usuários veem requisições da unidade" ON requisicoes_pecas
  FOR SELECT TO authenticated
  USING (public.user_has_access_to_unit(unidade_id));

-- 6. os_comentarios - ALL policy
DROP POLICY IF EXISTS "Users can manage os_comentarios for accessible OS" ON os_comentarios;
CREATE POLICY "Users can manage os_comentarios for accessible OS" ON os_comentarios
  FOR ALL TO authenticated
  USING (
    os_id IS NULL
    OR EXISTS (
      SELECT 1 FROM os
      WHERE os.id = os_comentarios.os_id
      AND public.user_has_access_to_unit(os.unidade_id)
    )
  )
  WITH CHECK (
    os_id IS NULL
    OR EXISTS (
      SELECT 1 FROM os
      WHERE os.id = os_comentarios.os_id
      AND public.user_has_access_to_unit(os.unidade_id)
    )
  );

-- 7. os_anexos - ALL policy
DROP POLICY IF EXISTS "Users can manage os_anexos for accessible OS" ON os_anexos;
CREATE POLICY "Users can manage os_anexos for accessible OS" ON os_anexos
  FOR ALL TO authenticated
  USING (
    os_id IS NULL
    OR EXISTS (
      SELECT 1 FROM os
      WHERE os.id = os_anexos.os_id
      AND public.user_has_access_to_unit(os.unidade_id)
    )
  )
  WITH CHECK (
    os_id IS NULL
    OR EXISTS (
      SELECT 1 FROM os
      WHERE os.id = os_anexos.os_id
      AND public.user_has_access_to_unit(os.unidade_id)
    )
  );

-- 8. cotacoes_pecas SELECT policy
DROP POLICY IF EXISTS "Usuários podem ver peças de cotações acessíveis" ON cotacoes_pecas;
CREATE POLICY "Usuários podem ver peças de cotações acessíveis" ON cotacoes_pecas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cotacoes c
      WHERE c.id = cotacoes_pecas.cotacao_id
      AND public.user_has_access_to_unit(c.unidade_id)
    )
  );

-- 9. cotacoes_servicos SELECT policy
DROP POLICY IF EXISTS "Users can view cotacoes_servicos" ON cotacoes_servicos;
CREATE POLICY "Users can view cotacoes_servicos" ON cotacoes_servicos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cotacoes c
      WHERE c.id = cotacoes_servicos.cotacao_id
      AND public.user_has_access_to_unit(c.unidade_id)
    )
  );
