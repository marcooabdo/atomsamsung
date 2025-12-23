/*
  # Update Samsung OS with correct warranty type logic

  1. Changes
    - Sets tipo_os based on status_garantia from Samsung API
    - I (In Warranty) = LP
    - O (Out of Warranty) = OW
    - All Samsung OS get tipo_orcamento = 'normal'
  
  2. Logic
    - Reads status_garantia field (Samsung WarrantyType)
    - If 'I' → tipo_os = 'LP'
    - If 'O' or null → tipo_os = 'OW'
    - All get tipo_orcamento = 'normal'
*/

-- Temporarily disable triggers
ALTER TABLE os DISABLE TRIGGER trigger_log_os_changes;
ALTER TABLE os DISABLE TRIGGER trigger_sync_status_changes;
ALTER TABLE os DISABLE TRIGGER trigger_sync_tipo_orcamento;

-- Update Samsung OS based on warranty type
UPDATE os
SET 
  tipo_os = CASE 
    WHEN UPPER(COALESCE(status_garantia, 'O')) = 'I' THEN 'LP'
    ELSE 'OW'
  END,
  tipo_orcamento = 'normal'
WHERE numero_os_samsung IS NOT NULL;

-- Re-enable triggers
ALTER TABLE os ENABLE TRIGGER trigger_log_os_changes;
ALTER TABLE os ENABLE TRIGGER trigger_sync_status_changes;
ALTER TABLE os ENABLE TRIGGER trigger_sync_tipo_orcamento;
