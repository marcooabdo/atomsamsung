/*
  # Add chave_acesso and pdf_url to estoque_nfs table

  1. Changes
    - Add `chave_acesso` column to store NF-e access key (44 digits)
    - Add `pdf_url` column to store downloaded DANFE PDF URL
    - Add `pdf_downloaded_at` timestamp for tracking when PDF was downloaded
    - Create index on chave_acesso for faster lookups
  
  2. Notes
    - chave_acesso is nullable for backwards compatibility with existing records
    - pdf_url will be populated when user downloads the DANFE
*/

-- Add new columns to estoque_nfs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_nfs' AND column_name = 'chave_acesso'
  ) THEN
    ALTER TABLE estoque_nfs ADD COLUMN chave_acesso text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_nfs' AND column_name = 'pdf_url'
  ) THEN
    ALTER TABLE estoque_nfs ADD COLUMN pdf_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_nfs' AND column_name = 'pdf_downloaded_at'
  ) THEN
    ALTER TABLE estoque_nfs ADD COLUMN pdf_downloaded_at timestamptz;
  END IF;
END $$;

-- Create index for faster lookups by chave_acesso
CREATE INDEX IF NOT EXISTS idx_estoque_nfs_chave_acesso ON estoque_nfs(chave_acesso);

-- Add comment for documentation
COMMENT ON COLUMN estoque_nfs.chave_acesso IS 'NF-e access key (44 digits) for DANFE consultation';
COMMENT ON COLUMN estoque_nfs.pdf_url IS 'URL of downloaded DANFE PDF';
COMMENT ON COLUMN estoque_nfs.pdf_downloaded_at IS 'Timestamp when DANFE PDF was downloaded';
