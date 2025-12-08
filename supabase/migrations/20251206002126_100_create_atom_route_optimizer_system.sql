/*
  # ATOM Route Optimizer System

  Sistema completo de otimização inteligente de rotas integrado com Kanban, técnicos e API de mapas.

  1. Novas Tabelas
    - `linhas_produto`: Cadastro de linhas de produto
    - `tecnicos_linhas_produto`: Relação N:N entre técnicos e linhas que atendem
    - `otimizacao_logs`: Histórico completo de otimizações realizadas
    - `otimizacao_os`: Registro de OS incluídas em cada otimização

  2. Alterações em Tabelas Existentes
    - `usuarios`: Adicionar campos de configuração de técnicos
    - `os`: Adicionar campo linha_produto_id

  3. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas adequadas por tipo de usuário
*/

-- =====================================================
-- 1. CRIAR TABELA DE LINHAS DE PRODUTO
-- =====================================================

CREATE TABLE IF NOT EXISTS linhas_produto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  tempo_medio_reparo_minutos integer NOT NULL DEFAULT 60,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linhas_produto_ativo ON linhas_produto(ativo) WHERE ativo = true;

ALTER TABLE linhas_produto ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE linhas_produto IS 'Cadastro de linhas de produto para classificação de OS';
COMMENT ON COLUMN linhas_produto.tempo_medio_reparo_minutos IS 'Tempo médio estimado de reparo em minutos';

-- =====================================================
-- 2. ADICIONAR CAMPOS AOS TÉCNICOS (USUARIOS)
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'horario_inicio') THEN
    ALTER TABLE usuarios ADD COLUMN horario_inicio time DEFAULT '08:00:00';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'horario_fim') THEN
    ALTER TABLE usuarios ADD COLUMN horario_fim time DEFAULT '18:00:00';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'tempo_almoco_minutos') THEN
    ALTER TABLE usuarios ADD COLUMN tempo_almoco_minutos integer DEFAULT 60;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'dias_permitidos_fora') THEN
    ALTER TABLE usuarios ADD COLUMN dias_permitidos_fora integer DEFAULT 0;
  END IF;
END $$;

COMMENT ON COLUMN usuarios.horario_inicio IS 'Horário de início do expediente do técnico';
COMMENT ON COLUMN usuarios.horario_fim IS 'Horário de fim do expediente do técnico';
COMMENT ON COLUMN usuarios.tempo_almoco_minutos IS 'Tempo de almoço em minutos';
COMMENT ON COLUMN usuarios.dias_permitidos_fora IS 'Quantidade de dias permitidos dormindo fora da unidade';

-- =====================================================
-- 3. CRIAR TABELA DE RELAÇÃO TÉCNICO x LINHA DE PRODUTO
-- =====================================================

CREATE TABLE IF NOT EXISTS tecnicos_linhas_produto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tecnico_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  linha_produto_id uuid NOT NULL REFERENCES linhas_produto(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tecnico_id, linha_produto_id)
);

CREATE INDEX IF NOT EXISTS idx_tecnicos_linhas_tecnico ON tecnicos_linhas_produto(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_tecnicos_linhas_linha ON tecnicos_linhas_produto(linha_produto_id);

ALTER TABLE tecnicos_linhas_produto ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE tecnicos_linhas_produto IS 'Relação N:N entre técnicos e linhas de produto que atendem';

-- =====================================================
-- 4. ADICIONAR LINHA DE PRODUTO ÀS OS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'os' AND column_name = 'linha_produto_id') THEN
    ALTER TABLE os ADD COLUMN linha_produto_id uuid REFERENCES linhas_produto(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_os_linha_produto ON os(linha_produto_id);

COMMENT ON COLUMN os.linha_produto_id IS 'Linha de produto desta OS para validação de compatibilidade com técnico';

-- =====================================================
-- 5. CRIAR TABELA DE LOGS DE OTIMIZAÇÃO
-- =====================================================

CREATE TABLE IF NOT EXISTS otimizacao_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES unidades(id),
  tecnico_id uuid NOT NULL REFERENCES usuarios(id),
  usuario_otimizador_id uuid NOT NULL REFERENCES usuarios(id),
  data_hora_otimizacao timestamptz NOT NULL DEFAULT now(),
  rotas_selecionadas text[] NOT NULL,
  total_os_incluidas integer NOT NULL DEFAULT 0,
  total_os_excluidas integer NOT NULL DEFAULT 0,
  distancia_total_km numeric(10,2),
  tempo_total_minutos integer,
  quilometragem_total_km numeric(10,2),
  horario_inicio_previsto time,
  horario_fim_previsto time,
  dias_necessarios integer,
  aplicada boolean DEFAULT false,
  data_hora_aplicacao timestamptz,
  observacoes text,
  resultado_json jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otimizacao_logs_unidade ON otimizacao_logs(unidade_id);
CREATE INDEX IF NOT EXISTS idx_otimizacao_logs_tecnico ON otimizacao_logs(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_otimizacao_logs_data ON otimizacao_logs(data_hora_otimizacao DESC);
CREATE INDEX IF NOT EXISTS idx_otimizacao_logs_aplicada ON otimizacao_logs(aplicada);

ALTER TABLE otimizacao_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE otimizacao_logs IS 'Histórico completo de otimizações de rotas realizadas no sistema';
COMMENT ON COLUMN otimizacao_logs.rotas_selecionadas IS 'Array com IDs das colunas de rota do Kanban selecionadas';
COMMENT ON COLUMN otimizacao_logs.aplicada IS 'Se a otimização foi aplicada às OS';
COMMENT ON COLUMN otimizacao_logs.resultado_json IS 'JSON completo com resultado detalhado da otimização';

-- =====================================================
-- 6. CRIAR TABELA DE OS INCLUÍDAS NA OTIMIZAÇÃO
-- =====================================================

CREATE TABLE IF NOT EXISTS otimizacao_os (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  otimizacao_id uuid NOT NULL REFERENCES otimizacao_logs(id) ON DELETE CASCADE,
  os_id uuid NOT NULL REFERENCES os(id) ON DELETE CASCADE,
  incluida boolean NOT NULL DEFAULT true,
  motivo_exclusao text,
  ordem_visita integer,
  horario_chegada_previsto timestamptz,
  horario_conclusao_previsto timestamptz,
  distancia_anterior_km numeric(10,2),
  tempo_deslocamento_minutos integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(otimizacao_id, os_id)
);

CREATE INDEX IF NOT EXISTS idx_otimizacao_os_otimizacao ON otimizacao_os(otimizacao_id);
CREATE INDEX IF NOT EXISTS idx_otimizacao_os_os ON otimizacao_os(os_id);
CREATE INDEX IF NOT EXISTS idx_otimizacao_os_incluida ON otimizacao_os(incluida);

ALTER TABLE otimizacao_os ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE otimizacao_os IS 'Registro de cada OS incluída ou excluída em uma otimização';
COMMENT ON COLUMN otimizacao_os.incluida IS 'true = OS foi incluída na rota, false = foi excluída';
COMMENT ON COLUMN otimizacao_os.motivo_exclusao IS 'Razão pela qual a OS não foi incluída na otimização';

-- =====================================================
-- 7. POLÍTICAS RLS - LINHAS DE PRODUTO
-- =====================================================

CREATE POLICY "Todos podem ver linhas de produto ativas"
  ON linhas_produto FOR SELECT
  TO authenticated
  USING (ativo = true);

CREATE POLICY "Master e gerentes podem gerenciar linhas"
  ON linhas_produto FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'gerente', 'diretoria')
    )
  );

-- =====================================================
-- 8. POLÍTICAS RLS - TECNICOS_LINHAS_PRODUTO
-- =====================================================

CREATE POLICY "Usuários podem ver linhas dos técnicos"
  ON tecnicos_linhas_produto FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Master e gerentes podem gerenciar linhas de técnicos"
  ON tecnicos_linhas_produto FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'gerente', 'diretoria')
    )
  );

-- =====================================================
-- 9. POLÍTICAS RLS - OTIMIZACAO_LOGS
-- =====================================================

CREATE POLICY "Usuários podem ver logs de otimização da sua unidade"
  ON otimizacao_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        usuarios.tipo IN ('master', 'diretoria')
        OR usuarios.unidade_id = otimizacao_logs.unidade_id
      )
    )
  );

CREATE POLICY "Usuários autorizados podem criar logs"
  ON otimizacao_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador')
    )
  );

CREATE POLICY "Usuários autorizados podem atualizar logs"
  ON otimizacao_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador')
    )
  );

-- =====================================================
-- 10. POLÍTICAS RLS - OTIMIZACAO_OS
-- =====================================================

CREATE POLICY "Usuários podem ver OS das otimizações"
  ON otimizacao_os FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM otimizacao_logs ol
      JOIN usuarios u ON u.id = auth.uid()
      WHERE ol.id = otimizacao_os.otimizacao_id
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = ol.unidade_id
      )
    )
  );

CREATE POLICY "Sistema pode gerenciar OS de otimização"
  ON otimizacao_os FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador')
    )
  );

-- =====================================================
-- 11. INSERIR LINHAS DE PRODUTO PADRÃO
-- =====================================================

INSERT INTO linhas_produto (nome, descricao, tempo_medio_reparo_minutos, ativo) VALUES
  ('Smartphone', 'Smartphones e aparelhos móveis', 90, true),
  ('Tablet', 'Tablets e dispositivos touch', 75, true),
  ('TV', 'Televisores e monitores', 120, true),
  ('Eletrodoméstico', 'Linha branca e eletrodomésticos', 150, true),
  ('Notebook', 'Notebooks e computadores portáteis', 120, true),
  ('Áudio', 'Equipamentos de áudio e som', 60, true),
  ('Acessórios', 'Acessórios diversos', 30, true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 12. FUNÇÃO PARA VALIDAR COMPATIBILIDADE TÉCNICO x OS
-- =====================================================

CREATE OR REPLACE FUNCTION validar_compatibilidade_tecnico_os(
  p_tecnico_id uuid,
  p_os_id uuid
)
RETURNS TABLE(
  compativel boolean,
  motivo text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_linha_produto_id uuid;
  v_tecnico_atende boolean;
BEGIN
  SELECT linha_produto_id INTO v_linha_produto_id
  FROM os
  WHERE id = p_os_id;

  IF v_linha_produto_id IS NULL THEN
    RETURN QUERY SELECT true, 'OS sem linha de produto específica'::text;
    RETURN;
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM tecnicos_linhas_produto
    WHERE tecnico_id = p_tecnico_id
    AND linha_produto_id = v_linha_produto_id
  ) INTO v_tecnico_atende;

  IF v_tecnico_atende THEN
    RETURN QUERY SELECT true, 'Técnico qualificado para esta linha'::text;
  ELSE
    RETURN QUERY SELECT
      false,
      ('O técnico não atende a linha de produto: ' || (SELECT nome FROM linhas_produto WHERE id = v_linha_produto_id))::text;
  END IF;
END;
$$;

-- =====================================================
-- 13. FUNÇÃO PARA BUSCAR TÉCNICOS COMPATÍVEIS
-- =====================================================

CREATE OR REPLACE FUNCTION buscar_tecnicos_compativeis(
  p_os_id uuid,
  p_unidade_id uuid DEFAULT NULL
)
RETURNS TABLE(
  tecnico_id uuid,
  tecnico_nome text,
  horario_inicio time,
  horario_fim time,
  dias_permitidos_fora integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_linha_produto_id uuid;
BEGIN
  SELECT linha_produto_id INTO v_linha_produto_id
  FROM os
  WHERE id = p_os_id;

  IF v_linha_produto_id IS NULL THEN
    RETURN QUERY
    SELECT
      u.id,
      u.nome,
      u.horario_inicio,
      u.horario_fim,
      u.dias_permitidos_fora
    FROM usuarios u
    WHERE u.tipo IN ('tecnico', 'tecnico_ih')
    AND u.ativo = true
    AND (p_unidade_id IS NULL OR u.unidade_id = p_unidade_id)
    ORDER BY u.nome;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.nome,
    u.horario_inicio,
    u.horario_fim,
    u.dias_permitidos_fora
  FROM usuarios u
  JOIN tecnicos_linhas_produto tlp ON tlp.tecnico_id = u.id
  WHERE tlp.linha_produto_id = v_linha_produto_id
  AND u.tipo IN ('tecnico', 'tecnico_ih')
  AND u.ativo = true
  AND (p_unidade_id IS NULL OR u.unidade_id = p_unidade_id)
  ORDER BY u.nome;
END;
$$;
