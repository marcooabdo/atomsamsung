/*
  # Adicionar Técnico Designado à Tabela OS

  1. Alterações
    - Adiciona campo `tecnico_designado_id` para rastrear qual técnico iniciou o reparo
    - Adiciona campo `tecnico_designado_em` para registrar quando foi designado
    - Adiciona foreign key para a tabela de usuários

  2. Segurança
    - Mantém as políticas RLS existentes
*/

-- Adiciona campos de técnico designado
ALTER TABLE os
ADD COLUMN IF NOT EXISTS tecnico_designado_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tecnico_designado_em timestamptz;

-- Cria índice para melhorar performance nas consultas
CREATE INDEX IF NOT EXISTS idx_os_tecnico_designado ON os(tecnico_designado_id);
