/*
# Add unique constraint on rotas_cidades_km (unidade_id, cidade)

1. Modified Tables
- `rotas_cidades_km`: Added unique constraint on (unidade_id, lower(cidade)) to enable upsert operations

2. Important Notes
- This enables the calculate-route-km function to upsert distances without duplicates
- Uses a unique index on lower(cidade) to handle case-insensitive matching
*/

CREATE UNIQUE INDEX IF NOT EXISTS idx_rotas_cidades_km_unidade_cidade_unique
ON rotas_cidades_km (unidade_id, LOWER(cidade));
