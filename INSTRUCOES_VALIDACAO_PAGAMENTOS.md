# INSTRUÇÕES: VALIDAÇÃO E CORREÇÃO DE PAGAMENTOS

**Objetivo**: Guia prático para validar e corrigir o sistema de pagamentos da OS.

---

## 1. REVISÃO DO DIAGNÓSTICO

Leia o arquivo **DIAGNOSTICO_PAGAMENTOS_OS.md** para entender:
- Status atual do sistema
- Problemas identificados
- Análise técnica detalhada

**Resumo dos Problemas**:
- 4 OSs com valores desatualizados (divergência > R$ 400)
- 4 OSs com pagamentos mas sem orçamento (valor_total = R$ 0)
- Triggers estão funcionando, mas dados históricos estão inconsistentes

---

## 2. VALIDAÇÃO MANUAL NO SUPABASE

### Passo 1: Verificar Inconsistências

Abra o **SQL Editor** no Supabase e execute:

```sql
-- Ver todas as OSs com problemas
SELECT * FROM v_os_inconsistencias
WHERE status_validacao != 'OK'
ORDER BY divergencia_valor DESC;
```

**Esperado**: Lista de OSs problemáticas com detalhes da divergência.

### Passo 2: Estatísticas Gerais

```sql
SELECT
  COUNT(*) as total_os_com_pagamento,
  COUNT(*) FILTER (WHERE status_validacao = 'OK') as os_ok,
  COUNT(*) FILTER (WHERE status_validacao != 'OK') as os_com_problema
FROM v_os_inconsistencias;
```

### Passo 3: Verificar Triggers Ativos

```sql
SELECT
  tgname as trigger_name,
  tgenabled as status,
  pg_get_triggerdef(oid) as definicao
FROM pg_trigger
WHERE tgrelid = 'pagamentos'::regclass
  AND tgname LIKE '%atualizar_valores%';
```

**Esperado**: 3 triggers ativos (insert, update, delete).

---

## 3. CORREÇÃO AUTOMÁTICA

### Opção A: Corrigir Todas as OSs de Uma Vez

**⚠️ ATENÇÃO**: Isso vai recalcular TODAS as OSs com inconsistências.

```sql
-- Executar correção automática
SELECT * FROM corrigir_todas_os_inconsistentes();
```

**Resultado Esperado**:
```
| os_id | numero_os | status_antes | status_depois | valor_antes | valor_depois | corrigido |
|-------|-----------|--------------|---------------|-------------|--------------|-----------|
| uuid1 | 4174...   | parcial      | pago          | 800.00      | 389.53       | true      |
| uuid2 | null      | parcial      | parcial       | 1300.00     | 500.00       | true      |
```

### Opção B: Corrigir Uma OS Específica

```sql
-- Corrigir apenas uma OS (mais seguro para testar)
SELECT validar_e_corrigir_valores_os('c44c7beb-98d8-473c-8c01-d3f906845405');
```

**Resultado**:
```json
{
  "os_id": "c44c7beb-98d8-473c-8c01-d3f906845405",
  "antes": {
    "valor_total": 800.00,
    "valor_pago": 0.00,
    "saldo_restante": 800.00,
    "status_pagamento": "pendente"
  },
  "depois": {
    "valor_total": 389.53,
    "valor_pago": 0.00,
    "saldo_restante": 389.53,
    "status_pagamento": "pendente"
  },
  "foi_corrigido": true,
  "executado_em": "2026-02-14T..."
}
```

### Opção C: Forçar Recálculo de Todas OSs (Últimos 90 Dias)

**⚠️ CUIDADO**: Isso vai forçar o recálculo de CENTENAS de OSs. Só use se necessário!

```sql
DO $$
DECLARE
  v_os record;
  v_count integer := 0;
BEGIN
  FOR v_os IN
    SELECT DISTINCT os_id
    FROM pagamentos
    WHERE created_at > NOW() - INTERVAL '90 days'
  LOOP
    PERFORM atualizar_valores_os_direto(v_os.os_id);
    v_count := v_count + 1;

    -- Log a cada 100 OSs
    IF v_count % 100 = 0 THEN
      RAISE NOTICE 'Processadas: % OSs', v_count;
    END IF;
  END LOOP;

  RAISE NOTICE 'CONCLUÍDO: % OSs recalculadas', v_count;
END $$;
```

---

## 4. VALIDAÇÃO PÓS-CORREÇÃO

### Verificar se Problemas Foram Resolvidos

```sql
-- Deve retornar 0 OSs com problema
SELECT COUNT(*) as oss_ainda_com_problema
FROM v_os_inconsistencias
WHERE status_validacao != 'OK';
```

### Comparar Antes e Depois

```sql
-- OSs corrigidas com maior impacto
SELECT
  numero_os_samsung,
  cliente_nome,
  valor_total,
  subtotal_real,
  ABS(valor_total - subtotal_real + desconto_real) as diferenca,
  status_validacao
FROM v_os_inconsistencias
WHERE ABS(valor_total - subtotal_real + desconto_real) < 1.00
ORDER BY valor_total DESC
LIMIT 10;
```

---

## 5. TESTE DE NOVO PAGAMENTO

Para garantir que o sistema está funcionando corretamente, faça um teste:

### 5.1 Criar OS de Teste

1. Acesse **Pipeline Operacional → OW**
2. Clique em **+ Nova OS**
3. Preencha:
   - Cliente: "Teste Pagamento"
   - Defeito: "Teste de validação"
4. Adicione 1 serviço de R$ 100,00
5. Salve a OS

### 5.2 Registrar Pagamento

1. Acesse a aba **Pagamento**
2. Clique em **Adicionar Pagamento**
3. Preencha:
   - Forma: PIX
   - Valor: R$ 50,00
4. Salve

### 5.3 Validar Atualização Automática

Execute no SQL Editor:

```sql
-- Buscar a OS de teste
SELECT
  id,
  cliente_nome,
  valor_total,
  valor_pago,
  saldo_restante,
  status_pagamento
FROM os
WHERE cliente_nome = 'Teste Pagamento'
ORDER BY created_at DESC
LIMIT 1;
```

**Resultado Esperado**:
```
valor_total: 100.00
valor_pago: 50.00
saldo_restante: 50.00
status_pagamento: 'parcial'
```

### 5.4 Adicionar Segundo Pagamento

1. Adicione mais R$ 50,00 via PIX
2. Valide novamente:

```sql
SELECT
  id,
  cliente_nome,
  valor_total,
  valor_pago,
  saldo_restante,
  status_pagamento
FROM os
WHERE cliente_nome = 'Teste Pagamento'
ORDER BY created_at DESC
LIMIT 1;
```

**Resultado Esperado**:
```
valor_total: 100.00
valor_pago: 100.00
saldo_restante: 0.00
status_pagamento: 'pago'  ✅
```

### 5.5 Limpar Teste

```sql
-- Deletar OS de teste
DELETE FROM os WHERE cliente_nome = 'Teste Pagamento';
```

---

## 6. VALIDAÇÃO DO SKYWALKER

### 6.1 Verificar Vendas Sincronizadas

```sql
SELECT
  v.numero_venda,
  v.tipo_venda,
  v.status,
  u.nome as vendedor,
  v.enviado_skywalker,
  v.data_envio_skywalker
FROM vendas v
JOIN usuarios u ON u.id = v.vendedor_id
WHERE v.created_at > NOW() - INTERVAL '30 days'
ORDER BY v.created_at DESC;
```

**Esperado**: Todas as vendas com `status = 'concluido'` devem ter `enviado_skywalker = true`.

### 6.2 Verificar Estrelas Calculadas

```sql
SELECT
  u.nome as profissional,
  p.time,
  pi.nome as pilar,
  em.valor_metrica,
  em.estrelas_conquistadas,
  em.mes_referencia
FROM skywalker_estrelas_mes em
JOIN skywalker_profissionais p ON p.id = em.profissional_id
JOIN usuarios u ON u.id = p.usuario_id
JOIN skywalker_pilares pi ON pi.id = em.pilar_id
WHERE em.mes_referencia = date_trunc('month', NOW())::date
ORDER BY u.nome, pi.nome;
```

### 6.3 Total de Estrelas por Profissional

```sql
SELECT
  u.nome,
  p.time,
  SUM(em.estrelas_conquistadas) as total_estrelas,
  n.nome as nivel_atual,
  n.estrelas_necessarias
FROM skywalker_profissionais p
JOIN usuarios u ON u.id = p.usuario_id
LEFT JOIN skywalker_estrelas_mes em ON em.profissional_id = p.id
  AND em.mes_referencia = date_trunc('month', NOW())::date
LEFT JOIN skywalker_niveis n ON n.id = p.nivel_atual_id
WHERE p.ativo = true
GROUP BY p.id, u.nome, p.time, n.nome, n.estrelas_necessarias
ORDER BY total_estrelas DESC NULLS LAST;
```

---

## 7. MONITORAMENTO CONTÍNUO

### Criar Alerta de Inconsistências

Configure um alerta diário para verificar:

```sql
-- Query para executar diariamente
SELECT
  status_validacao,
  COUNT(*) as quantidade
FROM v_os_inconsistencias
GROUP BY status_validacao
HAVING status_validacao != 'OK';
```

Se retornar algum resultado, investigar.

### Dashboard de Pagamentos

Adicione ao dashboard:

```sql
-- Estatísticas do dia
SELECT
  COUNT(*) as pagamentos_hoje,
  SUM(valor) as total_recebido,
  AVG(valor) as ticket_medio,
  COUNT(DISTINCT os_id) as oss_pagas
FROM pagamentos
WHERE DATE(data_lancamento) = CURRENT_DATE;

-- Formas de pagamento (últimos 30 dias)
SELECT
  forma_pagamento,
  COUNT(*) as quantidade,
  ROUND(SUM(valor), 2) as valor_total,
  ROUND(AVG(valor), 2) as ticket_medio
FROM pagamentos
WHERE data_lancamento > NOW() - INTERVAL '30 days'
GROUP BY forma_pagamento
ORDER BY valor_total DESC;

-- OSs com saldo pendente
SELECT
  COUNT(*) as total_com_saldo,
  SUM(saldo_restante) as saldo_total_pendente
FROM os
WHERE saldo_restante > 0
  AND coluna_kanban NOT IN ('os_fechada', 'os_cancelada');
```

---

## 8. TRATAMENTO DE CASOS ESPECIAIS

### Caso 1: OS com Pagamento mas Sem Orçamento (valor_total = 0)

**Identificação**:
```sql
SELECT * FROM v_os_inconsistencias
WHERE status_validacao LIKE '%Pagamento sem orcamento%';
```

**Resolução**:
1. Abrir a OS no sistema
2. Verificar se deve ter peças/serviços cadastrados
3. Se sim: adicionar itens e o valor será recalculado automaticamente
4. Se não: pode ser pagamento antecipado ou cortesia (deixar como está)

### Caso 2: OS com Valor Pago > Valor Total

**Identificação**:
```sql
SELECT
  id,
  numero_os_samsung,
  cliente_nome,
  valor_total,
  valor_pago,
  valor_pago - valor_total as excedente
FROM os
WHERE valor_pago > valor_total AND valor_total > 0
ORDER BY excedente DESC;
```

**Resolução**:
- Pode ser troco do cliente
- Verificar se deve criar um crédito
- Ou ajustar o valor_total caso esteja incorreto

### Caso 3: Pagamento Duplicado

**Identificação**:
```sql
SELECT
  os_id,
  forma_pagamento,
  valor,
  nsu,
  COUNT(*) as duplicatas
FROM pagamentos
GROUP BY os_id, forma_pagamento, valor, nsu
HAVING COUNT(*) > 1;
```

**Resolução**:
- Verificar se é duplicata real
- Deletar o registro duplicado
- O trigger recalculará automaticamente

---

## 9. CHECKLIST DE VALIDAÇÃO COMPLETA

Use este checklist para validar toda a funcionalidade:

### Frontend (Interface)

- [ ] Abrir aba "Pagamento" de uma OS
- [ ] Visualizar lista de pagamentos existentes
- [ ] Adicionar novo pagamento (PIX)
- [ ] Verificar se saldo foi atualizado instantaneamente
- [ ] Verificar se status mudou de "pendente" para "parcial"
- [ ] Adicionar desconto na OS
- [ ] Verificar se saldo foi recalculado com desconto
- [ ] Adicionar pagamento restante
- [ ] Verificar se status mudou para "pago"
- [ ] Editar valor de um pagamento
- [ ] Verificar se saldo foi recalculado
- [ ] Excluir um pagamento
- [ ] Verificar se saldo voltou ao valor anterior

### Backend (Banco de Dados)

- [ ] Executar: `SELECT * FROM v_os_inconsistencias WHERE status_validacao != 'OK'`
- [ ] Resultado esperado: 0 linhas (ou justificar cada uma)
- [ ] Verificar triggers ativos em `pagamentos`
- [ ] Validar que função `atualizar_valores_os()` existe e está correta
- [ ] Testar função `validar_e_corrigir_valores_os()` em uma OS
- [ ] Verificar logs de auditoria (se implementado)

### Skywalker (Pontuação)

- [ ] Registrar uma venda com status "concluido"
- [ ] Verificar se `enviado_skywalker = true`
- [ ] Validar que estrelas foram calculadas
- [ ] Consultar `skywalker_estrelas_mes` para o vendedor
- [ ] Confirmar que valor_metrica e estrelas_conquistadas estão corretos
- [ ] Verificar se total de estrelas bate com as regras configuradas

### Relatórios

- [ ] Gerar relatório de pagamentos do mês
- [ ] Validar se valores batem com soma da tabela `pagamentos`
- [ ] Verificar relatório de OSs pagas vs pendentes
- [ ] Confirmar que filtros por forma de pagamento funcionam
- [ ] Exportar para Excel e validar dados

---

## 10. SOLUÇÃO DE PROBLEMAS COMUNS

### Problema: Trigger não está disparando

**Sintomas**: Adiciono pagamento mas `valor_pago` não atualiza.

**Solução**:
```sql
-- Verificar se triggers estão habilitados
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgrelid = 'pagamentos'::regclass;

-- Se estiverem desabilitados, habilitar:
ALTER TABLE pagamentos ENABLE TRIGGER ALL;
```

### Problema: Valores não batem após correção

**Sintomas**: Executei correção mas valores ainda estão errados.

**Solução**:
```sql
-- Forçar recálculo direto
SELECT atualizar_valores_os_direto('UUID-DA-OS');

-- Se ainda não funcionar, verificar dados das tabelas:
SELECT * FROM cotacoes_pecas WHERE os_id = 'UUID-DA-OS';
SELECT * FROM cotacoes_servicos WHERE os_id = 'UUID-DA-OS';
SELECT * FROM os_servicos WHERE os_id = 'UUID-DA-OS';
SELECT * FROM pagamentos WHERE os_id = 'UUID-DA-OS';
```

### Problema: Skywalker não está calculando estrelas

**Sintomas**: Venda marcada como concluída mas sem estrelas.

**Solução**:
```sql
-- Verificar se profissional existe
SELECT * FROM skywalker_profissionais
WHERE usuario_id = (SELECT vendedor_id FROM vendas WHERE id = 'UUID-VENDA');

-- Verificar se regra existe para o pilar
SELECT * FROM skywalker_regras_estrelas
WHERE pilar_id = (SELECT id FROM skywalker_pilares WHERE nome = 'Vendas Store+')
  AND ativo = true;

-- Forçar recálculo manual
SELECT calcular_estrelas_profissional(
  (SELECT id FROM skywalker_profissionais WHERE usuario_id = 'UUID-USUARIO'),
  date_trunc('month', NOW())::date
);
```

---

## 11. CONTATO E SUPORTE

Se após seguir todos os passos ainda houver problemas:

1. Documente o erro com prints
2. Execute as queries de diagnóstico
3. Salve os resultados
4. Entre em contato com a equipe técnica

**Queries de Diagnóstico Completo**:
```sql
-- 1. Status geral
SELECT * FROM v_os_inconsistencias LIMIT 100;

-- 2. Triggers ativos
SELECT * FROM pg_trigger WHERE tgrelid IN ('pagamentos'::regclass, 'os'::regclass);

-- 3. Últimos pagamentos
SELECT * FROM pagamentos ORDER BY created_at DESC LIMIT 20;

-- 4. Skywalker: últimas vendas
SELECT * FROM vendas ORDER BY created_at DESC LIMIT 20;

-- 5. Skywalker: estrelas do mês
SELECT * FROM skywalker_estrelas_mes
WHERE mes_referencia = date_trunc('month', NOW())::date;
```

---

**Última atualização**: 2026-02-14
**Versão do documento**: 1.0
