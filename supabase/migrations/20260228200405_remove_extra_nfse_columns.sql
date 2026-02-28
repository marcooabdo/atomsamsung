/*
  # Remover colunas extras adicionadas por engano

  Remove as colunas que foram adicionadas nas tabelas nf_configuracoes e nf_emitidas
  que não eram necessárias.
*/

ALTER TABLE nf_configuracoes
  DROP COLUMN IF EXISTS nfse_codigo_tributacao_municipal,
  DROP COLUMN IF EXISTS nfse_tipo_retencao_issqn,
  DROP COLUMN IF EXISTS nfse_codigo_local_incidencia,
  DROP COLUMN IF EXISTS nfse_codigo_local_prestacao,
  DROP COLUMN IF EXISTS nfse_cnae,
  DROP COLUMN IF EXISTS nfse_ambiente;

ALTER TABLE nf_emitidas
  DROP COLUMN IF EXISTS nfse_dps_id,
  DROP COLUMN IF EXISTS nfse_numero_dps,
  DROP COLUMN IF EXISTS nfse_ambiente,
  DROP COLUMN IF EXISTS nfse_data_competencia,
  DROP COLUMN IF EXISTS nfse_codigo_verificacao,
  DROP COLUMN IF EXISTS nfse_link_pdf;
