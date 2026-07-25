import { useState, useEffect } from 'react';
import { Clock, CheckCircle, Package, TrendingUp, User, Calendar, Award, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { OSFinalizadaModal } from '../../components/mobile/OSFinalizadaModal';

interface KPIs {
  velocidade_media: number;
  taxa_sucesso: number;
  giro_pecas: number;
  os_concluidas_mes: number;
  os_concluidas_hoje: number;
}

interface HistoricoOS {
  id: string;
  os_id: string;
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
  const [selectedOS, setSelectedOS] = useState<{ osId: string; agendamentoId: string } | null>(null);

  const loadKPIs = async () => {
    if (!usuario) return;

    const agora = new Date();
    const hoje = agora.toISOString().split('T')[0];
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
    const fimHoje = new Date(hoje + 'T23:59:59.999Z').toISOString();

    const { data: agendamentosMes } = await supabase
      .from('agendamentos')
      .select('id, checkin_hora, checkout_hora, resultado_visita')
      .eq('tecnico_id', usuario.id)
      .eq('checkout_realizado', true)
      .not('checkout_hora', 'is', null)
      .gte('checkout_hora', inicioMes);

    const { data: agendamentosHoje } = await supabase
      .from('agendamentos')
      .select('id')
      .eq('tecnico_id', usuario.id)
      .eq('checkout_realizado', true)
      .not('checkout_hora', 'is', null)
      .gte('checkout_hora', hoje)
      .lte('checkout_hora', fimHoje);

    const { data: pecasData } = await supabase
      .from('requisicoes_pecas')
      .select('id, updated_at')
      .eq('tecnico_id', usuario.id)
      .eq('status', 'gi_postada')
      .gte('updated_at', inicioMes);

    if (agendamentosMes) {
      const temposAtendimento = agendamentosMes
        .filter(a => a.checkin_hora && a.checkout_hora)
        .map(a => {
          const checkin = new Date(a.checkin_hora!);
          const checkout = new Date(a.checkout_hora!);
          return (checkout.getTime() - checkin.getTime()) / (1000 * 60);
        });

      const velocidadeMedia = temposAtendimento.length > 0
        ? temposAtendimento.reduce((sum, t) => sum + t, 0) / temposAtendimento.length
        : 0;

      const totalConcluidasMes = agendamentosMes.length;
      const osComSucesso = agendamentosMes.filter(a =>
        a.resultado_visita === 'reparo_sucesso'
      ).length;
      const taxaSucesso = totalConcluidasMes > 0 ? (osComSucesso / totalConcluidasMes) * 100 : 0;

      const concluidasHoje = agendamentosHoje?.length || 0;

      setKpis({
        velocidade_media: Math.round(velocidadeMedia),
        taxa_sucesso: Math.round(taxaSucesso),
        giro_pecas: pecasData?.length || 0,
        os_concluidas_mes: totalConcluidasMes,
        os_concluidas_hoje: concluidasHoje
      });
    }

    setLoading(false);
  };

  const loadHistorico = async () => {
    if (!usuario) return;

    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const { data } = await supabase
      .from('agendamentos')
      .select(`
        id,
        os_id,
        checkin_hora,
        checkout_hora,
        resultado_visita,
        defeito_encontrado,
        os:os_id (
          id,
          numero_os_samsung,
          numero_os_interna,
          cliente_nome
        )
      `)
      .eq('tecnico_id', usuario.id)
      .eq('checkout_realizado', true)
      .not('checkout_hora', 'is', null)
      .gte('checkout_hora', inicioMes)
      .order('checkout_hora', { ascending: false })
      .limit(20);

    if (data) {
      const historicoFormatado = data
        .filter(a => a.checkin_hora && a.checkout_hora)
        .map(a => {
          const checkin = new Date(a.checkin_hora!);
          const checkout = new Date(a.checkout_hora!);
          const tempoMinutos = (checkout.getTime() - checkin.getTime()) / (1000 * 60);

          const resultado = (() => {
            const rv = a.resultado_visita;
            if (rv === 'reparo_sucesso') return 'Reparo com Sucesso';
            if (rv === 'peca_defeito') return 'Peça com Defeito';
            if (rv === 'improdutiva_revisita') return 'Improdutiva / Revisita';
            return rv || 'Finalizado';
          })();

          return {
            id: a.id,
            os_id: a.os_id,
            numero_os: a.os?.numero_os_samsung || a.os?.numero_os_interna || 'S/N',
            cliente_nome: a.os?.cliente_nome || '',
            data_conclusao: checkout.toLocaleDateString('pt-BR') + ' ' + checkout.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            tempo_atendimento: Math.round(tempoMinutos),
            resultado
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
            <p className="text-cyan-400 text-sm">Técnico IH</p>
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
          <h2 className="text-xl font-bold text-white">Performance do Mês</h2>
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
                  <p className="text-white text-xs">Tempo médio por atendimento no mês</p>
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
                  <p className="text-white text-xs">OS finalizadas com êxito no mês</p>
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
          <h2 className="text-xl font-bold text-white">OS Finalizadas do Mês</h2>
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
                        item.resultado === 'Reparo com Sucesso'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                          : item.resultado === 'Peça com Defeito'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                          : item.resultado === 'Improdutiva / Revisita'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                          : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
                      }`}>
                        {item.resultado}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm">{item.cliente_nome}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm mb-3">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Calendar className="w-4 h-4" />
                    {item.data_conclusao}
                  </div>
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Clock className="w-4 h-4" />
                    {item.tempo_atendimento} min
                  </div>
                </div>

                <button
                  onClick={() => setSelectedOS({ osId: item.os_id, agendamentoId: item.id })}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500/20 border border-cyan-500/50 rounded-lg text-cyan-400 font-medium hover:bg-cyan-500/30 transition-all"
                >
                  <Eye className="w-4 h-4" />
                  Ver Detalhes
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de OS Finalizada */}
      {selectedOS && (
        <OSFinalizadaModal
          osId={selectedOS.osId}
          agendamentoId={selectedOS.agendamentoId}
          onClose={() => setSelectedOS(null)}
        />
      )}
    </div>
  );
}
