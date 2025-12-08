# Guia Rápido - Otimizador de Rotas

## Como Usar o Sistema de Otimização de Rotas

### Passo 1: Configurar a API do Google Maps

1. Acesse o arquivo `.env` na raiz do projeto
2. Adicione sua chave da API do Google Maps:
   ```
   VITE_GOOGLE_MAPS_API_KEY=SUA_CHAVE_AQUI
   ```
3. Se não tiver uma chave, obtenha em: https://console.cloud.google.com/google/maps-apis
4. Ative as seguintes APIs:
   - Maps JavaScript API
   - Distance Matrix API
   - Directions API
   - Geocoding API

### Passo 2: Configurar a Base da Unidade

1. Acesse **Configurações** no menu
2. Clique em **Configurar Base da Unidade**
3. Digite o endereço completo da sua unidade
4. Clique em **Buscar** para obter as coordenadas automaticamente
5. Ou insira a latitude e longitude manualmente
6. Clique em **Salvar Configuração**

### Passo 3: Usar o Otimizador

1. Acesse a página **Otimizador** no menu
2. Selecione uma ou mais rotas clicando nos botões coloridos no topo
3. As OSs dessas rotas aparecerão no painel lateral
4. Clique em **Otimizar Rota** para calcular a melhor sequência
5. O mapa mostrará:
   - 🔵 Base da unidade (ponto azul)
   - 🔴 OSs pendentes (pontos vermelhos)
   - 🟢 OSs concluídas (pontos verdes)
   - Linha azul mostrando a rota otimizada

### Passo 4: Ajustar a Rota

Você pode fazer ajustes manuais:

- **Reordenar**: Arraste e solte as OSs no painel lateral
- **Remover**: Clique no X para remover uma OS da rota
- **Marcar como concluída**: Clique no ícone de check
  - A OS será movida automaticamente para "fechar_os" no Kanban
  - O marcador no mapa ficará verde

Toda vez que você fizer uma alteração, a rota será recalculada automaticamente.

### Passo 5: Acompanhar Métricas

No painel de métricas você verá:
- **Distância Total**: Quilometragem total da rota
- **Tempo Total**: Tempo estimado incluindo tráfego
- **OSs**: Quantidade de paradas
- **Progresso**: Percentual de conclusão
- **Horários**: Início e término previstos da jornada

### Passo 6: Navegar

1. Clique em qualquer OS no mapa ou painel para ver detalhes
2. Use as informações para planejar sua rota
3. O sistema salva seu progresso automaticamente
4. Você pode sair e voltar - seu trabalho estará salvo

## Dicas Úteis

### ✅ Boas Práticas:
- Configure as coordenadas da base antes de começar
- Selecione apenas as rotas que você precisa otimizar hoje
- Marque OSs como concluídas conforme avançar
- Deixe o sistema recalcular automaticamente - não force mudanças constantes

### ⚠️ Atenção:
- OSs sem endereço ou coordenadas não aparecerão no otimizador
- A sessão expira após 24 horas de inatividade
- Mudanças no Kanban por outros usuários atualizam em tempo real
- Marcar OS como concluída move ela para "fechar_os" automaticamente

### 🔧 Resolução de Problemas:

**"Google Maps não configurado"**
- Verifique se adicionou a chave no .env
- Reinicie o servidor de desenvolvimento

**"Base não configurada"**
- Acesse Configurações e configure as coordenadas

**"Rota não está otimizando"**
- Verifique sua conexão com internet
- Confirme que as OSs têm coordenadas válidas

**"OSs desapareceram do otimizador"**
- Verifique se foram movidas de coluna no Kanban
- Apenas OSs nas rotas selecionadas aparecem

## Recursos Avançados

### Configurações de Rota:
- **Modo de transporte**: Carro (padrão), moto, bicicleta
- **Evitar**: Pedágios, autoestradas, balsas
- **Tráfego**: Considerar condições de tráfego em tempo real
- **Horários**: Personalizar início/fim da jornada e almoço

### Sincronização com Kanban:
- Sistema detecta automaticamente quando você cria/renomeia/deleta colunas de rota
- Badge mostra quantidade de OSs em cada coluna em tempo real
- Ao marcar como concluída, atualiza Kanban instantaneamente

### Persistência:
- Seu trabalho é salvo automaticamente a cada alteração
- Sessão fica ativa por 24 horas
- Você pode ter múltiplas otimizações simultâneas (uma por unidade)

## Suporte

Em caso de dúvidas ou problemas:
1. Verifique os logs no console do navegador (F12)
2. Confirme que todas as configurações estão corretas
3. Tente limpar o cache e recarregar a página
4. Entre em contato com o suporte técnico

---

**Última atualização**: Dezembro 2024
