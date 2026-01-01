import { useState, useEffect } from 'react';
import { Clock, CheckCircle, Package, TrendingUp, User, Calendar, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface KPIs {
  velocidade_media: number;
  taxa_sucesso: number;
  giro_pecas: number;
  os_concluidas_mes: number;
  os_concluidas_hoje: number;
}

interface HistoricoOS {
  id: string;
  numero_os: string;
  cliente_nome: string;
  data_conclusao: string;
  tempo_atendimento: number;
  resultado: string;
}

export function DesempenhoMobile() {
  const { usuario } = useAuth();
  const [kpis, setKpis] = useState<KPIs>({
    velocidade_media: 0,
    taxa_sucesso: 0,
    giro_pecas: 0,
    os_concluidas_mes: 0,
    os_concluidas_hoje: 0
  });
  const [historico, setHistorico] = useState<HistoricoOS[]>([]);
  const [loading, setLoading] = useState(true);

  const loadKPIs = async () => {
    if (!usuario) return;

    const hoje = new Date().toISOString().split('T')[0];
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const { data: agendamentosData } = await supabase
      .from('agendamentos')
      .select('id, checkin_hora, checkout_hora, checkout_realizado, data_agendamento, os:os_id(status_kanban)')
      .eq('tecnico_id', usuario.id)
      .eq('checkout_realizado', true)
      .gte('created_at', inicioMes);

    const { data: pecasData } = await supabase
      .from('requisicoes_pecas')
      .select('id')
      .eq('solicitante_id', usuario.id)
      .eq('status', 'gi_postado')
      .gte('created_at', inicioMes);

    if (agendamentosData) {
      const temposAtendimento = agendamentosData
        .filter(a => a.checkin_hora && a.checkout_hora)
        .map(a => {
          const checkin = new Date(a.checkin_hora!);
          const checkout = new Date(a.checkout_hora!);
          return (checkout.getTime() - checkin.getTime()) / (1000 * 60);
        });

      const velocidadeMedia = temposAtendimento.length > 0
        ? temposAtendimento.reduce((sum, t) => sum + t, 0) / temposAtendimento.length
        : 0;

      const totalConcluidas = agendamentosData.length;
      const sucesso = agendamentosData.filter(a => a.os?.status_kanban === 'finalizado').length;
      const taxaSucesso = totalConcluidas > 0 ? (sucesso / totalConcluidas) * 100 : 0;

      const concluidasHoje = agendamentosData.filter(a => a.data_agendamento === hoje).length;

      setKpis({
        velocidade_media: Math.round(velocidadeMedia),
        taxa_sucesso: Math.round(taxaSucesso),
        giro_pecas: pecasData?.length || 0,
        os_concluidas_mes: totalConcluidas,
        os_concluidas_hoje: concluidasHoje
      });
    }

    setLoading(false);
  };

  const loadHistorico = async () => {
    if (!usuario) return;

    const { data } = await supabase
      .from('agendamentos')
      .select(`
        id,
        checkin_hora,
        checkout_hora,
        data_agendamento,
        os:os_id (
          numero_os,
          cliente_nome,
          status_kanban
        )
      `)
      .eq('tecnico_id', usuario.id)
      .eq('checkout_realizado', true)
      .order('checkout_hora', { ascending: false })
      .limit(10);

    if (data) {
      const historicoFormatado = data.map(a => {
        const checkin = new Date(a.checkin_hora!);
        const checkout = new Date(a.checkout_hora!);
        const tempoMinutos = (checkout.getTime() - checkin.getTime()) / (1000 * 60);

        return {
          id: a.id,
          numero_os: a.os?.numero_os || '',
          cliente_nome: a.os?.cliente_nome || '',
          data_conclusao: checkout.toLocaleDateString('pt-BR'),
          tempo_atendimento: Math.round(tempoMinutos),
          resultado: a.os?.status_kanban === 'finalizado' ? 'Sucesso' : 'Pendente'
        };
      });

      setHistorico(historicoFormatado);
    }
  };

  useEffect(() => {
    loadKPIs();
    loadHistorico();
  }, [usuario]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{usuario?.nome}</h1>
            <p className="text-cyan-400 text-sm">Tecnico IH</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900/50 backdrop-blur rounded-xl p-3">
            <p className="text-gray-400 text-xs mb-1">Hoje</p>
            <p className="text-2xl font-bold text-white">{kpis.os_concluidas_hoje}</p>
            <p className="text-cyan-400 text-xs">OS concluídas</p>
          </div>
          <div className="bg-gray-900/50 backdrop-blur rounded-xl p-3">
            <p className="text-gray-400 text-xs mb-1">Este Mês</p>
            <p className="text-2xl font-bold text-white">{kpis.os_concluidas_mes}</p>
            <p className="text-cyan-400 text-xs">OS concluídas</p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-6 h-6 text-cyan-400" />
          <h2 className="text-xl font-bold text-white">Indicadores de Performance</h2>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-cyan-500/20 rounded-xl">
                  <Clock className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Velocidade Média</p>
                  <p className="text-white text-xs">Tempo médio por atendimento</p>
                </div>
              </div>
              <p className="text-3xl font-black text-cyan-400">{kpis.velocidade_media}</p>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Minutos por OS</span>
              <span className="text-cyan-400">
                {kpis.velocidade_media < 60 ? 'Excelente' : kpis.velocidade_media < 90 ? 'Bom' : 'Regular'}
              </span>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-500/20 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Taxa de Sucesso</p>
                  <p className="text-white text-xs">OS finalizadas com êxito</p>
                </div>
              </div>
              <p className="text-3xl font-black text-green-400">{kpis.taxa_sucesso}%</p>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${kpis.taxa_sucesso}%` }}
              />
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <Package className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Giro de Peças</p>
                  <p className="text-white text-xs">GIs postadas no mês</p>
                </div>
              </div>
              <p className="text-3xl font-black text-purple-400">{kpis.giro_pecas}</p>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Peças utilizadas</span>
              <span className="text-purple-400">
                {kpis.giro_pecas > 20 ? 'Alto' : kpis.giro_pecas > 10 ? 'Médio' : 'Baixo'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-6 h-6 text-cyan-400" />
          <h2 className="text-xl font-bold text-white">Histórico Recente</h2>
        </div>

        {historico.length === 0 ? (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 text-center">
            <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Nenhum atendimento concluído ainda</p>
          </div>
        ) : (
          <div className="space-y-3">
            {historico.map(item => (
              <div key={item.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-bold">OS #{item.numero_os}</span>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        item.resultado === 'Sucesso'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                          : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                      }`}>
                        {item.resultado}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm">{item.cliente_nome}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Calendar className="w-4 h-4" />
                    {item.data_conclusao}
                  </div>
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Clock className="w-4 h-4" />
                    {item.tempo_atendimento} min
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
