/*
  # Ajuste do Sistema de Rotas - Uma Rota por Unidade

  1. Alterações
    - Remove rotas globais pré-existentes
    - Torna unidade_id obrigatório (NOT NULL)
    - Cria 7 rotas para cada unidade existente
    - Cada unidade tem suas próprias rotas com cidades diferentes

  2. Comportamento
    - Cada unidade tem suas próprias 7 rotas (Preta, Vermelha, Azul, Verde, Rosa, Amarela, Laranja)
    - As cidades cadastradas em cada rota são específicas por unidade
    - Ao selecionar unidade no filtro, aparecem as 7 rotas daquela unidade
*/

-- 1. Remover rotas globais existentes (sem unidade_id)
DELETE FROM rotas WHERE unidade_id IS NULL;

-- 2. Tornar unidade_id obrigatório
ALTER TABLE rotas ALTER COLUMN unidade_id SET NOT NULL;

-- 3. Criar 7 rotas para cada unidade existente
DO $$
DECLARE
  unidade_record RECORD;
BEGIN
  FOR unidade_record IN SELECT id FROM unidades LOOP
    -- Rota Preta
    IF NOT EXISTS (
      SELECT 1 FROM rotas 
      WHERE unidade_id = unidade_record.id 
      AND coluna_kanban = 'rota_preta'
    ) THEN
      INSERT INTO rotas (nome, cor, coluna_kanban, cidades, ativa, unidade_id)
      VALUES ('Rota Preta', '#1a1a1a', 'rota_preta', '{}', true, unidade_record.id);
    END IF;

    -- Rota Vermelha
    IF NOT EXISTS (
      SELECT 1 FROM rotas 
      WHERE unidade_id = unidade_record.id 
      AND coluna_kanban = 'rota_vermelha'
    ) THEN
      INSERT INTO rotas (nome, cor, coluna_kanban, cidades, ativa, unidade_id)
      VALUES ('Rota Vermelha', '#ef4444', 'rota_vermelha', '{}', true, unidade_record.id);
    END IF;

    -- Rota Azul
    IF NOT EXISTS (
      SELECT 1 FROM rotas 
      WHERE unidade_id = unidade_record.id 
      AND coluna_kanban = 'rota_azul'
    ) THEN
      INSERT INTO rotas (nome, cor, coluna_kanban, cidades, ativa, unidade_id)
      VALUES ('Rota Azul', '#3b82f6', 'rota_azul', '{}', true, unidade_record.id);
    END IF;

    -- Rota Verde
    IF NOT EXISTS (
      SELECT 1 FROM rotas 
      WHERE unidade_id = unidade_record.id 
      AND coluna_kanban = 'rota_verde'
    ) THEN
      INSERT INTO rotas (nome, cor, coluna_kanban, cidades, ativa, unidade_id)
      VALUES ('Rota Verde', '#10b981', 'rota_verde', '{}', true, unidade_record.id);
    END IF;

    -- Rota Rosa
    IF NOT EXISTS (
      SELECT 1 FROM rotas 
      WHERE unidade_id = unidade_record.id 
      AND coluna_kanban = 'rota_rosa'
    ) THEN
      INSERT INTO rotas (nome, cor, coluna_kanban, cidades, ativa, unidade_id)
      VALUES ('Rota Rosa', '#ec4899', 'rota_rosa', '{}', true, unidade_record.id);
    END IF;

    -- Rota Amarela
    IF NOT EXISTS (
      SELECT 1 FROM rotas 
      WHERE unidade_id = unidade_record.id 
      AND coluna_kanban = 'rota_amarela'
    ) THEN
      INSERT INTO rotas (nome, cor, coluna_kanban, cidades, ativa, unidade_id)
      VALUES ('Rota Amarela', '#eab308', 'rota_amarela', '{}', true, unidade_record.id);
    END IF;

    -- Rota Laranja
    IF NOT EXISTS (
      SELECT 1 FROM rotas 
      WHERE unidade_id = unidade_record.id 
      AND coluna_kanban = 'rota_laranja'
    ) THEN
      INSERT INTO rotas (nome, cor, coluna_kanban, cidades, ativa, unidade_id)
      VALUES ('Rota Laranja', '#f97316', 'rota_laranja', '{}', true, unidade_record.id);
    END IF;
  END LOOP;
END $$;

-- 4. Comentários explicativos
COMMENT ON COLUMN rotas.unidade_id IS 'Unidade a qual esta rota pertence (OBRIGATÓRIO - cada unidade tem suas próprias rotas)';
