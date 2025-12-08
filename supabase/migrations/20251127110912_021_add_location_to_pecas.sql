/*
  # Adicionar Localização às Peças

  ## Objetivo
  Permitir que cada peça tenha uma localização específica no mapa de estoque,
  com sugestões automáticas baseadas em histórico.

  ## Alterações
  - Adicionar coluna `bin_id` em `estoque_pecas`
  - Criar funções para sugerir e listar localizações
*/

-- Adicionar coluna de localização em estoque_pecas
ALTER TABLE estoque_pecas 
ADD COLUMN IF NOT EXISTS bin_id uuid REFERENCES estoque_bins(id) ON DELETE SET NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_pecas_bin ON estoque_pecas(bin_id);
CREATE INDEX IF NOT EXISTS idx_pecas_pn_bin ON estoque_pecas(pn, bin_id);

-- Função para sugerir localização
CREATE OR REPLACE FUNCTION sugerir_localizacao(pn_busca text, unidade_atual uuid)
RETURNS TABLE (
  bin_id uuid,
  estante_id uuid,
  sala_id uuid,
  unidade_id uuid,
  localizacao_completa text,
  quantidade_usado integer
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as bin_id,
    e.id as estante_id,
    s.id as sala_id,
    u.id as unidade_id,
    CONCAT(u.nome, ' > ', s.nome, ' > ', e.nome, ' > ', b.coordenada) as localizacao_completa,
    COUNT(*)::integer as quantidade_usado
  FROM estoque_pecas p
  JOIN estoque_bins b ON p.bin_id = b.id
  JOIN estoque_estantes e ON b.estante_id = e.id
  JOIN estoque_salas s ON e.sala_id = s.id
  JOIN unidades u ON s.unidade_id = u.id
  WHERE p.pn = pn_busca
    AND p.bin_id IS NOT NULL
    AND (u.id = unidade_atual OR unidade_atual IS NULL)
  GROUP BY b.id, e.id, s.id, u.id, u.nome, s.nome, e.nome, b.coordenada
  ORDER BY COUNT(*) DESC
  LIMIT 1;
END;
$$;

-- Função para listar localizações
CREATE OR REPLACE FUNCTION listar_localizacoes_pn(pn_busca text)
RETURNS TABLE (
  bin_id uuid,
  estante_id uuid,
  sala_id uuid,
  unidade_id uuid,
  localizacao_completa text,
  quantidade integer
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as bin_id,
    e.id as estante_id,
    s.id as sala_id,
    u.id as unidade_id,
    CONCAT(u.nome, ' > ', s.nome, ' > ', e.nome, ' > ', b.coordenada) as localizacao_completa,
    COUNT(*)::integer as quantidade
  FROM estoque_pecas p
  JOIN estoque_bins b ON p.bin_id = b.id
  JOIN estoque_estantes e ON b.estante_id = e.id
  JOIN estoque_salas s ON e.sala_id = s.id
  JOIN unidades u ON s.unidade_id = u.id
  WHERE p.pn = pn_busca
    AND p.bin_id IS NOT NULL
    AND p.status != 'arquivada'
  GROUP BY b.id, e.id, s.id, u.id, u.nome, s.nome, e.nome, b.coordenada
  ORDER BY COUNT(*) DESC;
END;
$$;