# Sistema de Pipeline Automático - ATOM Core

## Visão Geral

O Sistema de Pipeline Automático é uma solução completa para movimentação automática de Ordens de Serviço (OS) no quadro Kanban. O sistema detecta eventos (como aprovação de orçamento, recebimento de peças, escolha de rotas) e executa movimentações automáticas baseadas em regras configuráveis.

## Características Principais

### ✨ Automação Inteligente
- Movimentação automática 24/7 sem intervenção manual
- Regras baseadas em tipo de OS, atendimento e condições específicas
- Desempate por tipo de regra garantindo ordem lógica de execução
- Suporte a recebimento parcial de peças

### 📊 Rastreabilidade Completa
- Histórico detalhado de todas as movimentações
- Logs mostrando se foi automática ou manual
- Auditoria de quem criou/modificou regras
- Métricas de eficiência do sistema

### 🎯 Gestão Flexível
- Interface visual para criar e gerenciar regras
- Possibilidade de ativar/desativar regras individualmente
- Bloqueio temporário de automação por OS
- Regras globais ou específicas por unidade

## Arquitetura do Sistema

### Banco de Dados

#### Tabelas Principais
1. **`pipeline_regras`** - Armazena regras de automação
2. **`pipeline_logs`** - Histórico de movimentações
3. **`pipeline_erros`** - Log de erros para debugging
4. **`pipeline_regras_audit`** - Auditoria de modificações em regras

#### Modificações em Tabelas Existentes
- **`os_pecas`**:
  - `quantidade_esperada` - Total esperado
  - `quantidade_recebida` - Quantidade já recebida
  - `data_entrada_total` - Quando completou o recebimento

- **`os`**:
  - `bloqueio_movimentacao_automatica` - Flag de bloqueio
  - `motivo_bloqueio` - Razão do bloqueio

- **`unidades`**:
  - `movimentacao_automatica_ativa` - Habilitar/desabilitar por unidade

#### Views
- **`vw_os_status_pecas`** - Status agregado das peças por OS
- **`vw_pipeline_eficiencia`** - Métricas de eficiência

### Funções PostgreSQL

1. **`fn_verificar_todas_pecas_recebidas`** - Verifica se todas as peças foram recebidas
2. **`fn_buscar_rota_por_cidade`** - Encontra rota baseada na cidade
3. **`fn_executar_movimentacao_pipeline`** - Executa a movimentação e registra log
4. **`fn_avaliar_condicoes_regra`** - Avalia se as condições de uma regra são atendidas
5. **`fn_processar_pipeline_automatico`** - Função principal de orquestração

### Triggers Automáticos

1. **`trg_os_coluna_mudanca`** - Dispara quando a coluna da OS muda
2. **`trg_os_pecas_recebimento`** - Dispara quando quantidade de peça é atualizada
3. **`trg_os_rota_escolhida`** - Dispara quando uma rota é selecionada manualmente
4. **`trg_pipeline_regras_updated_at`** - Atualiza timestamp de modificação
5. **`trg_audit_pipeline_regras`** - Registra auditoria de mudanças

## Regras Padrão por Tipo de OS

### Tipo IH (In-Home)

#### 1. Orçamento Aprovado → Aguardando Peça
- **Gatilho**: Coluna muda para `orcamento_aprovado`
- **Condições**: `tipo_atendimento = IH`
- **Destino**: `aguardando_peca`

#### 2. Aguardando Peça → Peça em Trânsito
- **Gatilho**: Peça é requisitada
- **Condições**: `tipo_atendimento = IH` E existe peça requisitada/em trânsito
- **Destino**: `peca_em_transito`

#### 3. Peça em Trânsito → Rota Específica
- **Gatilho**: Todas as peças recebidas E cidade cadastrada em rota
- **Condições**:
  - `tipo_atendimento = IH`
  - `todas_pecas_recebidas = true`
  - `cidade_cadastrada_em_rota = true`
- **Destino**: Coluna da rota encontrada (ex: `rota_preta`)
- **Ação adicional**: Atualiza campo `rota_id` na OS

#### 4. Peça em Trânsito → Disponível IH
- **Gatilho**: Todas as peças recebidas E cidade NÃO cadastrada em rota
- **Condições**:
  - `tipo_atendimento = IH`
  - `todas_pecas_recebidas = true`
  - `cidade_cadastrada_em_rota = false`
- **Destino**: `disponivel_ih`

#### 5. Escolha Manual de Rota (Disponível IH)
- **Gatilho**: Usuário seleciona rota no sistema
- **Condições**: `coluna_origem = disponivel_ih` E `rota_id` é preenchido
- **Destino**: Coluna da rota escolhida
- **Tipo**: Manual (registrado no log)

### Tipo CI (Carry-In)

#### 1. Orçamento Aprovado → Em Reparo CI (sem peças)
- **Gatilho**: Coluna muda para `orcamento_aprovado`
- **Condições**:
  - `tipo_atendimento = CI`
  - `requer_peca = false`
- **Destino**: `em_reparo_ci`

#### 2. Orçamento Aprovado → Aguardando Peça (com peças)
- **Gatilho**: Coluna muda para `orcamento_aprovado`
- **Condições**:
  - `tipo_atendimento = CI`
  - `requer_peca = true`
- **Destino**: `aguardando_peca`

#### 3. Aguardando Peça → Peça em Trânsito
- **Gatilho**: Peça é requisitada
- **Condições**: `tipo_atendimento = CI` E peças requisitadas
- **Destino**: `peca_em_transito`

#### 4. Peça em Trânsito → Em Reparo CI
- **Gatilho**: Todas as peças recebidas
- **Condições**:
  - `tipo_atendimento = CI`
  - `todas_pecas_recebidas = true`
- **Destino**: `em_reparo_ci`

### Tipo SC/ACC

#### 1. Peça Disponível → Aguardando Fechamento
- **Gatilho**: Coluna muda para `peca_disponivel`
- **Condições**: `tipo_os IN (SC, ACC)`
- **Destino**: `aguardando_fechamento`

### Tipo OW

OW segue as mesmas regras de IH ou CI dependendo do campo `tipo_atendimento`.

## Fluxo de Recebimento de Peças

### Entrada Parcial
1. Operador acessa "Recebimento de Peças" no módulo Estoque
2. Seleciona a peça e clica em "Entrada Parcial"
3. Informa quantidade recebida (ex: 2 de 5)
4. Sistema atualiza `quantidade_recebida`
5. OS permanece em "Peça em Trânsito"
6. Trigger verifica mas não executa movimentação (ainda faltam peças)

### Entrada Total
1. Operador clica em "Entrada Total"
2. Sistema registra recebimento completo
3. Atualiza `data_entrada_total`
4. Muda `status` da peça para `disponivel`
5. Trigger detecta que todas as peças foram recebidas
6. Sistema processa regras aplicáveis:
   - Se cidade está em rota → Move para rota
   - Se cidade não está em rota → Move para "Disponível IH"

## Interface de Gerenciamento

### Configurações > Regras Pipeline

Acesso: Menu Configurações > Tab "Regras Pipeline"

Permissões: Apenas usuários com tipo `master`, `diretoria` ou `gerente`

#### Funcionalidades

1. **Listagem de Regras**
   - Nome, tipo, origem, destino
   - Status (ativa/inativa)
   - Contador de execuções
   - Filtros por tipo e status

2. **Criar/Editar Regra**
   - Nome e descrição
   - Tipo de regra (orcamento_aprovado, pecas_recebidas, etc.)
   - Colunas origem e destino
   - Condições avançadas:
     - Tipos de OS (LP, OW, SC, ACC)
     - Tipo de atendimento (IH, CI)
     - Tipo de orçamento
     - Todas peças recebidas (sim/não)
     - Cidade em rota (sim/não)
     - Requer peça (sim/não)
   - Switch ativa/inativa

3. **Ações**
   - Ativar/desativar regra
   - Editar regra
   - Deletar regra
   - Ver histórico de execuções

## Componentes Criados

### Frontend

1. **`ConfiguracoesPipelineRegras.tsx`**
   - Interface completa de gestão de regras
   - CRUD de regras com validações
   - Filtros e busca

2. **`OSPipelineInfo.tsx`**
   - Componente para mostrar no modal da OS
   - Status das peças (progresso visual)
   - Histórico de movimentações
   - Diferenciação visual entre automática/manual

3. **`RecebimentoPecas.tsx`**
   - Interface de entrada de peças
   - Listagem de peças pendentes
   - Entrada parcial e total
   - Barra de progresso por peça

### Backend

1. **`pipelineEngine.ts`**
   - Biblioteca TypeScript completa
   - Funções para interagir com regras
   - Gestão de logs e erros
   - Funções de entrada de peças

## Casos Especiais

### Bloqueio Temporário
Administradores podem bloquear a automação de uma OS específica:
```typescript
await pipelineEngine.alternarBloqueioMovimentacao(osId, true, 'Caso especial - aguardar cliente');
```

### Devolução de Peças
- Devolução de peça NÃO aciona movimentação reversa
- Campo `devolvida_em` é apenas informativo
- Não altera `quantidade_recebida`

### Escolha Manual de Rota
Quando usuário escolhe rota manualmente em OS "Disponível IH":
1. Sistema atualiza campo `rota_id`
2. Trigger detecta mudança
3. Busca coluna da rota selecionada
4. Executa movimentação como tipo "manual"
5. Registra no log com nome do usuário

## Desempate de Regras

Quando múltiplas regras se aplicam, ordem de prioridade por tipo:
1. `escolha_rota` (mais alta prioridade)
2. `orcamento_aprovado`
3. `pecas_recebidas`
4. `peca_disponivel`
5. `custom` (mais baixa prioridade)

Dentro do mesmo tipo, regras mais antigas têm prioridade.

## Segurança e Permissões

### RLS (Row Level Security)

#### `pipeline_regras`
- SELECT: Usuários veem regras da sua unidade + regras globais (unidade_id = null)
- INSERT/UPDATE/DELETE: Apenas master, diretoria, gerente

#### `pipeline_logs`
- SELECT: Usuários veem logs de OS da sua unidade
- INSERT: Sistema pode inserir logs

#### `pipeline_erros`
- SELECT: Apenas admin
- INSERT: Sistema pode inserir erros

#### `pipeline_regras_audit`
- SELECT: Apenas admin
- INSERT: Sistema pode inserir auditoria

### Auditoria
Toda criação, edição ou exclusão de regra é registrada em `pipeline_regras_audit` com:
- ID da regra
- Ação (created, updated, deleted)
- Usuário responsável
- Dados anteriores e novos (em JSONB)
- Timestamp

## Métricas e Relatórios

### Eficiência do Pipeline
```typescript
const metricas = await pipelineEngine.buscarEficiencia('2024-01-01', '2024-12-31');
```

Retorna:
- Total de movimentações automáticas vs manuais
- OS distintas afetadas
- Regras distintas executadas
- Agrupado por data

### Logs por OS
```typescript
const historico = await pipelineEngine.buscarLogsOS(osId);
```

Retorna todas as movimentações da OS com:
- Coluna origem e destino
- Tipo (automática/manual)
- Regra aplicada
- Usuário (se manual)
- Data e hora

### Erros do Sistema
```typescript
const erros = await pipelineEngine.buscarErros(50);
```

Retorna últimos erros com:
- OS afetada
- Regra que falhou
- Mensagem de erro
- Stack trace completo

## Boas Práticas

### Criando Regras Personalizadas

1. **Seja específico**
   - Use condições claras e objetivas
   - Evite regras muito genéricas que possam conflitar

2. **Teste antes de ativar**
   - Crie a regra inativa
   - Teste manualmente o cenário
   - Ative quando confirmado

3. **Documente**
   - Use descrições claras
   - Explique o "porquê" da regra

4. **Monitore**
   - Acompanhe o contador de execuções
   - Verifique logs de erro
   - Ajuste condições se necessário

### Troubleshooting

#### Regra não está executando
1. Verifique se está ativa
2. Confirme se as condições são atendidas
3. Verifique se há bloqueio na OS
4. Confirme se automação está ativa na unidade

#### OS não está se movendo
1. Verifique campo `bloqueio_movimentacao_automatica`
2. Confirme que existe regra aplicável
3. Verifique logs de erro
4. Teste manualmente as condições

#### Peças não acionam movimentação
1. Confirme que `quantidade_recebida >= quantidade_esperada`
2. Verifique se todas as peças da OS foram recebidas
3. Confirme que existe regra com condição `todas_pecas_recebidas = true`

## API Reference

### pipelineEngine

```typescript
// Buscar regras
const regras = await pipelineEngine.buscarRegras(unidadeId?);

// Criar regra
const novaRegra = await pipelineEngine.criarRegra({
  nome: 'Minha Regra',
  tipo_regra: 'custom',
  coluna_origem: 'entrada',
  coluna_destino: 'triagem',
  condicoes: {},
  ativo: true
});

// Processar pipeline manualmente
await pipelineEngine.processar(osId, 'evento_teste');

// Registrar entrada de peça
await pipelineEngine.registrarEntradaParcial(pecaId, 3);
await pipelineEngine.registrarEntradaTotal(pecaId);

// Buscar status de peças
const status = await pipelineEngine.buscarStatusPecasOS(osId);

// Buscar logs
const logs = await pipelineEngine.buscarLogsOS(osId);

// Gerenciar bloqueio
await pipelineEngine.alternarBloqueioMovimentacao(osId, true, 'Motivo');
```

## Manutenção

### Limpeza de Logs Antigos
Recomenda-se criar uma rotina para arquivar logs antigos (>90 dias) em tabela histórica.

### Monitoramento de Erros
Configure alertas para quando houver mais de 10 erros em 1 hora.

### Revisão de Regras
Mensalmente, revise regras com:
- Baixa contagem de execuções (podem estar obsoletas)
- Alta taxa de erro (podem ter condições incorretas)

## Suporte e Contato

Para dúvidas ou problemas:
1. Consulte os logs de erro no sistema
2. Verifique a documentação técnica das funções
3. Entre em contato com a equipe de desenvolvimento

---

**Versão**: 1.0.0
**Data**: 2024
**Sistema**: ATOM Core
**Módulo**: Pipeline Automático
