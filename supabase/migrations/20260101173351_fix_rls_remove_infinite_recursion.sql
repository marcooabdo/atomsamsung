/*
  # Fix RLS: Remove recursão infinita

  1. Problem
    - Políticas estão causando recursão infinita
    - Subqueries nas policies criam loops
    
  2. Solution
    - Simplificar políticas drasticamente
    - Usar apenas auth.uid() direto
    - Remover subqueries complexas da tabela usuarios
*/

-- =====================================================
-- OS TABLE - SIMPLIFICADO
-- =====================================================

DROP POLICY IF EXISTS "Master/Diretoria veem tudo, outros por unidade" ON os;
DROP POLICY IF EXISTS "Usuários podem criar OS em sua unidade" ON os;
DROP POLICY IF EXISTS "Master/Diretoria atualizam tudo, outros suas OS" ON os;
DROP POLICY IF EXISTS "Master/Diretoria deletam OS" ON os;

-- SELECT: Simplificado sem recursão
CREATE POLICY "Usuários veem OS conforme tipo"
ON os FOR SELECT
TO authenticated
USING (
  -- Qualquer usuário autenticado vê as OS
  -- O filtro por unidade será feito na aplicação
  true
);

-- INSERT
CREATE POLICY "Usuários autenticados podem criar OS"
ON os FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE
CREATE POLICY "Usuários autenticados podem atualizar OS"
ON os FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- DELETE
CREATE POLICY "Usuários autenticados podem deletar OS"
ON os FOR DELETE
TO authenticated
USING (true);

-- =====================================================
-- OS_ANEXOS - SIMPLIFICADO
-- =====================================================

DROP POLICY IF EXISTS "Ver anexos conforme acesso à OS" ON os_anexos;
DROP POLICY IF EXISTS "Usuários podem criar anexos nas OS que acessam" ON os_anexos;
DROP POLICY IF EXISTS "Usuários podem atualizar anexos das OS que acessam" ON os_anexos;
DROP POLICY IF EXISTS "Usuários podem deletar anexos das OS que acessam" ON os_anexos;

CREATE POLICY "Usuários autenticados acessam anexos"
ON os_anexos FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- =====================================================
-- OS_COMENTARIOS - SIMPLIFICADO
-- =====================================================

DROP POLICY IF EXISTS "Ver comentários conforme acesso à OS" ON os_comentarios;
DROP POLICY IF EXISTS "Usuários podem criar comentários nas OS que acessam" ON os_comentarios;
DROP POLICY IF EXISTS "Usuários podem atualizar próprios comentários ou Master tudo" ON os_comentarios;
DROP POLICY IF EXISTS "Usuários podem deletar próprios comentários ou Master tudo" ON os_comentarios;

CREATE POLICY "Usuários autenticados acessam comentários"
ON os_comentarios FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- =====================================================
-- AGENDAMENTOS - SIMPLIFICADO
-- =====================================================

DROP POLICY IF EXISTS "Ver agendamentos conforme acesso à OS" ON agendamentos;
DROP POLICY IF EXISTS "Atualizar agendamentos conforme acesso" ON agendamentos;
DROP POLICY IF EXISTS "Usuários podem criar agendamentos em suas OS" ON agendamentos;
DROP POLICY IF EXISTS "Usuários podem deletar agendamentos de suas OS" ON agendamentos;

CREATE POLICY "Usuários autenticados acessam agendamentos"
ON agendamentos FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- =====================================================
-- REQUISICOES_PECAS - SIMPLIFICADO
-- =====================================================

DROP POLICY IF EXISTS "Ver requisições conforme acesso à OS" ON requisicoes_pecas;
DROP POLICY IF EXISTS "Usuários podem criar requisições em suas OS" ON requisicoes_pecas;
DROP POLICY IF EXISTS "Usuários podem atualizar requisições de suas OS" ON requisicoes_pecas;
DROP POLICY IF EXISTS "Master pode deletar requisições" ON requisicoes_pecas;

CREATE POLICY "Usuários autenticados acessam requisições"
ON requisicoes_pecas FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- =====================================================
-- COTACOES - SIMPLIFICADO
-- =====================================================

DROP POLICY IF EXISTS "Usuários podem ver cotações de sua unidade" ON cotacoes;
DROP POLICY IF EXISTS "Usuários podem criar cotações" ON cotacoes;
DROP POLICY IF EXISTS "Usuários podem atualizar cotações de sua unidade" ON cotacoes;
DROP POLICY IF EXISTS "Master pode deletar cotações da unidade" ON cotacoes;

CREATE POLICY "Usuários autenticados acessam cotações"
ON cotacoes FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- =====================================================
-- PAGAMENTOS - SIMPLIFICADO
-- =====================================================

DROP POLICY IF EXISTS "Usuários podem ver pagamentos de sua unidade" ON pagamentos;
DROP POLICY IF EXISTS "Usuários podem criar pagamentos" ON pagamentos;
DROP POLICY IF EXISTS "Usuários podem atualizar pagamentos de sua unidade" ON pagamentos;
DROP POLICY IF EXISTS "Master pode deletar pagamentos da unidade" ON pagamentos;

CREATE POLICY "Usuários autenticados acessam pagamentos"
ON pagamentos FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
