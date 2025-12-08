/*
  # Adicionar Campos Faltantes e Tabela de NF de Devoluções
  
  1. Novos Campos
    - `requisicoes_pecas`:
      - `valor_peca` - Valor da peça para controle de pedidos
      - `numero_pedido_samsung` - Número do pedido Samsung
      - `previsao_entrega` - Data estimada de entrega
      - `tecnico_id` - Técnico que requisitou (pode ser diferente de requisitado_por)
      - `aprovado_em` - Timestamp de aprovação
    
    - `estoque_pedidos`:
      - `requisicao_peca_id` - Vinculo com requisição original
      - `unidade_id` - Unidade que fez o pedido
    
    - `estoque_devolucoes`:
      - `os_id` - OS relacionada à devolução
      - `status` - Status da devolução (pendente, aprovada, rejeitada)
      - `delivery` - Número do delivery da peça
    
    - `rotas`:
      - `unidade_id` - Unidade a que pertence a rota

  2. Nova Tabela
    - `estoque_nf_devolucoes` - Gerencia NFs de devolução de peças
  
  3. Security
    - Enable RLS on new table
    - Add policies for authenticated users
*/

-- Adicionar campos em requisicoes_pecas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requisicoes_pecas' AND column_name = 'valor_peca'
  ) THEN
    ALTER TABLE requisicoes_pecas ADD COLUMN valor_peca numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requisicoes_pecas' AND column_name = 'numero_pedido_samsung'
  ) THEN
    ALTER TABLE requisicoes_pecas ADD COLUMN numero_pedido_samsung text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requisicoes_pecas' AND column_name = 'previsao_entrega'
  ) THEN
    ALTER TABLE requisicoes_pecas ADD COLUMN previsao_entrega date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requisicoes_pecas' AND column_name = 'tecnico_id'
  ) THEN
    ALTER TABLE requisicoes_pecas ADD COLUMN tecnico_id uuid REFERENCES usuarios(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requisicoes_pecas' AND column_name = 'aprovado_em'
  ) THEN
    ALTER TABLE requisicoes_pecas ADD COLUMN aprovado_em timestamptz;
  END IF;
END $$;

-- Adicionar campos em estoque_pedidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_pedidos' AND column_name = 'requisicao_peca_id'
  ) THEN
    ALTER TABLE estoque_pedidos ADD COLUMN requisicao_peca_id uuid REFERENCES requisicoes_pecas(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_pedidos' AND column_name = 'unidade_id'
  ) THEN
    ALTER TABLE estoque_pedidos ADD COLUMN unidade_id uuid REFERENCES unidades(id);
  END IF;
END $$;

-- Adicionar campos em estoque_devolucoes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_devolucoes' AND column_name = 'os_id'
  ) THEN
    ALTER TABLE estoque_devolucoes ADD COLUMN os_id uuid REFERENCES os(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_devolucoes' AND column_name = 'status'
  ) THEN
    ALTER TABLE estoque_devolucoes ADD COLUMN status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'rejeitada'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_devolucoes' AND column_name = 'delivery'
  ) THEN
    ALTER TABLE estoque_devolucoes ADD COLUMN delivery text;
  END IF;
END $$;

-- Adicionar campo em rotas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rotas' AND column_name = 'unidade_id'
  ) THEN
    ALTER TABLE rotas ADD COLUMN unidade_id uuid REFERENCES unidades(id);
  END IF;
END $$;

-- Criar tabela estoque_nf_devolucoes
CREATE TABLE IF NOT EXISTS estoque_nf_devolucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_nf text NOT NULL,
  data_emissao date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('nova', 'nova_com_defeito', 'usada', 'mista')),
  valor_total numeric NOT NULL DEFAULT 0,
  remetente_cnpj text,
  remetente_dados jsonb,
  destinatario_cnpj text,
  destinatario_dados jsonb,
  cfop text,
  natureza_operacao text,
  observacoes text,
  pecas_ids uuid[] DEFAULT '{}',
  xml_conteudo text,
  data_coleta_transportadora timestamptz,
  status text DEFAULT 'emitida' CHECK (status IN ('emitida', 'coletada', 'cancelada')),
  unidade_id uuid REFERENCES unidades(id),
  emitido_por uuid REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE estoque_nf_devolucoes ENABLE ROW LEVEL SECURITY;

-- Policies para estoque_nf_devolucoes
CREATE POLICY "Users can view NF devolucoes from their unit"
  ON estoque_nf_devolucoes FOR SELECT
  TO authenticated
  USING (
    unidade_id IN (
      SELECT id FROM unidades
      WHERE id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
      OR (SELECT unidade_id FROM usuarios WHERE id = auth.uid()) IS NULL
    )
  );

CREATE POLICY "Estoque and above can insert NF devolucoes"
  ON estoque_nf_devolucoes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria', 'gerente', 'administrador', 'estoque')
    )
  );

CREATE POLICY "Estoque and above can update NF devolucoes"
  ON estoque_nf_devolucoes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND tipo IN ('master', 'diretoria', 'gerente', 'administrador', 'estoque')
    )
  );

-- Adicionar coluna delivery em estoque_pecas se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_pecas' AND column_name = 'delivery'
  ) THEN
    ALTER TABLE estoque_pecas ADD COLUMN delivery text;
  END IF;
END $$;