/*
  # Adicionar Colunas SAW e Controle de Qualidade/OQC ao Kanban

  1. Alterações
    - Adiciona as colunas 'saw' e 'controle_qualidade' aos valores permitidos em coluna_kanban
    - Estas colunas aparecem após 'em_rota_ih' e antes de 'reparo_concluido'
    - Aplicável para OS do tipo CI e IH (não SC/ACC)

  2. Segurança
    - Mantém as políticas RLS existentes
    - Sem impacto nos dados existentes
*/

-- Remove a constraint antiga de coluna_kanban
ALTER TABLE os
DROP CONSTRAINT IF EXISTS os_coluna_kanban_check;

-- Adiciona a constraint atualizada com as novas colunas
ALTER TABLE os
ADD CONSTRAINT os_coluna_kanban_check CHECK (
  coluna_kanban IN (
    'os_nova',
    'diagnostico',
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
    'saw',
    'controle_qualidade',
    'reparo_concluido',
    'aguardando_fechamento',
    'fechar_os',
    'os_fechada',
    'orcamentos_rejeitados'
  )
);
