/*
# Create Pipeline Notify Trigger

## Overview
Creates a database trigger that fires whenever an OS changes its `coluna_kanban` column.
The trigger calls the `gia-pipeline-notify` edge function to send automated messages
to the client based on the configured pipeline messages.

This approach catches ALL column changes regardless of source (drag-drop, API, automation).

## Changes
- Creates function `notify_pipeline_column_change()` that uses pg_net to call the edge function
- Creates trigger `trg_os_pipeline_notify` on the `os` table

## Important Notes
- Uses pg_net for async HTTP calls (non-blocking)
- Only fires when coluna_kanban actually changes
- Does not block the OS update - notification is fire-and-forget
*/

CREATE OR REPLACE FUNCTION notify_pipeline_column_change()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url text;
  service_key text;
BEGIN
  -- Only fire when coluna_kanban actually changes
  IF OLD.coluna_kanban IS NOT DISTINCT FROM NEW.coluna_kanban THEN
    RETURN NEW;
  END IF;

  -- Get the Supabase URL and service key from environment
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  -- Fallback: try config
  IF supabase_url IS NULL THEN
    SELECT value INTO supabase_url FROM system_secrets WHERE key = 'SUPABASE_URL' LIMIT 1;
  END IF;

  -- Use pg_net to make async HTTP call
  IF supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/gia-pipeline-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'os_id', NEW.id,
        'coluna_kanban', NEW.coluna_kanban,
        'coluna_anterior', OLD.coluna_kanban
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block the OS update due to notification errors
    RAISE WARNING 'Pipeline notify failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_os_pipeline_notify ON os;
CREATE TRIGGER trg_os_pipeline_notify
  AFTER UPDATE OF coluna_kanban ON os
  FOR EACH ROW
  EXECUTE FUNCTION notify_pipeline_column_change();
