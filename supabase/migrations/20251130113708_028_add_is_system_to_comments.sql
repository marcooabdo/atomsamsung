/*
  # Add System Flag to Comments

  1. Changes
    - Add `is_system` boolean column to `os_comentarios` table
    - Add `is_system` boolean column to `cotacao_comentarios` table
    - Default to `false` for user comments
    - System logs will use `true`

  2. Purpose
    - Differentiate user comments from system logs
    - Allow filtering to show/hide system messages
    - Track automated actions (approvals, rejections, status changes)
*/

-- Add is_system to os_comentarios
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os_comentarios' AND column_name = 'is_system'
  ) THEN
    ALTER TABLE os_comentarios ADD COLUMN is_system boolean DEFAULT false;
  END IF;
END $$;

-- Add is_system to cotacao_comentarios
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cotacao_comentarios' AND column_name = 'is_system'
  ) THEN
    ALTER TABLE cotacao_comentarios ADD COLUMN is_system boolean DEFAULT false;
  END IF;
END $$;