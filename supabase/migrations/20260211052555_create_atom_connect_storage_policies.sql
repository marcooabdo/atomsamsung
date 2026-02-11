/*
  # ATOM CONNECT - Storage Policies

  Políticas para o bucket atom-connect-media
*/

-- Policies para o bucket (removendo duplicadas primeiro)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Anyone can view atom connect media" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload atom connect media" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update atom connect media" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can delete atom connect media" ON storage.objects;
END $$;

CREATE POLICY "Anyone can view atom connect media" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'atom-connect-media');

CREATE POLICY "Authenticated users can upload atom connect media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'atom-connect-media');

CREATE POLICY "Authenticated users can update atom connect media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'atom-connect-media');

CREATE POLICY "Authenticated users can delete atom connect media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'atom-connect-media');
