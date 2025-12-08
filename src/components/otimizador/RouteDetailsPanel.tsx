import {
  Clock,
  Navigation,
  TrendingDown,
  Calendar,
  AlertCircle,
  CheckCircle,
  MapPin,
} from 'lucide-react';

interface RouteDetailsPanelProps {
  rota: any;
}

export default function RouteDetailsPanel({ rota }: RouteDetailsPanelProps) {
  if (!rota || !rota.metricas) {
    return null;
  }

  const { metricas, os_incluidas, avisos } = rota;

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins.toString().padStart(2, '0')}m`;
  };

  const getViabilityStatus = () => {
    const diasNecessarios = metricas.dias_necessarios || 1;
    if (diasNecessarios === 1) {
      return {
        color: 'green',
        text: 'Rota viável em 1 dia',
        icon: CheckCircle,
      };
    } else if (diasNecessarios === 2) {
      return {
        color: 'yellow',
        text: `Rota requer ${diasNecessarios} dias`,
        icon: AlertCircle,
      };
    } else {
      return {
        color: 'red',
        text: `Rota requer ${diasNecessarios} dias`,
        icon: AlertCircle,
      };
    }
  };

  const viabilidade = getViabilityStatus();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Distância Total</p>
              <p className="text-3xl font-bold text-cyan-400 mt-1">
                {metricas.distancia_total_km.toFixed(1)} <span className="text-lg">km</span>
              </p>
            </div>
            <Navigation className="w-12 h-12 text-cyan-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Tempo Total</p>
              <p className="text-3xl font-bold text-purple-400 mt-1">
                {formatDuration(metricas.tempo_total_minutos)}
              </p>
            </div>
            <Clock className="w-12 h-12 text-purple-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Número de Paradas</p>
              <p className="text-3xl font-bold text-green-400 mt-1">{os_incluidas.length}</p>
            </div>
            <MapPin className="w-12 h-12 text-green-400 opacity-50" />
          </div>
        </div>

        <div className={`bg-gradient-to-br from-${viabilidade.color}-500/10 to-${viabilidade.color}-600/5 border border-${viabilidade.color}-500/20 rounded-xl p-6`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Viabilidade</p>
              <p className={`text-lg font-bold text-${viabilidade.color}-400 mt-1`}>
                {viabilidade.text}
              </p>
            </div>
            <viabilidade.icon className={`w-12 h-12 text-${viabilidade.color}-400 opacity-50`} />
          </div>
        </div>
      </div>

      {avisos && avisos.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <AlertCircle className="w-6 h-6 text-yellow-400" />
            <h3 className="text-lg font-bold text-yellow-400">Avisos</h3>
          </div>
          <ul className="list-disc list-inside space-y-2">
            {avisos.map((aviso: string, index: number) => (
              <li key={index} className="text-yellow-300 text-sm">
                {aviso}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-cyan-400" />
          Timeline de Atendimentos
        </h3>

        <div className="space-y-3">
          {os_incluidas.map((os: any, index: number) => (
            <div key={os.os_id} className="bg-gray-700/30 border border-gray-600 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-cyan-500/20 border-2 border-cyan-500/50 flex items-center justify-center text-cyan-400 font-bold text-lg flex-shrink-0">
                  {os.ordem_visita}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-white font-bold text-lg">{os.numero_os}</span>
                    {index === 0 && (
                      <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 text-xs">
                        Primeira Parada
                      </span>
                    )}
                    {index === os_incluidas.length - 1 && (
                      <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-400 text-xs">
                        Última Parada
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2">
                    <div>
                      <p className="text-gray-400 text-xs">Distância do Anterior</p>
                      <p className="text-white text-sm font-medium">
                        {os.distancia_anterior_km.toFixed(1)} km
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Tempo de Deslocamento</p>
                      <p className="text-white text-sm font-medium">
                        {os.tempo_deslocamento_minutos} min
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Chegada Prevista</p>
                      <p className="text-cyan-400 text-sm font-bold">
                        {formatTime(os.horario_chegada)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Conclusão Prevista</p>
                      <p className="text-green-400 text-sm font-bold">
                        {formatTime(os.horario_conclusao)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-gray-400 text-sm">Início da Jornada</p>
              <p className="text-blue-400 text-2xl font-bold mt-1">
                {metricas.horario_inicio}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Término Previsto</p>
              <p className="text-purple-400 text-2xl font-bold mt-1">
                {metricas.horario_fim}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Dias Necessários</p>
              <p className={`text-${viabilidade.color}-400 text-2xl font-bold mt-1`}>
                {metricas.dias_necessarios}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
