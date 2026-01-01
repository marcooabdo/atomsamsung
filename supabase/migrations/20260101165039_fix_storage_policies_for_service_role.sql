/*
  # Fix Storage Policies for Service Role Access (n8n)

  1. Problem
    - Current policies only allow 'authenticated' users
    - n8n using Service Role Key cannot upload files
    - Need to add permissive policies for service_role

  2. Solution
    - Add service_role policies for INSERT, SELECT, UPDATE, DELETE
    - Keep existing authenticated policies
    - Allow n8n to upload files via API

  3. Security
    - Service role bypasses RLS by default
    - Explicit policies needed for storage objects
    - Authenticated users still have their own policies
*/

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Authenticated users can upload OS attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view OS attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete OS attachments" ON storage.objects;

-- Service Role policies (for n8n and automation)
CREATE POLICY "Service role can upload OS attachments"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'os-anexos' OR bucket_id = 'os_anexos');

CREATE POLICY "Service role can view OS attachments"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'os-anexos' OR bucket_id = 'os_anexos');

CREATE POLICY "Service role can update OS attachments"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'os-anexos' OR bucket_id = 'os_anexos')
WITH CHECK (bucket_id = 'os-anexos' OR bucket_id = 'os_anexos');

CREATE POLICY "Service role can delete OS attachments"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'os-anexos' OR bucket_id = 'os_anexos');

-- Authenticated users policies (for web app)
CREATE POLICY "Authenticated users can upload OS attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'os-anexos' OR bucket_id = 'os_anexos');

CREATE POLICY "Authenticated users can view OS attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'os-anexos' OR bucket_id = 'os_anexos');

CREATE POLICY "Authenticated users can update OS attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'os-anexos' OR bucket_id = 'os_anexos')
WITH CHECK (bucket_id = 'os-anexos' OR bucket_id = 'os_anexos');

CREATE POLICY "Authenticated users can delete OS attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'os-anexos' OR bucket_id = 'os_anexos');
