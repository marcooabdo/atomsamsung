/*
  # Remove incorrect trigger from os table
  
  1. Problem
    - trigger_atualizar_valores_os_on_os_discount calls atualizar_valores_os()
    - atualizar_valores_os() expects NEW.os_id (for related tables)
    - But os table has NEW.id, not NEW.os_id
    
  2. Solution
    - Remove this incorrect trigger
    - The correct trigger is trigger_recalcular_desconto_os which calls recalcular_valores_os_desconto()
*/

DROP TRIGGER IF EXISTS trigger_atualizar_valores_os_on_os_discount ON os;