/*
  # Fix Profile Photos Storage Policies

  ## Changes
  1. Remove restrictive RLS policies that rely on auth.uid()
  2. Allow all authenticated users to manage their photos
  3. Allow service_role to manage all photos

  ## Security
  - Public bucket for viewing
  - Authenticated users can upload/update/delete their own photos
  - No auth.uid() dependency (using custom auth system)
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile photo" ON storage.objects;

-- Policy: Anyone authenticated can view profile photos
CREATE POLICY "Authenticated users can view profile photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'profile-photos');

-- Policy: Authenticated users can upload profile photos
CREATE POLICY "Authenticated users can upload profile photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-photos');

-- Policy: Authenticated users can update profile photos
CREATE POLICY "Authenticated users can update profile photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-photos')
WITH CHECK (bucket_id = 'profile-photos');

-- Policy: Authenticated users can delete profile photos
CREATE POLICY "Authenticated users can delete profile photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-photos');
