/*
  # Adicionar campo is_cortesia à tabela OS

  1. Descrição
    - Adiciona o campo booleano "is_cortesia" à tabela "os"
    - Permite marcar ordens de serviço do tipo OW como cortesia (sem cobrança)
    - Valor padrão: false

  2. Alterações
    - Adiciona coluna "is_cortesia" (boolean, NOT NULL, default false)
    - Campo indica que a OS foi marcada como cortesia e não há valor a cobrar

  3. Segurança
    - Não requer alterações nas políticas RLS existentes
    - O campo será acessível pelos mesmos usuários que têm acesso à OS

  4. Impacto
    - Não afeta dados existentes (todas as OS existentes terão is_cortesia = false)
    - Compatível com todas as funcionalidades atuais
*/

-- Adicionar coluna is_cortesia à tabela os
ALTER TABLE os 
ADD COLUMN IF NOT EXISTS is_cortesia boolean NOT NULL DEFAULT false;

-- Adicionar comentário explicativo
COMMENT ON COLUMN os.is_cortesia IS 'Indica se a OS foi marcada como cortesia (sem cobrança). Aplicável principalmente para OS tipo OW.';
