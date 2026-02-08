/*
  # Habilitar Realtime para skywalker_estrelas_mes

  1. Objetivo
    - Permitir que o frontend receba atualizações em tempo real
    - Quando vendas forem editadas, o Skywalker atualiza automaticamente

  2. Alteração
    - Habilitar realtime na tabela skywalker_estrelas_mes
*/

-- Habilitar realtime para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE skywalker_estrelas_mes;

COMMENT ON TABLE skywalker_estrelas_mes IS 'Estrelas conquistadas por profissional por mês - com realtime habilitado';
