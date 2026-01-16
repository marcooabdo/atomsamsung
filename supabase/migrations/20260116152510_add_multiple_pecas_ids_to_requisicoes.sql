/*
  # Suporte para multiplos IDs de pecas vinculadas em requisicoes

  1. Alteracoes
    - Adiciona coluna `pecas_estoque_ids` (array de UUIDs) para armazenar multiplos IDs de pecas vinculadas
    - Usado quando a quantidade requisitada > 1 e multiplas pecas precisam ser vinculadas
    - O campo existente `peca_estoque_id` continua funcionando para requisicoes de quantidade 1
    - `quantidade_atendida` rastreia quantas pecas ja foram vinculadas

  2. Uso
    - Para SC/ACC com quantidade > 1: usar pecas_estoque_ids
    - Para requisicoes normais: continuar usando peca_estoque_id
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requisicoes_pecas' AND column_name = 'pecas_estoque_ids'
  ) THEN
    ALTER TABLE requisicoes_pecas ADD COLUMN pecas_estoque_ids uuid[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requisicoes_pecas' AND column_name = 'quantidade_atendida'
  ) THEN
    ALTER TABLE requisicoes_pecas ADD COLUMN quantidade_atendida integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requisicoes_pecas' AND column_name = 'is_lote'
  ) THEN
    ALTER TABLE requisicoes_pecas ADD COLUMN is_lote boolean DEFAULT false;
  END IF;
END $$;
