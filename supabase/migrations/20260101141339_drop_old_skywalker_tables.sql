/*
  # Remover tabelas antigas do Skywalker

  1. Remove todas as tabelas antigas do sistema Skywalker
  2. Remove triggers e funções relacionadas
  
  Preparação para o novo sistema completo do Skywalker
*/

-- Remover tabelas antigas
DROP TABLE IF EXISTS skywalker_comissoes CASCADE;
DROP TABLE IF EXISTS skywalker_vendas CASCADE;
DROP TABLE IF EXISTS skywalker_reviews CASCADE;
DROP TABLE IF EXISTS skywalker_handover_ow CASCADE;
DROP TABLE IF EXISTS skywalker_cultura CASCADE;
DROP TABLE IF EXISTS skywalker_provas_google CASCADE;
DROP TABLE IF EXISTS skywalker_kpis_mensais CASCADE;
DROP TABLE IF EXISTS skywalker_historico_mes CASCADE;
DROP TABLE IF EXISTS skywalker_historico CASCADE;
DROP TABLE IF EXISTS skywalker_metas_nivel CASCADE;
DROP TABLE IF EXISTS skywalker_regras CASCADE;
DROP TABLE IF EXISTS skywalker_colaboradores CASCADE;
