import {
  Clock,
  MapPin,
  Home,
  ArrowRight,
  Sun,
  Moon,
  Navigation2,
  Timer,
  Calendar,
} from 'lucide-react';

interface TripSummaryProps {
  rota: any;
  pontoBase: { lat: number; lng: number; endereco: string };
}

export default function TripSummary({ rota, pontoBase }: TripSummaryProps) {
  if (!rota || !rota.metricas || !rota.os_incluidas || rota.os_incluidas.length === 0) {
    return null;
  }

  const { metricas, os_incluidas } = rota;

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h${mins > 0 ? mins.toString().padStart(2, '0') + 'm' : ''}`;
    }
    return `${mins}m`;
  };

  const calcularTempoRetorno = () => {
    if (os_incluidas.length === 0) return 0;
    const ultimaOS = os_incluidas[os_incluidas.length - 1];
    const horarioConclusao = new Date(ultimaOS.horario_conclusao);
    const horarioFim = new Date(horarioConclusao);
    horarioFim.setHours(parseInt(metricas.horario_fim.split(':')[0]));
    horarioFim.setMinutes(parseInt(metricas.horario_fim.split(':')[1]));
    return Math.round((horarioFim.getTime() - horarioConclusao.getTime()) / 60000);
  };

  const tempoRetorno = calcularTempoRetorno();

  const getDayIndicator = (index: number) => {
    const minutosDisponiveis = 480;
    let tempoAcumulado = 0;
    for (let i = 0; i <= index; i++) {
      const os = os_incluidas[i];
      tempoAcumulado += os.tempo_deslocamento_minutos + 60;
    }
    return Math.ceil(tempoAcumulado / minutosDisponiveis);
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Navigation2 className="w-6 h-6 text-cyan-400" />
        <h3 className="text-xl font-bold text-white">Resumo Detalhado da Viagem</h3>
      </div>

      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/5 border-l-4 border-blue-500 rounded-lg p-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Home className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-white font-bold text-lg">Partida - Base da Unidade</h4>
                <div className="flex items-center gap-2 bg-blue-500/20 px-3 py-1 rounded-full">
                  <Sun className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-400 font-bold text-lg">{metricas.horario_inicio}</span>
                </div>
              </div>
              <p className="text-gray-400 text-sm">{pontoBase.endereco}</p>
            </div>
          </div>
        </div>

        {os_incluidas.map((os: any, index: number) => {
          const dia = getDayIndicator(index);
          const proximoDia = index > 0 ? getDayIndicator(index - 1) : 1;
          const mudouDia = dia !== proximoDia;

          return (
            <div key={os.os_id}>
              {mudouDia && (
                <div className="flex items-center gap-3 py-4">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
                  <div className="flex items-center gap-2 bg-purple-500/20 px-4 py-2 rounded-full border border-purple-500/30">
                    <Moon className="w-5 h-5 text-purple-400" />
                    <span className="text-purple-400 font-bold">Pernoite - Dia {dia}</span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
                </div>
              )}

              <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500/50 to-transparent"></div>

                <div className="ml-16 mb-3 bg-gray-700/30 border border-gray-600/50 rounded-lg p-3">
                  <div className="flex items-center gap-3 text-gray-400 text-sm mb-2">
                    <Timer className="w-4 h-4" />
                    <span>Deslocamento: {formatDuration(os.tempo_deslocamento_minutos)}</span>
                    <span className="text-gray-500">•</span>
                    <Navigation2 className="w-4 h-4" />
                    <span>{os.distancia_anterior_km.toFixed(1)} km</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-5 h-5 text-cyan-400 animate-pulse" />
                    <span className="text-gray-300">Em trânsito...</span>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-cyan-500/10 to-cyan-600/5 border-l-4 border-cyan-500 rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-cyan-500/20 border-2 border-cyan-500/50 flex items-center justify-center flex-shrink-0 text-cyan-400 font-bold text-lg">
                      {os.ordem_visita}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-white font-bold text-lg">{os.numero_os}</h4>
                        <div className="flex items-center gap-2 bg-cyan-500/20 px-3 py-1 rounded-full">
                          <Clock className="w-4 h-4 text-cyan-400" />
                          <span className="text-cyan-400 font-bold">{formatTime(os.horario_chegada)}</span>
                        </div>
                      </div>
                      <p className="text-gray-400 text-sm mb-3">{os.endereco || 'Endereço não informado'}</p>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-gray-700/50 rounded-lg p-2">
                          <p className="text-gray-400 text-xs mb-1">Chegada</p>
                          <p className="text-white font-bold">{formatTime(os.horario_chegada)}</p>
                        </div>
                        <div className="bg-gray-700/50 rounded-lg p-2">
                          <p className="text-gray-400 text-xs mb-1">Conclusão</p>
                          <p className="text-green-400 font-bold">{formatTime(os.horario_conclusao)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div className="ml-16 mb-3 bg-gray-700/30 border border-gray-600/50 rounded-lg p-3">
          <div className="flex items-center gap-3 text-gray-400 text-sm mb-2">
            <Timer className="w-4 h-4" />
            <span>Retorno à base: {formatDuration(tempoRetorno)}</span>
            <span className="text-gray-500">•</span>
            <Navigation2 className="w-4 h-4" />
            <span>{metricas.distancia_retorno_km.toFixed(1)} km</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-blue-400 animate-pulse" />
            <span className="text-gray-300">Retornando à base...</span>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500/10 to-green-600/5 border-l-4 border-green-500 rounded-lg p-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Home className="w-6 h-6 text-green-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-white font-bold text-lg">Chegada - Base da Unidade</h4>
                <div className="flex items-center gap-2 bg-green-500/20 px-3 py-1 rounded-full">
                  <Clock className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 font-bold text-lg">{metricas.horario_fim}</span>
                </div>
              </div>
              <p className="text-gray-400 text-sm">{pontoBase.endereco}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total de Paradas</p>
              <p className="text-2xl font-bold text-white">{os_incluidas.length}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Distância Total</p>
              <p className="text-2xl font-bold text-cyan-400">{metricas.distancia_total_km} km</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Tempo Total</p>
              <p className="text-2xl font-bold text-purple-400">{formatDuration(metricas.tempo_total_minutos)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Dias Necessários</p>
              <p className={`text-2xl font-bold ${metricas.requer_pernoite ? 'text-yellow-400' : 'text-green-400'}`}>
                {metricas.dias_necessarios}
              </p>
            </div>
          </div>
        </div>

        {metricas.requer_pernoite && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Moon className="w-6 h-6 text-yellow-400" />
              <div>
                <p className="text-yellow-400 font-bold">Rota com Pernoite</p>
                <p className="text-yellow-300/80 text-sm mt-1">
                  Esta rota requer {metricas.dias_necessarios} dias de trabalho. O técnico precisará pernoitar durante a execução.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
