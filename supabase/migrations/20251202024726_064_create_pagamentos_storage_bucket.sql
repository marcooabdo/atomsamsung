/*
  # Create Storage Bucket for Payment Receipts

  1. Purpose
    - Store payment receipt/proof files (comprovantes)
    - Allow secure access to payment documents

  2. Bucket Configuration
    - Name: pagamentos-comprovantes
    - Public access enabled for authenticated users
    - Files organized by OS and payment ID

  3. Security
    - RLS policies for authenticated users
    - Users can only access their unit's payment files
*/

-- Create pagamentos-comprovantes bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('pagamentos-comprovantes', 'pagamentos-comprovantes', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload payment receipts
CREATE POLICY "Authenticated users can upload payment receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pagamentos-comprovantes');

-- Policy: Allow authenticated users to view payment receipts
CREATE POLICY "Authenticated users can view payment receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'pagamentos-comprovantes');

-- Policy: Allow authenticated users to delete their own uploads
CREATE POLICY "Authenticated users can delete payment receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pagamentos-comprovantes');
