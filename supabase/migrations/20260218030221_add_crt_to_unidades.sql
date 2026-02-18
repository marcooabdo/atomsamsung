/*
  # Add crt (Código de Regime Tributário) to unidades

  Adds the CRT field required by SEFAZ for NF-e/NFS-e emission:
  - 1: Simples Nacional
  - 2: Simples Nacional, excesso sublimite de receita bruta
  - 3: Regime Normal (Lucro Presumido ou Real)
  - 4: MEI (Microempreendedor Individual)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unidades' AND column_name = 'crt'
  ) THEN
    ALTER TABLE unidades ADD COLUMN crt integer;
  END IF;
END $$;
