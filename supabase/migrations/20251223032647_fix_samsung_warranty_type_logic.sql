/*
  # Fix Samsung OS warranty type logic

  1. Changes
    - Corrects tipo_os for Samsung OS based on correct WarrantyType logic
    - WarrantyType "I" = LP (In Warranty)
    - WarrantyType "O" = OW (Out of Warranty)
  
  2. Logic
    - Uses status_garantia field which stores the WarrantyType from Samsung API
    - LP: tipo_orcamento = NULL (não precisa orçamento)
    - OW: tipo_orcamento = 'sem_orcamento' (padrão inicial)
*/

-- Temporarily disable triggers to avoid conflicts
ALTER TABLE os DISABLE TRIGGER trigger_log_os_changes;
ALTER TABLE os DISABLE TRIGGER trigger_sync_status_changes;
ALTER TABLE os DISABLE TRIGGER trigger_sync_tipo_orcamento;

-- Update Samsung OS based on correct WarrantyType logic
UPDATE os
SET 
  tipo_os = CASE
    WHEN UPPER(COALESCE(status_garantia, 'O')) = 'I' THEN 'LP'
    ELSE 'OW'
  END,
  tipo_orcamento = CASE
    WHEN UPPER(COALESCE(status_garantia, 'O')) = 'I' THEN NULL
    ELSE 'sem_orcamento'
  END
WHERE numero_os_samsung IS NOT NULL;

-- Re-enable triggers
ALTER TABLE os ENABLE TRIGGER trigger_log_os_changes;
ALTER TABLE os ENABLE TRIGGER trigger_sync_status_changes;
ALTER TABLE os ENABLE TRIGGER trigger_sync_tipo_orcamento;
