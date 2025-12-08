/*
  # Adiciona campos de análise do técnico na cotação

  1. Novos Campos
    - `analise_tecnico_concluida` (boolean) - Indica se técnico concluiu análise
    - `analise_tecnico_em` (timestamp) - Quando a análise foi concluída
    - `analise_tecnico_por` (uuid) - Quem concluiu a análise (técnico)
    - `enviada_diagnostico` (boolean) - Indica se foi enviada para diagnóstico no Kanban
    - `enviada_diagnostico_em` (timestamp) - Quando foi enviada para diagnóstico
  
  2. Objetivo
    - Permitir fluxo de cotação -> diagnóstico -> refazer orçamento -> cotação
    - Indicar visualmente quando técnico já analisou e precisa apenas precificar
*/

ALTER TABLE cotacoes 
ADD COLUMN IF NOT EXISTS analise_tecnico_concluida boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS analise_tecnico_em timestamptz,
ADD COLUMN IF NOT EXISTS analise_tecnico_por uuid REFERENCES usuarios(id),
ADD COLUMN IF NOT EXISTS enviada_diagnostico boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS enviada_diagnostico_em timestamptz;