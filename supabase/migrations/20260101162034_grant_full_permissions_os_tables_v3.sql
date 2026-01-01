/*
  # Conceder permissões completas nas tabelas OS

  1. Mudanças
    - Garante GRANT ALL em os, os_comentarios, os_anexos
    - Para roles: anon, authenticated, service_role
    - Necessário para N8N e integrações externas

  2. Segurança
    - Acesso total concedido (sem RLS)
*/

-- Conceder todas as permissões em OS
GRANT ALL ON TABLE os TO anon, authenticated, service_role;

-- Conceder todas as permissões em OS_COMENTARIOS
GRANT ALL ON TABLE os_comentarios TO anon, authenticated, service_role;

-- Conceder todas as permissões em OS_ANEXOS
GRANT ALL ON TABLE os_anexos TO anon, authenticated, service_role;

-- Conceder permissões em todas as sequences do schema public
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
