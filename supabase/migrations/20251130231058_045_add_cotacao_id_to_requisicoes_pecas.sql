/*
  # Adicionar cotacao_id à tabela requisicoes_pecas

  1. Descrição
    - Adiciona coluna cotacao_id na tabela requisicoes_pecas
    - Estabelece foreign key com a tabela cotacoes
    - Permite rastreamento da cotação original de cada requisição
    - Essencial para bloqueio de peças na interface de cotações

  2. Mudanças
    - Adiciona coluna cotacao_id (UUID, nullable)
    - Cria foreign key para tabela cotacoes
    - Atualiza requisições existentes com cotacao_id da OS relacionada
    - Garante integridade referencial

  3. Impacto
    - Melhora rastreabilidade entre requisições e cotações originais
    - Permite bloqueio correto de peças com pedido ativo na interface de cotações
    - Facilita queries que precisam verificar peças bloqueadas
    - Não afeta funcionamento atual do sistema
*/

-- Adicionar coluna cotacao_id
ALTER TABLE requisicoes_pecas
ADD COLUMN IF NOT EXISTS cotacao_id UUID REFERENCES cotacoes(id) ON DELETE SET NULL;

-- Criar índice para melhorar performance de queries
CREATE INDEX IF NOT EXISTS idx_requisicoes_pecas_cotacao_id ON requisicoes_pecas(cotacao_id);

-- Atualizar requisições existentes com cotacao_id da OS relacionada
UPDATE requisicoes_pecas rp
SET cotacao_id = os.cotacao_id
FROM os
WHERE rp.os_id = os.id
  AND rp.cotacao_id IS NULL
  AND os.cotacao_id IS NOT NULL;
