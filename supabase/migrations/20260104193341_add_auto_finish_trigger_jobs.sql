/*
  # Auto-fill finished_at when job ends

  1. Changes
    - Create trigger function to automatically set finished_at
    - Trigger fires when is_running changes from true to false
    - Only sets finished_at if it's currently null
  
  2. Behavior
    - When n8n updates is_running to false, finished_at is set automatically
    - If finished_at already has a value, it won't be overwritten
*/

CREATE OR REPLACE FUNCTION auto_set_job_finished_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Se is_running mudou de true para false e finished_at está null
  IF OLD.is_running = true AND NEW.is_running = false AND NEW.finished_at IS NULL THEN
    NEW.finished_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_auto_set_job_finished_at ON jobs;
CREATE TRIGGER trigger_auto_set_job_finished_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_job_finished_at();
