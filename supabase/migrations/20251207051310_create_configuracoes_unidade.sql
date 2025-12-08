/*
  # Configurações por Unidade para Otimizador

  1. Nova Tabela
    - `configuracoes_unidade`
      - Armazena configurações específicas de cada unidade
      - Tempos médios de atendimento por tipo
      - Parâmetros de otimização de rotas
      - Preferências de visualização
      - Configurações de notificações

  2. Segurança
    - RLS habilitado
    - Masters veem todas as configurações
    - Usuários veem apenas da sua unidade
    - Apenas gerentes e acima podem editar
*/

-- Criar tabela de configurações por unidade
CREATE TABLE IF NOT EXISTS configuracoes_unidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid UNIQUE NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,

  -- Tempos de atendimento (em minutos)
  tempo_medio_ih integer DEFAULT 120,
  tempo_medio_ci integer DEFAULT 60,
  intervalo_entre_atendimentos integer DEFAULT 15,

  -- Horários de expediente
  horario_inicio time DEFAULT '08:00:00',
  horario_fim time DEFAULT '18:00:00',
  horario_almoco time DEFAULT '12:00:00',
  duracao_almoco integer DEFAULT 60,

  -- Otimização de rotas
  raio_busca_km numeric(10,2) DEFAULT 50,

  -- Preferências de visualização
  modo_visualizacao_mapa text DEFAULT 'padrao' CHECK (modo_visualizacao_mapa IN ('padrao', 'satelite', 'terreno')),

  -- Notificações
  notificar_novos_agendamentos boolean DEFAULT true,
  notificar_checkout_pendente boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE configuracoes_unidade ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE configuracoes_unidade IS 'Configurações específicas de cada unidade para o otimizador de rotas';

-- Índices
CREATE INDEX IF NOT EXISTS idx_configuracoes_unidade ON configuracoes_unidade(unidade_id);

-- RLS Policies
CREATE POLICY "Master vê todas configurações"
  ON configuracoes_unidade FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_current_user_info() cui
      WHERE cui.user_tipo = 'master'
    )
  );

CREATE POLICY "Usuários veem configurações da unidade"
  ON configuracoes_unidade FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_current_user_info() cui
      WHERE cui.user_unidade_id = configuracoes_unidade.unidade_id
    )
  );

CREATE POLICY "Gerentes e acima podem inserir configurações"
  ON configuracoes_unidade FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_current_user_info() cui
      WHERE cui.user_tipo IN ('master', 'gerente', 'administrador')
        AND (cui.user_tipo = 'master' OR cui.user_unidade_id = configuracoes_unidade.unidade_id)
    )
  );

CREATE POLICY "Gerentes e acima podem atualizar configurações"
  ON configuracoes_unidade FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_current_user_info() cui
      WHERE cui.user_tipo IN ('master', 'gerente', 'administrador')
        AND (cui.user_tipo = 'master' OR cui.user_unidade_id = configuracoes_unidade.unidade_id)
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_configuracoes_unidade_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_configuracoes_unidade_updated_at ON configuracoes_unidade;
CREATE TRIGGER trigger_update_configuracoes_unidade_updated_at
  BEFORE UPDATE ON configuracoes_unidade
  FOR EACH ROW
  EXECUTE FUNCTION update_configuracoes_unidade_updated_at();

-- Inserir configurações padrão para unidades existentes
INSERT INTO configuracoes_unidade (unidade_id)
SELECT id FROM unidades
WHERE id NOT IN (SELECT unidade_id FROM configuracoes_unidade)
ON CONFLICT (unidade_id) DO NOTHING;
