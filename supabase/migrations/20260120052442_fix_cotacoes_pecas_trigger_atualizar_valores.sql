/*
  # Fix cotacoes_pecas trigger para atualizar valores da OS

  ## Problema
  - cotacoes_pecas não tinha trigger para recalcular valores da OS
  - Apenas os_pecas tinha possibilidade de atualizar via outros triggers
  - Quando peças eram deletadas/atualizadas em cotacoes_pecas, valores não atualizavam

  ## Solução
  - Adicionar trigger AFTER INSERT OR UPDATE OR DELETE
  - Chamar função atualizar_valores_os() para recalcular automaticamente

  ## Impacto
  - Valores da OS serão recalculados automaticamente ao:
    - Adicionar peças
    - Modificar peças
    - Remover peças
*/

-- Criar trigger para atualizar valores da OS quando cotacoes_pecas mudar
DROP TRIGGER IF EXISTS trigger_atualizar_valores_os_on_cotacoes_pecas ON cotacoes_pecas;

CREATE TRIGGER trigger_atualizar_valores_os_on_cotacoes_pecas
  AFTER INSERT OR UPDATE OR DELETE ON cotacoes_pecas
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valores_os();
