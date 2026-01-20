/*
  # Adicionar coluna DISPONÍVEL IH e automação de workflow

  ## Mudanças
  1. Adiciona nova coluna 'disponivel_ih' ao constraint de coluna_kanban
  2. Esta coluna será usada para OS tipo IH que pulam negociação (LP ou Cortesia)

  ## Regras de Negócio
  - OS tipo LP pula 'negociacao_em_andamento' e vai direto para:
    - 'em_reparo_ci' se tipo_atendimento = 'CI'
    - 'disponivel_ih' se tipo_atendimento = 'IH'
  - OS tipo OW com cortesia também pula 'negociacao_em_andamento' da mesma forma

  ## Notas
  - A lógica de transição automática será implementada no frontend ao salvar diagnóstico
*/

-- Remover constraint existente
ALTER TABLE os DROP CONSTRAINT IF EXISTS os_coluna_kanban_check;

-- Adicionar nova constraint incluindo 'disponivel_ih'
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
    'controle_qualidade',
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
