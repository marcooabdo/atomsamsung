/*
  # Adicionar 4 novas colunas ao Pipeline Operacional (CI e IH)

  1. Alterações
    - Adiciona 'instalacao_inicial', 'service_handling', 'return_handling', 'trade_up'
      aos valores permitidos em coluna_kanban
    - Estas colunas ficam entre 'saw' e 'controle_qualidade' no pipeline

  2. Segurança
    - Sem impacto nos dados existentes
    - Sem alterações em políticas RLS
*/

ALTER TABLE os
DROP CONSTRAINT IF EXISTS os_coluna_kanban_check;

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
    'disponivel_ih',
    'rota_preta',
    'rota_vermelha',
    'rota_azul',
    'rota_verde',
    'rota_rosa',
    'rota_amarela',
    'rota_laranja',
    'em_rota_ih',
    'saw',
    'instalacao_inicial',
    'service_handling',
    'return_handling',
    'trade_up',
    'controle_qualidade',
    'reparo_concluido',
    'aguardando_fechamento',
    'fechar_os',
    'os_fechada',
    'orcamentos_rejeitados'
  )
);
