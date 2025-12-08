/*
  # Adicionar Campos de Endereço Separados

  ## Mudanças
  
  1. Tabela `os`:
    - Adiciona `cliente_cep` (text)
    - Adiciona `cliente_logradouro` (text)
    - Adiciona `cliente_numero` (text)
    - Adiciona `cliente_complemento` (text)
    - Adiciona `cliente_bairro` (text)
    - Adiciona `cliente_cidade` (text)
    - Adiciona `cliente_estado` (text)
    - Mantém `cliente_endereco` existente para compatibilidade
  
  2. Tabela `cotacoes`:
    - Adiciona os mesmos campos de endereço
  
  3. Tabela `clientes`:
    - Adiciona os mesmos campos de endereço para reutilização
  
  ## Notas
  - Os campos `cliente_endereco` existentes são mantidos para compatibilidade
  - Novos campos permitem melhor estruturação e validação de dados
  - Facilita integração com APIs de CEP e busca de endereços
*/

-- Adicionar campos de endereço à tabela os
ALTER TABLE os ADD COLUMN IF NOT EXISTS cliente_cep text;
ALTER TABLE os ADD COLUMN IF NOT EXISTS cliente_logradouro text;
ALTER TABLE os ADD COLUMN IF NOT EXISTS cliente_numero text;
ALTER TABLE os ADD COLUMN IF NOT EXISTS cliente_complemento text;
ALTER TABLE os ADD COLUMN IF NOT EXISTS cliente_bairro text;
ALTER TABLE os ADD COLUMN IF NOT EXISTS cliente_cidade text;
ALTER TABLE os ADD COLUMN IF NOT EXISTS cliente_estado text;

-- Adicionar campos de endereço à tabela cotacoes
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_cep text;
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_logradouro text;
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_numero text;
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_complemento text;
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_bairro text;
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_cidade text;
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_estado text;

-- Adicionar campos de endereço à tabela clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cep text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS logradouro text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS complemento text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bairro text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS estado text;