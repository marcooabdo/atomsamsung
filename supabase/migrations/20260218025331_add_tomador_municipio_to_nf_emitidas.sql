/*
  # Add tomador_municipio to nf_emitidas

  Adds the municipality name (xMun) field for the recipient on NFS-e records,
  required by the NFS-e Nacional specification (endNac.xMun field).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_emitidas' AND column_name = 'tomador_municipio'
  ) THEN
    ALTER TABLE nf_emitidas ADD COLUMN tomador_municipio text;
  END IF;
END $$;
