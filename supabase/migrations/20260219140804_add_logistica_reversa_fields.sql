/*
  # Add Logistica Reversa Fields to estoque_pecas

  ## Summary
  Adds two new timestamp columns to track the reverse logistics workflow
  for parts being returned to Samsung.

  ## New Columns (estoque_pecas)
  - `data_coleta_transportadora` - Date/time when the carrier collected the part for return shipping to Samsung
  - `data_retorno_credito` - Date/time when Samsung confirmed credit for the returned part in GSPN

  ## Notes
  - Both columns are nullable (no date = step not yet completed)
  - Used in conjunction with status = 'devolvida_samsung' to track the full return lifecycle
  - SLA target is 10 days between coleta and retorno_credito
*/

ALTER TABLE estoque_pecas
  ADD COLUMN IF NOT EXISTS data_coleta_transportadora TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS data_retorno_credito TIMESTAMP WITH TIME ZONE;
