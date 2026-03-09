/*
  # Fix pipeline_colunas id to auto-generate

  1. Modified Tables
    - `atom_connect_pipeline_colunas`
      - Change `id` column default to auto-generate UUIDs

  2. Notes
    - The id column was text with no default, causing insert failures
    - Adding gen_random_uuid()::text as default so new rows auto-generate an id
*/

ALTER TABLE atom_connect_pipeline_colunas ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;