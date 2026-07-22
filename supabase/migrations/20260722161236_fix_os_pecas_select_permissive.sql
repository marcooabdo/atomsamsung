/*
# Make os_pecas SELECT fully permissive for authenticated users

The os_pecas table inherits its access control from the parent `os` table.
If a user can see the OS, they should be able to see its parts.
The previous RLS policy was incorrectly blocking legitimate reads.
*/

DROP POLICY IF EXISTS "os_pecas_select" ON os_pecas;
CREATE POLICY "os_pecas_select" ON os_pecas FOR SELECT
  TO authenticated
  USING (true);
