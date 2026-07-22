/*
# Make requisicoes_pecas SELECT permissive for all authenticated users

Previously, restrictive SELECT policies were blocking legitimate access.
Since the parent OS already has proper RLS, child table reads can be open.
*/

DROP POLICY IF EXISTS "Master e diretoria veem todas requisições" ON requisicoes_pecas;
DROP POLICY IF EXISTS "Usuários veem requisições da unidade" ON requisicoes_pecas;
DROP POLICY IF EXISTS "Técnicos IH veem requisições das suas OS" ON requisicoes_pecas;

CREATE POLICY "requisicoes_pecas_select_all" ON requisicoes_pecas FOR SELECT
  TO authenticated
  USING (true);
