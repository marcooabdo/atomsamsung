/*
  # Habilitar Realtime para os_comentarios

  1. Problema
    - Quando triggers do banco criam logs automaticamente, o frontend não recebe notificação
    - Usuário precisa fechar e reabrir modal para ver novos comentários

  2. Solução
    - Habilitar realtime para a tabela os_comentarios
    - Frontend já possui subscription configurado
*/

ALTER PUBLICATION supabase_realtime ADD TABLE os_comentarios;
