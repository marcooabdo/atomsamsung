/*
  # Create GIA Stats RPC Function

  1. New Functions
    - `get_gia_stats()` - Returns aggregated statistics for GIA AI assistant
      - OS counts by status, kanban, type
      - Financial totals
      - Inventory stats
      - Scheduling and route stats
      - All in a single efficient SQL call

  2. Important Notes
    - This replaces 20+ individual queries with one optimized call
    - Returns JSONB for flexible data structure
    - Uses service role so GIA can access all data
*/

CREATE OR REPLACE FUNCTION get_gia_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  today date := CURRENT_DATE;
  month_start date := date_trunc('month', CURRENT_DATE)::date;
  year_start date := date_trunc('year', CURRENT_DATE)::date;
BEGIN
  SELECT jsonb_build_object(
    'os', (
      SELECT jsonb_build_object(
        'total', count(*),
        'mes_atual', count(*) FILTER (WHERE created_at >= month_start),
        'ano_atual', count(*) FILTER (WHERE created_at >= year_start),
        'hoje', count(*) FILTER (WHERE created_at::date = today),
        'em_aberto', count(*) FILTER (WHERE coluna_kanban NOT IN ('concluido', 'entregue', 'cancelado', 'os_fechada')),
        'atrasadas', count(*) FILTER (WHERE prazo_entrega IS NOT NULL AND prazo_entrega::date < today AND coluna_kanban NOT IN ('concluido', 'entregue', 'cancelado')),
        'valor_total_geral', coalesce(sum(valor_total), 0),
        'valor_total_mes', coalesce(sum(valor_total) FILTER (WHERE created_at >= month_start), 0),
        'valor_total_ano', coalesce(sum(valor_total) FILTER (WHERE created_at >= year_start), 0),
        'orcamentos_total', count(*) FILTER (WHERE tipo_orcamento IN ('lp', 'normal')),
        'orcamentos_aprovados', count(*) FILTER (WHERE orcamento_aprovado = true),
        'por_status', (SELECT jsonb_object_agg(s, c) FROM (SELECT coalesce(status, 'unknown') as s, count(*) as c FROM os GROUP BY status) t),
        'por_kanban', (SELECT jsonb_object_agg(k, c) FROM (SELECT coalesce(coluna_kanban, 'unknown') as k, count(*) as c FROM os GROUP BY coluna_kanban) t),
        'por_tipo_os', (SELECT jsonb_object_agg(tp, c) FROM (SELECT coalesce(tipo_os, 'unknown') as tp, count(*) as c FROM os GROUP BY tipo_os) t),
        'por_tipo_atendimento', (SELECT jsonb_object_agg(ta, c) FROM (SELECT coalesce(tipo_atendimento, 'unknown') as ta, count(*) as c FROM os GROUP BY tipo_atendimento) t),
        'recentes', (SELECT coalesce(jsonb_agg(r), '[]'::jsonb) FROM (
          SELECT numero_os_interna, numero_os_samsung, cliente_nome, coluna_kanban, tipo_os, valor_total, created_at::text, prazo_entrega::text, tecnico_designado, unidade_id, prioridade, status_garantia, is_cortesia
          FROM os ORDER BY created_at DESC LIMIT 15
        ) r),
        'atrasadas_detalhes', (SELECT coalesce(jsonb_agg(a), '[]'::jsonb) FROM (
          SELECT numero_os_interna, cliente_nome, prazo_entrega::text, coluna_kanban, tipo_os, valor_total
          FROM os WHERE prazo_entrega IS NOT NULL AND prazo_entrega::date < today AND coluna_kanban NOT IN ('concluido', 'entregue', 'cancelado')
          ORDER BY prazo_entrega ASC LIMIT 15
        ) a),
        'por_dia_mes_atual', (SELECT coalesce(jsonb_object_agg(d, c), '{}'::jsonb) FROM (
          SELECT created_at::date::text as d, count(*) as c FROM os WHERE created_at >= month_start GROUP BY created_at::date
        ) t),
        'por_unidade', (SELECT coalesce(jsonb_object_agg(u, c), '{}'::jsonb) FROM (
          SELECT coalesce(unidade_id::text, 'sem_unidade') as u, count(*) as c FROM os GROUP BY unidade_id
        ) t)
      ) FROM os
    ),
    'financeiro', (
      SELECT jsonb_build_object(
        'total_pagamentos', count(*),
        'receita_total', coalesce(sum(valor), 0),
        'receita_mes', coalesce(sum(valor) FILTER (WHERE created_at >= month_start), 0),
        'receita_ano', coalesce(sum(valor) FILTER (WHERE created_at >= year_start), 0),
        'receita_hoje', coalesce(sum(valor) FILTER (WHERE created_at::date = today), 0),
        'por_metodo', (SELECT coalesce(jsonb_object_agg(m, c), '{}'::jsonb) FROM (
          SELECT coalesce(metodo_pagamento, 'outro') as m, count(*) as c FROM pagamentos GROUP BY metodo_pagamento
        ) t),
        'valor_por_metodo', (SELECT coalesce(jsonb_object_agg(m, v), '{}'::jsonb) FROM (
          SELECT coalesce(metodo_pagamento, 'outro') as m, coalesce(sum(valor), 0) as v FROM pagamentos GROUP BY metodo_pagamento
        ) t),
        'recentes', (SELECT coalesce(jsonb_agg(r), '[]'::jsonb) FROM (
          SELECT valor, metodo_pagamento, status, created_at::text, os_id FROM pagamentos ORDER BY created_at DESC LIMIT 20
        ) r)
      ) FROM pagamentos
    ),
    'estoque', (
      SELECT jsonb_build_object(
        'total_pecas', count(*),
        'pecas_disponiveis', count(*) FILTER (WHERE status = 'disponivel'),
        'pecas_reservadas', count(*) FILTER (WHERE status = 'reservada'),
        'pecas_em_uso', count(*) FILTER (WHERE status = 'em_uso'),
        'pecas_devolvidas_novas', count(*) FILTER (WHERE status = 'devolvida_nova'),
        'gi_pendentes', count(*) FILTER (WHERE status = 'devolvida_nova' AND (gi_postada IS NULL OR gi_postada = false)),
        'pecas_criticas', (SELECT coalesce(jsonb_agg(p), '[]'::jsonb) FROM (
          SELECT sku, descricao, quantidade, preco_custo, preco_venda FROM estoque_pecas WHERE quantidade <= 2 AND status = 'disponivel' LIMIT 20
        ) p),
        'valor_total_estoque', coalesce(sum(quantidade * preco_custo), 0)
      ) FROM estoque_pecas
    ),
    'cotacoes', (
      SELECT jsonb_build_object(
        'total', count(*),
        'pendentes', count(*) FILTER (WHERE status IN ('pendente', 'enviada')),
        'aprovadas', count(*) FILTER (WHERE status = 'aprovada'),
        'reprovadas', count(*) FILTER (WHERE status = 'reprovada'),
        'valor_pendente', coalesce(sum(valor_total) FILTER (WHERE status IN ('pendente', 'enviada')), 0)
      ) FROM cotacoes
    ),
    'requisicoes', (
      SELECT jsonb_build_object(
        'total', count(*),
        'pendentes', count(*) FILTER (WHERE status IN ('pendente', 'aguardando_aprovacao')),
        'por_status', (SELECT coalesce(jsonb_object_agg(s, c), '{}'::jsonb) FROM (
          SELECT coalesce(status::text, 'unknown') as s, count(*) as c FROM requisicoes_pecas GROUP BY status
        ) t)
      ) FROM requisicoes_pecas
    ),
    'agendamentos', (
      SELECT jsonb_build_object(
        'total', count(*),
        'hoje', count(*) FILTER (WHERE data_agendamento = today),
        'agenda_hoje', (SELECT coalesce(jsonb_agg(a), '[]'::jsonb) FROM (
          SELECT ag.os_id, ag.tecnico_id, ag.periodo, ag.status::text, ag.checkin_at IS NOT NULL as tem_checkin, o.cliente_nome, o.numero_os_interna
          FROM agendamentos ag LEFT JOIN os o ON o.id = ag.os_id
          WHERE ag.data_agendamento = today
        ) a)
      ) FROM agendamentos
    ),
    'rotas', (
      SELECT jsonb_build_object(
        'total', count(*),
        'abertas', count(*) FILTER (WHERE status IN ('em_andamento', 'planejada')),
        'concluidas_mes', count(*) FILTER (WHERE status = 'concluida' AND created_at >= month_start)
      ) FROM rotas_otimizadas
    ),
    'tecnicos', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
      SELECT id, nome, tipo, unidade_id, numero_tecnico FROM usuarios WHERE tipo IN ('tecnico', 'tecnico_ih', 'master', 'diretoria', 'supervisor') AND ativo = true
    ) t),
    'unidades', (SELECT coalesce(jsonb_agg(u), '[]'::jsonb) FROM (
      SELECT id, nome, cidade, estado FROM unidades WHERE ativa = true
    ) u),
    'skywalker', jsonb_build_object(
      'profissionais_ativos', (SELECT count(*) FROM skywalker_profissionais WHERE ativo = true),
      'niveis', (SELECT coalesce(jsonb_agg(n ORDER BY ordem), '[]'::jsonb) FROM (SELECT nome, estrelas_necessarias, bonus_valor, ordem FROM skywalker_niveis WHERE ativo = true) n)
    ),
    'jobs', jsonb_build_object(
      'total', (SELECT count(*) FROM jobs),
      'em_andamento', (SELECT count(*) FROM jobs WHERE status = 'em_andamento')
    ),
    'nfs_recentes', (SELECT count(*) FROM estoque_nfs),
    'checklists_ativos', (SELECT count(*) FROM checklists WHERE ativo = true),
    'metas', (SELECT coalesce(jsonb_agg(m), '[]'::jsonb) FROM (SELECT * FROM metas_performance) m),
    'data_hoje', today::text,
    'mes_referencia', to_char(CURRENT_DATE, 'YYYY-MM')
  ) INTO result;

  RETURN result;
END;
$$;
