/*
  # Add individual tax detail columns to estoque_pecas

  1. New Columns on `estoque_pecas`
    - `valor_unitario_sem_imposto` (decimal 12,4) - Raw unit value from XML (vUnCom)
    - `icms_valor` (decimal 10,2) - ICMS tax value for the item
    - `icms_aliquota` (decimal 6,2) - ICMS tax rate (%)
    - `icms_st_valor` (decimal 10,2) - ICMS ST (Substituição Tributária) value
    - `icms_st_aliquota` (decimal 6,2) - ICMS ST rate (%)
    - `ipi_valor` (decimal 10,2) - IPI tax value
    - `ipi_aliquota` (decimal 6,2) - IPI tax rate (%)
    - `pis_valor` (decimal 10,2) - PIS tax value
    - `pis_aliquota` (decimal 6,4) - PIS tax rate (%)
    - `cofins_valor` (decimal 10,2) - COFINS tax value
    - `cofins_aliquota` (decimal 6,4) - COFINS tax rate (%)

  2. Notes
    - All columns are nullable (NULL means the tax info was not available at import time)
    - These are informational/display-only columns extracted from the NF XML
    - The valor_com_impostos column remains the authoritative cost value
    - Rates stored as percentages (e.g., 18.00 = 18%)
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estoque_pecas' AND column_name = 'valor_unitario_sem_imposto') THEN
    ALTER TABLE estoque_pecas ADD COLUMN valor_unitario_sem_imposto decimal(12,4);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estoque_pecas' AND column_name = 'icms_valor') THEN
    ALTER TABLE estoque_pecas ADD COLUMN icms_valor decimal(10,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estoque_pecas' AND column_name = 'icms_aliquota') THEN
    ALTER TABLE estoque_pecas ADD COLUMN icms_aliquota decimal(6,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estoque_pecas' AND column_name = 'icms_st_valor') THEN
    ALTER TABLE estoque_pecas ADD COLUMN icms_st_valor decimal(10,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estoque_pecas' AND column_name = 'icms_st_aliquota') THEN
    ALTER TABLE estoque_pecas ADD COLUMN icms_st_aliquota decimal(6,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estoque_pecas' AND column_name = 'ipi_valor') THEN
    ALTER TABLE estoque_pecas ADD COLUMN ipi_valor decimal(10,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estoque_pecas' AND column_name = 'ipi_aliquota') THEN
    ALTER TABLE estoque_pecas ADD COLUMN ipi_aliquota decimal(6,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estoque_pecas' AND column_name = 'pis_valor') THEN
    ALTER TABLE estoque_pecas ADD COLUMN pis_valor decimal(10,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estoque_pecas' AND column_name = 'pis_aliquota') THEN
    ALTER TABLE estoque_pecas ADD COLUMN pis_aliquota decimal(6,4);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estoque_pecas' AND column_name = 'cofins_valor') THEN
    ALTER TABLE estoque_pecas ADD COLUMN cofins_valor decimal(10,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estoque_pecas' AND column_name = 'cofins_aliquota') THEN
    ALTER TABLE estoque_pecas ADD COLUMN cofins_aliquota decimal(6,4);
  END IF;
END $$;