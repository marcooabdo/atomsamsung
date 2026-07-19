/*
# Add pendente_entrada and origem columns to estoque_nfs

1. Modified Tables
   - `estoque_nfs`
     - `origem` (text) - Origin of the NF: 'xml_manual', 'chave_acesso', 'distribuicao_automatica'
     - `pendente_entrada` (boolean, default false) - Whether NF is pending processing/entry
     - `nsu` (text) - NSU from Nuvem Fiscal distribution for deduplication
     - `manifestada` (boolean, default false) - Whether the NF was manifested

2. Important Notes
   - Existing NFs retain their current state (pendente_entrada = false means already processed)
   - origem defaults to 'xml_manual' for existing records
   - Index on pendente_entrada for fast filtering of pending NFs
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estoque_nfs' AND column_name = 'origem') THEN
    ALTER TABLE estoque_nfs ADD COLUMN origem text DEFAULT 'xml_manual';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estoque_nfs' AND column_name = 'pendente_entrada') THEN
    ALTER TABLE estoque_nfs ADD COLUMN pendente_entrada boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estoque_nfs' AND column_name = 'nsu') THEN
    ALTER TABLE estoque_nfs ADD COLUMN nsu text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estoque_nfs' AND column_name = 'manifestada') THEN
    ALTER TABLE estoque_nfs ADD COLUMN manifestada boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_estoque_nfs_pendente_entrada ON estoque_nfs(pendente_entrada) WHERE pendente_entrada = true;
CREATE INDEX IF NOT EXISTS idx_estoque_nfs_origem ON estoque_nfs(origem);
