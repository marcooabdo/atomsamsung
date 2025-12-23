/*
  # Fix Samsung OS tipo_os field

  1. Changes
    - Temporarily disables specific user triggers
    - Converts all OS with tipo_os = 'SAMSUNG' to either 'LP' or 'OW'
    - Uses status_garantia field to determine the type:
      - If warranty status indicates in warranty → 'LP'
      - Otherwise → 'OW' with tipo_orcamento = 'sem_orcamento'
    - Re-enables triggers after update
  
  2. Logic
    - Checks for keywords: 'IN WARRANTY', 'GARANTIA', 'IW', 'W'
    - Defaults to 'OW' if warranty status is null or unclear
    - Sets tipo_orcamento to 'sem_orcamento' for OW types
*/

-- Temporarily disable specific user triggers
ALTER TABLE os DISABLE TRIGGER trigger_log_os_changes;
ALTER TABLE os DISABLE TRIGGER trigger_sync_status_changes;
ALTER TABLE os DISABLE TRIGGER trigger_sync_tipo_orcamento;

-- Update existing Samsung OS to LP or OW based on warranty status
UPDATE os
SET 
  tipo_os = CASE
    WHEN 
      UPPER(COALESCE(status_garantia, '')) LIKE '%IN WARRANTY%' OR
      UPPER(COALESCE(status_garantia, '')) LIKE '%GARANTIA%' OR
      UPPER(COALESCE(status_garantia, '')) = 'IW' OR
      UPPER(COALESCE(status_garantia, '')) = 'W'
    THEN 'LP'
    ELSE 'OW'
  END,
  tipo_orcamento = CASE
    WHEN NOT (
      UPPER(COALESCE(status_garantia, '')) LIKE '%IN WARRANTY%' OR
      UPPER(COALESCE(status_garantia, '')) LIKE '%GARANTIA%' OR
      UPPER(COALESCE(status_garantia, '')) = 'IW' OR
      UPPER(COALESCE(status_garantia, '')) = 'W'
    )
    THEN 'sem_orcamento'
    ELSE tipo_orcamento
  END
WHERE tipo_os = 'SAMSUNG';

-- Re-enable triggers
ALTER TABLE os ENABLE TRIGGER trigger_log_os_changes;
ALTER TABLE os ENABLE TRIGGER trigger_sync_status_changes;
ALTER TABLE os ENABLE TRIGGER trigger_sync_tipo_orcamento;
