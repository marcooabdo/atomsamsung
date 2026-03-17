/*
  # Drop duplicate indexes

  This migration removes duplicate indexes where two non-unique indexes exist
  on the same column(s) of the same table. Only the duplicate is dropped, the
  original is preserved.

  1. Duplicate indexes removed:
    - `idx_pecas_bin` on estoque_pecas(bin_id) - duplicate of idx_estoque_pecas_bin
    - `idx_markup_regras_unidade_id` on markup_regras(unidade_id) - duplicate of idx_markup_regras_unidade
    - `idx_os_anexos_cotacao_id` on os_anexos(cotacao_id) - duplicate of idx_os_anexos_cotacao
    - `idx_requisicoes_pecas_cotacao` on requisicoes_pecas(cotacao_id) - duplicate of idx_requisicoes_pecas_cotacao_id
    - `idx_servicos_unidade_id` on servicos(unidade_id) - duplicate of idx_servicos_unidade
    - `idx_taxas_maquina_unidade_id` on taxas_maquina(unidade_id) - duplicate of idx_taxas_maquina_unidade

  2. Impact:
    - Reduces storage overhead from maintaining duplicate index structures
    - Reduces write overhead (fewer indexes to update on INSERT/UPDATE/DELETE)
    - No query performance impact since identical index remains
*/

DROP INDEX IF EXISTS idx_pecas_bin;
DROP INDEX IF EXISTS idx_markup_regras_unidade_id;
DROP INDEX IF EXISTS idx_os_anexos_cotacao_id;
DROP INDEX IF EXISTS idx_requisicoes_pecas_cotacao;
DROP INDEX IF EXISTS idx_servicos_unidade_id;
DROP INDEX IF EXISTS idx_taxas_maquina_unidade_id;
