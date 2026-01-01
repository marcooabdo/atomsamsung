/*
  # Criar tabela configuracoes_unidade

  1. Nova Tabela
    - `configuracoes_unidade`
      - `id` (uuid, primary key)
      - `unidade_id` (uuid, foreign key para unidades)
      - `tempo_medio_ih` (integer) - Tempo médio de atendimento IH em minutos
      - `horario_inicio` (time) - Horário de início do expediente
      - `horario_fim` (time) - Horário de fim do expediente
      - `duracao_almoco` (integer) - Duração do almoço em minutos
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Segurança
    - Habilitar RLS
    - Adicionar políticas para leitura e escrita baseadas na unidade
*/

CREATE TABLE IF NOT EXISTS configuracoes_unidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  tempo_medio_ih integer NOT NULL DEFAULT 60,
  horario_inicio time NOT NULL DEFAULT '08:00:00',
  horario_fim time NOT NULL DEFAULT '18:00:00',
  duracao_almoco integer NOT NULL DEFAULT 60,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(unidade_id)
);

ALTER TABLE configuracoes_unidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver configurações de sua unidade"
  ON configuracoes_unidade
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.unidade_id = configuracoes_unidade.unidade_id
    )
  );

CREATE POLICY "Master pode ver todas as configurações"
  ON configuracoes_unidade
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'master'
    )
  );

CREATE POLICY "Master e Admin podem inserir configurações"
  ON configuracoes_unidade
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo IN ('master', 'admin')
        AND (usuarios.tipo = 'master' OR usuarios.unidade_id = configuracoes_unidade.unidade_id)
    )
  );

CREATE POLICY "Master e Admin podem atualizar configurações"
  ON configuracoes_unidade
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo IN ('master', 'admin')
        AND (usuarios.tipo = 'master' OR usuarios.unidade_id = configuracoes_unidade.unidade_id)
    )
  );

-- Inserir configurações padrão para todas as unidades existentes
INSERT INTO configuracoes_unidade (unidade_id, tempo_medio_ih, horario_inicio, horario_fim, duracao_almoco)
SELECT id, 60, '08:00:00', '18:00:00', 60
FROM unidades
WHERE id NOT IN (SELECT unidade_id FROM configuracoes_unidade)
ON CONFLICT (unidade_id) DO NOTHING;
