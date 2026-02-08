/*
  # Corrigir trigger para disparar quando tipo_venda mudar

  1. Problema
    - Trigger não dispara quando tipo_venda é alterado
    - Estrelas ficam no pilar antigo (Store+) ao invés de ir para o novo (Care+)

  2. Solução
    - Adicionar tipo_venda ao trigger
    - Recalcular estrelas para AMBOS os pilares (antigo e novo)
*/

-- Recriar trigger para incluir tipo_venda
DROP TRIGGER IF EXISTS trigger_registrar_venda_skywalker ON vendas;

CREATE TRIGGER trigger_registrar_venda_skywalker
  BEFORE INSERT OR UPDATE OF status, vendedor_id, tipo_venda ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION registrar_venda_skywalker();

-- Comentário
COMMENT ON TRIGGER trigger_registrar_venda_skywalker ON vendas IS 'Dispara recálculo de estrelas Skywalker ao criar, mudar status, vendedor ou tipo de venda';
