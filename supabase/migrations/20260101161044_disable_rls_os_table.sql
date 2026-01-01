/*
  # Desabilitar RLS da tabela OS temporariamente

  1. Mudanças
    - Remove todas as políticas RLS da tabela OS
    - Desabilita RLS na tabela OS
    - Remove função n8n_insert_os (não mais necessária)

  2. Segurança
    - ATENÇÃO: A tabela OS ficará aberta para qualquer operação
    - Usar apenas temporariamente para desenvolvimento/testes
    - Reabilitar RLS em produção
*/

-- Dropar todas as políticas da tabela OS
DROP POLICY IF EXISTS "Usuários podem ver OS de sua unidade ou técnico" ON os;
DROP POLICY IF EXISTS "Usuários autorizados podem criar OS" ON os;
DROP POLICY IF EXISTS "Usuários autorizados podem atualizar OS" ON os;
DROP POLICY IF EXISTS "Usuários podem deletar OS de sua unidade" ON os;
DROP POLICY IF EXISTS "Masters podem ver todas as OS" ON os;
DROP POLICY IF EXISTS "Técnicos podem ver OS agendadas para eles" ON os;
DROP POLICY IF EXISTS "Técnicos IH podem ver OS agendadas para eles" ON os;

-- Desabilitar RLS na tabela OS
ALTER TABLE os DISABLE ROW LEVEL SECURITY;

-- Remover função n8n_insert_os
DROP FUNCTION IF EXISTS n8n_insert_os;

-- Comentário de aviso
COMMENT ON TABLE os IS 'ATENÇÃO: RLS DESABILITADO TEMPORARIAMENTE - Reabilitar em produção';
