/*
  # Adicionar campos da Nuvem Fiscal na tabela nf_emitidas

  1. Novos Campos
    - `nuvem_fiscal_id` (text) - ID externo retornado pela Nuvem Fiscal
    - `pdf_url` (text) - URL do PDF da NFS-e gerada
    - `xml_url` (text) - URL do XML da NFS-e gerada
  
  2. Objetivo
    - Armazenar referências externas para consulta posterior
    - Permitir reprocessamento sem perder dados
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_emitidas' AND column_name = 'nuvem_fiscal_id'
  ) THEN
    ALTER TABLE nf_emitidas ADD COLUMN nuvem_fiscal_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_emitidas' AND column_name = 'pdf_url'
  ) THEN
    ALTER TABLE nf_emitidas ADD COLUMN pdf_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_emitidas' AND column_name = 'xml_url'
  ) THEN
    ALTER TABLE nf_emitidas ADD COLUMN xml_url text;
  END IF;
END $$;

COMMENT ON COLUMN nf_emitidas.nuvem_fiscal_id IS 'ID externo da NFS-e na Nuvem Fiscal';
COMMENT ON COLUMN nf_emitidas.pdf_url IS 'URL do PDF da NFS-e';
COMMENT ON COLUMN nf_emitidas.xml_url IS 'URL do XML da NFS-e';
