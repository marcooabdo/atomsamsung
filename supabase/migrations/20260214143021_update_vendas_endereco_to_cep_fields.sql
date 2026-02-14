/*
  # Atualizar Campos de Endereço para Sistema de CEP

  1. Alterações na Tabela `vendas`
    - Remove: `cliente_endereco` (text único)
    - Adiciona:
      - `cliente_cep` (text) - CEP do cliente
      - `cliente_logradouro` (text) - Rua/Avenida
      - `cliente_numero` (text) - Número da residência
      - `cliente_complemento` (text) - Complemento (apto, bloco, etc)
      - `cliente_bairro` (text) - Bairro
      - `cliente_cidade` (text) - Cidade
      - `cliente_estado` (text) - Estado (UF)

  2. Funcionalidades
    - Campos separados permitem busca por CEP via API ViaCEP
    - Usuário só precisa preencher número e complemento manualmente
    - Dados estruturados facilitam relatórios e análises

  3. Migração de Dados
    - Campo antigo `cliente_endereco` é removido
    - Novos registros usarão os campos separados
*/

-- Remover coluna antiga de endereço (se existir dados, eles serão perdidos)
ALTER TABLE vendas DROP COLUMN IF EXISTS cliente_endereco;

-- Adicionar novos campos de endereço estruturado
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cliente_cep text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cliente_logradouro text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cliente_numero text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cliente_complemento text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cliente_bairro text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cliente_cidade text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cliente_estado text;

-- Criar índice para busca por CEP
CREATE INDEX IF NOT EXISTS vendas_cliente_cep_idx ON vendas(cliente_cep);
CREATE INDEX IF NOT EXISTS vendas_cliente_cidade_idx ON vendas(cliente_cidade);

-- Comentários
COMMENT ON COLUMN vendas.cliente_cep IS 'CEP do cliente (formato: 00000-000)';
COMMENT ON COLUMN vendas.cliente_logradouro IS 'Logradouro (rua, avenida, etc)';
COMMENT ON COLUMN vendas.cliente_numero IS 'Número da residência';
COMMENT ON COLUMN vendas.cliente_complemento IS 'Complemento (apartamento, bloco, sala, etc)';
COMMENT ON COLUMN vendas.cliente_bairro IS 'Bairro';
COMMENT ON COLUMN vendas.cliente_cidade IS 'Cidade';
COMMENT ON COLUMN vendas.cliente_estado IS 'Estado (UF)';
