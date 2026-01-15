/*
  # Adicionar segundo telefone do cliente
  
  1. Campo Adicionado à tabela `os`
    - `cliente_telefone_2` (text) - Segundo número de telefone do cliente (opcional)
    
  2. Propósito
    - Permitir cadastro de até 2 telefones diferentes por cliente
    - Facilitar contato quando cliente possui múltiplos números
    - Campo opcional, sem obrigatoriedade
*/

-- Adicionar campo de segundo telefone
ALTER TABLE os 
ADD COLUMN IF NOT EXISTS cliente_telefone_2 text;