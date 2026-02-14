/*
  VALIDAÇÃO RÁPIDA: Sistema de Pagamentos
  Execute este script para obter um diagnóstico instantâneo
*/

\echo '========================================='
\echo '   VALIDAÇÃO RÁPIDA - SISTEMA PAGAMENTOS'
\echo '========================================='
\echo ''

-- 1. STATUS DOS TRIGGERS
\echo '1. TRIGGERS ATIVOS NA TABELA PAGAMENTOS:'
\echo '----------------------------------------'
SELECT
  tgname as "Trigger",
  CASE tgenabled
    WHEN 'O' THEN '✅ Ativo'
    WHEN 'D' THEN '❌ Desabilitado'
    ELSE '⚠️  Desconhecido'
  END as "Status"
FROM pg_trigger
WHERE tgrelid = 'pagamentos'::regclass
  AND tgname LIKE '%atualizar_valores%'
ORDER BY tgname;

\echo ''
\echo '2. CONSISTÊNCIA GERAL DAS OSs:'
\echo '----------------------------------------'
SELECT
  COUNT(*) as "Total OSs com Pagamento",
  COUNT(*) FILTER (
    WHERE valor_pago = (
      SELECT COALESCE(SUM(valor), 0)
      FROM pagamentos p
      WHERE p.os_id = o.id
    )
  ) as "✅ Valores Consistentes",
  COUNT(*) FILTER (
    WHERE valor_pago != (
      SELECT COALESCE(SUM(valor), 0)
      FROM pagamentos p
      WHERE p.os_id = o.id
    )
  ) as "❌ Valores Inconsistentes",
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE valor_pago = (
        SELECT COALESCE(SUM(valor), 0)
        FROM pagamentos p
        WHERE p.os_id = o.id
      )
    ) / NULLIF(COUNT(*), 0),
    2
  ) as "% Saúde"
FROM os o
WHERE valor_pago > 0
  AND created_at > NOW() - INTERVAL '90 days';

\echo ''
\echo '3. OSs COM PROBLEMAS (Últimos 30 dias):'
\echo '----------------------------------------'
SELECT
  numero_os_samsung as "OS Samsung",
  cliente_nome as "Cliente",
  CONCAT('R$ ', valor_total) as "Valor Total",
  CONCAT('R$ ', valor_pago) as "Valor Pago",
  status_pagamento as "Status",
  CASE
    WHEN valor_total = 0 AND valor_pago > 0
    THEN '⚠️  Pagamento sem orçamento'
    WHEN ABS(saldo_restante - (valor_total - valor_pago)) > 0.01
    THEN '⚠️  Saldo incorreto'
    WHEN valor_pago >= valor_total AND valor_total > 0 AND status_pagamento != 'pago'
    THEN '⚠️  Status deveria ser pago'
    ELSE '✅ OK'
  END as "Diagnóstico"
FROM os
WHERE created_at > NOW() - INTERVAL '30 days'
  AND valor_pago > 0
  AND (
    (valor_total = 0 AND valor_pago > 0) OR
    (ABS(saldo_restante - (valor_total - valor_pago)) > 0.01) OR
    (valor_pago >= valor_total AND valor_total > 0 AND status_pagamento != 'pago')
  )
ORDER BY created_at DESC
LIMIT 10;

\echo ''
\echo '4. INTEGRAÇÃO SKYWALKER - VENDAS:'
\echo '----------------------------------------'
SELECT
  COUNT(*) as "Total Vendas (30d)",
  COUNT(*) FILTER (WHERE status = 'concluido') as "Vendas Concluídas",
  COUNT(*) FILTER (WHERE enviado_skywalker = true) as "✅ Enviadas p/ Skywalker",
  COUNT(*) FILTER (WHERE status = 'concluido' AND enviado_skywalker = false) as "❌ Não Enviadas",
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE enviado_skywalker = true) /
    NULLIF(COUNT(*) FILTER (WHERE status = 'concluido'), 0),
    2
  ) as "% Sincronização"
FROM vendas
WHERE created_at > NOW() - INTERVAL '30 days';

\echo ''
\echo '5. SKYWALKER - ESTRELAS DO MÊS ATUAL:'
\echo '----------------------------------------'
SELECT
  u.nome as "Profissional",
  p.time as "Time",
  COUNT(DISTINCT em.pilar_id) as "Pilares Ativos",
  SUM(em.estrelas_conquistadas) as "⭐ Total Estrelas",
  n.nome as "Nível Atual",
  n.estrelas_necessarias as "Estrelas Necessárias"
FROM skywalker_profissionais p
JOIN usuarios u ON u.id = p.usuario_id
LEFT JOIN skywalker_estrelas_mes em ON em.profissional_id = p.id
  AND em.mes_referencia = date_trunc('month', NOW())::date
LEFT JOIN skywalker_niveis n ON n.id = p.nivel_atual_id
WHERE p.ativo = true
GROUP BY p.id, u.nome, p.time, n.nome, n.estrelas_necessarias
ORDER BY SUM(em.estrelas_conquistadas) DESC NULLS LAST;

\echo ''
\echo '6. ESTATÍSTICAS DE PAGAMENTO (Hoje):'
\echo '----------------------------------------'
SELECT
  COUNT(*) as "Pagamentos Hoje",
  CONCAT('R$ ', ROUND(SUM(valor), 2)) as "Total Recebido",
  CONCAT('R$ ', ROUND(AVG(valor), 2)) as "Ticket Médio",
  COUNT(DISTINCT os_id) as "OSs Pagas"
FROM pagamentos
WHERE DATE(data_lancamento) = CURRENT_DATE;

\echo ''
\echo '7. FORMAS DE PAGAMENTO MAIS USADAS (30d):'
\echo '----------------------------------------'
SELECT
  forma_pagamento as "Forma",
  COUNT(*) as "Quantidade",
  CONCAT('R$ ', ROUND(SUM(valor), 2)) as "Total",
  CONCAT('R$ ', ROUND(AVG(valor), 2)) as "Média"
FROM pagamentos
WHERE data_lancamento > NOW() - INTERVAL '30 days'
GROUP BY forma_pagamento
ORDER BY SUM(valor) DESC
LIMIT 5;

\echo ''
\echo '8. RESUMO EXECUTIVO:'
\echo '----------------------------------------'
WITH stats AS (
  SELECT
    COUNT(*) FILTER (WHERE valor_pago > 0) as total_os,
    COUNT(*) FILTER (
      WHERE valor_pago > 0
      AND valor_pago = (SELECT COALESCE(SUM(valor), 0) FROM pagamentos WHERE os_id = os.id)
    ) as os_ok,
    COUNT(*) FILTER (
      WHERE valor_total = 0 AND valor_pago > 0
    ) as pagamento_sem_orcamento,
    (SELECT COUNT(*) FROM pg_trigger
     WHERE tgrelid = 'pagamentos'::regclass
     AND tgname LIKE '%atualizar_valores%'
     AND tgenabled = 'O') as triggers_ativos,
    (SELECT COUNT(*) FROM vendas
     WHERE created_at > NOW() - INTERVAL '30 days'
     AND status = 'concluido'
     AND enviado_skywalker = true) as vendas_skywalker
  FROM os
  WHERE created_at > NOW() - INTERVAL '30 days'
)
SELECT
  CASE
    WHEN triggers_ativos = 3 THEN '✅'
    ELSE '❌'
  END || ' Triggers: ' || triggers_ativos || '/3' as "Status Triggers",

  CASE
    WHEN ROUND(100.0 * os_ok / NULLIF(total_os, 0), 0) >= 95 THEN '✅'
    WHEN ROUND(100.0 * os_ok / NULLIF(total_os, 0), 0) >= 80 THEN '⚠️'
    ELSE '❌'
  END || ' Consistência: ' || ROUND(100.0 * os_ok / NULLIF(total_os, 0), 1) || '%' as "Status Valores",

  CASE
    WHEN pagamento_sem_orcamento = 0 THEN '✅'
    WHEN pagamento_sem_orcamento <= 5 THEN '⚠️'
    ELSE '❌'
  END || ' OSs Órfãs: ' || pagamento_sem_orcamento as "Status Órfãs",

  CASE
    WHEN vendas_skywalker > 0 THEN '✅'
    ELSE '⚠️'
  END || ' Skywalker: ' || vendas_skywalker || ' vendas sincronizadas' as "Status Skywalker"
FROM stats;

\echo ''
\echo '========================================='
\echo '   VALIDAÇÃO CONCLUÍDA'
\echo '========================================='
\echo ''
\echo 'Interpretação dos resultados:'
\echo '  ✅ = Funcionando perfeitamente'
\echo '  ⚠️  = Atenção necessária'
\echo '  ❌ = Problema crítico'
\echo ''
\echo 'Se encontrou problemas, execute:'
\echo '  SELECT * FROM corrigir_todas_os_inconsistentes();'
\echo ''
\echo 'Para mais detalhes, consulte:'
\echo '  - RESUMO_VALIDACAO_PAGAMENTOS.md'
\echo '  - DIAGNOSTICO_PAGAMENTOS_OS.md'
\echo '  - INSTRUCOES_VALIDACAO_PAGAMENTOS.md'
\echo ''
