/*
  # Add WhatsApp to tipo_atendimento constraint

  1. Changes
    - Modify the tipo_atendimento check constraint to include 'whatsapp'
    - This allows creating conversations from WhatsApp messages

  2. Notes
    - Drops and recreates the constraint to include the new value
*/

ALTER TABLE atom_connect_conversas 
DROP CONSTRAINT IF EXISTS atom_connect_conversas_tipo_atendimento_check;

ALTER TABLE atom_connect_conversas 
ADD CONSTRAINT atom_connect_conversas_tipo_atendimento_check 
CHECK (tipo_atendimento = ANY (ARRAY['balcao'::text, 'ih'::text, 'venda'::text, 'whatsapp'::text]));
