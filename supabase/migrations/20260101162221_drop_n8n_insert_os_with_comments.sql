/*
  # Remover função n8n_insert_os_with_comments

  1. Mudanças
    - Remove a função n8n_insert_os_with_comments
    - Mantém apenas a função original n8n_insert_os

  2. Segurança
    - Limpeza de função não utilizada
*/

-- Remover a função
DROP FUNCTION IF EXISTS n8n_insert_os_with_comments;
