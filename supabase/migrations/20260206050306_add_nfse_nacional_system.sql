/*
  # NFS-e Nacional Integration System

  1. Changes to `nf_configuracoes`
    - `provedor` (text) - 'nacional' or 'municipal' to distinguish NFS-e type
    - `nfse_tipo_ambiente` (integer) - 1=producao, 2=homologacao
    - `nfse_codigo_tributacao_nacional` (text) - cTribNac code (e.g., '140101')
    - `nfse_codigo_nbs` (text) - NBS code (e.g., '120018100')
    - `nfse_codigo_municipio_prestacao` (text) - cLocPrestacao (e.g., '3170206')
    - `nfse_descricao_servico` (text) - xDescServ description
    - `nfse_trib_issqn` (integer) - tribISSQN code (1=exigivel, 2=nao incidencia, etc.)
    - `nfse_codigo_municipio_ibge` (text) - cMun IBGE code for tomador

  2. Changes to `nf_emitidas`
    - `provedor` (text) - 'nacional' or 'municipal'
    - `payload_json` (jsonb) - full payload sent to API
    - `pagamento_id` (uuid) - link to specific payment record
    - `tentativas` (integer) - number of emission attempts
    - `tomador_email` (text) - email for the client
    - `tomador_telefone` (text) - phone for the client
    - `tomador_bairro` (text) - neighborhood
    - `tomador_cidade_ibge` (text) - IBGE city code
    - `tomador_cep` (text) - postal code
    - `tomador_logradouro` (text) - street
    - `tomador_numero` (text) - number

  3. Security
    - All new columns use safe defaults
    - No destructive changes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_configuracoes' AND column_name = 'provedor'
  ) THEN
    ALTER TABLE nf_configuracoes ADD COLUMN provedor text DEFAULT 'nacional';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_configuracoes' AND column_name = 'nfse_tipo_ambiente'
  ) THEN
    ALTER TABLE nf_configuracoes ADD COLUMN nfse_tipo_ambiente integer DEFAULT 2;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_configuracoes' AND column_name = 'nfse_codigo_tributacao_nacional'
  ) THEN
    ALTER TABLE nf_configuracoes ADD COLUMN nfse_codigo_tributacao_nacional text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_configuracoes' AND column_name = 'nfse_codigo_nbs'
  ) THEN
    ALTER TABLE nf_configuracoes ADD COLUMN nfse_codigo_nbs text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_configuracoes' AND column_name = 'nfse_codigo_municipio_prestacao'
  ) THEN
    ALTER TABLE nf_configuracoes ADD COLUMN nfse_codigo_municipio_prestacao text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_configuracoes' AND column_name = 'nfse_descricao_servico'
  ) THEN
    ALTER TABLE nf_configuracoes ADD COLUMN nfse_descricao_servico text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_configuracoes' AND column_name = 'nfse_trib_issqn'
  ) THEN
    ALTER TABLE nf_configuracoes ADD COLUMN nfse_trib_issqn integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_configuracoes' AND column_name = 'nfse_codigo_municipio_ibge'
  ) THEN
    ALTER TABLE nf_configuracoes ADD COLUMN nfse_codigo_municipio_ibge text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_emitidas' AND column_name = 'provedor'
  ) THEN
    ALTER TABLE nf_emitidas ADD COLUMN provedor text DEFAULT 'nacional';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_emitidas' AND column_name = 'payload_json'
  ) THEN
    ALTER TABLE nf_emitidas ADD COLUMN payload_json jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_emitidas' AND column_name = 'pagamento_id'
  ) THEN
    ALTER TABLE nf_emitidas ADD COLUMN pagamento_id uuid REFERENCES pagamentos(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_emitidas' AND column_name = 'tentativas'
  ) THEN
    ALTER TABLE nf_emitidas ADD COLUMN tentativas integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_emitidas' AND column_name = 'tomador_email'
  ) THEN
    ALTER TABLE nf_emitidas ADD COLUMN tomador_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_emitidas' AND column_name = 'tomador_telefone'
  ) THEN
    ALTER TABLE nf_emitidas ADD COLUMN tomador_telefone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_emitidas' AND column_name = 'tomador_bairro'
  ) THEN
    ALTER TABLE nf_emitidas ADD COLUMN tomador_bairro text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_emitidas' AND column_name = 'tomador_cidade_ibge'
  ) THEN
    ALTER TABLE nf_emitidas ADD COLUMN tomador_cidade_ibge text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_emitidas' AND column_name = 'tomador_cep'
  ) THEN
    ALTER TABLE nf_emitidas ADD COLUMN tomador_cep text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_emitidas' AND column_name = 'tomador_logradouro'
  ) THEN
    ALTER TABLE nf_emitidas ADD COLUMN tomador_logradouro text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_emitidas' AND column_name = 'tomador_numero'
  ) THEN
    ALTER TABLE nf_emitidas ADD COLUMN tomador_numero text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_nf_emitidas_pagamento ON nf_emitidas(pagamento_id);
CREATE INDEX IF NOT EXISTS idx_nf_emitidas_provedor ON nf_emitidas(provedor);
CREATE INDEX IF NOT EXISTS idx_nf_configuracoes_provedor ON nf_configuracoes(provedor);