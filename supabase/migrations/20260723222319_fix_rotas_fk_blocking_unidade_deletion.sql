/*
# Fix rota FK constraints blocking cascade deletion

When deleting a unidade, rotas cascades. But os.rota_id and agendamentos.rota_id
reference rotas with NO ACTION, blocking the cascade.
Setting these to SET NULL so the deletion proceeds cleanly.

## Modified constraints:
- os.rota_id -> SET NULL on delete
- agendamentos.rota_id -> SET NULL on delete
*/

ALTER TABLE os DROP CONSTRAINT IF EXISTS os_rota_id_fkey;
ALTER TABLE os ADD CONSTRAINT os_rota_id_fkey
  FOREIGN KEY (rota_id) REFERENCES rotas(id) ON DELETE SET NULL;

ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_rota_id_fkey;
ALTER TABLE agendamentos ADD CONSTRAINT agendamentos_rota_id_fkey
  FOREIGN KEY (rota_id) REFERENCES rotas(id) ON DELETE SET NULL;
