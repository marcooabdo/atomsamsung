/*
  # Add GSPN sync fields to os_anexos

  1. New Columns
    - `origem` (text) - Source of the attachment (manual, gspn_sync)
    - `gspn_fileobjkey` (text) - Unique key from GSPN system
    - `gspn_description` (text) - Description from GSPN
    - `gspn_created_at` (timestamptz) - Original creation date from GSPN
    - `gspn_created_by` (text) - Creator info from GSPN

  2. Index
    - Create unique index on gspn_fileobjkey for deduplication
*/

ALTER TABLE os_anexos ADD COLUMN IF NOT EXISTS origem text DEFAULT 'manual';
ALTER TABLE os_anexos ADD COLUMN IF NOT EXISTS gspn_fileobjkey text;
ALTER TABLE os_anexos ADD COLUMN IF NOT EXISTS gspn_description text;
ALTER TABLE os_anexos ADD COLUMN IF NOT EXISTS gspn_created_at timestamptz;
ALTER TABLE os_anexos ADD COLUMN IF NOT EXISTS gspn_created_by text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_os_anexos_gspn_fileobjkey 
ON os_anexos (gspn_fileobjkey) 
WHERE gspn_fileobjkey IS NOT NULL;