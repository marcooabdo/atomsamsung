/*
  # Remove Validação de Agendamento em Rotas

  1. Problema
    - Trigger impede mover OS para rota sem agendamento prévio
    - Usuário precisa criar agendamento ANTES de mover para rota
    - Lógica circular: rota requer agendamento, mas agendamento só disponível em rota

  2. Solução
    - Remove trigger que valida agendamento obrigatório em rotas
    - Mantém função para referência histórica mas desabilita trigger
    - Permite criar agendamento em qualquer momento

  3. Impacto
    - OS pode ser movida para rotas sem agendamento
    - Usuário pode agendar antes ou depois de mover para rota
    - Sistema fica mais flexível e menos restritivo
*/

-- Remover trigger que valida agendamento obrigatório em rotas
DROP TRIGGER IF EXISTS trigger_validar_agendamento_rota ON os;

-- Comentar a função para referência histórica
COMMENT ON FUNCTION validar_agendamento_rota IS 'DESABILITADA: Validação removida para permitir maior flexibilidade no fluxo de agendamento';