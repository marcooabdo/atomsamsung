/*
  # Add tomador_uf to nf_emitidas

  Adds the UF (state code) field for the recipient (tomador) on NFS-e records,
  required by the NFS-e Nacional specification (endNac.UF field).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_emitidas' AND column_name = 'tomador_uf'
  ) THEN
    ALTER TABLE nf_emitidas ADD COLUMN tomador_uf text;
  END IF;
END $$;
