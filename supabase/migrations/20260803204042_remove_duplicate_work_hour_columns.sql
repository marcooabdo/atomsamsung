/*
# Remove duplicate work hour columns from usuarios

The columns hora_inicio, hora_fim, tempo_almoco_min were added in error.
The table already has horario_inicio_expediente, horario_fim_expediente, duracao_almoco_minutos.
Removing the duplicates.
*/

ALTER TABLE usuarios DROP COLUMN IF EXISTS hora_inicio;
ALTER TABLE usuarios DROP COLUMN IF EXISTS hora_fim;
ALTER TABLE usuarios DROP COLUMN IF EXISTS tempo_almoco_min;