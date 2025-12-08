/*
  # Atualizar configurações de unidade

  1. Alterações
    - Remove campos desnecessários: tempo_medio_ci e intervalo_entre_atendimentos
    - Mantém apenas campos relevantes para operações IH
*/

-- Remover colunas não utilizadas
ALTER TABLE configuracoes_unidade DROP COLUMN IF EXISTS tempo_medio_ci;
ALTER TABLE configuracoes_unidade DROP COLUMN IF EXISTS intervalo_entre_atendimentos;
