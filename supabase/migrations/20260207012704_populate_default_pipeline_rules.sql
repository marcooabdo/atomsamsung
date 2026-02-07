/*
  # Populate Default Pipeline Rules

  ## Overview
  This migration creates default pipeline automation rules for each OS type (IH, CI, SC/ACC, OW).
  These rules implement the standard workflow for service orders based on their characteristics.

  ## Rules Created

  ### IH (In-Home) Rules:
  1. Orçamento Aprovado → Aguardando Peça (when parts are needed)
  2. Aguardando Peça → Peça em Trânsito (when parts are requested)
  3. Peça em Trânsito → Rota Específica (when all parts received and city in route)
  4. Peça em Trânsito → Disponível IH (when all parts received and city NOT in route)

  ### CI (Carry-In) Rules:
  1. Orçamento Aprovado → Em Reparo CI (when no parts needed)
  2. Orçamento Aprovado → Aguardando Peça (when parts needed)

  ### SC/ACC Rules:
  1. Peça Disponível → Aguardando Fechamento

  ### OW Rules:
  OW follows IH or CI rules depending on tipo_atendimento

  ## Note
  Rules are created with unidade_id = NULL, making them apply to all units.
  Users can create unit-specific rules that override these defaults.
*/

-- IH Rule 1: Orçamento Aprovado → Aguardando Peça
INSERT INTO pipeline_regras (
  nome,
  descricao,
  tipo_regra,
  coluna_origem,
  coluna_destino,
  condicoes,
  ativo,
  unidade_id
) VALUES (
  'IH: Orçamento Aprovado → Aguardando Peça',
  'Move OS tipo IH de orçamento aprovado para aguardando peça automaticamente',
  'orcamento_aprovado',
  'orcamento_aprovado',
  'aguardando_peca',
  '{"tipo_atendimento": "IH"}'::jsonb,
  true,
  NULL
) ON CONFLICT DO NOTHING;

-- IH Rule 2: Aguardando Peça → Peça em Trânsito (when parts requested)
INSERT INTO pipeline_regras (
  nome,
  descricao,
  tipo_regra,
  coluna_origem,
  coluna_destino,
  condicoes,
  ativo,
  unidade_id
) VALUES (
  'IH: Aguardando Peça → Peça em Trânsito',
  'Move OS para peça em trânsito quando peça é requisitada mas ainda não recebida',
  'pecas_recebidas',
  'aguardando_peca',
  'peca_em_transito',
  '{"tipo_atendimento": "IH", "todas_pecas_recebidas": false, "requer_peca": true}'::jsonb,
  true,
  NULL
) ON CONFLICT DO NOTHING;

-- IH Rule 3: Peça em Trânsito → Rota Específica (when all parts received and city in route)
INSERT INTO pipeline_regras (
  nome,
  descricao,
  tipo_regra,
  coluna_origem,
  coluna_destino,
  condicoes,
  ativo,
  unidade_id
) VALUES (
  'IH: Peça em Trânsito → Rota (cidade cadastrada)',
  'Move OS para rota específica quando todas as peças são recebidas e a cidade está cadastrada em uma rota',
  'pecas_recebidas',
  'peca_em_transito',
  'rota_preta',
  '{"tipo_atendimento": "IH", "todas_pecas_recebidas": true, "cidade_cadastrada_em_rota": true}'::jsonb,
  true,
  NULL
) ON CONFLICT DO NOTHING;

-- IH Rule 4: Peça em Trânsito → Disponível IH (when all parts received and city NOT in route)
INSERT INTO pipeline_regras (
  nome,
  descricao,
  tipo_regra,
  coluna_origem,
  coluna_destino,
  condicoes,
  ativo,
  unidade_id
) VALUES (
  'IH: Peça em Trânsito → Disponível IH (cidade não cadastrada)',
  'Move OS para disponível IH quando todas as peças são recebidas mas a cidade não está em nenhuma rota',
  'pecas_recebidas',
  'peca_em_transito',
  'disponivel_ih',
  '{"tipo_atendimento": "IH", "todas_pecas_recebidas": true, "cidade_cadastrada_em_rota": false}'::jsonb,
  true,
  NULL
) ON CONFLICT DO NOTHING;

-- CI Rule 1: Orçamento Aprovado → Em Reparo CI (no parts needed)
INSERT INTO pipeline_regras (
  nome,
  descricao,
  tipo_regra,
  coluna_origem,
  coluna_destino,
  condicoes,
  ativo,
  unidade_id
) VALUES (
  'CI: Orçamento Aprovado → Em Reparo CI (sem peças)',
  'Move OS tipo CI de orçamento aprovado diretamente para em reparo quando não requer peças',
  'orcamento_aprovado',
  'orcamento_aprovado',
  'em_reparo_ci',
  '{"tipo_atendimento": "CI", "requer_peca": false}'::jsonb,
  true,
  NULL
) ON CONFLICT DO NOTHING;

-- CI Rule 2: Orçamento Aprovado → Aguardando Peça (parts needed)
INSERT INTO pipeline_regras (
  nome,
  descricao,
  tipo_regra,
  coluna_origem,
  coluna_destino,
  condicoes,
  ativo,
  unidade_id
) VALUES (
  'CI: Orçamento Aprovado → Aguardando Peça (com peças)',
  'Move OS tipo CI de orçamento aprovado para aguardando peça quando requer peças',
  'orcamento_aprovado',
  'orcamento_aprovado',
  'aguardando_peca',
  '{"tipo_atendimento": "CI", "requer_peca": true}'::jsonb,
  true,
  NULL
) ON CONFLICT DO NOTHING;

-- CI Rule 3: Aguardando Peça → Peça em Trânsito
INSERT INTO pipeline_regras (
  nome,
  descricao,
  tipo_regra,
  coluna_origem,
  coluna_destino,
  condicoes,
  ativo,
  unidade_id
) VALUES (
  'CI: Aguardando Peça → Peça em Trânsito',
  'Move OS CI para peça em trânsito quando peça é requisitada',
  'pecas_recebidas',
  'aguardando_peca',
  'peca_em_transito',
  '{"tipo_atendimento": "CI", "todas_pecas_recebidas": false, "requer_peca": true}'::jsonb,
  true,
  NULL
) ON CONFLICT DO NOTHING;

-- CI Rule 4: Peça em Trânsito → Em Reparo CI
INSERT INTO pipeline_regras (
  nome,
  descricao,
  tipo_regra,
  coluna_origem,
  coluna_destino,
  condicoes,
  ativo,
  unidade_id
) VALUES (
  'CI: Peça em Trânsito → Em Reparo CI',
  'Move OS CI para em reparo quando todas as peças são recebidas',
  'pecas_recebidas',
  'peca_em_transito',
  'em_reparo_ci',
  '{"tipo_atendimento": "CI", "todas_pecas_recebidas": true}'::jsonb,
  true,
  NULL
) ON CONFLICT DO NOTHING;

-- SC/ACC Rule: Peça Disponível → Aguardando Fechamento
INSERT INTO pipeline_regras (
  nome,
  descricao,
  tipo_regra,
  coluna_origem,
  coluna_destino,
  condicoes,
  ativo,
  unidade_id
) VALUES (
  'SC/ACC: Peça Disponível → Aguardando Fechamento',
  'Move OS tipos SC e ACC de peça disponível para aguardando fechamento automaticamente',
  'peca_disponivel',
  'peca_disponivel',
  'aguardando_fechamento',
  '{"tipo_os": ["SC", "ACC"]}'::jsonb,
  true,
  NULL
) ON CONFLICT DO NOTHING;

-- OW Rule 1: IH - Orçamento Aprovado → Aguardando Peça
INSERT INTO pipeline_regras (
  nome,
  descricao,
  tipo_regra,
  coluna_origem,
  coluna_destino,
  condicoes,
  ativo,
  unidade_id
) VALUES (
  'OW-IH: Orçamento Aprovado → Aguardando Peça',
  'Move OS tipo OW com atendimento IH de orçamento aprovado para aguardando peça',
  'orcamento_aprovado',
  'orcamento_aprovado',
  'aguardando_peca',
  '{"tipo_os": ["OW"], "tipo_atendimento": "IH"}'::jsonb,
  true,
  NULL
) ON CONFLICT DO NOTHING;

-- OW Rule 2: CI sem peças - Orçamento Aprovado → Em Reparo CI
INSERT INTO pipeline_regras (
  nome,
  descricao,
  tipo_regra,
  coluna_origem,
  coluna_destino,
  condicoes,
  ativo,
  unidade_id
) VALUES (
  'OW-CI: Orçamento Aprovado → Em Reparo CI (sem peças)',
  'Move OS tipo OW com atendimento CI de orçamento aprovado para em reparo quando não requer peças',
  'orcamento_aprovado',
  'orcamento_aprovado',
  'em_reparo_ci',
  '{"tipo_os": ["OW"], "tipo_atendimento": "CI", "requer_peca": false}'::jsonb,
  true,
  NULL
) ON CONFLICT DO NOTHING;

-- OW Rule 3: CI com peças - Orçamento Aprovado → Aguardando Peça
INSERT INTO pipeline_regras (
  nome,
  descricao,
  tipo_regra,
  coluna_origem,
  coluna_destino,
  condicoes,
  ativo,
  unidade_id
) VALUES (
  'OW-CI: Orçamento Aprovado → Aguardando Peça (com peças)',
  'Move OS tipo OW com atendimento CI de orçamento aprovado para aguardando peça quando requer peças',
  'orcamento_aprovado',
  'orcamento_aprovado',
  'aguardando_peca',
  '{"tipo_os": ["OW"], "tipo_atendimento": "CI", "requer_peca": true}'::jsonb,
  true,
  NULL
) ON CONFLICT DO NOTHING;

-- OW Rule 4: Peça em Trânsito → Rota (IH com cidade cadastrada)
INSERT INTO pipeline_regras (
  nome,
  descricao,
  tipo_regra,
  coluna_origem,
  coluna_destino,
  condicoes,
  ativo,
  unidade_id
) VALUES (
  'OW-IH: Peça em Trânsito → Rota (cidade cadastrada)',
  'Move OS OW-IH para rota específica quando todas as peças são recebidas e cidade está cadastrada',
  'pecas_recebidas',
  'peca_em_transito',
  'rota_preta',
  '{"tipo_os": ["OW"], "tipo_atendimento": "IH", "todas_pecas_recebidas": true, "cidade_cadastrada_em_rota": true}'::jsonb,
  true,
  NULL
) ON CONFLICT DO NOTHING;

-- OW Rule 5: Peça em Trânsito → Disponível IH (cidade não cadastrada)
INSERT INTO pipeline_regras (
  nome,
  descricao,
  tipo_regra,
  coluna_origem,
  coluna_destino,
  condicoes,
  ativo,
  unidade_id
) VALUES (
  'OW-IH: Peça em Trânsito → Disponível IH (cidade não cadastrada)',
  'Move OS OW-IH para disponível IH quando todas as peças são recebidas mas cidade não está em rota',
  'pecas_recebidas',
  'peca_em_transito',
  'disponivel_ih',
  '{"tipo_os": ["OW"], "tipo_atendimento": "IH", "todas_pecas_recebidas": true, "cidade_cadastrada_em_rota": false}'::jsonb,
  true,
  NULL
) ON CONFLICT DO NOTHING;

-- OW Rule 6: Peça em Trânsito → Em Reparo CI (CI)
INSERT INTO pipeline_regras (
  nome,
  descricao,
  tipo_regra,
  coluna_origem,
  coluna_destino,
  condicoes,
  ativo,
  unidade_id
) VALUES (
  'OW-CI: Peça em Trânsito → Em Reparo CI',
  'Move OS OW-CI para em reparo quando todas as peças são recebidas',
  'pecas_recebidas',
  'peca_em_transito',
  'em_reparo_ci',
  '{"tipo_os": ["OW"], "tipo_atendimento": "CI", "todas_pecas_recebidas": true}'::jsonb,
  true,
  NULL
) ON CONFLICT DO NOTHING;
