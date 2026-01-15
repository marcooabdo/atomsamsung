/*
  # Atualizar constraint de coluna_kanban

  ## Mudanças
  1. Remove constraint antiga de coluna_kanban
  2. Adiciona nova constraint incluindo 'negociacao_em_andamento'
  3. Adiciona campos de controle de orçamento na OS

  ## Notas
  - 'aguardando_cotacao' será renomeado para 'negociacao_em_andamento'
  - Novos campos permitem tracking de versão do orçamento
*/

-- Remover constraint existente
ALTER TABLE os DROP CONSTRAINT IF EXISTS os_coluna_kanban_check;

-- Adicionar nova constraint com 'negociacao_em_andamento' incluído
ALTER TABLE os ADD CONSTRAINT os_coluna_kanban_check CHECK (
  coluna_kanban IN (
    'os_nova',
    'diagnostico', 
    'aguardando_cotacao',
    'negociacao_em_andamento',
    'aguardando_aprovacao',
    'orcamento_aprovado',
    'aguardando_peca',
    'peca_em_transito',
    'peca_disponivel',
    'em_reparo_ci',
    'rota_preta',
    'rota_vermelha',
    'rota_azul',
    'rota_verde',
    'rota_rosa',
    'rota_amarela',
    'rota_laranja',
    'em_rota_ih',
    'reparo_concluido',
    'aguardando_fechamento',
    'fechar_os',
    'os_fechada',
    'finalizado',
    'orcamentos_rejeitados',
    'wip_ci',
    'wip_ih'
  )
);

-- Adicionar campos de controle de orçamento na tabela OS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'versao_orcamento'
  ) THEN
    ALTER TABLE os ADD COLUMN versao_orcamento integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'valor_orcamento_inicial'
  ) THEN
    ALTER TABLE os ADD COLUMN valor_orcamento_inicial numeric(12,2) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'orcamento_enviado'
  ) THEN
    ALTER TABLE os ADD COLUMN orcamento_enviado boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'orcamento_enviado_em'
  ) THEN
    ALTER TABLE os ADD COLUMN orcamento_enviado_em timestamptz DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'orcamento_enviado_por'
  ) THEN
    ALTER TABLE os ADD COLUMN orcamento_enviado_por uuid REFERENCES usuarios(id) DEFAULT NULL;
  END IF;
END $$;

-- Atualizar OS existentes que estão em 'aguardando_cotacao' para 'negociacao_em_andamento'
UPDATE os
SET coluna_kanban = 'negociacao_em_andamento'
WHERE coluna_kanban = 'aguardando_cotacao';
