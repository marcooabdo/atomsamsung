/*
  # Enhance GIA Stats RPC with Detailed Breakdowns

  1. Changes
    - Add OS breakdown by tipo_atendimento per unidade (CI vs IH per unit)
    - Add OS per day for last 7 days with tipo_atendimento breakdown
    - Add OS per unidade with tipo_atendimento breakdown
    - Add more granular agendamento stats
    - Add technician workload stats

  2. Important Notes
    - More detailed data allows GIA to answer questions like:
      "quantas OS abriram nos ultimos dias, CI ou IH, de qual unidade"
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
  week_ago date := CURRENT_DATE - interval '7 days';
BEGIN
  SELECT jsonb_build_object(
    'os', (
      SELECT jsonb_build_object(
        'total', count(*),
        'mes_atual', count(*) FILTER (WHERE created_at >= month_start),
        'ano_atual', count(*) FILTER (WHERE created_at >= year_start),
        'hoje', count(*) FILTER (WHERE created_at::date = today),
        'ultimos_7_dias', count(*) FILTER (WHERE created_at::date >= week_ago),
        'em_aberto', count(*) FILTER (WHERE coluna_kanban NOT IN ('concluido', 'entregue', 'cancelado', 'os_fechada')),
        'valor_total_geral', coalesce(sum(valor_total), 0),
        'valor_total_mes', coalesce(sum(valor_total) FILTER (WHERE created_at >= month_start), 0),
        'valor_total_ano', coalesce(sum(valor_total) FILTER (WHERE created_at >= year_start), 0),
        'orcamentos_total', count(*) FILTER (WHERE tipo_orcamento IN ('lp', 'normal')),
        'orcamentos_aprovados', count(*) FILTER (WHERE orcamento_aprovado_em IS NOT NULL),
        'cortesias', count(*) FILTER (WHERE is_cortesia = true),
        'por_kanban', (SELECT coalesce(jsonb_object_agg(k, c), '{}'::jsonb) FROM (SELECT coalesce(coluna_kanban, 'unknown') as k, count(*) as c FROM os GROUP BY coluna_kanban) t),
        'por_tipo_os', (SELECT coalesce(jsonb_object_agg(tp, c), '{}'::jsonb) FROM (SELECT coalesce(tipo_os, 'unknown') as tp, count(*) as c FROM os GROUP BY tipo_os) t),
        'por_tipo_atendimento', (SELECT coalesce(jsonb_object_agg(ta, c), '{}'::jsonb) FROM (SELECT coalesce(tipo_atendimento, 'unknown') as ta, count(*) as c FROM os GROUP BY tipo_atendimento) t),
        'por_tipo_atendimento_mes', (SELECT coalesce(jsonb_object_agg(ta, c), '{}'::jsonb) FROM (SELECT coalesce(tipo_atendimento, 'unknown') as ta, count(*) as c FROM os WHERE created_at >= month_start GROUP BY tipo_atendimento) t),
        'por_unidade', (SELECT coalesce(jsonb_object_agg(u, c), '{}'::jsonb) FROM (
          SELECT coalesce(unidade_id::text, 'sem_unidade') as u, count(*) as c FROM os GROUP BY unidade_id
        ) t),
        'por_unidade_mes', (SELECT coalesce(jsonb_object_agg(u, c), '{}'::jsonb) FROM (
          SELECT coalesce(unidade_id::text, 'sem_unidade') as u, count(*) as c FROM os WHERE created_at >= month_start GROUP BY unidade_id
        ) t),
        'por_dia_mes_atual', (SELECT coalesce(jsonb_object_agg(d, c), '{}'::jsonb) FROM (
          SELECT created_at::date::text as d, count(*) as c FROM os WHERE created_at >= month_start GROUP BY created_at::date
        ) t),
        'ultimos_7_dias_detalhado', (SELECT coalesce(jsonb_agg(r), '[]'::jsonb) FROM (
          SELECT 
            d::text as dia,
            count(*) as total,
            count(*) FILTER (WHERE tipo_atendimento = 'CI') as ci,
            count(*) FILTER (WHERE tipo_atendimento = 'IH') as ih,
            count(*) FILTER (WHERE tipo_atendimento NOT IN ('CI', 'IH') OR tipo_atendimento IS NULL) as outros
          FROM os, generate_series(week_ago, today, '1 day'::interval) d
          WHERE created_at::date = d::date
          GROUP BY d
          ORDER BY d DESC
        ) r),
        'por_unidade_tipo_atendimento', (SELECT coalesce(jsonb_agg(r), '[]'::jsonb) FROM (
          SELECT 
            coalesce(o.unidade_id::text, 'sem_unidade') as unidade_id,
            coalesce(u.nome, 'Sem Unidade') as unidade_nome,
            count(*) as total,
            count(*) FILTER (WHERE o.tipo_atendimento = 'CI') as ci,
            count(*) FILTER (WHERE o.tipo_atendimento = 'IH') as ih,
            count(*) FILTER (WHERE o.tipo_atendimento NOT IN ('CI', 'IH') OR o.tipo_atendimento IS NULL) as outros,
            count(*) FILTER (WHERE o.created_at >= month_start) as total_mes,
            count(*) FILTER (WHERE o.tipo_atendimento = 'CI' AND o.created_at >= month_start) as ci_mes,
            count(*) FILTER (WHERE o.tipo_atendimento = 'IH' AND o.created_at >= month_start) as ih_mes
          FROM os o LEFT JOIN unidades u ON u.id = o.unidade_id
          GROUP BY o.unidade_id, u.nome
          ORDER BY total DESC
        ) r),
        'recentes', (SELECT coalesce(jsonb_agg(r), '[]'::jsonb) FROM (
          SELECT numero_os_interna, numero_os_samsung, cliente_nome, coluna_kanban, tipo_os, tipo_atendimento, valor_total, created_at::text, tecnico_designado_id, unidade_id, status_garantia, is_cortesia
          FROM os ORDER BY created_at DESC LIMIT 20
        ) r),
        'tecnicos_carga', (SELECT coalesce(jsonb_agg(r), '[]'::jsonb) FROM (
          SELECT 
            coalesce(t.nome, 'Sem tecnico') as tecnico_nome,
            o.tecnico_designado_id,
            count(*) as total_os,
            count(*) FILTER (WHERE o.coluna_kanban NOT IN ('concluido', 'entregue', 'cancelado', 'os_fechada')) as os_abertas,
            count(*) FILTER (WHERE o.created_at >= month_start) as os_mes
          FROM os o LEFT JOIN usuarios t ON t.id = o.tecnico_designado_id
          WHERE o.tecnico_designado_id IS NOT NULL
          GROUP BY o.tecnico_designado_id, t.nome
          ORDER BY total_os DESC
          LIMIT 20
        ) r)
      ) FROM os
    ),
    'financeiro', (
      SELECT jsonb_build_object(
        'total_pagamentos', count(*),
        'receita_total', coalesce(sum(valor), 0),
        'receita_mes', coalesce(sum(valor) FILTER (WHERE created_at >= month_start), 0),
        'receita_ano', coalesce(sum(valor) FILTER (WHERE created_at >= year_start), 0),
        'receita_hoje', coalesce(sum(valor) FILTER (WHERE created_at::date = today), 0),
        'por_forma', (SELECT coalesce(jsonb_object_agg(m, c), '{}'::jsonb) FROM (
          SELECT coalesce(forma_pagamento, 'outro') as m, count(*) as c FROM pagamentos GROUP BY forma_pagamento
        ) t),
        'valor_por_forma', (SELECT coalesce(jsonb_object_agg(m, v), '{}'::jsonb) FROM (
          SELECT coalesce(forma_pagamento, 'outro') as m, coalesce(sum(valor), 0) as v FROM pagamentos GROUP BY forma_pagamento
        ) t),
        'recentes', (SELECT coalesce(jsonb_agg(r), '[]'::jsonb) FROM (
          SELECT valor, forma_pagamento, created_at::text, os_id FROM pagamentos ORDER BY created_at DESC LIMIT 20
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
        'gi_pendentes', count(*) FILTER (WHERE status = 'devolvida_nova' AND gi_postada_em IS NULL),
        'valor_total_estoque', coalesce(sum(valor_com_impostos), 0)
      ) FROM estoque_pecas
    ),
    'cotacoes', (
      SELECT jsonb_build_object(
        'total', count(*),
        'pendentes', count(*) FILTER (WHERE status IN ('pendente', 'enviada')),
        'aprovadas', count(*) FILTER (WHERE status = 'aprovada'),
        'reprovadas', count(*) FILTER (WHERE status = 'reprovada')
      ) FROM cotacoes
    ),
    'requisicoes', (
      SELECT jsonb_build_object(
        'total', count(*),
        'pendentes', count(*) FILTER (WHERE status = 'pendente'),
        'por_status', (SELECT coalesce(jsonb_object_agg(s, c), '{}'::jsonb) FROM (
          SELECT coalesce(status::text, 'unknown') as s, count(*) as c FROM requisicoes_pecas GROUP BY status
        ) t)
      ) FROM requisicoes_pecas
    ),
    'agendamentos', (
      SELECT jsonb_build_object(
        'total', count(*),
        'hoje', count(*) FILTER (WHERE data_agendamento = today),
        'semana', count(*) FILTER (WHERE data_agendamento >= week_ago AND data_agendamento <= today),
        'agenda_hoje', (SELECT coalesce(jsonb_agg(a), '[]'::jsonb) FROM (
          SELECT ag.os_id, ag.tecnico_id, ag.status::text, ag.checkin_realizado, o.cliente_nome, o.numero_os_interna, o.tipo_atendimento
          FROM agendamentos ag LEFT JOIN os o ON o.id = ag.os_id
          WHERE ag.data_agendamento = today
        ) a)
      ) FROM agendamentos
    ),
    'rotas', (
      SELECT jsonb_build_object(
        'total', count(*),
        'ativas', count(*) FILTER (WHERE ativa = true)
      ) FROM rotas
    ),
    'tecnicos', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
      SELECT id, nome, tipo, unidade_id, numero_tecnico FROM usuarios WHERE tipo IN ('tecnico', 'tecnico_ih', 'master', 'diretoria', 'supervisor', 'administrador') AND ativo = true
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
    'checklists_ativos', (SELECT count(*) FROM checklist_templates WHERE ativo = true),
    'metas', (SELECT coalesce(jsonb_agg(m), '[]'::jsonb) FROM (SELECT * FROM metas_performance) m),
    'data_hoje', today::text,
    'mes_referencia', to_char(CURRENT_DATE, 'YYYY-MM')
  ) INTO result;

  RETURN result;
END;
$$;
