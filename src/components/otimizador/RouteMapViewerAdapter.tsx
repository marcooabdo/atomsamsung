import { RouteMapViewer } from './RouteMapViewer';
import type { Coordinates } from '../../lib/googleMapsService';
import type { OS } from '../../lib/routeKanbanSync';

interface LegacyRouteMapViewerProps {
  rota: any;
  unidadeConfig: {
    latitude: number | null;
    longitude: number | null;
    endereco_base: string | null;
  };
}

export default function RouteMapViewerAdapter({ rota, unidadeConfig }: LegacyRouteMapViewerProps) {
  console.log('=== RouteMapViewerAdapter Debug ===');
  console.log('Rota recebida:', rota);
  console.log('UnidadeConfig:', unidadeConfig);
  console.log('OS incluidas:', rota?.os_incluidas);

  if (!unidadeConfig?.latitude || !unidadeConfig?.longitude) {
    console.warn('Base não configurada - latitude ou longitude ausentes');
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
        <div className="text-center p-8">
          <p className="text-slate-600 font-medium mb-2">Base não configurada</p>
          <p className="text-sm text-slate-500">
            Configure as coordenadas da base nas configurações
          </p>
        </div>
      </div>
    );
  }

  if (!rota || !rota.os_incluidas || rota.os_incluidas.length === 0) {
    console.warn('Rota vazia ou sem OSs incluídas');
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
        <div className="text-center p-8">
          <p className="text-slate-600 font-medium mb-2">Nenhuma rota otimizada</p>
          <p className="text-sm text-slate-500">
            Selecione rotas e clique em "Otimizar" para começar
          </p>
        </div>
      </div>
    );
  }

  const baseCoordinates: Coordinates = {
    lat: unidadeConfig.latitude,
    lng: unidadeConfig.longitude
  };

  console.log('Base coordinates:', baseCoordinates);

  const osData: OS[] = rota.os_incluidas.map((os: any, index: number) => {
    const coords = os.coordenadas || { lat: os.lat, lng: os.lng };

    const lat = typeof coords.lat === 'string' ? parseFloat(coords.lat) : coords.lat;
    const lng = typeof coords.lng === 'string' ? parseFloat(coords.lng) : coords.lng;

    const endereco_completo = os.endereco ||
      `${os.cliente_logradouro || ''}, ${os.cliente_numero || ''} - ${os.cliente_bairro || ''}`.trim();

    console.log(`OS ${index + 1} (ordem: ${os.ordem_visita}):`, {
      id: os.os_id || os.id,
      numero_os: os.numero_os,
      cliente_nome: os.cliente_nome,
      cliente_cidade: os.cliente_cidade,
      coords_originais: coords,
      coords_convertidos: { lat, lng },
      endereco: endereco_completo,
      tipo_lat_convertido: typeof lat,
      tipo_lng_convertido: typeof lng,
      lat_valido: !isNaN(lat) && lat !== null && lat !== undefined,
      lng_valido: !isNaN(lng) && lng !== null && lng !== undefined,
      ordem_visita: os.ordem_visita,
      prioridade: os.prioridade,
      tipo_atendimento: os.tipo_atendimento
    });

    return {
      id: os.os_id || os.id,
      numero_os: os.numero_os || '',
      cliente_nome: os.cliente_nome || 'Cliente não informado',
      cliente_endereco: endereco_completo,
      cliente_cidade: os.cliente_cidade || '',
      cliente_cep: os.cliente_cep || '',
      lat: lat,
      lng: lng,
      coluna_kanban: os.coluna_kanban || '',
      tipo_atendimento: os.tipo_atendimento || 'IH',
      prioridade: os.prioridade || null,
      concluida: false
    };
  });

  console.log('osData final para o mapa:', osData);
  console.log('Quantidade de OSs:', osData.length);

  return (
    <div className="w-full h-[600px] rounded-lg overflow-hidden border-2 border-slate-300 shadow-lg">
      <RouteMapViewer
        baseCoordinates={baseCoordinates}
        osData={osData}
        polyline={rota.polyline}
        selectedOS={null}
        onOSClick={(os) => console.log('OS clicada:', os)}
        showCompleted={true}
      />
    </div>
  );
}
