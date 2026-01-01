/*
  # Create Permissive Storage Policies for os-anexos

  1. Problem
    - n8n getting "Unauthorized" error when uploading files
    - Service role should have full access to storage
    - No policies found for os-anexos bucket

  2. Solution
    - Create VERY permissive policies for os-anexos bucket
    - Allow service_role, authenticated, and anon
    - Enable n8n to upload files via API

  3. Security
    - Bucket is already public (read access)
    - Policies control who can INSERT/UPDATE/DELETE
    - service_role has full permissions
*/

-- First, make sure the bucket exists and is properly configured
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'os-anexos') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('os-anexos', 'os-anexos', true);
  END IF;
END $$;

-- Remove any existing policies for os-anexos
DROP POLICY IF EXISTS "Anyone can view OS attachments" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload OS attachments" ON storage.objects;
DROP POLICY IF EXISTS "Service role can view OS attachments" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update OS attachments" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete OS attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload OS attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view OS attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update OS attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete OS attachments" ON storage.objects;

-- Public READ access for everyone
CREATE POLICY "Anyone can view OS attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'os-anexos');

-- Service role - Full access
CREATE POLICY "Service role full access to OS attachments"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'os-anexos')
WITH CHECK (bucket_id = 'os-anexos');

-- Authenticated users - Full access
CREATE POLICY "Authenticated full access to OS attachments"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'os-anexos')
WITH CHECK (bucket_id = 'os-anexos');

-- Anon users - Can upload (for n8n webhook scenarios)
CREATE POLICY "Anon can upload OS attachments"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'os-anexos');
