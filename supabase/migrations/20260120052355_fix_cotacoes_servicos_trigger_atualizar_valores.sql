/*
  # Fix cotacoes_servicos trigger para atualizar valores da OS

  ## Problema
  - cotacoes_servicos não tinha trigger para recalcular valores da OS
  - Apenas os_servicos tinha o trigger correto
  - Quando serviços eram deletados/atualizados em cotacoes_servicos, valores não atualizavam

  ## Solução
  - Adicionar trigger AFTER INSERT OR UPDATE OR DELETE
  - Chamar função atualizar_valores_os() para recalcular automaticamente

  ## Impacto
  - Valores da OS serão recalculados automaticamente ao:
    - Adicionar serviços
    - Modificar serviços
    - Remover serviços
*/

-- Criar trigger para atualizar valores da OS quando cotacoes_servicos mudar
DROP TRIGGER IF EXISTS trigger_atualizar_valores_os_on_cotacoes_servicos ON cotacoes_servicos;

CREATE TRIGGER trigger_atualizar_valores_os_on_cotacoes_servicos
  AFTER INSERT OR UPDATE OR DELETE ON cotacoes_servicos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valores_os();
