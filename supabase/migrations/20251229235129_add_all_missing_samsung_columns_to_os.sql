/*
  # Add all missing Samsung columns to OS table

  1. Changes
    - Add `status_samsung_desc` (text) - Status description from Samsung
    - Add `status_samsung_reason` (text) - Status reason from Samsung
    - Add `data_requisicao_samsung` (text) - Customer request date from Samsung
*/

ALTER TABLE os ADD COLUMN IF NOT EXISTS status_samsung_desc text;
ALTER TABLE os ADD COLUMN IF NOT EXISTS status_samsung_reason text;
ALTER TABLE os ADD COLUMN IF NOT EXISTS data_requisicao_samsung text;