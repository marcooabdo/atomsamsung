/*
  # Adicionar Campo de Sequência no Kanban

  1. Alterações
    - Adiciona coluna `sequencia_coluna` na tabela `os` para controlar a ordem dos cards dentro de cada coluna do Kanban
    - Permite reordenar cards arrastando para cima ou para baixo dentro da mesma coluna
    - Inicializa sequências existentes baseado no `created_at`

  2. Implementação
    - Campo `sequencia_coluna` INTEGER NOT NULL DEFAULT 0
    - Índice composto para performance em (coluna_kanban, sequencia_coluna)
    - Popula sequências iniciais para OSs existentes
*/

-- Adicionar coluna de sequência para ordenação dentro da coluna
ALTER TABLE os
ADD COLUMN IF NOT EXISTS sequencia_coluna INTEGER NOT NULL DEFAULT 0;

-- Criar índice composto para ordenação eficiente
CREATE INDEX IF NOT EXISTS idx_os_coluna_sequencia
ON os(coluna_kanban, sequencia_coluna);

-- Popula sequências iniciais baseado na data de criação (mais antigas primeiro)
DO $$
DECLARE
  coluna_atual TEXT;
  contador INTEGER;
BEGIN
  FOR coluna_atual IN
    SELECT DISTINCT coluna_kanban FROM os WHERE coluna_kanban IS NOT NULL
  LOOP
    contador := 0;
    
    UPDATE os
    SET sequencia_coluna = subquery.nova_seq
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) - 1 as nova_seq
      FROM os
      WHERE coluna_kanban = coluna_atual
    ) AS subquery
    WHERE os.id = subquery.id;
    
  END LOOP;
END $$;

-- Criar função para renumerar sequências ao adicionar/remover da coluna
CREATE OR REPLACE FUNCTION renumerar_sequencias_coluna(
  p_coluna_kanban TEXT,
  p_unidade_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE os
  SET sequencia_coluna = subquery.nova_seq
  FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY sequencia_coluna, created_at) - 1 as nova_seq
    FROM os
    WHERE coluna_kanban = p_coluna_kanban
      AND unidade_id = p_unidade_id
  ) AS subquery
  WHERE os.id = subquery.id
    AND os.coluna_kanban = p_coluna_kanban
    AND os.unidade_id = p_unidade_id;
END;
$$ LANGUAGE plpgsql;
