/*
  # Create Missing Storage Buckets

  1. Problem
    - cotacoes-anexos: Policies exist (migration 026) but bucket was never created
    - os-anexos: Code uses 'os-anexos' but only 'os_anexos' exists

  2. Solution
    - Create cotacoes-anexos bucket
    - Create os-anexos bucket (in addition to os_anexos)
    - Enable public access for authenticated users

  3. Security
    - RLS policies already exist for both buckets
    - Users can upload/view/delete attachments
*/

-- Create cotacoes-anexos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('cotacoes-anexos', 'cotacoes-anexos', true)
ON CONFLICT (id) DO NOTHING;

-- Create os-anexos bucket (with hyphen) if it doesn't exist
-- This is separate from os_anexos (with underscore) that already exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('os-anexos', 'os-anexos', true)
ON CONFLICT (id) DO NOTHING;

-- Note: Policies already exist from previous migrations:
-- - cotacoes-anexos policies: migration 026
-- - os_anexos policies: migration 134 (create_os_anexos_storage_bucket.sql)