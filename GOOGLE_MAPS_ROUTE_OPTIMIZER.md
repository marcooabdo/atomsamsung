# Sistema de Otimização de Rotas com Google Maps - Documentação Completa

## Visão Geral

Sistema completo de otimização de rotas integrado ao Kanban, utilizando as APIs premium do Google Maps (Distance Matrix e Directions) para máxima precisão no cálculo de rotas.

## Funcionalidades Implementadas

### 1. Integração com Google Maps API

#### Arquivos Criados:
- `src/lib/googleMapsService.ts` - Serviço centralizado para todas as interações com Google Maps
- `.env.example` - Template com variáveis de ambiente necessárias

#### Funcionalidades:
- ✅ Distance Matrix API para cálculo preciso de distâncias
- ✅ Directions API para rotas otimizadas com polyline
- ✅ Geocoding API para converter endereços em coordenadas
- ✅ Sistema de cache inteligente (1 hora de validade)
- ✅ Rate limiting para respeitar limites da API
- ✅ Fallback para cálculo euclidiano quando API falhar
- ✅ Throttling de requisições paralelas (máximo 10 simultâneas)

### 2. Sincronização Bidirecional com Kanban

#### Arquivo:
- `src/lib/routeKanbanSync.ts`

#### Funcionalidades:
- ✅ Carrega rotas dinamicamente das colunas do Kanban
- ✅ Sincronização em tempo real com Supabase Realtime
- ✅ Ao marcar OS como concluída, move automaticamente para coluna "fechar_os"
- ✅ Conta OSs em cada coluna em tempo real
- ✅ Geocodificação automática de endereços de OSs

### 3. Motor de Otimização de Rotas

#### Arquivo:
- `src/lib/routeOptimizerService.ts`

#### Funcionalidades:
- ✅ Otimização usando Directions API do Google (waypoint optimization)
- ✅ Cálculo de tempo total considerando tráfego em tempo real
- ✅ Cálculo de distância total em quilômetros
- ✅ Estimativa de horários de chegada em cada ponto
- ✅ Suporte a configurações avançadas:
  - Modo de transporte (carro, moto, bicicleta)
  - Evitar pedágios/autoestradas
  - Consideração de tráfego
  - Horário de início/fim da jornada
  - Tempo de almoço

### 4. Persistência Temporária de Sessões

#### Tabela de Banco de Dados:
- `route_sessions` - Criada na migração

#### Funcionalidades:
- ✅ Salva estado da rota enquanto usuário está otimizando
- ✅ Auto-save a cada alteração
- ✅ Recupera sessão ao voltar à página
- ✅ Auto-limpeza após 24 horas
- ✅ Armazena: sequência de OSs, OSs concluídas, configurações, métricas, polyline

### 5. Componentes de Visualização

#### GoogleRouteMapViewer.tsx
- ✅ Mapa interativo com Google Maps
- ✅ Marcadores customizados:
  - Base da unidade (azul/ciano)
  - OSs pendentes (vermelho)
  - OSs concluídas (verde)
  - Marcador selecionado (borda amarela)
- ✅ Polyline da rota otimizada
- ✅ InfoWindow detalhada ao clicar
- ✅ Auto-zoom para enquadrar todos os pontos
- ✅ Legenda com contadores em tempo real

#### RouteControlPanel.tsx
- ✅ Lista ordenada de OSs com drag and drop
- ✅ Reordenação manual da sequência
- ✅ Botão de check para marcar como concluída
- ✅ Botão X para remover da rota
- ✅ Visual destaque para OS selecionada
- ✅ Badge de prioridade
- ✅ Indicadores visuais de conclusão
- ✅ Resumo com contadores

#### RouteMetrics.tsx
- ✅ Cards com métricas principais:
  - Distância total (km)
  - Tempo total (horas)
  - Quantidade de OSs
  - Progresso percentual
- ✅ Barra de progresso visual
- ✅ Horários de início e término previstos
- ✅ Timestamp da última atualização
- ✅ Indicador de recálculo em andamento

#### IntegratedRouteOptimizer.tsx
- ✅ Componente principal que integra tudo
- ✅ Seleção de múltiplas rotas do Kanban
- ✅ Layout responsivo com mapa e controles
- ✅ Botão "Otimizar Rota" para calcular
- ✅ Recálculo automático ao modificar sequência
- ✅ Tratamento de erros amigável
- ✅ Validações antes de otimizar

#### BaseConfigModal.tsx
- ✅ Modal para configurar coordenadas da base
- ✅ Geocodificação automática de endereço
- ✅ Entrada manual de coordenadas
- ✅ Validação de coordenadas
- ✅ Salvamento direto no banco

## Estrutura do Banco de Dados

### Migração: `add_google_maps_integration`

#### Alterações na Tabela `unidades`:
```sql
- lat_base (numeric) - Latitude da base
- lng_base (numeric) - Longitude da base
- endereco_completo (text) - Endereço formatado
```

#### Nova Tabela `route_sessions`:
```sql
- id (uuid)
- unidade_id (uuid)
- usuario_id (uuid)
- tecnico_id (uuid, nullable)
- rotas_selecionadas (text[])
- os_ids (uuid[])
- os_sequence (uuid[])
- os_completed (uuid[])
- config (jsonb)
- metrics (jsonb)
- polyline (text)
- last_calculated_at (timestamptz)
- expires_at (timestamptz) - Auto-limpa após 24h
```

#### Alterações na Tabela `os`:
```sql
- concluida (boolean) - Flag de conclusão
- concluida_em (timestamptz) - Timestamp de conclusão
- ordem_visita (integer) - Ordem na rota (temporário)
```

#### Funções Auxiliares:
- `limpar_sessoes_expiradas()` - Remove sessões antigas
- `get_os_from_routes()` - Busca OSs das rotas selecionadas

## Configuração

### 1. Configurar Google Maps API Key

Adicione no arquivo `.env`:
```
VITE_GOOGLE_MAPS_API_KEY=sua_chave_aqui
```

### 2. Ativar APIs no Google Cloud Console

Acesse https://console.cloud.google.com/google/maps-apis e ative:
- Maps JavaScript API
- Distance Matrix API
- Directions API
- Geocoding API

### 3. Configurar Coordenadas da Base

Na aplicação, acesse Configurações > Base da Unidade e:
- Digite o endereço completo
- Clique em "Buscar" para geocodificar automaticamente
- Ou insira lat/lng manualmente
- Salve a configuração

## Fluxo de Uso

### 1. Seleção de Rotas
1. Na página Otimizador, selecione uma ou mais rotas do Kanban
2. OSs dessas rotas são carregadas automaticamente
3. Apenas OSs com coordenadas válidas são incluídas

### 2. Otimização
1. Clique em "Otimizar Rota"
2. Sistema calcula rota ideal usando Google Directions API
3. Mapa exibe polyline da rota otimizada
4. Métricas são atualizadas em tempo real

### 3. Ajustes Manuais
1. Arraste e solte OSs para reordenar
2. Rota é recalculada automaticamente
3. Clique em X para remover OS da rota
4. Recalculo mantém otimização

### 4. Conclusão de OSs
1. Clique no ícone de check na OS
2. OS é marcada como concluída
3. No Kanban, OS move automaticamente para "fechar_os"
4. Marcador no mapa muda para verde
5. Métricas atualizam progresso

### 5. Persistência
- Sessão é salva automaticamente
- Ao voltar à página, estado é recuperado
- Sessão expira em 24 horas

## Validações e Alertas

### Validações Antes de Otimizar:
- ✅ Verifica se Google Maps API está configurada
- ✅ Verifica se base possui coordenadas
- ✅ Valida que há OSs selecionadas
- ✅ Filtra OSs sem coordenadas
- ✅ Alerta se rota ultrapassar horário de trabalho

### Tratamento de Erros:
- ✅ Fallback para cálculo euclidiano se API falhar
- ✅ Retry automático com backoff exponencial
- ✅ Mensagens claras de erro para o usuário
- ✅ Logs detalhados no console para debug

## Arquitetura Técnica

### Services (Camada de Lógica):
1. **googleMapsService** - Abstração de todas as APIs do Google
2. **routeKanbanSync** - Sincronização bidirecional com Kanban
3. **routeOptimizer** - Algoritmos de otimização e persistência

### Components (Camada de UI):
1. **GoogleRouteMapViewer** - Visualização do mapa
2. **RouteControlPanel** - Controle de sequência com drag-drop
3. **RouteMetrics** - Dashboard de métricas
4. **IntegratedRouteOptimizer** - Orquestrador principal
5. **BaseConfigModal** - Configuração da base

### Database (Camada de Dados):
1. **route_sessions** - Persistência temporária
2. **os** - Flags de conclusão e ordem
3. **unidades** - Coordenadas da base

## Performance e Otimizações

### Cache:
- ✅ Distance Matrix: Cache de 1 hora
- ✅ Geocoding: Cache de 24 horas
- ✅ Polylines: Cache de 1 hora

### Rate Limiting:
- ✅ Máximo 10 requisições paralelas
- ✅ Debounce em drag-drop
- ✅ Throttling de recálculos

### Otimizações:
- ✅ Lazy loading de marcadores (>50 OSs)
- ✅ Web Workers para cálculos pesados (preparado)
- ✅ IndexedDB para cache local (preparado)

## Diferencial Competitivo

### Vantagens sobre Soluções Básicas:
1. **Precisão Real**: Usa dados de tráfego em tempo real do Google
2. **Integração Nativa**: Sincronizado com Kanban automaticamente
3. **UX Profissional**: Interface estilo Waze corporativo
4. **Sem Limites**: Otimiza quantas OSs forem necessárias
5. **Persistência Inteligente**: Salva progresso automaticamente
6. **Reação em Tempo Real**: Mudanças no Kanban refletem instantaneamente

## Próximos Passos Sugeridos

### Funcionalidades Adicionais:
1. Modo de navegação estilo Waze com voz
2. Impressão de romaneio PDF
3. Compartilhamento de rota com técnico via WhatsApp
4. Histórico de rotas realizadas
5. Analytics de performance do técnico
6. Otimização multi-dia para rotas longas
7. Consideração de janelas de atendimento do cliente
8. Integração com Waze/Google Maps nativo para navegação

## Suporte e Manutenção

### Logs Importantes:
- Todos os erros de API são logados no console
- Sessões expiradas são limpas automaticamente
- Cache pode ser limpo: `googleMapsService.clearCache()`

### Monitoramento:
- Verifique uso de quota no Google Cloud Console
- Monitore performance no Supabase Dashboard
- Acompanhe tamanho do cache: `googleMapsService.getCacheSize()`

## Conclusão

Sistema completo e production-ready de otimização de rotas integrado ao Kanban, usando as melhores práticas e tecnologias do mercado. Pronto para escalar conforme necessidade do negócio.

---

**Data de Implementação**: Dezembro 2024
**Status**: ✅ Completo e Testado
**Build Status**: ✅ Passando
