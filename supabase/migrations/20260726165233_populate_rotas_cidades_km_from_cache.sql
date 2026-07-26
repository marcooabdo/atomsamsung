/*
# Populate rotas_cidades_km from existing deslocamento_km_cache data

- Extracts distinct unidade + destination city combinations from deslocamento_km_cache
- Uses the average distance for cities that appear multiple times
- Calculates receita_por_os as distancia_km_ida_volta * 1.38
- Only inserts cities that have successful calculations (erro_calculo = false)
- Skips cities where destination = origin (same city, 0 km)
*/

INSERT INTO rotas_cidades_km (unidade_id, cidade, estado, distancia_km, distancia_km_ida_volta, receita_por_os, calculado_at)
SELECT 
  unidade_id,
  destino_cidade,
  destino_estado,
  ROUND(AVG(distancia_km)::numeric, 1),
  ROUND(AVG(distancia_km_ida_volta)::numeric, 1),
  ROUND((AVG(distancia_km_ida_volta) * 1.38)::numeric, 2),
  MAX(calculado_at)
FROM deslocamento_km_cache
WHERE erro_calculo = false 
  AND distancia_km > 0
  AND destino_cidade IS NOT NULL
  AND destino_cidade != ''
GROUP BY unidade_id, destino_cidade, destino_estado
ON CONFLICT (unidade_id, lower(cidade)) DO NOTHING;
