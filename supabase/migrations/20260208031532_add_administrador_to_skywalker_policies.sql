/*
  # Adicionar Administrador às Policies do Skywalker
  
  1. Atualização
    - Adiciona tipo 'administrador' em todas as policies de RLS do sistema Skywalker
    - Permite que administradores tenham os mesmos acessos que gerentes
    
  2. Tabelas Afetadas
    - skywalker_profissionais
    - skywalker_niveis
    - skywalker_pilares
    - skywalker_regras_estrelas
    - skywalker_google_reviews
    - skywalker_vendas_store
    - skywalker_vendas_care
    - skywalker_instalacoes
    - skywalker_conversoes
    - skywalker_participacao
    - skywalker_lp_unidade
    - skywalker_estrelas_mes
    - skywalker_bonus_config
    - skywalker_times
    - skywalker_regras_promocao
    - skywalker_bonificacoes
*/

-- ====================
-- SKYWALKER_PROFISSIONAIS
-- ====================

DROP POLICY IF EXISTS "Apenas diretoria gerencia profissionais" ON skywalker_profissionais;

CREATE POLICY "Apenas diretoria gerencia profissionais"
  ON skywalker_profissionais FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

-- ====================
-- SKYWALKER_NIVEIS
-- ====================

DROP POLICY IF EXISTS "Apenas master pode gerenciar níveis" ON skywalker_niveis;

CREATE POLICY "Apenas master pode gerenciar níveis"
  ON skywalker_niveis FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

-- ====================
-- SKYWALKER_PILARES
-- ====================

DROP POLICY IF EXISTS "Apenas master gerencia pilares" ON skywalker_pilares;

CREATE POLICY "Apenas master gerencia pilares"
  ON skywalker_pilares FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

-- ====================
-- SKYWALKER_REGRAS_ESTRELAS
-- ====================

DROP POLICY IF EXISTS "Apenas master gerencia regras" ON skywalker_regras_estrelas;

CREATE POLICY "Apenas master gerencia regras"
  ON skywalker_regras_estrelas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

-- ====================
-- SKYWALKER_GOOGLE_REVIEWS
-- ====================

DROP POLICY IF EXISTS "Diretoria gerencia reviews" ON skywalker_google_reviews;

CREATE POLICY "Diretoria gerencia reviews"
  ON skywalker_google_reviews FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

-- ====================
-- SKYWALKER_VENDAS_STORE
-- ====================

DROP POLICY IF EXISTS "Gestores lançam vendas store" ON skywalker_vendas_store;
DROP POLICY IF EXISTS "Diretoria gerencia vendas store" ON skywalker_vendas_store;

CREATE POLICY "Gestores lançam vendas store"
  ON skywalker_vendas_store FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

CREATE POLICY "Diretoria gerencia vendas store"
  ON skywalker_vendas_store FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

-- ====================
-- SKYWALKER_VENDAS_CARE
-- ====================

DROP POLICY IF EXISTS "Gestores lançam vendas care" ON skywalker_vendas_care;
DROP POLICY IF EXISTS "Diretoria gerencia vendas care" ON skywalker_vendas_care;

CREATE POLICY "Gestores lançam vendas care"
  ON skywalker_vendas_care FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

CREATE POLICY "Diretoria gerencia vendas care"
  ON skywalker_vendas_care FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

-- ====================
-- SKYWALKER_INSTALACOES
-- ====================

DROP POLICY IF EXISTS "Gestores lançam instalações" ON skywalker_instalacoes;
DROP POLICY IF EXISTS "Diretoria gerencia instalações" ON skywalker_instalacoes;

CREATE POLICY "Gestores lançam instalações"
  ON skywalker_instalacoes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

CREATE POLICY "Diretoria gerencia instalações"
  ON skywalker_instalacoes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

-- ====================
-- SKYWALKER_CONVERSOES
-- ====================

DROP POLICY IF EXISTS "Gestores lançam conversões" ON skywalker_conversoes;
DROP POLICY IF EXISTS "Diretoria gerencia conversões" ON skywalker_conversoes;

CREATE POLICY "Gestores lançam conversões"
  ON skywalker_conversoes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

CREATE POLICY "Diretoria gerencia conversões"
  ON skywalker_conversoes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

-- ====================
-- SKYWALKER_PARTICIPACAO
-- ====================

DROP POLICY IF EXISTS "Gestores lançam participação" ON skywalker_participacao;
DROP POLICY IF EXISTS "Diretoria gerencia participação" ON skywalker_participacao;

CREATE POLICY "Gestores lançam participação"
  ON skywalker_participacao FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

CREATE POLICY "Diretoria gerencia participação"
  ON skywalker_participacao FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

-- ====================
-- SKYWALKER_LP_UNIDADE
-- ====================

DROP POLICY IF EXISTS "Gestores gerenciam LP unidade" ON skywalker_lp_unidade;
DROP POLICY IF EXISTS "Diretoria gerencia LP unidade" ON skywalker_lp_unidade;

CREATE POLICY "Gestores gerenciam LP unidade"
  ON skywalker_lp_unidade FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

CREATE POLICY "Diretoria gerencia LP unidade"
  ON skywalker_lp_unidade FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

-- ====================
-- SKYWALKER_ESTRELAS_MES
-- ====================

DROP POLICY IF EXISTS "Diretoria gerencia estrelas" ON skywalker_estrelas_mes;

CREATE POLICY "Diretoria gerencia estrelas"
  ON skywalker_estrelas_mes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

-- ====================
-- SKYWALKER_BONUS_CONFIG
-- ====================

DROP POLICY IF EXISTS "Diretoria gerencia config bonus" ON skywalker_bonus_config;

CREATE POLICY "Diretoria gerencia config bonus"
  ON skywalker_bonus_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

-- ====================
-- SKYWALKER_TIMES
-- ====================

DROP POLICY IF EXISTS "skywalker_times_all" ON skywalker_times;

CREATE POLICY "skywalker_times_all"
  ON skywalker_times FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

-- ====================
-- SKYWALKER_REGRAS_PROMOCAO
-- ====================

DROP POLICY IF EXISTS "skywalker_regras_promocao_all" ON skywalker_regras_promocao;

CREATE POLICY "skywalker_regras_promocao_all"
  ON skywalker_regras_promocao FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

-- ====================
-- SKYWALKER_BONIFICACOES
-- ====================

DROP POLICY IF EXISTS "skywalker_bonificacoes_all" ON skywalker_bonificacoes;

CREATE POLICY "skywalker_bonificacoes_all"
  ON skywalker_bonificacoes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );
