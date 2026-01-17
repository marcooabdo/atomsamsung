/*
  # Corrigir Constraint Unique de Taxas de Máquina

  1. Mudanças
    - Remove constraint antiga `UNIQUE (parcelamento)` que impedia múltiplas unidades de ter o mesmo parcelamento
    - Adiciona constraint `UNIQUE (parcelamento, unidade_id)` para permitir que cada unidade configure suas próprias taxas

  2. Contexto
    - Antes: Apenas um conjunto global de taxas (1x a 12x) para todas as unidades
    - Agora: Cada unidade pode ter suas próprias configurações de taxa de 1x a 12x

  3. Impacto
    - Permite que cada unidade tenha configurações independentes de taxas de cartão
    - Mantém a integridade evitando duplicatas dentro da mesma unidade
*/

-- Remove a constraint antiga que impedia múltiplas unidades
ALTER TABLE taxas_maquina DROP CONSTRAINT IF EXISTS taxas_maquina_parcelamento_key;

-- Adiciona nova constraint que permite o mesmo parcelamento para unidades diferentes
-- mas previne duplicatas dentro da mesma unidade
ALTER TABLE taxas_maquina 
  ADD CONSTRAINT taxas_maquina_parcelamento_unidade_key 
  UNIQUE (parcelamento, unidade_id);

-- Remove o índice antigo que não é mais necessário
DROP INDEX IF EXISTS idx_taxas_maquina_parcelamento;

-- Cria novo índice composto para performance
CREATE INDEX IF NOT EXISTS idx_taxas_maquina_parcelamento_unidade 
  ON taxas_maquina(unidade_id, parcelamento);
