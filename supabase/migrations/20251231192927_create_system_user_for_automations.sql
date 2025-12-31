/*
  # Create System User for Automations
  
  1. Changes
    - Create a special system user for external processes, automations, crons, etc.
    - User ID: 00000000-0000-0000-0000-000000000001 (easy to reference in code)
    - Type: master (full access)
    - Email: sistema@automacao.internal
    - Name: Sistema - Automação
  
  2. Notes
    - This user can be used for edge functions, cron jobs, and external integrations
    - It has no unit assignment (null) to allow cross-unit operations
    - Always active
*/

INSERT INTO usuarios (
  id,
  nome,
  email,
  tipo,
  unidade_id,
  ativo,
  numero_tecnico,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Sistema - Automação',
  'sistema@automacao.internal',
  'master',
  NULL,
  true,
  NULL,
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  email = EXCLUDED.email,
  tipo = EXCLUDED.tipo,
  ativo = EXCLUDED.ativo,
  updated_at = now();
