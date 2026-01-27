/*
  # Parametrização Completa de NF-e e Sistema de Exceções

  1. Novas Colunas NF-e
    - Configurações Gerais da NF-e
    - Tipo de nota, ambiente, documento, finalidade, modelo
    - Regime tributário, série, última NF
    - Informações para o fisco
    
  2. Impostos NF-e
    - ICMS: CSOSN, CFOP, Alíquota
    - IPI: CST, Alíquota
    - ISSQN: CST, Alíquota, Base
    - PIS: CST, Alíquota, Base
    - COFINS: CST, Alíquota, Base
    - IBS/CBS: Configurações completas da reforma tributária
    - Imposto Seletivo (IS)
    
  3. Tabela de Exceções
    - Sistema de exceções por estado, produto, NCM, origem, CST, CFOP
    - Permite configurar regras específicas para cada imposto
    
  4. Sistema de Variáveis
    - Permite usar variáveis nos comentários (ex: {cliente_nome}, {os_numero})
*/

-- Adicionar colunas de configuração geral NF-e
ALTER TABLE nf_configuracoes 
ADD COLUMN IF NOT EXISTS nfe_tipo_nota TEXT DEFAULT '1',
ADD COLUMN IF NOT EXISTS nfe_tipo_ambiente TEXT DEFAULT '2',
ADD COLUMN IF NOT EXISTS nfe_tipo_documento TEXT DEFAULT '55',
ADD COLUMN IF NOT EXISTS nfe_finalidade TEXT DEFAULT '1',
ADD COLUMN IF NOT EXISTS nfe_modelo_documento TEXT DEFAULT '55',
ADD COLUMN IF NOT EXISTS nfe_informacoes_fisco TEXT,
ADD COLUMN IF NOT EXISTS nfe_ultima_nf_emitida INTEGER DEFAULT 0;

-- Adicionar colunas ICMS
ALTER TABLE nf_configuracoes 
ADD COLUMN IF NOT EXISTS icms_csosn TEXT,
ADD COLUMN IF NOT EXISTS icms_cst TEXT,
ADD COLUMN IF NOT EXISTS icms_aliquota NUMERIC(5,2) DEFAULT 0;

-- Adicionar colunas IPI
ALTER TABLE nf_configuracoes 
ADD COLUMN IF NOT EXISTS ipi_cst TEXT,
ADD COLUMN IF NOT EXISTS ipi_aliquota NUMERIC(5,2) DEFAULT 0;

-- Adicionar colunas ISSQN
ALTER TABLE nf_configuracoes 
ADD COLUMN IF NOT EXISTS issqn_cst TEXT,
ADD COLUMN IF NOT EXISTS issqn_aliquota NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS issqn_base NUMERIC(5,2) DEFAULT 100;

-- Adicionar colunas PIS
ALTER TABLE nf_configuracoes 
ADD COLUMN IF NOT EXISTS pis_cst TEXT,
ADD COLUMN IF NOT EXISTS pis_aliquota NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pis_base_calculo NUMERIC(5,2) DEFAULT 100;

-- Adicionar colunas COFINS
ALTER TABLE nf_configuracoes 
ADD COLUMN IF NOT EXISTS cofins_cst TEXT,
ADD COLUMN IF NOT EXISTS cofins_aliquota NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cofins_base_calculo NUMERIC(5,2) DEFAULT 100;

-- Adicionar colunas adicionais IBS/CBS (Reforma Tributária)
ALTER TABLE nf_configuracoes 
ADD COLUMN IF NOT EXISTS ibs_estadual_reducao NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ibs_municipal_reducao NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cbs_federal_reducao NUMERIC(5,2) DEFAULT 0;

-- Adicionar colunas Imposto Seletivo (IS)
ALTER TABLE nf_configuracoes 
ADD COLUMN IF NOT EXISTS is_cst TEXT,
ADD COLUMN IF NOT EXISTS is_classificacao_tributaria TEXT,
ADD COLUMN IF NOT EXISTS is_aliquota NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_aliquota_especifica NUMERIC(10,4) DEFAULT 0;

-- Criar tabela de exceções fiscais
CREATE TABLE IF NOT EXISTS nf_excecoes_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuracao_id UUID NOT NULL REFERENCES nf_configuracoes(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  
  nome TEXT NOT NULL,
  tipo_imposto TEXT NOT NULL, -- 'icms', 'ipi', 'issqn', 'pis', 'cofins', 'ibs_cbs'
  
  -- Filtros de aplicação
  estados TEXT[], -- Array de UFs, NULL = qualquer estado
  produtos_ids UUID[], -- Array de IDs de produtos, NULL = qualquer produto
  ncms TEXT[], -- Array de NCMs, NULL = qualquer NCM
  origens TEXT[], -- Array de origens, NULL = qualquer origem
  csts TEXT[], -- Array de CSTs, NULL = qualquer CST
  cfops TEXT[], -- Array de CFOPs, NULL = qualquer CFOP
  
  -- Valores da exceção (JSON para flexibilidade)
  valores JSONB NOT NULL DEFAULT '{}',
  
  ativo BOOLEAN DEFAULT true,
  prioridade INTEGER DEFAULT 0, -- Maior número = maior prioridade
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_nf_excecoes_configuracao ON nf_excecoes_fiscais(configuracao_id);
CREATE INDEX IF NOT EXISTS idx_nf_excecoes_unidade ON nf_excecoes_fiscais(unidade_id);
CREATE INDEX IF NOT EXISTS idx_nf_excecoes_tipo ON nf_excecoes_fiscais(tipo_imposto);
CREATE INDEX IF NOT EXISTS idx_nf_excecoes_ativo ON nf_excecoes_fiscais(ativo);

-- RLS para exceções fiscais
ALTER TABLE nf_excecoes_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver exceções de sua unidade"
  ON nf_excecoes_fiscais FOR SELECT
  TO authenticated
  USING (
    unidade_id IN (
      SELECT unidade_id FROM usuarios WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND unidade_id IS NULL
    )
  );

CREATE POLICY "Usuários podem inserir exceções em sua unidade"
  ON nf_excecoes_fiscais FOR INSERT
  TO authenticated
  WITH CHECK (
    unidade_id IN (
      SELECT unidade_id FROM usuarios WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND unidade_id IS NULL
    )
  );

CREATE POLICY "Usuários podem atualizar exceções de sua unidade"
  ON nf_excecoes_fiscais FOR UPDATE
  TO authenticated
  USING (
    unidade_id IN (
      SELECT unidade_id FROM usuarios WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND unidade_id IS NULL
    )
  );

CREATE POLICY "Usuários podem deletar exceções de sua unidade"
  ON nf_excecoes_fiscais FOR DELETE
  TO authenticated
  USING (
    unidade_id IN (
      SELECT unidade_id FROM usuarios WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND unidade_id IS NULL
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_nf_excecoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_nf_excecoes_updated_at
  BEFORE UPDATE ON nf_excecoes_fiscais
  FOR EACH ROW
  EXECUTE FUNCTION update_nf_excecoes_updated_at();

-- Criar tabela de variáveis disponíveis (para documentação)
CREATE TABLE IF NOT EXISTS nf_variaveis_disponiveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_nota TEXT NOT NULL, -- 'nfse', 'nfe'
  variavel TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  exemplo TEXT,
  categoria TEXT NOT NULL, -- 'cliente', 'empresa', 'nota', 'valores', etc
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir variáveis padrão para NFS-e e NF-e
INSERT INTO nf_variaveis_disponiveis (tipo_nota, variavel, descricao, exemplo, categoria) VALUES
-- Variáveis do Cliente
('nfse', '{cliente_nome}', 'Nome do cliente/tomador', 'João Silva', 'cliente'),
('nfse', '{cliente_cpf_cnpj}', 'CPF/CNPJ do cliente', '123.456.789-00', 'cliente'),
('nfse', '{cliente_endereco}', 'Endereço completo do cliente', 'Rua ABC, 123', 'cliente'),
('nfse', '{cliente_cidade}', 'Cidade do cliente', 'São Paulo', 'cliente'),
('nfse', '{cliente_uf}', 'Estado do cliente', 'SP', 'cliente'),

('nfe', '{cliente_nome}', 'Nome do cliente/destinatário', 'João Silva', 'cliente'),
('nfe', '{cliente_cpf_cnpj}', 'CPF/CNPJ do cliente', '123.456.789-00', 'cliente'),
('nfe', '{cliente_endereco}', 'Endereço completo do cliente', 'Rua ABC, 123', 'cliente'),
('nfe', '{cliente_cidade}', 'Cidade do cliente', 'São Paulo', 'cliente'),
('nfe', '{cliente_uf}', 'Estado do cliente', 'SP', 'cliente'),

-- Variáveis da Empresa
('nfse', '{empresa_nome}', 'Nome da empresa prestadora', 'Minha Empresa LTDA', 'empresa'),
('nfse', '{empresa_cnpj}', 'CNPJ da empresa', '12.345.678/0001-90', 'empresa'),
('nfse', '{empresa_inscricao_municipal}', 'Inscrição Municipal', '123456', 'empresa'),
('nfse', '{empresa_telefone}', 'Telefone da empresa', '(11) 1234-5678', 'empresa'),

('nfe', '{empresa_nome}', 'Nome da empresa emitente', 'Minha Empresa LTDA', 'empresa'),
('nfe', '{empresa_cnpj}', 'CNPJ da empresa', '12.345.678/0001-90', 'empresa'),
('nfe', '{empresa_inscricao_estadual}', 'Inscrição Estadual', '123456789', 'empresa'),
('nfe', '{empresa_telefone}', 'Telefone da empresa', '(11) 1234-5678', 'empresa'),

-- Variáveis da Nota
('nfse', '{nota_numero}', 'Número da nota fiscal', '12345', 'nota'),
('nfse', '{nota_serie}', 'Série da nota', '1', 'nota'),
('nfse', '{nota_data_emissao}', 'Data de emissão', '27/01/2026', 'nota'),
('nfse', '{nota_codigo_verificacao}', 'Código de verificação', 'ABC123XYZ', 'nota'),

('nfe', '{nota_numero}', 'Número da nota fiscal', '12345', 'nota'),
('nfe', '{nota_serie}', 'Série da nota', '1', 'nota'),
('nfe', '{nota_data_emissao}', 'Data de emissão', '27/01/2026', 'nota'),
('nfe', '{nota_chave_acesso}', 'Chave de acesso da NF-e', '12345678901234567890123456789012345678901234', 'nota'),

-- Variáveis de Valores
('nfse', '{valor_servicos}', 'Valor total dos serviços', 'R$ 1.000,00', 'valores'),
('nfse', '{valor_iss}', 'Valor do ISS', 'R$ 50,00', 'valores'),
('nfse', '{valor_liquido}', 'Valor líquido', 'R$ 950,00', 'valores'),

('nfe', '{valor_produtos}', 'Valor total dos produtos', 'R$ 1.000,00', 'valores'),
('nfe', '{valor_icms}', 'Valor do ICMS', 'R$ 180,00', 'valores'),
('nfe', '{valor_total}', 'Valor total da nota', 'R$ 1.180,00', 'valores'),

-- Variáveis de OS (quando aplicável)
('nfse', '{os_numero}', 'Número da OS', 'OS-2026-0001', 'os'),
('nfse', '{os_equipamento}', 'Equipamento da OS', 'Notebook Dell', 'os'),
('nfse', '{os_defeito}', 'Defeito relatado', 'Não liga', 'os'),

('nfe', '{os_numero}', 'Número da OS', 'OS-2026-0001', 'os'),
('nfe', '{os_equipamento}', 'Equipamento da OS', 'Notebook Dell', 'os')
ON CONFLICT (variavel) DO NOTHING;

-- RLS para variáveis (leitura pública para usuários autenticados)
ALTER TABLE nf_variaveis_disponiveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver variáveis"
  ON nf_variaveis_disponiveis FOR SELECT
  TO authenticated
  USING (true);
