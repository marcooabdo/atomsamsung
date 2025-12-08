/*
  # Hierarchical Permission System

  ## User Types and Permissions

  ### Hierarchy (from highest to lowest):
  1. **Master** - Full access to all units and all users
  2. **Diretoria** - Access to all units and all users except Master
  3. **Gerente** - Access to own unit, all users in own unit
  4. **Administrador** - Access to own unit, users except Gerente in own unit
  5. **Estoque** - Access to own unit data, only own user info
  6. **Técnico** - Access to own unit data, only own user info
  7. **Técnico IH** - Access to own unit data, only own user info
  8. **Vendedor** - Access to own unit data, only own user info
  9. **Atendente** - Access to own unit data, only own user info

  ## Changes Made
  
  1. Update user types in usuarios table
  2. Create helper function to check user hierarchy
  3. Create RLS policies for usuarios table
  4. Create RLS policies for OS and related tables
  5. Create RLS policies for cotacoes
  6. Create RLS policies for estoque
  7. Create RLS policies for financeiro
*/

-- Update user type constraint to include all new types
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_tipo_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_tipo_check 
CHECK (tipo IN ('master', 'diretoria', 'gerente', 'administrador', 'estoque', 'tecnico', 'tecnico_ih', 'vendedor', 'atendente'));

-- Create function to get user hierarchy level
CREATE OR REPLACE FUNCTION get_user_hierarchy_level(user_type text)
RETURNS integer AS $$
BEGIN
  RETURN CASE user_type
    WHEN 'master' THEN 100
    WHEN 'diretoria' THEN 90
    WHEN 'gerente' THEN 80
    WHEN 'administrador' THEN 70
    WHEN 'estoque' THEN 50
    WHEN 'tecnico' THEN 40
    WHEN 'tecnico_ih' THEN 40
    WHEN 'vendedor' THEN 40
    WHEN 'atendente' THEN 40
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user can view another user
CREATE OR REPLACE FUNCTION can_view_user(viewer_id uuid, target_user_id uuid)
RETURNS boolean AS $$
DECLARE
  viewer_type text;
  viewer_unidade uuid;
  viewer_level integer;
  target_type text;
  target_unidade uuid;
  target_level integer;
BEGIN
  -- Get viewer info
  SELECT tipo, unidade_id INTO viewer_type, viewer_unidade
  FROM usuarios WHERE id = viewer_id;
  
  -- Get target info
  SELECT tipo, unidade_id INTO target_type, target_unidade
  FROM usuarios WHERE id = target_user_id;
  
  viewer_level := get_user_hierarchy_level(viewer_type);
  target_level := get_user_hierarchy_level(target_type);
  
  -- Master sees everyone
  IF viewer_type = 'master' THEN
    RETURN true;
  END IF;
  
  -- Diretoria sees everyone except master
  IF viewer_type = 'diretoria' THEN
    RETURN target_type != 'master';
  END IF;
  
  -- Gerente sees all users in their unit
  IF viewer_type = 'gerente' THEN
    RETURN viewer_unidade = target_unidade;
  END IF;
  
  -- Administrador sees users in their unit except gerente
  IF viewer_type = 'administrador' THEN
    RETURN viewer_unidade = target_unidade AND target_type NOT IN ('gerente', 'diretoria', 'master');
  END IF;
  
  -- Others only see themselves
  RETURN viewer_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies on usuarios
DROP POLICY IF EXISTS "Users can read own data" ON usuarios;
DROP POLICY IF EXISTS "Users can view users" ON usuarios;
DROP POLICY IF EXISTS "Users can insert users" ON usuarios;
DROP POLICY IF EXISTS "Users can update users" ON usuarios;
DROP POLICY IF EXISTS "Users can delete users" ON usuarios;

-- Create new RLS policies for usuarios table
CREATE POLICY "Users can view based on hierarchy"
  ON usuarios FOR SELECT
  TO authenticated
  USING (can_view_user(auth.uid(), id));

CREATE POLICY "Master and Diretoria can insert users"
  ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
  );

CREATE POLICY "Users can update based on hierarchy"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR (u.tipo = 'gerente' AND u.unidade_id = usuarios.unidade_id)
      )
    )
  );

CREATE POLICY "Only Master can delete users"
  ON usuarios FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo = 'master'
    )
  );

-- Create policies for unidades table
DROP POLICY IF EXISTS "Users can view unidades" ON unidades;
DROP POLICY IF EXISTS "Users can insert unidades" ON unidades;
DROP POLICY IF EXISTS "Users can update unidades" ON unidades;
DROP POLICY IF EXISTS "Users can delete unidades" ON unidades;

CREATE POLICY "Users can view unidades based on role"
  ON unidades FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = unidades.id
      )
    )
  );

CREATE POLICY "Master and Diretoria can manage unidades"
  ON unidades FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
  );

-- Create policies for OS table
DROP POLICY IF EXISTS "Users can view OS" ON os;
DROP POLICY IF EXISTS "Users can insert OS" ON os;
DROP POLICY IF EXISTS "Users can update OS" ON os;

CREATE POLICY "Users can view OS based on unit"
  ON os FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = os.unidade_id
      )
    )
  );

CREATE POLICY "Users can insert OS in their unit"
  ON os FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = os.unidade_id
      )
    )
  );

CREATE POLICY "Users can update OS in their unit"
  ON os FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = os.unidade_id
      )
    )
  );

-- Create policies for cotacoes table
DROP POLICY IF EXISTS "Users can view cotacoes" ON cotacoes;
DROP POLICY IF EXISTS "Users can insert cotacoes" ON cotacoes;
DROP POLICY IF EXISTS "Users can update cotacoes" ON cotacoes;

CREATE POLICY "Users can view cotacoes based on unit"
  ON cotacoes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = cotacoes.unidade_id
      )
    )
  );

CREATE POLICY "Users can insert cotacoes in their unit"
  ON cotacoes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = cotacoes.unidade_id
      )
    )
  );

CREATE POLICY "Users can update cotacoes in their unit"
  ON cotacoes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = cotacoes.unidade_id
      )
    )
  );

-- Create policies for estoque_pecas table
DROP POLICY IF EXISTS "Users can view estoque" ON estoque_pecas;
DROP POLICY IF EXISTS "Users can insert estoque" ON estoque_pecas;
DROP POLICY IF EXISTS "Users can update estoque" ON estoque_pecas;

CREATE POLICY "Users can view estoque based on unit"
  ON estoque_pecas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = estoque_pecas.unidade_id
      )
    )
  );

CREATE POLICY "Estoque users can manage estoque in their unit"
  ON estoque_pecas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria', 'gerente', 'administrador', 'estoque')
        AND (u.tipo IN ('master', 'diretoria') OR u.unidade_id = estoque_pecas.unidade_id)
      )
    )
  );

-- Create policies for financeiro_lancamentos table
DROP POLICY IF EXISTS "Users can view financeiro" ON financeiro_lancamentos;
DROP POLICY IF EXISTS "Users can insert financeiro" ON financeiro_lancamentos;
DROP POLICY IF EXISTS "Users can update financeiro" ON financeiro_lancamentos;

CREATE POLICY "Users can view financeiro based on unit and role"
  ON financeiro_lancamentos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR (u.tipo IN ('gerente', 'administrador') AND u.unidade_id = financeiro_lancamentos.unidade_id)
      )
    )
  );

CREATE POLICY "Authorized users can manage financeiro in their unit"
  ON financeiro_lancamentos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR (u.tipo IN ('gerente', 'administrador') AND u.unidade_id = financeiro_lancamentos.unidade_id)
      )
    )
  );

-- Create policies for configuration tables (servicos, markup_regras, taxas_maquina, formas_pagamento)
-- These should be viewable by all but only manageable by master/diretoria

DROP POLICY IF EXISTS "Users can view servicos" ON servicos;
DROP POLICY IF EXISTS "Users can manage servicos" ON servicos;

CREATE POLICY "All users can view servicos"
  ON servicos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Master and Diretoria can manage servicos"
  ON servicos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
  );

DROP POLICY IF EXISTS "Users can view markup rules" ON markup_regras;
DROP POLICY IF EXISTS "Users can insert markup rules" ON markup_regras;
DROP POLICY IF EXISTS "Users can update markup rules" ON markup_regras;
DROP POLICY IF EXISTS "Users can delete markup rules" ON markup_regras;

CREATE POLICY "All users can view markup rules"
  ON markup_regras FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Master and Diretoria can manage markup rules"
  ON markup_regras FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
  );

DROP POLICY IF EXISTS "Users can view taxas" ON taxas_maquina;
DROP POLICY IF EXISTS "Users can manage taxas" ON taxas_maquina;

CREATE POLICY "All users can view taxas"
  ON taxas_maquina FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Master and Diretoria can manage taxas"
  ON taxas_maquina FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
  );

DROP POLICY IF EXISTS "Users can view formas_pagamento" ON formas_pagamento;
DROP POLICY IF EXISTS "Users can manage formas_pagamento" ON formas_pagamento;

CREATE POLICY "All users can view formas_pagamento"
  ON formas_pagamento FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Master and Diretoria can manage formas_pagamento"
  ON formas_pagamento FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria')
    )
  );
