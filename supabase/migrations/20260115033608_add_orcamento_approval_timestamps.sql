/*
  # Adicionar timestamps de aprovação e reprovação de orçamento
  
  1. Campos Adicionados à tabela `os`
    - `orcamento_aprovado_em` (timestamptz) - Data e hora da aprovação do orçamento
    - `orcamento_aprovado_por` (uuid) - Usuário que aprovou o orçamento
    - `orcamento_reprovado_em` (timestamptz) - Data e hora da reprovação do orçamento
    - `orcamento_reprovado_por` (uuid) - Usuário que reprovou o orçamento
    
  2. Propósito
    - Rastrear quando e quem aprovou ou reprovou orçamentos
    - Manter histórico completo de negociações
    - Exibir informações de rastreabilidade na interface
*/

-- Adicionar campos de aprovação
ALTER TABLE os 
ADD COLUMN IF NOT EXISTS orcamento_aprovado_em timestamptz,
ADD COLUMN IF NOT EXISTS orcamento_aprovado_por uuid REFERENCES usuarios(id),
ADD COLUMN IF NOT EXISTS orcamento_reprovado_em timestamptz,
ADD COLUMN IF NOT EXISTS orcamento_reprovado_por uuid REFERENCES usuarios(id);