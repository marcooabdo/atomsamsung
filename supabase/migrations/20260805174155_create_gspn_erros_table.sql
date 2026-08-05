/*
# Create gspn_erros table

## Purpose
Centralized error log for all GSPN processes (cron-leve, cron-pesado, refresh, busca-manual).
The backend writes here whenever any GSPN operation fails. The frontend subscribes
via Supabase Realtime to show instant toast notifications and provides a history view.

## New Tables
- `gspn_erros`
  - `id` (uuid, PK, auto-generated)
  - `processo` (text, not null) — which process failed: 'cron-leve' | 'cron-pesado' | 'refresh' | 'busca-manual'
  - `mensagem` (text, not null) — error message
  - `unidade_id` (uuid, nullable) — FK to unidades, if the error relates to a specific unit
  - `os_id` (uuid, nullable) — FK to os, if the error relates to a specific OS
  - `numero_os_samsung` (text, nullable) — Samsung OS number for display purposes
  - `criado_em` (timestamptz, not null, default now()) — when the error occurred

## Indexes
- `idx_gspn_erros_criado_em_desc` on criado_em DESC for efficient recent-first queries

## Security
- RLS enabled
- authenticated users can SELECT (read error history)
- service_role can INSERT (backend writes errors)

## Realtime
- Table added to supabase_realtime publication for live error notifications
*/

-- Create table
CREATE TABLE IF NOT EXISTS gspn_erros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo text NOT NULL,
  mensagem text NOT NULL,
  unidade_id uuid REFERENCES unidades(id) ON DELETE SET NULL,
  os_id uuid REFERENCES os(id) ON DELETE SET NULL,
  numero_os_samsung text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Index for recent-first queries
CREATE INDEX IF NOT EXISTS idx_gspn_erros_criado_em_desc ON gspn_erros (criado_em DESC);

-- Enable RLS
ALTER TABLE gspn_erros ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated can read, service_role can insert
DROP POLICY IF EXISTS "authenticated_select_gspn_erros" ON gspn_erros;
CREATE POLICY "authenticated_select_gspn_erros" ON gspn_erros
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "service_insert_gspn_erros" ON gspn_erros;
CREATE POLICY "service_insert_gspn_erros" ON gspn_erros
  FOR INSERT TO service_role WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE gspn_erros;
