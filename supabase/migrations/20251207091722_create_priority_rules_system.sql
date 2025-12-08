/*
  # Sistema de Regras de Prioridade

  1. Nova Tabela
    - `regras_prioridade` - Regras configuráveis para cálculo automático de prioridade
      - Campos para condições: dias_na_etapa, tipo_os, modelos, colunas_kanban
      - Campo para prioridade resultante
      - Ordem de aplicação das regras

  2. Security
    - Enable RLS
    - Políticas para usuários autenticados
*/

CREATE TABLE IF NOT EXISTS regras_prioridade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES unidades(id) NOT NULL,
  nome text NOT NULL,
  descricao text,
  ativa boolean DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  
  -- Condições (todas são opcionais, se não preenchidas não são consideradas)
  dias_na_etapa_min integer,
  dias_na_etapa_max integer,
  tipo_os text[], -- ['LP', 'OW']
  tipo_atendimento text[], -- ['IH', 'CI']
  modelos_aparelho text[], -- Lista de modelos específicos
  marcas_aparelho text[], -- Lista de marcas específicas
  colunas_kanban text[], -- Colunas específicas do Kanban
  
  -- Cliente VIP ou especial
  cliente_vip boolean,
  
  -- Resultado
  prioridade_resultado text NOT NULL CHECK (prioridade_resultado IN ('baixa', 'normal', 'alta', 'urgente')),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE regras_prioridade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view priority rules of their unit"
  ON regras_prioridade
  FOR SELECT
  TO authenticated
  USING (
    unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo = 'master')
  );

CREATE POLICY "Users can insert priority rules"
  ON regras_prioridade
  FOR INSERT
  TO authenticated
  WITH CHECK (
    unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo = 'master')
  );

CREATE POLICY "Users can update priority rules"
  ON regras_prioridade
  FOR UPDATE
  TO authenticated
  USING (
    unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo = 'master')
  );

CREATE POLICY "Users can delete priority rules"
  ON regras_prioridade
  FOR DELETE
  TO authenticated
  USING (
    unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo = 'master')
  );

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_regras_prioridade_unidade ON regras_prioridade(unidade_id);
CREATE INDEX IF NOT EXISTS idx_regras_prioridade_ordem ON regras_prioridade(ordem);
CREATE INDEX IF NOT EXISTS idx_regras_prioridade_ativa ON regras_prioridade(ativa);

-- Adicionar campo cliente_vip na tabela OS (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'cliente_vip'
  ) THEN
    ALTER TABLE os ADD COLUMN cliente_vip boolean DEFAULT false;
  END IF;
END $$;

-- Função para calcular prioridade automaticamente baseada nas regras
CREATE OR REPLACE FUNCTION calcular_prioridade_automatica(os_id_param uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  os_record RECORD;
  regra RECORD;
  prioridade_calculada text := 'normal';
BEGIN
  -- Buscar dados da OS
  SELECT 
    o.*,
    EXTRACT(DAY FROM (now() - o.created_at))::integer as dias_decorridos
  INTO os_record
  FROM os o
  WHERE o.id = os_id_param;
  
  IF NOT FOUND THEN
    RETURN 'normal';
  END IF;
  
  -- Buscar regras ativas da unidade, ordenadas por ordem de prioridade
  FOR regra IN 
    SELECT * FROM regras_prioridade
    WHERE unidade_id = os_record.unidade_id
    AND ativa = true
    ORDER BY ordem ASC
  LOOP
    -- Verificar se todas as condições da regra são atendidas
    
    -- Dias na etapa
    IF regra.dias_na_etapa_min IS NOT NULL AND os_record.dias_decorridos < regra.dias_na_etapa_min THEN
      CONTINUE;
    END IF;
    
    IF regra.dias_na_etapa_max IS NOT NULL AND os_record.dias_decorridos > regra.dias_na_etapa_max THEN
      CONTINUE;
    END IF;
    
    -- Tipo de OS
    IF regra.tipo_os IS NOT NULL AND NOT (os_record.tipo_os = ANY(regra.tipo_os)) THEN
      CONTINUE;
    END IF;
    
    -- Tipo de atendimento
    IF regra.tipo_atendimento IS NOT NULL AND NOT (os_record.tipo_atendimento = ANY(regra.tipo_atendimento)) THEN
      CONTINUE;
    END IF;
    
    -- Modelos de aparelho
    IF regra.modelos_aparelho IS NOT NULL AND NOT (os_record.aparelho_modelo = ANY(regra.modelos_aparelho)) THEN
      CONTINUE;
    END IF;
    
    -- Marcas de aparelho
    IF regra.marcas_aparelho IS NOT NULL AND NOT (os_record.aparelho_marca = ANY(regra.marcas_aparelho)) THEN
      CONTINUE;
    END IF;
    
    -- Colunas do Kanban
    IF regra.colunas_kanban IS NOT NULL AND NOT (os_record.coluna_kanban = ANY(regra.colunas_kanban)) THEN
      CONTINUE;
    END IF;
    
    -- Cliente VIP
    IF regra.cliente_vip IS NOT NULL AND os_record.cliente_vip != regra.cliente_vip THEN
      CONTINUE;
    END IF;
    
    -- Se chegou aqui, todas as condições foram atendidas
    prioridade_calculada := regra.prioridade_resultado;
    EXIT; -- Para na primeira regra que atende
  END LOOP;
  
  RETURN prioridade_calculada;
END;
$$;

-- Inserir regras de exemplo
INSERT INTO regras_prioridade (unidade_id, nome, descricao, ordem, dias_na_etapa_min, prioridade_resultado)
SELECT 
  id,
  'OSs com mais de 10 dias',
  'OSs que estão há mais de 10 dias em qualquer etapa recebem prioridade alta',
  1,
  10,
  'alta'
FROM unidades
WHERE NOT EXISTS (
  SELECT 1 FROM regras_prioridade WHERE nome = 'OSs com mais de 10 dias'
);

INSERT INTO regras_prioridade (unidade_id, nome, descricao, ordem, dias_na_etapa_min, prioridade_resultado)
SELECT 
  id,
  'OSs com mais de 20 dias - URGENTE',
  'OSs que estão há mais de 20 dias recebem prioridade urgente',
  0,
  20,
  'urgente'
FROM unidades
WHERE NOT EXISTS (
  SELECT 1 FROM regras_prioridade WHERE nome = 'OSs com mais de 20 dias - URGENTE'
);

INSERT INTO regras_prioridade (unidade_id, nome, descricao, ordem, tipo_os, prioridade_resultado)
SELECT 
  id,
  'OSs LP têm prioridade alta',
  'Todos os atendimentos LP recebem prioridade alta por padrão',
  2,
  ARRAY['LP']::text[],
  'alta'
FROM unidades
WHERE NOT EXISTS (
  SELECT 1 FROM regras_prioridade WHERE nome = 'OSs LP têm prioridade alta'
);
