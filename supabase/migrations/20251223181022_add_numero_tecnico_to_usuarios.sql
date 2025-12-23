/*
  # Adiciona Número do Técnico à Tabela Usuarios

  1. Alterações
    - Adiciona coluna `numero_tecnico` (text, nullable)
    - Campo para identificação/cadastro do técnico
    - Não é obrigatório pois nem todos usuários são técnicos

  2. Notas
    - Campo diferente de telefone
    - Usado para cadastro/registro do técnico
*/

-- Adicionar coluna numero_tecnico
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS numero_tecnico text;

-- Comentário explicativo
COMMENT ON COLUMN usuarios.numero_tecnico IS 'Número de cadastro/registro do técnico (não é telefone)';
