/*
# Add "EM REPARO IH" column to Kanban board

1. Changes
  - Drops and recreates the `os_coluna_kanban_check` constraint to include `em_reparo_ih` value.
  - This new column appears after "Agendado" (em_rota_ih) in the Kanban board.

2. Important Notes
  - Idempotent: uses DROP IF EXISTS before recreating.
  - No data loss: only adds a new allowed value to an existing CHECK constraint.
*/

ALTER TABLE public.os DROP CONSTRAINT IF EXISTS os_coluna_kanban_check;

ALTER TABLE public.os ADD CONSTRAINT os_coluna_kanban_check CHECK (
  coluna_kanban = ANY (ARRAY[
    'os_nova'::text,
    'diagnostico'::text,
    'negociacao_em_andamento'::text,
    'aguardando_aprovacao'::text,
    'orcamento_aprovado'::text,
    'aguardando_peca'::text,
    'peca_em_transito'::text,
    'peca_disponivel'::text,
    'em_reparo_ci'::text,
    'disponivel_ih'::text,
    'rota_preta'::text,
    'rota_vermelha'::text,
    'rota_azul'::text,
    'rota_verde'::text,
    'rota_rosa'::text,
    'rota_amarela'::text,
    'rota_laranja'::text,
    'em_rota_ih'::text,
    'em_reparo_ih'::text,
    'saw'::text,
    'instalacao_inicial'::text,
    'service_handling'::text,
    'return_handling'::text,
    'trade_up'::text,
    'controle_qualidade'::text,
    'qa_bt'::text,
    'reparo_concluido'::text,
    'aguardando_fechamento'::text,
    'fechar_os'::text,
    'os_fechada'::text,
    'orcamentos_rejeitados'::text
  ])
);