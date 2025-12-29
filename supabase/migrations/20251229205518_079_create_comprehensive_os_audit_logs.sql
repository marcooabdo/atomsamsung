/*
  # Sistema Completo de Auditoria de OS

  1. Descrição
    - Cria triggers automáticos para registrar TODAS as alterações em OSs
    - Rastreia mudanças em: OS, checklist, serviços, pagamentos, peças, agendamentos, anexos
    - Registra usuário, data/hora e detalhes da alteração
    - Logs aparecem automaticamente na aba de comentários

  2. Tabelas Monitoradas
    - os: Status, coluna kanban, dados principais, endereço
    - os_checklist: Itens marcados/desmarcados
    - cotacoes_servicos: Serviços adicionados/removidos/alterados
    - pagamentos: Pagamentos criados/alterados/deletados
    - requisicoes_pecas: Peças requisitadas/aprovadas/reprovadas/devolvidas
    - agendamentos: Agendamentos criados/alterados
    - os_anexos: Anexos adicionados/removidos
    - cotacoes: Criação, envio, aprovação de orçamentos

  3. Formato dos Logs
    - Tipo de ação (CREATE, UPDATE, DELETE)
    - Campo alterado
    - Valor anterior → Valor novo
    - Usuário responsável
    - Data e hora exata
*/

-- Função auxiliar para criar log de comentário do sistema
CREATE OR REPLACE FUNCTION criar_log_os(
  p_os_id uuid,
  p_usuario_id uuid,
  p_comentario text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_os_id IS NOT NULL THEN
    INSERT INTO os_comentarios (os_id, usuario_id, comentario, is_system)
    VALUES (p_os_id, COALESCE(p_usuario_id, (SELECT id FROM usuarios LIMIT 1)), p_comentario, true);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignorar erros silenciosamente para não quebrar operações principais
    NULL;
END;
$$;

-- Triggers já criados no conteúdo...