/*
  # Sistema de Configuração de Nota Fiscal

  1. New Tables
    - `nf_configuracoes` - Armazena parametrizações de NFS-e e NF-e por unidade
      - `id` (uuid, primary key)
      - `unidade_id` (uuid, FK para unidades)
      - `tipo` (text - 'nfse' ou 'nfe')
      - `nome` (text - título da parametrização)
      - `codigo_servico` (text - código do serviço na prefeitura)
      - `cnae` (text - código CNAE)
      - `aliquota_iss` (decimal - alíquota do ISS)
      - `retencao_ir` (decimal - alíquota retenção IR)
      - `retencao_pis` (decimal - alíquota retenção PIS)
      - `retencao_cofins` (decimal - alíquota retenção COFINS)
      - `retencao_csll` (decimal - alíquota retenção CSLL)
      - `retencao_inss` (decimal - alíquota retenção INSS)
      - `cfop` (text - CFOP para NF-e)
      - `ncm` (text - NCM padrão para NF-e)
      - `observacoes_padrao` (text - observações padrão na nota)
      - `ativo` (boolean)
      - `created_at` (timestamp)

    - `nf_emitidas` - Registro de notas fiscais emitidas
      - `id` (uuid, primary key)
      - `os_id` (uuid, FK para os)
      - `nf_config_id` (uuid, FK para nf_configuracoes)
      - `tipo` (text - 'nfse' ou 'nfe')
      - `numero` (text - número da nota)
      - `serie` (text - série da nota)
      - `chave_acesso` (text - chave de acesso da NF-e)
      - `valor_servicos` (decimal)
      - `valor_produtos` (decimal)
      - `valor_total` (decimal)
      - `valor_retencoes` (decimal)
      - `status` (text - 'pendente', 'emitida', 'cancelada', 'erro')
      - `xml_url` (text)
      - `pdf_url` (text)
      - `protocolo` (text)
      - `data_emissao` (timestamp)
      - `observacoes` (text)
      - `response_api` (jsonb)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users based on unit access
*/

-- Tabela de configurações de NF
CREATE TABLE IF NOT EXISTS nf_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('nfse', 'nfe')),
  nome text NOT NULL,
  codigo_servico text,
  cnae text,
  aliquota_iss decimal(5,2) DEFAULT 0,
  retencao_ir decimal(5,2) DEFAULT 0,
  retencao_pis decimal(5,2) DEFAULT 0,
  retencao_cofins decimal(5,2) DEFAULT 0,
  retencao_csll decimal(5,2) DEFAULT 0,
  retencao_inss decimal(5,2) DEFAULT 0,
  cfop text,
  ncm text,
  cst_icms text,
  cst_pis text,
  cst_cofins text,
  natureza_operacao text,
  regime_tributario text,
  observacoes_padrao text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Tabela de NFs emitidas
CREATE TABLE IF NOT EXISTS nf_emitidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid REFERENCES os(id) ON DELETE SET NULL,
  nf_config_id uuid REFERENCES nf_configuracoes(id) ON DELETE SET NULL,
  unidade_id uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('nfse', 'nfe')),
  numero text,
  serie text,
  chave_acesso text,
  valor_servicos decimal(10,2) DEFAULT 0,
  valor_produtos decimal(10,2) DEFAULT 0,
  valor_total decimal(10,2) DEFAULT 0,
  valor_retencoes decimal(10,2) DEFAULT 0,
  base_calculo decimal(10,2) DEFAULT 0,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'emitida', 'cancelada', 'erro')),
  xml_url text,
  pdf_url text,
  protocolo text,
  data_emissao timestamptz,
  tomador_nome text,
  tomador_documento text,
  tomador_endereco text,
  observacoes text,
  response_api jsonb,
  erro_mensagem text,
  emitido_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_nf_configuracoes_unidade ON nf_configuracoes(unidade_id);
CREATE INDEX IF NOT EXISTS idx_nf_configuracoes_tipo ON nf_configuracoes(tipo);
CREATE INDEX IF NOT EXISTS idx_nf_emitidas_os ON nf_emitidas(os_id);
CREATE INDEX IF NOT EXISTS idx_nf_emitidas_unidade ON nf_emitidas(unidade_id);
CREATE INDEX IF NOT EXISTS idx_nf_emitidas_status ON nf_emitidas(status);

-- RLS
ALTER TABLE nf_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE nf_emitidas ENABLE ROW LEVEL SECURITY;

-- Policies para nf_configuracoes
CREATE POLICY "Users can view NF configs of their unit"
  ON nf_configuracoes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND (
          usuarios.tipo IN ('master', 'diretoria')
          OR usuarios.unidade_id = nf_configuracoes.unidade_id
        )
    )
  );

CREATE POLICY "Admins can insert NF configs"
  ON nf_configuracoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador')
    )
  );

CREATE POLICY "Admins can update NF configs"
  ON nf_configuracoes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador')
    )
  );

CREATE POLICY "Admins can delete NF configs"
  ON nf_configuracoes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador')
    )
  );

-- Policies para nf_emitidas
CREATE POLICY "Users can view NF emitidas of their unit"
  ON nf_emitidas
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND (
          usuarios.tipo IN ('master', 'diretoria')
          OR usuarios.unidade_id = nf_emitidas.unidade_id
        )
    )
  );

CREATE POLICY "Users can insert NF emitidas"
  ON nf_emitidas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador', 'atendente')
    )
  );

CREATE POLICY "Users can update NF emitidas"
  ON nf_emitidas
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador', 'atendente')
    )
  );
