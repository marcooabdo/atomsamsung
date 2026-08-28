/*
# Add profile visibility columns to usuarios

1. Modified Tables
   - `usuarios`
     - `exibir_email` (boolean, default true) — controls whether email shows on public profile
     - `exibir_telefone` (boolean, default true) — controls whether phone shows on public profile

2. Important Notes
   - Both default to true (show by default) so existing users remain visible
   - Users can toggle these off to hide contact info from the profile popup in chat
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'exibir_email') THEN
    ALTER TABLE usuarios ADD COLUMN exibir_email boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'exibir_telefone') THEN
    ALTER TABLE usuarios ADD COLUMN exibir_telefone boolean NOT NULL DEFAULT true;
  END IF;
END $$;
