# Status das Migrações do Banco de Dados

## Resumo

- **Total de arquivos**: 156 arquivos de migração
- **Aplicadas**: 51 migrações
- **Pendentes**: 142 migrações
- **Status**: ✅ Campo `samsung_asccode` aplicado com sucesso!

## Migrações Aplicadas (51)

1. ✅ Core schema (001-013)
2. ✅ Warehouse system (014-020)
3. ✅ Requisições e Cotações (021-030)
4. ✅ Foreign keys e policies (031-050)
5. ✅ Samsung fields - `samsung_asccode` e `samsung_token` ✅

## Migrações Pendentes Críticas (40)

### Sistema de Pagamentos (não aplicado)
- 054_create_payment_system.sql - **CRÍTICO**: Adiciona `valor_total`, `valor_pago`, `saldo_restante`
- 055_fix_payment_value_calculation.sql
- 060_add_payment_details_and_trigger.sql
- 061-062_populate_os_payment_values.sql
- 064_create_pagamentos_storage_bucket.sql
- 068-073_pagamentos fixes

### Campos Importantes na Tabela OS (não aplicados)
- ❌ `numero_tecnico` (usuarios) - 223_181022
- ❌ `tipo_orcamento` - 056
- ❌ `prioridade` - 207_091416
- ❌ `tipo_reparo` - 208_191417
- ❌ `latitude/longitude` - 207_092442
- ❌ `valor_total`, `valor_pago`, `saldo_restante` - 054

### Outros Sistemas Pendentes
- Sistema de rotas por unidade (051)
- Sistema de agendamentos (053)
- Sistema de chat (057-058)
- Sistema de performance e metas (228)
- Integrações Google Maps (207_173928)
- Configurações por unidade (207_051310)
- Samsung GSPN sync logs (223_015925)

## O que foi resolvido?

✅ **O erro do `samsung_asccode` foi corrigido!**
- Campo criado com sucesso na tabela `unidades`
- Tipo: `text`, nullable
- Migração aplicada: `20251229203620_20251223013411_add_samsung_fields_to_unidades.sql`

## Próximos Passos Recomendados

Para ter todas as funcionalidades do sistema, você precisa aplicar as 142 migrações pendentes:

1. **Urgente** (Sistema de Pagamentos):
   - Aplica 051-073 para ter controle financeiro completo

2. **Importante** (Campos essenciais):
   - Aplica as migrações sem número (configurações, prioridades)
   - Aplica 221-226 (campos Samsung adicionais na OS)

3. **Recomendado** (Funcionalidades extras):
   - Chat interno (057-058)
   - Performance/metas (228)
   - Google Maps (207_173928)

## Como aplicar as migrações restantes?

As migrações podem ser aplicadas manualmente usando o MCP tool `mcp__supabase__apply_migration`, lendo cada arquivo SQL e aplicando em ordem.

**Nota**: As migrações estão configuradas com `IF NOT EXISTS` e `DO $$ BEGIN...END $$` para serem idempotentes (podem ser reaplicadas sem causar erros).
