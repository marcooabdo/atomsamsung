/*
  # Sistema de Rotas para OS IH

  1. Alterações na Tabela OS
    - Adiciona 7 novas colunas de rota ao constraint CHECK da coluna_kanban
    - Rotas: preta, vermelha, azul, verde, rosa, amarela, laranja
    - Cria índice em cliente_cidade para otimizar consultas de roteamento

  2. Alterações na Tabela Rotas
    - Adiciona coluna `coluna_kanban` para mapear a coluna correspondente no Kanban
    - Adiciona coluna `unidade_id` para permitir rotas por unidade

  3. Notas
    - Sistema funciona EXCLUSIVAMENTE para OS do tipo IH
    - OS CI não são afetadas por esta funcionalidade
    - Rotas são mapeadas por cidade do cliente
*/

-- 1. Atualizar constraint CHECK da coluna_kanban na tabela os
ALTER TABLE os DROP CONSTRAINT IF EXISTS os_coluna_kanban_check;

ALTER TABLE os ADD CONSTRAINT os_coluna_kanban_check CHECK (coluna_kanban IN (
  'os_nova', 'diagnostico', 'aguardando_cotacao', 'aguardando_aprovacao',
  'orcamento_aprovado', 'aguardando_peca', 'peca_em_transito', 'peca_disponivel',
  'em_reparo_ci', 
  'rota_preta', 'rota_vermelha', 'rota_azul', 'rota_verde', 'rota_rosa', 'rota_amarela', 'rota_laranja',
  'em_rota_ih', 'reparo_concluido', 'aguardando_fechamento',
  'fechar_os', 'os_fechada', 'orcamentos_rejeitados'
));

-- 2. Criar índice em cliente_cidade para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_os_cliente_cidade ON os(cliente_cidade);

-- 3. Adicionar coluna coluna_kanban na tabela rotas
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS coluna_kanban text;
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES unidades(id);

-- 4. Adicionar comentários nas colunas
COMMENT ON COLUMN rotas.coluna_kanban IS 'Coluna do Kanban associada a esta rota (ex: rota_preta, rota_vermelha)';
COMMENT ON COLUMN rotas.unidade_id IS 'Unidade a qual esta rota pertence (NULL = todas unidades)';

-- 5. Inserir 7 rotas padrão se não existirem
DO $$
BEGIN
  -- Rota Preta
  IF NOT EXISTS (SELECT 1 FROM rotas WHERE nome = 'Rota Preta') THEN
    INSERT INTO rotas (nome, cor, coluna_kanban, cidades, ativa)
    VALUES ('Rota Preta', '#1a1a1a', 'rota_preta', '{}', true);
  END IF;

  -- Rota Vermelha
  IF NOT EXISTS (SELECT 1 FROM rotas WHERE nome = 'Rota Vermelha') THEN
    INSERT INTO rotas (nome, cor, coluna_kanban, cidades, ativa)
    VALUES ('Rota Vermelha', '#ef4444', 'rota_vermelha', '{}', true);
  END IF;

  -- Rota Azul
  IF NOT EXISTS (SELECT 1 FROM rotas WHERE nome = 'Rota Azul') THEN
    INSERT INTO rotas (nome, cor, coluna_kanban, cidades, ativa)
    VALUES ('Rota Azul', '#3b82f6', 'rota_azul', '{}', true);
  END IF;

  -- Rota Verde
  IF NOT EXISTS (SELECT 1 FROM rotas WHERE nome = 'Rota Verde') THEN
    INSERT INTO rotas (nome, cor, coluna_kanban, cidades, ativa)
    VALUES ('Rota Verde', '#10b981', 'rota_verde', '{}', true);
  END IF;

  -- Rota Rosa
  IF NOT EXISTS (SELECT 1 FROM rotas WHERE nome = 'Rota Rosa') THEN
    INSERT INTO rotas (nome, cor, coluna_kanban, cidades, ativa)
    VALUES ('Rota Rosa', '#ec4899', 'rota_rosa', '{}', true);
  END IF;

  -- Rota Amarela
  IF NOT EXISTS (SELECT 1 FROM rotas WHERE nome = 'Rota Amarela') THEN
    INSERT INTO rotas (nome, cor, coluna_kanban, cidades, ativa)
    VALUES ('Rota Amarela', '#eab308', 'rota_amarela', '{}', true);
  END IF;

  -- Rota Laranja
  IF NOT EXISTS (SELECT 1 FROM rotas WHERE nome = 'Rota Laranja') THEN
    INSERT INTO rotas (nome, cor, coluna_kanban, cidades, ativa)
    VALUES ('Rota Laranja', '#f97316', 'rota_laranja', '{}', true);
  END IF;
END $$;
