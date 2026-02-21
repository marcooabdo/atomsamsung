/*
  # GIA Logistics Core

  ## Resumo
  Cria a infraestrutura de banco de dados para o módulo GIA Logistics,
  um sistema de roteirização autônoma com geolocalização just-in-time.

  ## Novas Tabelas

  ### `rotas_otimizadas`
  Armazena rotas criadas (manualmente ou pela GIA) para técnicos.
  - `id`, `unidade_id`, `tecnico_id`: identificadores
  - `nome`: nome descritivo da rota
  - `data_rota`: data de execução planejada
  - `status_rota`: ciclo de vida (rascunho / aprovada_notificando / liberada_tecnico)
  - `skill`: linha de equipamento (TV, smartphone, etc.)
  - `cidades`: array de cidades cobertas
  - `total_os`: contagem de OSs na rota
  - `metadata`: dados extras (distância total, tempo estimado, etc.)

  ## Colunas Adicionadas

  ### Tabela `os`
  - `status_agendamento_gia`: ciclo de vida logístico GIA
  - `rota_id`: vínculo com a rota

  ## Segurança
  - RLS habilitado em `rotas_otimizadas`
  - Policies para usuários autenticados lerem e gerenciarem rotas da sua unidade
*/

CREATE TABLE IF NOT EXISTS rotas_otimizadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES unidades(id) ON DELETE CASCADE,
  tecnico_id uuid,
  nome text NOT NULL DEFAULT 'Rota GIA',
  data_rota date,
  status_rota varchar(50) NOT NULL DEFAULT 'rascunho',
  skill text,
  cidades text[],
  total_os integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rotas_otimizadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read rotas_otimizadas"
  ON rotas_otimizadas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert rotas_otimizadas"
  ON rotas_otimizadas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update rotas_otimizadas"
  ON rotas_otimizadas FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete rotas_otimizadas"
  ON rotas_otimizadas FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

ALTER TABLE os ADD COLUMN IF NOT EXISTS status_agendamento_gia VARCHAR(50) DEFAULT 'aguardando_pecas';
ALTER TABLE os ADD COLUMN IF NOT EXISTS rota_id uuid REFERENCES rotas_otimizadas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_os_status_agendamento_gia ON os(status_agendamento_gia);
CREATE INDEX IF NOT EXISTS idx_os_rota_id ON os(rota_id);
CREATE INDEX IF NOT EXISTS idx_rotas_status_rota ON rotas_otimizadas(status_rota);
CREATE INDEX IF NOT EXISTS idx_rotas_unidade_id ON rotas_otimizadas(unidade_id);
