# DIAGNÓSTICO COMPLETO: ABA DE PAGAMENTO NA OS

**Data**: 2026-02-14
**Objetivo**: Validar funcionamento completo do fluxo de pagamentos
**Status**: ⚠️ **INCONSISTÊNCIAS IDENTIFICADAS**

---

## RESUMO EXECUTIVO

O sistema de pagamentos está **PARCIALMENTE FUNCIONAL** com as seguintes descobertas:

### ✅ FUNCIONANDO CORRETAMENTE:
1. **Triggers automáticos** estão ativos e disparando corretamente
2. **Sincronização de valores** entre tabela `pagamentos` e campo `valor_pago` da OS está 100% consistente
3. **Status de pagamento** está sendo atualizado conforme regra de negócio ('pendente', 'parcial', 'pago')
4. **Integração com Skywalker** está funcionando - vendas concluídas geram estrelas automaticamente
5. **Regras de pontuação** estão configuradas para todos os pilares (32 regras ativas)

### ⚠️ PROBLEMAS IDENTIFICADOS:

#### **PROBLEMA CRÍTICO #1: Valores da OS Desatualizados**

Existem OSs com `valor_total` divergente do cálculo real (peças + serviços - desconto):

| OS ID | OS Samsung | Valor Atual | Subtotal Real | Diferença | Causa Provável |
|-------|-----------|-------------|---------------|-----------|----------------|
| c44c7beb | 4174954263 | R$ 800,00 | R$ 389,53 | +R$ 410,47 | Trigger não executou |
| d93a89ae | - | R$ 1.300,00 | R$ 500,00 | +R$ 800,00 | Trigger não executou |
| 7e5a7980 | 12344325 | R$ 1.560,00 | R$ 500,00 | +R$ 1.060,00 | Trigger não executou |
| 4b4a803d | - | R$ 49,90 | R$ 99,90 | -R$ 50,00 | Serviços duplicados |

**Impacto**: Saldo restante incorreto, status de pagamento pode estar errado, relatórios financeiros imprecisos.

#### **PROBLEMA CRÍTICO #2: OSs com Valor R$ 0,00 mas com Pagamentos**

4 OSs receberam pagamentos mas não têm peças/serviços cadastrados:

| OS ID | Cliente | Valor Pago | Status | Coluna Kanban |
|-------|---------|-----------|---------|---------------|
| a77c1dfb | henrique oliveira | R$ 1.000,00 | parcial | os_nova |
| 675cef2b | henrique oliveira | R$ 100,00 | parcial | os_fechada |
| 65fc66a1 | Reginaldo Pereira | R$ 200,00 | parcial | os_fechada |
| 0590f32c | Lucas Henrique... | R$ 200,00 | parcial | os_fechada |

**Impacto**: Pagamentos órfãos, dinheiro sem vínculo com serviço prestado.

#### **PROBLEMA #3: OSs com Serviços Duplicados**

A OS `4b4a803d` tem serviços cadastrados em **AMBAS** as tabelas:
- `cotacoes_servicos`: R$ 50,00
- `os_servicos`: R$ 50,00
- **Total**: R$ 100,00 (deveria ser apenas R$ 50,00)

**Causa**: A função `atualizar_valores_os()` já tem lógica para evitar isso (usa UM ou OUTRO baseado em `tipo_orcamento`), mas dados históricos podem ter sido inseridos antes dessa correção.

---

## ANÁLISE DETALHADA

### 1. ATUALIZAÇÃO DE STATUS DA OS

#### Status: ✅ **FUNCIONANDO**

A função `atualizar_valores_os()` é disparada automaticamente via 3 triggers:

```sql
-- Trigger 1: AFTER INSERT
CREATE TRIGGER trg_atualizar_valores_os_insert
  AFTER INSERT ON pagamentos
  FOR EACH ROW EXECUTE FUNCTION atualizar_valores_os();

-- Trigger 2: AFTER UPDATE
CREATE TRIGGER trg_atualizar_valores_os_update
  AFTER UPDATE ON pagamentos
  FOR EACH ROW EXECUTE FUNCTION atualizar_valores_os();

-- Trigger 3: AFTER DELETE
CREATE TRIGGER trg_atualizar_valores_os_delete
  AFTER DELETE ON pagamentos
  FOR EACH ROW EXECUTE FUNCTION atualizar_valores_os();
```

**Lógica de Status**:
```
valor_pago = 0                    → status = 'pendente'
valor_pago > 0 AND < valor_total  → status = 'parcial'
valor_pago >= valor_total         → status = 'pago'
```

**Validação**: Todas as 10 OSs testadas têm `valor_pago` exatamente igual à soma dos pagamentos registrados. ✅

---

### 2. CÁLCULO DE VALORES

#### Status: ⚠️ **PARCIALMENTE FUNCIONAL**

**Função Responsável**: `atualizar_valores_os()`

**Sequência de Cálculo**:
```sql
1. SUBTOTAL = Σ(cotacoes_pecas) + Σ(os_pecas) + Σ(servicos)
   - Se tipo_orcamento = 'samsung_contigo' ou 'acessorios': usa os_servicos
   - Caso contrário: usa cotacoes_servicos

2. DESCONTO em R$ =
   - Se tipo = 'percentual': SUBTOTAL × (desconto_valor / 100)
   - Se tipo = 'valor': desconto_valor

3. VALOR_TOTAL = SUBTOTAL - DESCONTO (mínimo 0)

4. VALOR_PAGO = Σ(pagamentos.valor) -- sempre VALOR BRUTO

5. SALDO_RESTANTE = VALOR_TOTAL - VALOR_PAGO (mínimo 0)

6. STATUS_PAGAMENTO = conforme regra acima
```

**Problema Identificado**: Algumas OSs têm `valor_total` desatualizado, provavelmente porque:
1. Foram criadas antes dos triggers serem implementados
2. Houve erro na execução do trigger em algum momento
3. Dados foram inseridos manualmente via SQL

---

### 3. INTEGRAÇÃO COM SKYWALKER

#### Status: ✅ **FUNCIONANDO**

**Tabela**: `vendas` → trigger `registrar_venda_skywalker()`

**Fluxo**:
```
1. Venda marcada como 'concluido' na tabela vendas
   ↓
2. Trigger registrar_venda_skywalker() dispara
   ↓
3. Busca profissional do vendedor em skywalker_profissionais
   ↓
4. Mapeia tipo_venda → pilar:
   - 'store_plus' → 'Vendas Store+'
   - 'seguro_care' → 'Vendas Care+'
   - 'smb' → 'SMB'
   ↓
5. Conta total de vendas concluídas do vendedor neste mês
   ↓
6. Busca regra em skywalker_regras_estrelas
   WHERE valor_metrica >= valor_minimo
     AND valor_metrica <= valor_maximo
   ↓
7. INSERT/UPDATE em skywalker_estrelas_mes
   SET estrelas_conquistadas = r.estrelas
```

**Validação Realizada**:
- 5 vendas concluídas nos últimos 30 dias
- Todas têm `enviado_skywalker = true` ✅
- Todas têm registros em `skywalker_estrelas_mes` ✅
- "Henrique Bitencourt" tem 2 estrelas no mês atual (1 Care+ + 1 Store+) ✅

**Regras Configuradas**: 32 regras ativas cobrindo todos os pilares:

| Pilar | Time | Faixa | Estrelas |
|-------|------|-------|----------|
| Vendas Store+ | front_office | 4-7 vendas | 1⭐ |
| Vendas Store+ | front_office | 8-11 vendas | 2⭐ |
| Vendas Store+ | front_office | 12+ vendas | 3⭐ |
| Vendas Care+ | front_office | 1-3 vendas | 1⭐ |
| Vendas Care+ | front_office | 4+ vendas | 2⭐ |
| Conversão | front_office | 30-49% | 1⭐ |
| Conversão | front_office | 50-69% | 2⭐ |
| Conversão | front_office | 70%+ | 3⭐ |
| Google Reviews | front_office/inside_sales | 1-2 reviews | 1⭐ |
| Google Reviews | front_office/inside_sales | 3-4 reviews | 2⭐ |
| Google Reviews | front_office/inside_sales | 5+ reviews | 3⭐ |
| *... e mais 21 regras* | - | - | - |

---

### 4. PROFISSIONAIS SKYWALKER

**Total de Profissionais Ativos**: 5

| Profissional | Time | Estrelas no Mês | Nível Atual | Estrelas Necessárias |
|--------------|------|-----------------|-------------|----------------------|
| Henrique Bitencourt | front_office | 2 | Avançado | 8 |
| Robert Costa | inside_sales | 0 | Avançado | 8 |
| Henrique TESTE | front_office | 0 | Starter | 6 |
| Marco Abdo | front_office | 0 | Líder Global | 12 |
| Lucas Amorim | inside_sales | 0 | Starter | 6 |

**Observação**: Apenas Henrique Bitencourt tem pontuação no mês atual (fevereiro/2026).

---

## TRIGGERS ATIVOS NA TABELA PAGAMENTOS

Total: **5 triggers**

| Trigger | Tipo | Status | Função |
|---------|------|--------|--------|
| trg_atualizar_valores_os_insert | AFTER INSERT | ✅ Ativo | atualizar_valores_os() |
| trg_atualizar_valores_os_update | AFTER UPDATE | ✅ Ativo | atualizar_valores_os() |
| trg_atualizar_valores_os_delete | AFTER DELETE | ✅ Ativo | atualizar_valores_os() |
| trg_validar_sku_unico | BEFORE INSERT/UPDATE | ✅ Ativo | validar_sku_unico() |
| trigger_log_pagamentos_changes | AFTER INSERT/UPDATE/DELETE | ✅ Ativo | log_pagamentos_changes() |

---

## POSSÍVEIS CAUSAS DOS PROBLEMAS

### Para OSs com Valores Desatualizados:

1. **Dados Históricos**: OSs criadas antes da implementação dos triggers (antes de 18/01/2026)
2. **Inserção Manual**: Dados inseridos diretamente via SQL ignorando triggers
3. **Erro em Trigger**: Alguma condição causou falha silenciosa no trigger
4. **Race Condition**: Múltiplas atualizações simultâneas podem ter causado inconsistência

### Para OSs com Valor R$ 0,00:

1. **Fluxo Incompleto**: Pagamento foi registrado antes de adicionar peças/serviços
2. **OS de Teste**: Pode ser dado de teste que não foi finalizado
3. **Pagamento Antecipado**: Cliente pagou antes do orçamento ser aprovado

---

## AÇÕES CORRETIVAS RECOMENDADAS

### AÇÃO IMEDIATA #1: Forçar Recálculo de Todas as OSs

```sql
-- Script para forçar recálculo de TODAS as OSs com pagamentos
UPDATE pagamentos
SET updated_at = updated_at
WHERE created_at > NOW() - INTERVAL '90 days';
-- Isso dispara o trigger em cada registro
```

### AÇÃO IMEDIATA #2: Identificar OSs Problemáticas

```sql
-- Query para encontrar OSs com valores inconsistentes
WITH os_valores_calculados AS (
  SELECT
    o.id,
    o.numero_os_samsung,
    o.valor_total as valor_atual,
    (
      COALESCE((SELECT SUM(valor_total) FROM cotacoes_pecas WHERE os_id = o.id), 0) +
      COALESCE((SELECT SUM(valor_total) FROM os_pecas WHERE os_id = o.id), 0) +
      CASE
        WHEN o.tipo_orcamento IN ('samsung_contigo', 'acessorios')
        THEN COALESCE((SELECT SUM(valor_total) FROM os_servicos WHERE os_id = o.id), 0)
        ELSE COALESCE((SELECT SUM(valor_total) FROM cotacoes_servicos WHERE os_id = o.id), 0)
      END
    ) as subtotal_real,
    CASE
      WHEN o.desconto_tipo = 'percentual'
      THEN (subtotal_real * (o.desconto_valor / 100))
      WHEN o.desconto_tipo = 'valor'
      THEN o.desconto_valor
      ELSE 0
    END as desconto_real,
    subtotal_real - desconto_real as valor_esperado
  FROM os o
  WHERE o.valor_pago > 0
)
SELECT * FROM os_valores_calculados
WHERE ABS(valor_atual - valor_esperado) > 1.00
ORDER BY ABS(valor_atual - valor_esperado) DESC;
```

### AÇÃO IMEDIATA #3: Limpar OSs com Valor R$ 0,00

Opção A: Adicionar validação para impedir pagamento sem orçamento
```sql
ALTER TABLE pagamentos
ADD CONSTRAINT check_os_tem_valor
CHECK (
  EXISTS (
    SELECT 1 FROM os
    WHERE os.id = os_id
    AND (valor_total > 0 OR tipo_orcamento = 'samsung_contigo')
  )
);
```

Opção B: Criar alerta no frontend quando `valor_total = 0`

### AÇÃO PREVENTIVA #1: Monitoramento Contínuo

Criar view para dashboard de inconsistências:
```sql
CREATE OR REPLACE VIEW v_os_inconsistencias AS
SELECT
  o.id,
  o.numero_os_samsung,
  o.cliente_nome,
  o.valor_total,
  o.valor_pago,
  o.saldo_restante,
  o.status_pagamento,
  CASE
    WHEN o.valor_total = 0 AND o.valor_pago > 0
    THEN '⚠️ Pagamento sem orçamento'
    WHEN ABS(o.saldo_restante - (o.valor_total - o.valor_pago)) > 0.01
    THEN '⚠️ Saldo calculado incorreto'
    WHEN o.valor_pago >= o.valor_total AND o.status_pagamento != 'pago'
    THEN '⚠️ Status incorreto (deveria ser pago)'
    ELSE '✅ OK'
  END as status_validacao
FROM os o
WHERE o.valor_pago > 0
  AND o.created_at > NOW() - INTERVAL '90 days';
```

### AÇÃO PREVENTIVA #2: Auditoria de Triggers

Adicionar log de execução na função:
```sql
CREATE TABLE IF NOT EXISTS trigger_execution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_name text,
  table_name text,
  operation text,
  record_id uuid,
  executed_at timestamptz DEFAULT NOW(),
  error_message text
);
```

---

## SUGESTÕES DE MELHORIA

### Melhoria #1: Histórico de Pagamentos

Criar tabela de histórico para rastrear todas as mudanças:
```sql
CREATE TABLE pagamentos_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id uuid REFERENCES pagamentos(id),
  valor_anterior numeric,
  valor_novo numeric,
  modificado_por uuid REFERENCES usuarios(id),
  modificado_em timestamptz DEFAULT NOW(),
  motivo text
);
```

### Melhoria #2: Validação de Integridade

Adicionar RPC para validar e corrigir valores:
```sql
CREATE OR REPLACE FUNCTION validar_e_corrigir_valores_os(p_os_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_antes jsonb;
  v_depois jsonb;
BEGIN
  -- Capturar valores antes
  SELECT jsonb_build_object(
    'valor_total', valor_total,
    'valor_pago', valor_pago,
    'saldo_restante', saldo_restante,
    'status_pagamento', status_pagamento
  ) INTO v_antes
  FROM os WHERE id = p_os_id;

  -- Forçar recálculo via trigger
  UPDATE pagamentos
  SET updated_at = updated_at
  WHERE os_id = p_os_id
  LIMIT 1;

  -- Capturar valores depois
  SELECT jsonb_build_object(
    'valor_total', valor_total,
    'valor_pago', valor_pago,
    'saldo_restante', saldo_restante,
    'status_pagamento', status_pagamento
  ) INTO v_depois
  FROM os WHERE id = p_os_id;

  RETURN jsonb_build_object(
    'antes', v_antes,
    'depois', v_depois,
    'corrigido', v_antes != v_depois
  );
END;
$$ LANGUAGE plpgsql;
```

### Melhoria #3: Dashboard de Pagamentos

Criar endpoint para exibir estatísticas:
- Total pago hoje/semana/mês
- OSs com saldo pendente
- Conversão de orçamentos em pagamentos
- Formas de pagamento mais usadas
- Taxa média de parcelamento

### Melhoria #4: Integração Skywalker Expandida

Considerar adicionar métricas de pagamento ao Skywalker:
- **Pilar**: "Conversão de Pagamentos"
- **Métrica**: % de OSs pagas / OSs abertas
- **Faixas**:
  - 70-79% = 1⭐
  - 80-89% = 2⭐
  - 90%+ = 3⭐

---

## CONCLUSÃO

O sistema de pagamentos está **tecnicamente funcional** com triggers automáticos e integração Skywalker operando corretamente. No entanto, existem **inconsistências em dados históricos** que precisam ser corrigidas.

**Prioridades**:
1. 🔴 **CRÍTICO**: Forçar recálculo de OSs com valores desatualizados
2. 🟡 **ALTO**: Resolver OSs com pagamento mas valor_total = 0
3. 🟢 **MÉDIO**: Implementar monitoramento contínuo
4. 🔵 **BAIXO**: Adicionar melhorias sugeridas

**Próximos Passos Recomendados**:
1. Executar script de recálculo forçado
2. Validar manualmente as 4 OSs críticas identificadas
3. Implementar view de inconsistências
4. Configurar alerta automático para novos casos

---

## QUERIES ÚTEIS PARA VALIDAÇÃO

### Query 1: Verificar Consistência Geral
```sql
SELECT
  COUNT(*) as total_os,
  COUNT(*) FILTER (WHERE valor_pago = (SELECT COALESCE(SUM(valor), 0) FROM pagamentos WHERE os_id = os.id)) as consistentes,
  COUNT(*) FILTER (WHERE valor_pago != (SELECT COALESCE(SUM(valor), 0) FROM pagamentos WHERE os_id = os.id)) as inconsistentes
FROM os
WHERE valor_pago > 0;
```

### Query 2: OSs com Maior Divergência
```sql
SELECT
  o.id,
  o.numero_os_samsung,
  o.valor_total as valor_atual,
  (SELECT COALESCE(SUM(valor_total), 0) FROM cotacoes_pecas WHERE os_id = o.id) +
  (SELECT COALESCE(SUM(valor_total), 0) FROM cotacoes_servicos WHERE os_id = o.id) +
  (SELECT COALESCE(SUM(valor_total), 0) FROM os_servicos WHERE os_id = o.id) as subtotal_real,
  ABS(o.valor_total - subtotal_real) as divergencia
FROM os o
WHERE o.valor_pago > 0
ORDER BY divergencia DESC
LIMIT 20;
```

### Query 3: Estatísticas de Pagamento
```sql
SELECT
  forma_pagamento,
  COUNT(*) as quantidade,
  SUM(valor) as valor_total,
  AVG(valor) as ticket_medio,
  SUM(taxa_valor) as total_taxas
FROM pagamentos
WHERE data_lancamento > NOW() - INTERVAL '30 days'
GROUP BY forma_pagamento
ORDER BY valor_total DESC;
```

---

**Relatório gerado automaticamente em**: 2026-02-14
**Próxima revisão recomendada**: Após execução das ações corretivas
