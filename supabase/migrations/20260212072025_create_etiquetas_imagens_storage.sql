/*
  # Create Etiquetas Imagens Storage Bucket

  1. Storage Setup
    - Create public bucket `etiquetas-imagens` for label images
    - Set file size limit to 5MB

  2. Security Policies
    - Allow authenticated users to upload images to their unit folder
    - Allow public read access to all images
    - Allow users to delete their own unit's images
*/

-- Create storage bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'etiquetas-imagens',
  'etiquetas-imagens',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their unit images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their unit images" ON storage.objects;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'etiquetas-imagens'
);

-- Allow public read access to all images
CREATE POLICY "Public read access to images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'etiquetas-imagens');

-- Allow authenticated users to update their unit's images
CREATE POLICY "Users can update their unit images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'etiquetas-imagens')
WITH CHECK (bucket_id = 'etiquetas-imagens');

-- Allow authenticated users to delete their unit's images
CREATE POLICY "Users can delete their unit images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'etiquetas-imagens');
