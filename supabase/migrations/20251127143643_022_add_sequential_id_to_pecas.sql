/*
  # Adicionar ID Sequencial Numérico às Peças

  ## Objetivo
  Criar um ID sequencial simples (1, 2, 3...) para cada peça que entra no sistema.

  ## Alterações
  - Adicionar coluna `id_numerico` em `estoque_pecas`
  - Criar sequence para auto-incremento
  - Atualizar peças existentes
*/

-- Criar sequence
CREATE SEQUENCE IF NOT EXISTS estoque_pecas_id_seq;

-- Adicionar coluna
ALTER TABLE estoque_pecas 
ADD COLUMN IF NOT EXISTS id_numerico bigint;

-- Atualizar peças existentes com IDs sequenciais
DO $$
DECLARE
  peca RECORD;
  contador INTEGER := 1;
BEGIN
  FOR peca IN 
    SELECT id FROM estoque_pecas 
    WHERE id_numerico IS NULL
    ORDER BY created_at, id
  LOOP
    UPDATE estoque_pecas 
    SET id_numerico = contador 
    WHERE id = peca.id;
    contador := contador + 1;
  END LOOP;
  
  -- Atualizar sequence para próximo valor
  PERFORM setval('estoque_pecas_id_seq', contador);
END $$;

-- Tornar coluna NOT NULL e usar sequence como default
ALTER TABLE estoque_pecas 
ALTER COLUMN id_numerico SET DEFAULT nextval('estoque_pecas_id_seq'),
ALTER COLUMN id_numerico SET NOT NULL;

-- Criar índice único
CREATE UNIQUE INDEX IF NOT EXISTS idx_pecas_id_numerico ON estoque_pecas(id_numerico);

-- Comentário
COMMENT ON COLUMN estoque_pecas.id_numerico IS 'ID sequencial numérico para cada peça (1, 2, 3...)';