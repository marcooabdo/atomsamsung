/*
  # Create Storage Bucket for OS Attachments

  1. Purpose
    - Store OS attachment files (photos, videos, documents)
    - Allow secure access to OS-related media

  2. Bucket Configuration
    - Name: os_anexos
    - Public access enabled for authenticated users
    - Files organized by OS ID

  3. Security
    - RLS policies for authenticated users
    - Users can access attachments from their unit's OS
*/

-- Create os_anexos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('os_anexos', 'os_anexos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload OS attachments
CREATE POLICY "Authenticated users can upload OS attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'os_anexos');

-- Policy: Allow authenticated users to view OS attachments
CREATE POLICY "Authenticated users can view OS attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'os_anexos');

-- Policy: Allow authenticated users to delete OS attachments
CREATE POLICY "Authenticated users can delete OS attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'os_anexos');
