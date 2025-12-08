/*
  # Adicionar número da OS às requisições de peças

  1. Alterações
    - Adiciona coluna `numero_os_samsung` em `requisicoes_pecas`
    - Permite rastrear requisições mesmo quando a OS é deletada ou movida
    - Atualiza requisições existentes com o número da OS atual

  2. Notas
    - Campo text (não UUID) para preservar o número mesmo após deleção da OS
    - Facilita identificação no estoque de qual OS a requisição pertence
*/

-- Adicionar coluna numero_os_samsung
ALTER TABLE requisicoes_pecas 
ADD COLUMN IF NOT EXISTS numero_os_samsung text;

-- Atualizar requisições existentes com o número da OS
UPDATE requisicoes_pecas rp
SET numero_os_samsung = os.numero_os_samsung
FROM os
WHERE rp.os_id = os.id
AND rp.numero_os_samsung IS NULL;

-- Comentário na coluna
COMMENT ON COLUMN requisicoes_pecas.numero_os_samsung IS 'Número da OS Samsung preservado mesmo após deleção da OS';
