/*
  # Sistema de Requisição de Peças

  1. Nova Tabela: `requisicoes_pecas`
    - Gerencia requisições de peças feitas pelo técnico
    - Vincula OS → Peça → Estoque
    - Controla status (pendente, atendida, devolvida)
    - Registra GI (Goods Issue) quando consumida

  2. Campos Principais:
    - `id` (uuid, PK)
    - `os_id` (uuid, FK para OS)
    - `cotacao_peca_id` (uuid, FK para cotacoes_pecas)
    - `codigo_peca` (text)
    - `descricao` (text)
    - `quantidade_requisitada` (numeric)
    - `status` (enum: pendente, atendida, em_uso, gi_postada, devolvida)
    - `peca_estoque_id` (uuid, FK para estoque_pecas)
    - `requisitado_por` (uuid, FK para usuarios)
    - `atendido_por` (uuid, FK para usuarios)
    - `gi_postada_em` (timestamptz)
    - `motivo_devolucao` (text)
    - `tipo_devolucao` (enum: nova, nova_com_defeito, usada)
    - `unidade_id` (uuid, FK para unidades)

  3. Security:
    - RLS habilitado
    - Técnicos podem requisitar
    - Estoque pode atender
    - Apenas usuários da mesma unidade veem requisições
*/

-- Enum para status de requisição
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'requisicao_status') THEN
    CREATE TYPE requisicao_status AS ENUM (
      'pendente',
      'atendida',
      'em_uso',
      'gi_postada',
      'devolvida'
    );
  END IF;
END $$;

-- Enum para tipo de devolução
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_devolucao') THEN
    CREATE TYPE tipo_devolucao AS ENUM (
      'nova',
      'nova_com_defeito',
      'usada'
    );
  END IF;
END $$;

-- Tabela de requisições
CREATE TABLE IF NOT EXISTS requisicoes_pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES os(id) ON DELETE CASCADE,
  cotacao_peca_id uuid REFERENCES cotacoes_pecas(id) ON DELETE SET NULL,
  
  -- Dados da peça
  codigo_peca text NOT NULL,
  descricao text NOT NULL,
  quantidade_requisitada numeric(10,2) NOT NULL DEFAULT 1,
  
  -- Status e rastreamento
  status requisicao_status NOT NULL DEFAULT 'pendente',
  peca_estoque_id uuid REFERENCES estoque_pecas(id) ON DELETE SET NULL,
  
  -- Quem requisitou e quem atendeu
  requisitado_por uuid REFERENCES usuarios(id),
  atendido_por uuid REFERENCES usuarios(id),
  
  -- GI e devolução
  gi_postada_em timestamptz,
  motivo_devolucao text,
  tipo_devolucao tipo_devolucao,
  
  -- Controle
  unidade_id uuid NOT NULL REFERENCES unidades(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_requisicoes_pecas_os ON requisicoes_pecas(os_id);
CREATE INDEX IF NOT EXISTS idx_requisicoes_pecas_status ON requisicoes_pecas(status);
CREATE INDEX IF NOT EXISTS idx_requisicoes_pecas_unidade ON requisicoes_pecas(unidade_id);
CREATE INDEX IF NOT EXISTS idx_requisicoes_pecas_estoque ON requisicoes_pecas(peca_estoque_id);

-- Adicionar colunas em os_pecas se não existirem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'os_pecas' AND column_name = 'codigo'
  ) THEN
    ALTER TABLE os_pecas ADD COLUMN codigo text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'os_pecas' AND column_name = 'descricao'
  ) THEN
    ALTER TABLE os_pecas ADD COLUMN descricao text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'os_pecas' AND column_name = 'valor_unitario'
  ) THEN
    ALTER TABLE os_pecas ADD COLUMN valor_unitario numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'os_pecas' AND column_name = 'valor_total'
  ) THEN
    ALTER TABLE os_pecas ADD COLUMN valor_total numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'os_pecas' AND column_name = 'cotacao_peca_id'
  ) THEN
    ALTER TABLE os_pecas ADD COLUMN cotacao_peca_id uuid REFERENCES cotacoes_pecas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- RLS para requisicoes_pecas
ALTER TABLE requisicoes_pecas ENABLE ROW LEVEL SECURITY;

-- Master e diretoria veem todas as requisições
CREATE POLICY "Master e diretoria veem todas requisições"
  ON requisicoes_pecas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretoria')
    )
  );

-- Usuários veem requisições da sua unidade
CREATE POLICY "Usuários veem requisições da unidade"
  ON requisicoes_pecas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.unidade_id = requisicoes_pecas.unidade_id
    )
  );

-- Técnicos podem criar requisições
CREATE POLICY "Técnicos criam requisições"
  ON requisicoes_pecas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (usuarios.unidade_id = requisicoes_pecas.unidade_id OR usuarios.tipo IN ('master', 'diretoria'))
    )
  );

-- Estoque e gestores podem atualizar requisições
CREATE POLICY "Estoque atualiza requisições"
  ON requisicoes_pecas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        usuarios.tipo IN ('master', 'diretoria', 'estoque') 
        OR usuarios.unidade_id = requisicoes_pecas.unidade_id
      )
    )
  );
