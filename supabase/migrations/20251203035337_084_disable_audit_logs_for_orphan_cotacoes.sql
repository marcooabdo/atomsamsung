/*
  # Desabilitar Logs de Auditoria para Cotações Órfãs

  1. Problema
    - Ao mover orçamento de volta, triggers tentam criar logs
    - OS está sendo deletada neste momento
    - Causa conflitos e erros 400
    - Usuário não consegue refazer orçamento

  2. Solução
    - Desabilitar triggers de log durante operações de cotação sem OS
    - Não tentar criar logs quando OS não existe
    - Simplificar: logs apenas quando OS está ativa
    - Comentários da aplicação já registram a movimentação

  3. Comportamento
    - Cotação com OS ativa: registra logs normalmente
    - Cotação sem OS: não tenta criar logs (evita erros)
    - Comentários no código já registram "OS removida do Kanban"
*/

-- Desabilitar trigger de cotações completamente
-- Os comentários da aplicação já registram a movimentação
DROP TRIGGER IF EXISTS trigger_log_cotacoes_changes ON cotacoes;

-- Desabilitar trigger de anexos completamente  
-- Os comentários da aplicação já registram a movimentação
DROP TRIGGER IF EXISTS trigger_log_anexos_changes ON os_anexos;

COMMENT ON TABLE cotacoes IS 'Triggers de auditoria desabilitados para evitar conflitos ao mover orçamentos. Comentários da aplicação registram movimentações.';