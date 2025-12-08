/*
  # Atualizar Bins para Sistema de Coordenadas Batalha Naval

  ## Objetivo
  Mudar sistema de coordenadas das bins para:
  - Linhas: Letras (A, B, C, D, ...)
  - Colunas: Números (1, 2, 3, 4, ...)
  - Exemplo: A1, B3, D5

  ## Mudanças
  1. Adicionar coluna `linha` (text) para letra da linha
  2. Adicionar coluna `coluna` (integer) para número da coluna
  3. Manter colunas antigas temporariamente para migração
  4. Atualizar códigos existentes

  ## Sistema Novo
  - linha: A, B, C, D, E, ... (até Z)
  - coluna: 1, 2, 3, 4, 5, ... (números)
  - codigo: Combinação linha+coluna (ex: A1, B3, Z99)
*/

-- Adicionar novas colunas
ALTER TABLE estoque_bins
ADD COLUMN IF NOT EXISTS linha text,
ADD COLUMN IF NOT EXISTS coluna integer;

-- Função helper para converter número em letra
CREATE OR REPLACE FUNCTION number_to_letter(n integer)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  IF n <= 0 THEN
    RETURN 'A';
  END IF;
  
  IF n > 26 THEN
    RETURN chr(64 + 26); -- Z
  END IF;
  
  RETURN chr(64 + n); -- A=65, B=66, etc
END;
$$;

-- Migrar dados existentes
-- andar vira linha (1→A, 2→B, etc)
-- posicao vira coluna (mantém número)
UPDATE estoque_bins
SET 
  linha = number_to_letter(andar),
  coluna = posicao
WHERE linha IS NULL;

-- Atualizar códigos para novo formato
UPDATE estoque_bins
SET codigo = linha || coluna::text
WHERE linha IS NOT NULL AND coluna IS NOT NULL;

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_estoque_bins_coordinates 
ON estoque_bins(estante_id, linha, coluna);

-- Comentários
COMMENT ON COLUMN estoque_bins.linha IS 'Linha da bin no formato letra (A, B, C, ...)';
COMMENT ON COLUMN estoque_bins.coluna IS 'Coluna da bin no formato número (1, 2, 3, ...)';
COMMENT ON COLUMN estoque_bins.codigo IS 'Código único da bin (ex: A1, B3, Z10)';