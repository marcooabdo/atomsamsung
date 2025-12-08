/*
  # Correção: Adicionar Campos de Agendamento na Tabela OS

  1. Mudanças na Tabela OS
    - Adiciona `data_agendamento` (date, nullable) - Data do agendamento
    - Adiciona `tecnico_agendado_id` (uuid, nullable) - Técnico designado para o agendamento
    - Adiciona `confirmado_com_cliente` (boolean, default false) - Flag de confirmação
    - Cria índices para melhor performance nas queries de agendamento

  2. Motivo
    - O código estava tentando usar campos que não existiam na tabela
    - Isso causava falhas silenciosas no salvamento de agendamentos
    - OSs não apareciam no calendário por falta dos campos necessários

  3. Impacto
    - Permite salvar corretamente dados de agendamento na tabela OS
    - Habilita filtros por técnico e data no calendário
    - Mantém compatibilidade com a tabela agendamentos existente
*/

-- Adiciona campos de agendamento na tabela OS
ALTER TABLE os
  ADD COLUMN IF NOT EXISTS data_agendamento date,
  ADD COLUMN IF NOT EXISTS tecnico_agendado_id uuid REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS confirmado_com_cliente boolean DEFAULT false;

-- Cria índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_os_data_agendamento ON os(data_agendamento) WHERE data_agendamento IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_os_tecnico_agendado ON os(tecnico_agendado_id) WHERE tecnico_agendado_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_os_unidade_data ON os(unidade_id, data_agendamento) WHERE data_agendamento IS NOT NULL;

-- Comentários explicativos
COMMENT ON COLUMN os.data_agendamento IS 'Data em que o atendimento foi agendado com o cliente';
COMMENT ON COLUMN os.tecnico_agendado_id IS 'Técnico designado para realizar o atendimento agendado';
COMMENT ON COLUMN os.confirmado_com_cliente IS 'Indica se a visita foi confirmada com o cliente';
