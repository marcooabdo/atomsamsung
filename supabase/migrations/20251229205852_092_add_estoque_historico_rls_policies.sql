/*
  # Adicionar políticas RLS para estoque_historico

  1. Políticas
    - Permite usuários autenticados inserir registros de histórico
    - Permite usuários autenticados visualizar histórico

  2. Segurança
    - RLS já está ativado na tabela
    - Políticas permitem acesso apenas para usuários autenticados
*/

-- Política para SELECT - usuários autenticados podem ver histórico
CREATE POLICY "Usuarios podem visualizar historico estoque"
  ON estoque_historico FOR SELECT
  TO authenticated
  USING (true);

-- Política para INSERT - usuários autenticados podem criar registros de histórico
CREATE POLICY "Usuarios podem criar historico estoque"
  ON estoque_historico FOR INSERT
  TO authenticated
  WITH CHECK (true);