ALTER TABLE os ADD COLUMN IF NOT EXISTS arquivada boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_os_arquivada ON os (arquivada) WHERE arquivada = true;