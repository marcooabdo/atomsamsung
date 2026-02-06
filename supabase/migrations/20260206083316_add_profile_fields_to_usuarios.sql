/*
  # Add profile fields to usuarios

  1. Modified Tables
    - `usuarios`
      - `telefone` (text, nullable) - personal phone number
      - `ramal` (text, nullable) - extension number  
      - `cargo` (text, nullable) - job title/role description
      - `bio` (text, nullable) - short bio for chat profile

  2. Notes
    - All fields are optional
    - These fields will be visible in chat contact profiles
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'telefone'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN telefone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'ramal'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN ramal text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'cargo'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN cargo text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'bio'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN bio text;
  END IF;
END $$;
