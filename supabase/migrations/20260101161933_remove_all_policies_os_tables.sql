/*
  # Remover todas as políticas RLS restantes

  1. Mudanças
    - Remove todas as políticas de os, os_comentarios e os_anexos
    - Garante que RLS está desabilitado

  2. Segurança
    - Tabelas abertas sem restrições
*/

-- Remover todas as políticas de OS
DROP POLICY IF EXISTS "os_delete_policy" ON os;
DROP POLICY IF EXISTS "os_insert_policy" ON os;
DROP POLICY IF EXISTS "os_select_policy" ON os;
DROP POLICY IF EXISTS "os_update_policy" ON os;

-- Remover todas as políticas de OS_COMENTARIOS
DROP POLICY IF EXISTS "os_comentarios_insert_policy" ON os_comentarios;
DROP POLICY IF EXISTS "os_comentarios_select_policy" ON os_comentarios;

-- Remover todas as políticas de OS_ANEXOS
DROP POLICY IF EXISTS "Usuários podem atualizar anexos" ON os_anexos;
DROP POLICY IF EXISTS "os_anexos_insert_policy" ON os_anexos;
DROP POLICY IF EXISTS "os_anexos_select_policy" ON os_anexos;

-- Garantir que RLS está desabilitado
ALTER TABLE os DISABLE ROW LEVEL SECURITY;
ALTER TABLE os_comentarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE os_anexos DISABLE ROW LEVEL SECURITY;
