/*
  # Sincronizar Delivery de NF para Peças

  ## Objetivo
  Sincronizar automaticamente o campo `delivery` da tabela `estoque_nfs` 
  para a tabela `estoque_pecas` baseado no relacionamento `nf_id`.

  ## Alterações

  1. **Atualizar Dados Existentes**
     - Atualiza todas as peças existentes com a delivery da NF correspondente
  
  2. **Trigger para Sincronização Automática**
     - Quando uma nova peça é inserida → copia a delivery da NF
     - Quando o nf_id de uma peça é atualizado → atualiza a delivery
     - Quando a delivery de uma NF é atualizada → atualiza todas as peças vinculadas

  ## Notas Importantes
  - A delivery é extraída do XML da DANFE e armazenada em estoque_nfs
  - Todas as peças de uma mesma NF compartilham a mesma delivery
  - O trigger garante sincronização em tempo real
*/

-- ========================================
-- 1. ATUALIZAR DADOS EXISTENTES
-- ========================================

-- Atualizar delivery de todas as peças baseado na NF vinculada
UPDATE estoque_pecas ep
SET delivery = nf.delivery
FROM estoque_nfs nf
WHERE ep.nf_id = nf.id
  AND (ep.delivery IS DISTINCT FROM nf.delivery);

-- ========================================
-- 2. FUNÇÃO PARA SINCRONIZAR DELIVERY
-- ========================================

-- Função que sincroniza delivery quando uma peça é inserida/atualizada
CREATE OR REPLACE FUNCTION sync_delivery_from_nf_to_peca()
RETURNS TRIGGER AS $$
BEGIN
  -- Buscar e atualizar a delivery da NF correspondente
  SELECT delivery INTO NEW.delivery
  FROM estoque_nfs
  WHERE id = NEW.nf_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para INSERT e UPDATE em estoque_pecas
DROP TRIGGER IF EXISTS trg_sync_delivery_peca_insert_update ON estoque_pecas;
CREATE TRIGGER trg_sync_delivery_peca_insert_update
  BEFORE INSERT OR UPDATE OF nf_id
  ON estoque_pecas
  FOR EACH ROW
  EXECUTE FUNCTION sync_delivery_from_nf_to_peca();

-- ========================================
-- 3. SINCRONIZAR QUANDO NF É ATUALIZADA
-- ========================================

-- Função que atualiza delivery de todas as peças quando a NF é atualizada
CREATE OR REPLACE FUNCTION sync_delivery_from_nf_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a delivery foi alterada, atualizar todas as peças vinculadas
  IF (NEW.delivery IS DISTINCT FROM OLD.delivery) THEN
    UPDATE estoque_pecas
    SET delivery = NEW.delivery
    WHERE nf_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para UPDATE em estoque_nfs
DROP TRIGGER IF EXISTS trg_sync_delivery_nf_update ON estoque_nfs;
CREATE TRIGGER trg_sync_delivery_nf_update
  AFTER UPDATE OF delivery
  ON estoque_nfs
  FOR EACH ROW
  EXECUTE FUNCTION sync_delivery_from_nf_update();

-- ========================================
-- 4. CRIAR ÍNDICE PARA PERFORMANCE
-- ========================================

-- Índice para melhorar performance das buscas por delivery em peças
CREATE INDEX IF NOT EXISTS idx_estoque_pecas_delivery 
  ON estoque_pecas(delivery) 
  WHERE delivery IS NOT NULL;

-- Índice composto para melhorar JOIN entre peças e NF
CREATE INDEX IF NOT EXISTS idx_estoque_pecas_nf_delivery 
  ON estoque_pecas(nf_id, delivery);
