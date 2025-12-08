/*
  # Adicionar Posição e Dimensões às Estantes

  ## Objetivo
  Permitir que estantes sejam posicionadas visualmente no mapa da sala
  e tenham dimensões configuráveis (largura e altura).

  ## Mudanças
  1. Adicionar colunas de posição (x, y) em pixels
  2. Adicionar colunas de dimensão (largura, altura) em pixels
  3. Adicionar coluna de rotação (0, 90, 180, 270 graus)
  4. Manter compatibilidade com estantes existentes

  ## Colunas Adicionadas
  - `posicao_x` (integer): Posição horizontal no mapa (pixels)
  - `posicao_y` (integer): Posição vertical no mapa (pixels)
  - `largura` (integer): Largura da estante no mapa (pixels)
  - `altura` (integer): Altura da estante no mapa (pixels)
  - `rotacao` (integer): Rotação em graus (0, 90, 180, 270)
*/

-- Adicionar colunas de posição e dimensão
ALTER TABLE estoque_estantes
ADD COLUMN IF NOT EXISTS posicao_x integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS posicao_y integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS largura integer DEFAULT 120,
ADD COLUMN IF NOT EXISTS altura integer DEFAULT 200,
ADD COLUMN IF NOT EXISTS rotacao integer DEFAULT 0;

-- Criar índice para melhorar performance de queries de posição
CREATE INDEX IF NOT EXISTS idx_estoque_estantes_posicao 
ON estoque_estantes(sala_id, posicao_x, posicao_y);

-- Comentários explicativos
COMMENT ON COLUMN estoque_estantes.posicao_x IS 'Posição horizontal da estante no mapa da sala (pixels)';
COMMENT ON COLUMN estoque_estantes.posicao_y IS 'Posição vertical da estante no mapa da sala (pixels)';
COMMENT ON COLUMN estoque_estantes.largura IS 'Largura da estante no mapa (pixels)';
COMMENT ON COLUMN estoque_estantes.altura IS 'Altura da estante no mapa (pixels)';
COMMENT ON COLUMN estoque_estantes.rotacao IS 'Rotação da estante em graus (0, 90, 180, 270)';