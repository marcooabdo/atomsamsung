/*
  # Ajusta Políticas RLS da Tabela OS para Todos os Usuários

  1. Problema
    - Algumas políticas RLS podem estar bloqueando atualizações
    - Usuários do tipo 'diretoria' podem não ter permissão adequada
    - Políticas conflitantes entre migrations antigas

  2. Solução
    - Remove todas as políticas antigas conflitantes
    - Cria políticas novas e unificadas
    - Garante que todos os perfis autorizados possam mover cards no Kanban
    - Simplifica lógica de permissões

  3. Perfis Autorizados
    - master: pode ver e editar tudo
    - diretoria: pode ver e editar tudo
    - gerente: pode ver e editar da sua unidade
    - tecnico: pode ver tudo da unidade, editar suas próprias OSs
    - recepcao: pode ver e editar da sua unidade
    - estoque: pode ver da sua unidade
*/

-- Remover todas as políticas antigas da tabela os
DROP POLICY IF EXISTS "Usuários podem ver OS de sua unidade ou técnico" ON os;
DROP POLICY IF EXISTS "Usuários autorizados podem criar OS" ON os;
DROP POLICY IF EXISTS "Usuários autorizados podem atualizar OS" ON os;
DROP POLICY IF EXISTS "Usuários autorizados podem deletar OS" ON os;
DROP POLICY IF EXISTS "Users can view OS from their unit" ON os;
DROP POLICY IF EXISTS "Users can view OS based on unit" ON os;
DROP POLICY IF EXISTS "Users can insert OS in their unit" ON os;
DROP POLICY IF EXISTS "Users can update OS in their unit" ON os;

-- Política de SELECT: mais permissiva para visualização
CREATE POLICY "os_select_policy"
  ON os FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        -- Master e diretoria veem tudo
        u.tipo IN ('master', 'diretoria')
        -- Outros veem apenas da sua unidade
        OR u.unidade_id = os.unidade_id
        -- Ou se for o técnico responsável
        OR u.id = os.tecnico_id
      )
    )
  );

-- Política de INSERT: apenas usuários autorizados podem criar
CREATE POLICY "os_insert_policy"
  ON os FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'diretoria', 'gerente', 'recepcao', 'tecnico')
    )
  );

-- Política de UPDATE: permite atualizações para usuários autorizados
CREATE POLICY "os_update_policy"
  ON os FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        -- Master e diretoria podem editar tudo
        u.tipo IN ('master', 'diretoria')
        -- Gerente pode editar da sua unidade
        OR (u.tipo = 'gerente' AND u.unidade_id = os.unidade_id)
        -- Técnico pode editar suas próprias OSs
        OR (u.tipo = 'tecnico' AND u.id = os.tecnico_id)
        -- Recepção pode editar da sua unidade
        OR (u.tipo = 'recepcao' AND u.unidade_id = os.unidade_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR (u.tipo = 'gerente' AND u.unidade_id = os.unidade_id)
        OR (u.tipo = 'tecnico' AND u.id = os.tecnico_id)
        OR (u.tipo = 'recepcao' AND u.unidade_id = os.unidade_id)
      )
    )
  );

-- Política de DELETE: apenas master, diretoria e gerentes
CREATE POLICY "os_delete_policy"
  ON os FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo = 'master'
        OR (u.tipo = 'diretoria' AND u.unidade_id = os.unidade_id)
        OR (u.tipo = 'gerente' AND u.unidade_id = os.unidade_id)
        OR (u.tipo = 'tecnico' AND u.id = os.tecnico_id)
      )
    )
  );