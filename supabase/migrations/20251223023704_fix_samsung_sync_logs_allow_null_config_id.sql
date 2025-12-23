/*
  # Fix samsung_sync_logs to allow NULL config_id

  1. Changes
    - Alter config_id column to allow NULL values
    - This is necessary because manual syncs don't have an associated config

  2. Reason
    - Edge Function was failing with 500 error when trying to insert NULL config_id
    - Manual syncs are triggered by users directly, not by scheduled configs
*/

ALTER TABLE samsung_sync_logs
  ALTER COLUMN config_id DROP NOT NULL;
