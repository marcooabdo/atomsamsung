/*
  # Allow NULL usuario_id in os_anexos
  
  1. Changes
    - Remove NOT NULL constraint from usuario_id column in os_anexos table
    - This allows attachments to be created without requiring a user ID
  
  2. Notes
    - Existing data will not be affected
    - The column can now accept NULL values
*/

ALTER TABLE os_anexos 
  ALTER COLUMN usuario_id DROP NOT NULL;
