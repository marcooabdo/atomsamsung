/*
  # Adicionar Dados Fiscais e Endereço Completo às Unidades

  1. Novos Campos Fiscais
    - cnpj (CNPJ da unidade)
    - razao_social (Razão social da empresa)
    - nome_fantasia (Nome fantasia)
    - inscricao_estadual (Inscrição Estadual)
    - ie_isento (IE Isento - boolean)
    - inscricao_municipal (Inscrição Municipal)
    - cnae (Código CNAE)
    - telefone (Telefone de contato)
    
  2. Endereço Desmembrado
    - cep (CEP)
    - cidade (Cidade)
    - uf (Estado/UF)
    - bairro (Bairro)
    - rua (Logradouro/Rua)
    - numero (Número do endereço)
    - complemento (Complemento)
    
  3. Manter campos existentes
    - Os campos antigos (endereco, latitude, longitude) são mantidos para compatibilidade
*/

-- Adicionar campos fiscais
ALTER TABLE unidades
ADD COLUMN IF NOT EXISTS cnpj TEXT,
ADD COLUMN IF NOT EXISTS razao_social TEXT,
ADD COLUMN IF NOT EXISTS nome_fantasia TEXT,
ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT,
ADD COLUMN IF NOT EXISTS ie_isento BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT,
ADD COLUMN IF NOT EXISTS cnae TEXT,
ADD COLUMN IF NOT EXISTS telefone TEXT;

-- Adicionar campos de endereço desmembrado
ALTER TABLE unidades
ADD COLUMN IF NOT EXISTS cep TEXT,
ADD COLUMN IF NOT EXISTS cidade TEXT,
ADD COLUMN IF NOT EXISTS uf TEXT,
ADD COLUMN IF NOT EXISTS bairro TEXT,
ADD COLUMN IF NOT EXISTS rua TEXT,
ADD COLUMN IF NOT EXISTS numero TEXT,
ADD COLUMN IF NOT EXISTS complemento TEXT;

-- Criar índices para performance em buscas comuns
CREATE INDEX IF NOT EXISTS idx_unidades_cnpj ON unidades(cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unidades_cidade_uf ON unidades(cidade, uf) WHERE cidade IS NOT NULL AND uf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unidades_cep ON unidades(cep) WHERE cep IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN unidades.cnpj IS 'CNPJ da unidade (formato: 00.000.000/0000-00)';
COMMENT ON COLUMN unidades.razao_social IS 'Razão social da empresa';
COMMENT ON COLUMN unidades.nome_fantasia IS 'Nome fantasia da empresa';
COMMENT ON COLUMN unidades.inscricao_estadual IS 'Inscrição Estadual';
COMMENT ON COLUMN unidades.ie_isento IS 'Indica se é isento de Inscrição Estadual';
COMMENT ON COLUMN unidades.inscricao_municipal IS 'Inscrição Municipal';
COMMENT ON COLUMN unidades.cnae IS 'Código CNAE da atividade principal';
COMMENT ON COLUMN unidades.telefone IS 'Telefone de contato da unidade';
COMMENT ON COLUMN unidades.cep IS 'CEP do endereço';
COMMENT ON COLUMN unidades.cidade IS 'Cidade';
COMMENT ON COLUMN unidades.uf IS 'Unidade Federativa (Estado)';
COMMENT ON COLUMN unidades.bairro IS 'Bairro';
COMMENT ON COLUMN unidades.rua IS 'Logradouro/Rua';
COMMENT ON COLUMN unidades.numero IS 'Número do endereço';
COMMENT ON COLUMN unidades.complemento IS 'Complemento do endereço';
