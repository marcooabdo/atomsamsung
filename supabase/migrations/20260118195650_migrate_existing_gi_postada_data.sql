/*
  # Migrar Dados Existentes de GI Postada

  1. Alterações
    - Preenche gi_postada_em e gi_postada_por para peças que já têm status 'usada'
    - Copia os dados da requisição para as peças individuais
    - Garante consistência entre requisições e peças

  2. Notas
    - Migração de dados históricos
    - Resolve problema de peças marcadas como usadas mas sem rastreamento de GI
*/

-- Atualizar peças que estão em requisições com gi_postada mas não têm gi_postada_em
UPDATE estoque_pecas ep
SET 
  gi_postada_em = rp.gi_postada_em,
  gi_postada_por = (
    SELECT id FROM usuarios WHERE nome = 'Sistema' LIMIT 1
  )
FROM requisicoes_pecas rp
WHERE rp.status = 'gi_postada'
  AND rp.is_lote = true
  AND ep.id = ANY(rp.pecas_estoque_ids)
  AND ep.gi_postada_em IS NULL
  AND ep.status = 'usada';

-- Também atualizar peças únicas (não lote)
UPDATE estoque_pecas ep
SET 
  gi_postada_em = rp.gi_postada_em,
  gi_postada_por = (
    SELECT id FROM usuarios WHERE nome = 'Sistema' LIMIT 1
  )
FROM requisicoes_pecas rp
WHERE rp.status = 'gi_postada'
  AND (rp.is_lote = false OR rp.is_lote IS NULL)
  AND ep.id = rp.peca_estoque_id
  AND ep.gi_postada_em IS NULL
  AND ep.status = 'usada';
