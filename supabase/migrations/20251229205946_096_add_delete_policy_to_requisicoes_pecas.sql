/*
  # Adicionar política de DELETE para requisicoes_pecas

  1. Mudanças
    - Adiciona política DELETE para permitir que usuários deletem requisições pendentes
    - Apenas técnicos da mesma unidade, master ou diretoria podem deletar
    - Apenas requisições com status 'pendente' podem ser deletadas
  
  2. Segurança
    - Restringe DELETE apenas a requisições pendentes
    - Mantém controle por unidade e hierarquia
*/

CREATE POLICY "Usuários podem deletar requisições pendentes"
  ON requisicoes_pecas
  FOR DELETE
  TO authenticated
  USING (
    status = 'pendente' 
    AND EXISTS (
      SELECT 1 
      FROM usuarios 
      WHERE usuarios.id = auth.uid() 
      AND (
        usuarios.tipo IN ('master', 'diretoria')
        OR usuarios.unidade_id = requisicoes_pecas.unidade_id
      )
    )
  );