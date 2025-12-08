/*
  # Sistema de Otimização de Rotas com Google Maps - Integração Completa

  ## 1. Alterações na Tabela Unidades
    - Adiciona `lat_base` e `lng_base`: Coordenadas da base da unidade
    - Adiciona `endereco_completo`: Endereço formatado para geocodificação
    - Esses campos são essenciais para o cálculo de rotas otimizadas

  ## 2. Nova Tabela: route_sessions
    - Armazena sessões temporárias de otimização de rotas
    - Permite salvar progresso do usuário enquanto está otimizando
    - Auto-limpeza após 24 horas ou quando aplicada
    - Armazena sequência de OSs, OSs concluídas, configurações

  ## 3. Alterações na Tabela OS
    - Adiciona `lat` e `lng`: Coordenadas da OS para mapa
    - Adiciona `concluida`: Flag para marcar OS como concluída na rota
    - Adiciona `concluida_em`: Timestamp de conclusão
    - Adiciona `ordem_visita`: Ordem de visita na rota otimizada

  ## 4. Segurança
    - RLS habilitado em route_sessions
    - Políticas restritivas por unidade e usuário

  ## 5. Notas
    - Sistema integrado com Google Maps Distance Matrix e Directions API
    - Persistência temporária apenas para sessões ativas
    - Sincronização bidirecional com Kanban
*/

-- =====================================================
-- 1. ADICIONAR COORDENADAS DA BASE ÀS UNIDADES
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unidades' AND column_name = 'lat_base') THEN
    ALTER TABLE unidades ADD COLUMN lat_base numeric(10,7);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unidades' AND column_name = 'lng_base') THEN
    ALTER TABLE unidades ADD COLUMN lng_base numeric(10,7);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unidades' AND column_name = 'endereco_completo') THEN
    ALTER TABLE unidades ADD COLUMN endereco_completo text;
  END IF;
END $$;

COMMENT ON COLUMN unidades.lat_base IS 'Latitude da base/sede da unidade para cálculo de rotas';
COMMENT ON COLUMN unidades.lng_base IS 'Longitude da base/sede da unidade para cálculo de rotas';
COMMENT ON COLUMN unidades.endereco_completo IS 'Endereço completo formatado para geocodificação';

-- =====================================================
-- 2. CRIAR TABELA DE SESSÕES DE ROTA (Persistência Temporária)
-- =====================================================

CREATE TABLE IF NOT EXISTS route_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tecnico_id uuid REFERENCES usuarios(id),
  rotas_selecionadas text[] NOT NULL DEFAULT '{}',
  os_ids uuid[] NOT NULL DEFAULT '{}',
  os_sequence uuid[] NOT NULL DEFAULT '{}',
  os_completed uuid[] NOT NULL DEFAULT '{}',
  config jsonb DEFAULT '{}'::jsonb,
  metrics jsonb DEFAULT '{}'::jsonb,
  polyline text,
  last_calculated_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_sessions_unidade ON route_sessions(unidade_id);
CREATE INDEX IF NOT EXISTS idx_route_sessions_usuario ON route_sessions(usuario_id);
CREATE INDEX IF NOT EXISTS idx_route_sessions_tecnico ON route_sessions(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_route_sessions_expires ON route_sessions(expires_at);

ALTER TABLE route_sessions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE route_sessions IS 'Sessões temporárias de otimização de rotas (auto-limpeza em 24h)';
COMMENT ON COLUMN route_sessions.rotas_selecionadas IS 'Array com nomes das colunas de rota selecionadas (ex: rota_preta, rota_vermelha)';
COMMENT ON COLUMN route_sessions.os_ids IS 'Array com IDs de todas as OSs disponíveis nesta sessão';
COMMENT ON COLUMN route_sessions.os_sequence IS 'Array com IDs das OSs na ordem otimizada de visita';
COMMENT ON COLUMN route_sessions.os_completed IS 'Array com IDs das OSs já concluídas';
COMMENT ON COLUMN route_sessions.config IS 'Configurações da sessão (evitar pedágios, modo transporte, etc)';
COMMENT ON COLUMN route_sessions.metrics IS 'Métricas calculadas (distância total, tempo total, etc)';
COMMENT ON COLUMN route_sessions.polyline IS 'Polyline codificada da rota do Google Directions API';

-- =====================================================
-- 3. ADICIONAR CAMPOS DE ROTA NAS OS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'os' AND column_name = 'concluida') THEN
    ALTER TABLE os ADD COLUMN concluida boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'os' AND column_name = 'concluida_em') THEN
    ALTER TABLE os ADD COLUMN concluida_em timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'os' AND column_name = 'ordem_visita') THEN
    ALTER TABLE os ADD COLUMN ordem_visita integer;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_os_concluida ON os(concluida) WHERE concluida = true;
CREATE INDEX IF NOT EXISTS idx_os_ordem_visita ON os(ordem_visita) WHERE ordem_visita IS NOT NULL;

COMMENT ON COLUMN os.concluida IS 'Indica se a OS foi marcada como concluída no otimizador de rotas';
COMMENT ON COLUMN os.concluida_em IS 'Timestamp de quando a OS foi marcada como concluída';
COMMENT ON COLUMN os.ordem_visita IS 'Ordem de visita na rota otimizada (temporário, não persistente)';

-- =====================================================
-- 4. POLÍTICAS RLS - ROUTE_SESSIONS
-- =====================================================

CREATE POLICY "Usuários podem ver sessões da sua unidade"
  ON route_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        usuarios.tipo IN ('master', 'diretoria')
        OR usuarios.unidade_id = route_sessions.unidade_id
      )
    )
  );

CREATE POLICY "Usuários podem criar sessões na sua unidade"
  ON route_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.id = route_sessions.usuario_id
      AND (
        usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador')
        OR usuarios.unidade_id = route_sessions.unidade_id
      )
    )
  );

CREATE POLICY "Usuários podem atualizar suas próprias sessões"
  ON route_sessions FOR UPDATE
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretoria')
    )
  );

CREATE POLICY "Usuários podem deletar suas próprias sessões"
  ON route_sessions FOR DELETE
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretoria')
    )
  );

-- =====================================================
-- 5. FUNÇÃO PARA LIMPAR SESSÕES EXPIRADAS
-- =====================================================

CREATE OR REPLACE FUNCTION limpar_sessoes_expiradas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM route_sessions
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION limpar_sessoes_expiradas() IS 'Remove sessões de rota expiradas (>24h)';

-- =====================================================
-- 6. TRIGGER PARA AUTO-ATUALIZAR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_route_session_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_route_session_timestamp ON route_sessions;

CREATE TRIGGER trigger_update_route_session_timestamp
  BEFORE UPDATE ON route_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_route_session_timestamp();

-- =====================================================
-- 7. FUNÇÃO HELPER PARA OBTER OSs DE ROTAS
-- =====================================================

CREATE OR REPLACE FUNCTION get_os_from_routes(
  p_unidade_id uuid,
  p_rotas_selecionadas text[]
)
RETURNS TABLE(
  id uuid,
  numero_os text,
  cliente_nome text,
  cliente_endereco text,
  cliente_cidade text,
  lat numeric,
  lng numeric,
  coluna_kanban text,
  tipo_atendimento text,
  prioridade integer,
  concluida boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    os.id,
    os.numero_os,
    os.cliente_nome,
    os.cliente_endereco,
    os.cliente_cidade,
    os.lat,
    os.lng,
    os.coluna_kanban,
    os.tipo_atendimento,
    os.prioridade,
    os.concluida
  FROM os
  WHERE os.unidade_id = p_unidade_id
  AND os.tipo_atendimento = 'IH'
  AND os.coluna_kanban = ANY(p_rotas_selecionadas)
  AND os.lat IS NOT NULL
  AND os.lng IS NOT NULL
  ORDER BY os.prioridade DESC NULLS LAST, os.created_at ASC;
END;
$$;

COMMENT ON FUNCTION get_os_from_routes IS 'Busca todas as OSs IH das rotas selecionadas com coordenadas válidas';
