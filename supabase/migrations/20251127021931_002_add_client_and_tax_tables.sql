/*
  # Adicionar tabelas de clientes, taxas e comentários

  1. Novas Tabelas
    - `clientes`
      - Armazena dados completos dos clientes com endereço desmembrado
      - Busca automática por CPF/CNPJ
      - Integração com ViaCEP para preenchimento automático
    
    - `taxas_maquina`
      - Configura taxas de cartão por parcelamento
      - Auto-preenchimento na cotação
    
    - `cotacao_comentarios`
      - Sistema de comentários internos nas cotações
      - Rastreamento de quem comentou e quando
  
  2. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas restritivas para acesso autenticado
*/

-- Criar tabela de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf_cnpj text UNIQUE NOT NULL,
  nome text NOT NULL,
  telefone text,
  email text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de taxas de máquina
CREATE TABLE IF NOT EXISTS taxas_maquina (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcelamento integer NOT NULL UNIQUE,
  taxa numeric(5,2) NOT NULL DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de comentários de cotações
CREATE TABLE IF NOT EXISTS cotacao_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES usuarios(id),
  texto text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxas_maquina ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotacao_comentarios ENABLE ROW LEVEL SECURITY;

-- Políticas para clientes
CREATE POLICY "Usuários autenticados podem ver clientes"
  ON clientes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir clientes"
  ON clientes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar clientes"
  ON clientes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas para taxas_maquina
CREATE POLICY "Usuários autenticados podem ver taxas"
  ON taxas_maquina FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem gerenciar taxas"
  ON taxas_maquina FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas para cotacao_comentarios
CREATE POLICY "Usuários autenticados podem ver comentários"
  ON cotacao_comentarios FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir comentários"
  ON cotacao_comentarios FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_clientes_cpf_cnpj ON clientes(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_taxas_maquina_parcelamento ON taxas_maquina(parcelamento);
CREATE INDEX IF NOT EXISTS idx_cotacao_comentarios_cotacao_id ON cotacao_comentarios(cotacao_id);

-- Inserir taxas padrão (exemplo)
INSERT INTO taxas_maquina (parcelamento, taxa, ativo) VALUES
  (1, 0, true),
  (2, 2.99, true),
  (3, 3.99, true),
  (4, 4.99, true),
  (5, 5.99, true),
  (6, 6.99, true),
  (7, 7.99, true),
  (8, 8.99, true),
  (9, 9.99, true),
  (10, 10.99, true),
  (11, 11.99, true),
  (12, 12.99, true)
ON CONFLICT (parcelamento) DO NOTHING;
