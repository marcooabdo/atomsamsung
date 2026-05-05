/*
  # ATOM Compliance System

  1. New Tables
    - `compliance_ocorrencias` - Main occurrence record (dano, multa, extravio, outros)
      - id, unidade_id, titulo, categoria, data_ocorrencia, descricao, valor_total,
        tipo_deducao (folha/premiacao), status (aberto/em_pagamento/quitado), created_by, created_at
    - `compliance_responsaveis` - Employees responsible for each occurrence
      - id, ocorrencia_id, usuario_id, percentual, valor_devido, valor_pago
    - `compliance_parcelas` - Monthly installments per responsible
      - id, responsavel_id, numero_parcela, total_parcelas, mes_referencia, valor, deduzido, data_deducao
  
  2. Security
    - Enable RLS on all tables
    - Authenticated users within same unidade can view
    - Only administrador/master can insert/update/delete
*/

CREATE TABLE IF NOT EXISTS compliance_ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES unidades(id) ON DELETE SET NULL,
  titulo text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT 'outros',
  data_ocorrencia date NOT NULL DEFAULT CURRENT_DATE,
  descricao text DEFAULT '',
  valor_total numeric(12,2) NOT NULL DEFAULT 0,
  tipo_deducao text NOT NULL DEFAULT 'folha',
  status text NOT NULL DEFAULT 'aberto',
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id uuid NOT NULL REFERENCES compliance_ocorrencias(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  percentual numeric(5,2) NOT NULL DEFAULT 0,
  valor_devido numeric(12,2) NOT NULL DEFAULT 0,
  valor_pago numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  responsavel_id uuid NOT NULL REFERENCES compliance_responsaveis(id) ON DELETE CASCADE,
  numero_parcela int NOT NULL DEFAULT 1,
  total_parcelas int NOT NULL DEFAULT 1,
  mes_referencia date NOT NULL DEFAULT CURRENT_DATE,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  deduzido boolean NOT NULL DEFAULT false,
  data_deducao timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_ocorrencias_unidade ON compliance_ocorrencias(unidade_id);
CREATE INDEX IF NOT EXISTS idx_compliance_ocorrencias_status ON compliance_ocorrencias(status);
CREATE INDEX IF NOT EXISTS idx_compliance_responsaveis_ocorrencia ON compliance_responsaveis(ocorrencia_id);
CREATE INDEX IF NOT EXISTS idx_compliance_responsaveis_usuario ON compliance_responsaveis(usuario_id);
CREATE INDEX IF NOT EXISTS idx_compliance_parcelas_responsavel ON compliance_parcelas(responsavel_id);

ALTER TABLE compliance_ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_responsaveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_ocorrencias_select" ON compliance_ocorrencias FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = (SELECT auth.uid()) AND (u.tipo IN ('master','administrador') OR u.unidade_id = compliance_ocorrencias.unidade_id))
  );

CREATE POLICY "compliance_ocorrencias_insert" ON compliance_ocorrencias FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = (SELECT auth.uid()) AND u.tipo IN ('master','administrador','gerente'))
  );

CREATE POLICY "compliance_ocorrencias_update" ON compliance_ocorrencias FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = (SELECT auth.uid()) AND u.tipo IN ('master','administrador','gerente')))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = (SELECT auth.uid()) AND u.tipo IN ('master','administrador','gerente')));

CREATE POLICY "compliance_ocorrencias_delete" ON compliance_ocorrencias FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = (SELECT auth.uid()) AND u.tipo IN ('master','administrador')));

CREATE POLICY "compliance_responsaveis_select" ON compliance_responsaveis FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM compliance_ocorrencias o JOIN usuarios u ON u.id = (SELECT auth.uid())
      WHERE o.id = compliance_responsaveis.ocorrencia_id
        AND (u.tipo IN ('master','administrador') OR u.unidade_id = o.unidade_id OR compliance_responsaveis.usuario_id = u.id)
    )
  );

CREATE POLICY "compliance_responsaveis_insert" ON compliance_responsaveis FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = (SELECT auth.uid()) AND u.tipo IN ('master','administrador','gerente')));

CREATE POLICY "compliance_responsaveis_update" ON compliance_responsaveis FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = (SELECT auth.uid()) AND u.tipo IN ('master','administrador','gerente')))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = (SELECT auth.uid()) AND u.tipo IN ('master','administrador','gerente')));

CREATE POLICY "compliance_responsaveis_delete" ON compliance_responsaveis FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = (SELECT auth.uid()) AND u.tipo IN ('master','administrador')));

CREATE POLICY "compliance_parcelas_select" ON compliance_parcelas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM compliance_responsaveis r
      JOIN compliance_ocorrencias o ON o.id = r.ocorrencia_id
      JOIN usuarios u ON u.id = (SELECT auth.uid())
      WHERE r.id = compliance_parcelas.responsavel_id
        AND (u.tipo IN ('master','administrador') OR u.unidade_id = o.unidade_id OR r.usuario_id = u.id)
    )
  );

CREATE POLICY "compliance_parcelas_insert" ON compliance_parcelas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = (SELECT auth.uid()) AND u.tipo IN ('master','administrador','gerente')));

CREATE POLICY "compliance_parcelas_update" ON compliance_parcelas FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = (SELECT auth.uid()) AND u.tipo IN ('master','administrador','gerente')))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = (SELECT auth.uid()) AND u.tipo IN ('master','administrador','gerente')));

CREATE POLICY "compliance_parcelas_delete" ON compliance_parcelas FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = (SELECT auth.uid()) AND u.tipo IN ('master','administrador')));
