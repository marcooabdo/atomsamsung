/*
  # Prevenir Vinculação Duplicada de Peças

  1. Nova Constraint
    - Adiciona UNIQUE constraint parcial em `requisicoes_pecas(peca_estoque_id)`
    - Aplica apenas para requisições ATIVAS (status NÃO 'reprovada' nem 'devolvida')
    - Garante que cada peça física só pode estar vinculada a uma requisição ativa por vez

  2. Segurança
    - Previne erros de vinculação duplicada em nível de banco de dados
    - Proteção contra race conditions

  ## Por que isso é importante?
  Se houver apenas 1 peça física no estoque (ID #123), não pode aprovar 2 requisições
  diferentes com a mesma peça. Esta constraint garante essa regra.
*/

-- Remove constraint antiga se existir
DROP INDEX IF EXISTS requisicoes_pecas_peca_estoque_id_unique_active;

-- Cria constraint única parcial: permite que peca_estoque_id seja usada por múltiplas requisições
-- SOMENTE se elas estiverem reprovadas ou devolvidas
-- Garante que requisições ATIVAS (pendente, pedido_feito, atendida, em_uso, gi_postada, devolucao_pendente)
-- não podem compartilhar a mesma peça física
CREATE UNIQUE INDEX requisicoes_pecas_peca_estoque_id_unique_active
ON requisicoes_pecas (peca_estoque_id)
WHERE peca_estoque_id IS NOT NULL 
  AND status NOT IN ('reprovada', 'devolvida', 'cancelada');

COMMENT ON INDEX requisicoes_pecas_peca_estoque_id_unique_active IS 
'Garante que cada peça física só pode estar vinculada a uma requisição ativa por vez. Requisições reprovadas, devolvidas ou canceladas não afetam esta restrição.';