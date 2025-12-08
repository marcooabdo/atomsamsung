# Como Integrar o Sistema de Rotas na Página Otimizador

## Integração Simples

### Opção 1: Substituir Completamente

Se você quiser usar apenas o novo sistema com Google Maps, edite `src/pages/Otimizador.tsx`:

```tsx
import { IntegratedRouteOptimizer } from '../components/otimizador/IntegratedRouteOptimizer';
import { useAuth } from '../contexts/AuthContext';

export default function Otimizador() {
  const { user } = useAuth();

  if (!user) {
    return <div>Carregando...</div>;
  }

  return (
    <IntegratedRouteOptimizer
      unidadeId={user.unidade_id}
      usuarioId={user.id}
    />
  );
}
```

### Opção 2: Adicionar como Nova Aba

Se você quiser manter o sistema existente e adicionar o novo como opção:

```tsx
import { useState } from 'react';
import { IntegratedRouteOptimizer } from '../components/otimizador/IntegratedRouteOptimizer';
import { useAuth } from '../contexts/AuthContext';
// ... outros imports existentes

export default function Otimizador() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'atom' | 'google-maps'>('google-maps');

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('google-maps')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'google-maps'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Google Maps (Novo)
          </button>
          <button
            onClick={() => setActiveTab('atom')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'atom'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            ATOM (Legado)
          </button>
        </div>
      </div>

      {activeTab === 'google-maps' && user && (
        <IntegratedRouteOptimizer
          unidadeId={user.unidade_id}
          usuarioId={user.id}
        />
      )}

      {activeTab === 'atom' && (
        <div>
          {/* Seu código existente do ATOM aqui */}
        </div>
      )}
    </div>
  );
}
```

### Opção 3: Adicionar Link no Menu

Criar uma nova página separada em `src/pages/RotasGoogleMaps.tsx`:

```tsx
import { IntegratedRouteOptimizer } from '../components/otimizador/IntegratedRouteOptimizer';
import { useAuth } from '../contexts/AuthContext';

export default function RotasGoogleMaps() {
  const { user } = useAuth();

  if (!user) {
    return <div>Carregando...</div>;
  }

  return (
    <IntegratedRouteOptimizer
      unidadeId={user.unidade_id}
      usuarioId={user.id}
    />
  );
}
```

E adicionar a rota no `src/App.tsx`:

```tsx
import RotasGoogleMaps from './pages/RotasGoogleMaps';

// ... no Router
<Route path="/rotas-google-maps" element={<RotasGoogleMaps />} />
```

E no menu de navegação:

```tsx
<NavLink to="/rotas-google-maps">
  Rotas Google Maps
</NavLink>
```

## Usando Componentes Individuais

Se você preferir integrar componentes específicos ao invés do sistema completo:

### Apenas o Mapa:

```tsx
import { GoogleRouteMapViewer } from '../components/otimizador/GoogleRouteMapViewer';

<GoogleRouteMapViewer
  baseCoordinates={{ lat: -23.5505, lng: -46.6333 }}
  osData={osArray}
  polyline={polylineString}
  selectedOS={selectedOS}
  onOSClick={(os) => console.log('OS clicada:', os)}
  showCompleted={true}
/>
```

### Apenas o Painel de Controle:

```tsx
import { RouteControlPanel } from '../components/otimizador/RouteControlPanel';

<RouteControlPanel
  osSequence={osArray}
  onReorder={(newSequence) => console.log('Nova sequência:', newSequence)}
  onRemove={(osId) => console.log('Remover OS:', osId)}
  onToggleComplete={(osId, completed) => console.log('Toggle:', osId, completed)}
  onOSSelect={(os) => console.log('OS selecionada:', os)}
  selectedOS={selectedOS}
/>
```

### Apenas as Métricas:

```tsx
import { RouteMetrics } from '../components/otimizador/RouteMetrics';

<RouteMetrics
  metrics={optimizedRoute.metrics}
  lastCalculated={new Date().toISOString()}
  isCalculating={false}
/>
```

## Usando os Serviços Diretamente

### Google Maps Service:

```tsx
import { googleMapsService } from '../lib/googleMapsService';

// Verificar se está configurado
const isConfigured = googleMapsService.isConfigured();

// Calcular matriz de distâncias
const matrix = await googleMapsService.calculateDistanceMatrix(
  origins,
  destinations,
  { mode: 'driving', considerTraffic: true }
);

// Obter rota otimizada
const route = await googleMapsService.getOptimizedRoute(
  waypoints,
  startPoint,
  endPoint,
  { optimize: true }
);

// Geocodificar endereço
const coords = await googleMapsService.geocodeAddress('Av Paulista, 1000');

// Limpar cache
googleMapsService.clearCache();
```

### Route Kanban Sync Service:

```tsx
import { routeKanbanSync } from '../lib/routeKanbanSync';

// Buscar colunas de rota
const routes = await routeKanbanSync.getRouteColumns(unidadeId);

// Buscar OSs das rotas
const oss = await routeKanbanSync.getOSFromRoutes(unidadeId, ['rota_preta', 'rota_vermelha']);

// Marcar como concluída (move para fechar_os)
await routeKanbanSync.markOSAsCompleted(osId);

// Desfazer conclusão
await routeKanbanSync.markOSAsIncomplete(osId, 'rota_preta');

// Inscrever em mudanças
routeKanbanSync.subscribeToRouteChanges(unidadeId, (routes) => {
  console.log('Rotas atualizadas:', routes);
});
```

### Route Optimizer Service:

```tsx
import { routeOptimizer } from '../lib/routeOptimizerService';

// Otimizar rota
const result = await routeOptimizer.optimizeRoute(
  baseCoordinates,
  osArray,
  {
    mode: 'driving',
    avoid: 'tolls',
    considerTraffic: true,
    workdayStart: '08:00',
    workdayEnd: '18:00'
  }
);

// Salvar sessão
await routeOptimizer.saveSession(
  unidadeId,
  usuarioId,
  tecnicoId,
  rotasSelecionadas,
  osArray,
  result,
  config
);

// Carregar sessão
const session = await routeOptimizer.loadSession(unidadeId, usuarioId);

// Recalcular com nova sequência
const newResult = await routeOptimizer.recalculateRoute(
  baseCoordinates,
  newOsSequence,
  config
);
```

## Personalizações

### Customizar Cores dos Marcadores:

Edite `GoogleRouteMapViewer.tsx` e modifique os valores `fillColor`:

```tsx
icon={{
  path: google.maps.SymbolPath.CIRCLE,
  scale: 10,
  fillColor: '#ef4444', // Mude para sua cor preferida
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 2
}}
```

### Ajustar Configurações Padrão:

Edite `IntegratedRouteOptimizer.tsx` e modifique o estado inicial:

```tsx
const [config, setConfig] = useState<RouteConfig>({
  mode: 'driving',
  avoid: 'tolls', // Adicione evitar pedágios por padrão
  considerTraffic: true,
  workdayStart: '07:00', // Mude horário de início
  workdayEnd: '19:00', // Mude horário de fim
  lunchBreakMinutes: 90 // Aumente tempo de almoço
});
```

### Adicionar Validações Customizadas:

Antes de chamar `handleOptimize()`, adicione suas validações:

```tsx
const handleOptimize = async () => {
  // Validação customizada
  if (allOSs.length > 50) {
    setError('Máximo de 50 OSs por rota. Divida em múltiplas rotas.');
    return;
  }

  // Validação de distância máxima
  const totalDistance = calculateTotalDistance(allOSs);
  if (totalDistance > 200) {
    setError('Rota muito longa (>200km). Considere dividir.');
    return;
  }

  // Continue com otimização...
};
```

## Solução de Problemas de Integração

### Erro de TypeScript:

Se tiver erros de tipo, verifique se:
1. Todos os arquivos `.ts` e `.tsx` foram criados
2. Os imports estão corretos
3. Execute `npm run typecheck` para ver erros

### Google Maps não carrega:

1. Verifique se `VITE_GOOGLE_MAPS_API_KEY` está no `.env`
2. Reinicie o servidor (`npm run dev`)
3. Abra o console do navegador e veja erros

### OSs não aparecem:

1. Verifique se OSs têm `lat` e `lng` não-nulos
2. Confirme que `tipo_atendimento` é 'IH'
3. Veja se `coluna_kanban` está nas rotas selecionadas

### Build falha:

Execute `npm run build` e veja o erro específico. Comum:
- Import de arquivo que não existe
- Export/import incompatível (default vs named)
- Variável TypeScript não definida

---

**Dica**: Comece com a Opção 1 (substituição completa) para testar. Depois evolua para Opção 2 se precisar manter o legado.
