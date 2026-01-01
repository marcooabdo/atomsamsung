import { useState, useEffect } from 'react';
import { Calendar, CheckCircle, Package, ClipboardList, TrendingUp, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSkywalker } from '../../contexts/SkywalkerContext';
import { useAuth } from '../../contexts/AuthContext';

interface MetricasData {
  os_abertas: number;
  os_finalizadas: number;
  agendamentos: number;
  cotacoes_aprovadas: number;
  pecas_disponiveis: number;
  percentual_lp_ow: number;
}

export function MetricasAutomaticas() {
  const { colaboradores, mesAtual } = useSkywalker();
  const { usuario } = useAuth();
  const [selectedColaborador, setSelectedColaborador] = useState('');
  const [metricas, setMetricas] = useState<MetricasData>({
    os_abertas: 0,
    os_finalizadas: 0,
    agendamentos: 0,
    cotacoes_aprovadas: 0,
    pecas_disponiveis: 0,
    percentual_lp_ow: 0
  });
  const [loading, setLoading] = useState(false);

  const loadMetricas = async () => {
    if (!selectedColaborador) return;

    setLoading(true);

    const [anoAtual, mesNum] = mesAtual.split('-');
    const inicioMes = `${anoAtual}-${mesNum}-01`;
    const fimMes = new Date(parseInt(anoAtual), parseInt(mesNum), 0).toISOString().split('T')[0];

    const { data: osData } = await supabase
      .from('os')
      .select('id, status_kanban, tipo_orcamento')
      .eq('criado_por', selectedColaborador)
      .gte('created_at', inicioMes)
      .lte('created_at', `${fimMes}T23:59:59`);

    const { data: agendamentosData } = await supabase
      .from('agendamentos')
      .select('id')
      .eq('tecnico_id', selectedColaborador)
      .gte('created_at', inicioMes)
      .lte('created_at', `${fimMes}T23:59:59`);

    const { data: cotacoesData } = await supabase
      .from('cotacoes')
      .select('id, status')
      .eq('criado_por', selectedColaborador)
      .eq('status', 'aprovada')
      .gte('created_at', inicioMes)
      .lte('created_at', `${fimMes}T23:59:59`);

    const { data: pecasData } = await supabase
      .from('requisicoes_pecas')
      .select('id, status')
      .eq('solicitante_id', selectedColaborador)
      .eq('status', 'atendida')
      .gte('created_at', inicioMes)
      .lte('created_at', `${fimMes}T23:59:59`);

    const osAbertas = osData?.length || 0;
    const osFinalizadas = osData?.filter(os => os.status_kanban === 'finalizado').length || 0;
    const agendamentos = agendamentosData?.length || 0;
    const cotacoesAprovadas = cotacoesData?.length || 0;
    const pecasDisponiveis = pecasData?.length || 0;

    const totalOs = osData?.length || 0;
    const lpCount = osData?.filter(os => os.tipo_orcamento === 'lp').length || 0;
    const owCount = osData?.filter(os => os.tipo_orcamento === 'ow').length || 0;
    const percentualLpOw = totalOs > 0 ? ((lpCount / totalOs) * 100) : 0;

    setMetricas({
      os_abertas: osAbertas,
      os_finalizadas: osFinalizadas,
      agendamentos,
      cotacoes_aprovadas: cotacoesAprovadas,
      pecas_disponiveis: pecasDisponiveis,
      percentual_lp_ow: percentualLpOw
    });

    setLoading(false);
  };

  useEffect(() => {
    if (selectedColaborador) {
      loadMetricas();
    }
  }, [selectedColaborador, mesAtual]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl border border-cyan-500/30">
            <TrendingUp className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Metricas Automaticas</h2>
            <p className="text-gray-400 text-sm">Dados reais do sistema baseados na data de criacao</p>
          </div>
        </div>

        <button
          onClick={loadMetricas}
          disabled={loading || !selectedColaborador}
          className="p-2 bg-cyan-500/20 border border-cyan-500/50 rounded-lg text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-xl">
        <label className="block text-gray-400 text-sm mb-2">Selecione o Colaborador</label>
        <select
          value={selectedColaborador}
          onChange={(e) => setSelectedColaborador(e.target.value)}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
        >
          <option value="">Selecione um colaborador</option>
          {colaboradores.map(c => (
            <option key={c.id} value={c.usuario_id}>{c.usuario?.nome}</option>
          ))}
        </select>
      </div>

      {selectedColaborador && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <ClipboardList className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-gray-400 text-sm">OS Abertas no Mes</span>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{metricas.os_abertas}</p>
            <p className="text-blue-400 text-xs">Baseado na data de criacao</p>
          </div>

          <div className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-gray-400 text-sm">OS Finalizadas</span>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{metricas.os_finalizadas}</p>
            <p className="text-green-400 text-xs">Status: Finalizado</p>
          </div>

          <div className="p-6 bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/30 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Calendar className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-gray-400 text-sm">Agendamentos</span>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{metricas.agendamentos}</p>
            <p className="text-purple-400 text-xs">Criados no mes</p>
          </div>

          <div className="p-6 bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/30 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-orange-400" />
              </div>
              <span className="text-gray-400 text-sm">Cotacoes Aprovadas</span>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{metricas.cotacoes_aprovadas}</p>
            <p className="text-orange-400 text-xs">Status: Aprovada</p>
          </div>

          <div className="p-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <Package className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="text-gray-400 text-sm">Pecas Disponiveis</span>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{metricas.pecas_disponiveis}</p>
            <p className="text-cyan-400 text-xs">Status: Atendida</p>
          </div>

          <div className="p-6 bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/30 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-pink-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-pink-400" />
              </div>
              <span className="text-gray-400 text-sm">% LP vs OW</span>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{metricas.percentual_lp_ow.toFixed(1)}%</p>
            <p className="text-pink-400 text-xs">LP do total de OS</p>
          </div>
        </div>
      )}

      <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-cyan-400 font-medium mb-1">Como funcionam as metricas?</p>
            <ul className="text-cyan-300/70 text-sm space-y-1">
              <li>• Todas as metricas sao baseadas na <strong>data de criacao</strong> dos registros</li>
              <li>• Se uma OS foi aberta no dia 25 e hoje esta fechada, ela ainda conta para o dia 25</li>
              <li>• Agendamentos, cotacoes e pecas seguem a mesma logica</li>
              <li>• O percentual LP/OW considera todas as OS abertas no mes, independente do status atual</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
