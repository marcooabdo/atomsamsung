/*
  # Desabilitar RLS de os_comentarios e os_anexos

  1. Mudanças
    - Remove todas as políticas RLS de os_comentarios
    - Remove todas as políticas RLS de os_anexos
    - Desabilita RLS em ambas tabelas

  2. Segurança
    - ATENÇÃO: Tabelas ficarão abertas para qualquer operação
    - Usar apenas temporariamente para desenvolvimento/testes
    - Reabilitar RLS em produção
*/

-- OS_COMENTARIOS: Dropar todas as políticas
DROP POLICY IF EXISTS "Usuários podem ver comentários de OS acessíveis" ON os_comentarios;
DROP POLICY IF EXISTS "Usuários podem adicionar comentários em OS acessíveis" ON os_comentarios;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios comentários" ON os_comentarios;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios comentários" ON os_comentarios;
DROP POLICY IF EXISTS "Técnicos IH podem ver comentários de suas OS" ON os_comentarios;
DROP POLICY IF EXISTS "Técnicos IH podem adicionar comentários" ON os_comentarios;

-- Desabilitar RLS em os_comentarios
ALTER TABLE os_comentarios DISABLE ROW LEVEL SECURITY;

-- OS_ANEXOS: Dropar todas as políticas
DROP POLICY IF EXISTS "Usuários podem ver anexos de OS acessíveis" ON os_anexos;
DROP POLICY IF EXISTS "Usuários podem adicionar anexos em OS acessíveis" ON os_anexos;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios anexos" ON os_anexos;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios anexos" ON os_anexos;
DROP POLICY IF EXISTS "Técnicos IH podem ver anexos de suas OS" ON os_anexos;
DROP POLICY IF EXISTS "Técnicos IH podem adicionar anexos" ON os_anexos;

-- Desabilitar RLS em os_anexos
ALTER TABLE os_anexos DISABLE ROW LEVEL SECURITY;

-- Comentários de aviso
COMMENT ON TABLE os_comentarios IS 'ATENÇÃO: RLS DESABILITADO TEMPORARIAMENTE - Reabilitar em produção';
COMMENT ON TABLE os_anexos IS 'ATENÇÃO: RLS DESABILITADO TEMPORARIAMENTE - Reabilitar em produção';
