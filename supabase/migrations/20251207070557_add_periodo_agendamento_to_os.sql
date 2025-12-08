/*
  # Adicionar Campo de Período ao Agendamento

  1. Mudanças na Tabela OS
    - Adiciona `periodo_agendamento` (text, valores: 'manha' ou 'tarde')
    - Campo opcional para permitir selecionar manhã ou tarde ao agendar

  2. Motivo
    - Simplificar agendamentos permitindo escolher apenas manhã ou tarde
    - Remover necessidade de definir horário exato de início e fim
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'periodo_agendamento'
  ) THEN
    ALTER TABLE os ADD COLUMN periodo_agendamento text CHECK (periodo_agendamento IN ('manha', 'tarde'));
  END IF;
END $$;
