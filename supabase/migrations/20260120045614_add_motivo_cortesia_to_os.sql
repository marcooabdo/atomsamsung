/*
  # Adicionar campo motivo_cortesia à tabela OS

  1. Descrição
    - Adiciona o campo "motivo_cortesia" à tabela "os"
    - Armazena o motivo pelo qual a OS foi marcada como cortesia
    - Campo opcional, preenchido apenas quando is_cortesia = true

  2. Alterações
    - Adiciona coluna "motivo_cortesia" (text, nullable)
    - Campo armazena a justificativa da cortesia

  3. Segurança
    - Não requer alterações nas políticas RLS existentes
    - O campo será acessível pelos mesmos usuários que têm acesso à OS

  4. Impacto
    - Não afeta dados existentes
    - Compatível com todas as funcionalidades atuais
*/

-- Adicionar coluna motivo_cortesia à tabela os
ALTER TABLE os 
ADD COLUMN IF NOT EXISTS motivo_cortesia text;

-- Adicionar comentário explicativo
COMMENT ON COLUMN os.motivo_cortesia IS 'Justificativa do motivo pelo qual a OS foi marcada como cortesia. Preenchido quando is_cortesia = true.';
