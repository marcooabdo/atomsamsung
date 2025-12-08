import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UnitFilter } from '../components/UnitFilter';
import { AgendamentoLista } from '../components/agendamento/AgendamentoLista';
import { AgendamentoCalendario } from '../components/agendamento/AgendamentoCalendario';
import { CheckinModal } from '../components/agendamento/CheckinModal';
import { CheckoutModal } from '../components/agendamento/CheckoutModal';
import OSDetailsModal from '../components/OSDetailsModal';
import { AgendamentosViewer } from '../components/agendamento/AgendamentosViewer';
import { RouteDashboard } from '../components/agendamento/RouteDashboard';
import { Calendar, List, Activity, AlertCircle, Users, MapPin, BarChart3 } from 'lucide-react';

type ViewMode = 'calendar' | 'list' | 'map';

export function Agendamento() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unidades, setUnidades] = useState<Array<{id: string; nome: string}>>([]);
  const [selectedUnidade, setSelectedUnidade] = useState('');
  const [tecnicos, setTecnicos] = useState<Array<{id: string; nome: string}>>([]);
  const [selectedTecnico, setSelectedTecnico] = useState<string>('todos');
  const [agendamentoCheckin, setAgendamentoCheckin] = useState<any>(null);
  const [agendamentoCheckout, setAgendamentoCheckout] = useState<any>(null);
  const [selectedOSId, setSelectedOSId] = useState<string | null>(null);
  const [checkoutsPendentes, setCheckoutsPendentes] = useState(0);
  const [showDashboard, setShowDashboard] = useState(false);

  useEffect(() => {
    loadUnidades();
  }, []);

  useEffect(() => {
    if (user) {
      if (user.unidade_id) {
        setSelectedUnidade(user.unidade_id);
      }
      loadAgendamentos();
      loadTecnicos();
    }
  }, [user, selectedUnidade]);

  useEffect(() => {
    loadAgendamentos();
  }, [selectedTecnico]);

  const loadUnidades = async () => {
    const { data } = await supabase.from('unidades').select('id, nome').order('nome');
    setUnidades(data || []);
  };

  const loadTecnicos = async () => {
    const unidadeFilter = selectedUnidade || user?.unidade_id;
    if (!unidadeFilter) return;

    const { data } = await supabase
      .from('usuarios')
      .select('id, nome')
      .eq('unidade_id', unidadeFilter)
      .in('tipo', ['tecnico', 'tecnico_ih'])
      .eq('ativo', true)
      .order('nome');

    setTecnicos(data || []);
  };

  const loadAgendamentos = async () => {
    try {
      const unidadeFilter = selectedUnidade || (user?.unidade_id || null);
      const canSeeAllUnits = (user?.tipo === 'master' || user?.tipo === 'diretoria') && !user?.unidade_id;

      let query = supabase
        .from('agendamentos')
        .select(`
          *,
          os:os!agendamentos_os_id_fkey(
            numero_os_samsung,
            numero_os_interna,
            cliente_nome,
            cliente_telefone,
            cliente_endereco,
            cliente_bairro,
            cliente_cidade,
            cliente_estado,
            cliente_cep,
            tipo_atendimento,
            coluna_kanban,
            defeito_relatado,
            observacoes_internas,
            confirmado_com_cliente
          ),
          tecnico:usuarios!agendamentos_tecnico_id_fkey(nome),
          unidade:unidades!agendamentos_unidade_id_fkey(nome)
        `)
        .in('status', ['confirmado', 'em_andamento', 'concluido'])
        .gte('data_agendamento', new Date().toISOString().split('T')[0])
        .order('data_agendamento', { ascending: true })
        .order('horario_inicio', { ascending: true });

      if (user?.tipo === 'tecnico') {
        query = query.eq('tecnico_id', user.id);
      }

      if (!canSeeAllUnits && unidadeFilter) {
        query = query.eq('unidade_id', unidadeFilter);
      } else if (selectedUnidade) {
        query = query.eq('unidade_id', selectedUnidade);
      }

      if (selectedTecnico && selectedTecnico !== 'todos') {
        query = query.eq('tecnico_id', selectedTecnico);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAgendamentos(data || []);

      const checkoutsPendentesCount = (data || []).filter(
        (ag: any) => ag.checkout_pendente === true
      ).length;
      setCheckoutsPendentes(checkoutsPendentesCount);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      <UnitFilter
        unidades={unidades}
        selectedUnidade={selectedUnidade}
        onUnidadeChange={setSelectedUnidade}
      />

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="tech-heading text-xl text-[#00D4FF] mb-2">AGENDAMENTOS</h3>
          <p className="text-sm text-gray-400 tracking-wide">
            Gestão de visitas técnicas e instalações
          </p>
        </div>
        <div className="flex items-center gap-3">
          {checkoutsPendentes > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              <span className="text-yellow-500 font-semibold">
                {checkoutsPendentes} Checkout{checkoutsPendentes > 1 ? 's' : ''} Pendente{checkoutsPendentes > 1 ? 's' : ''}
              </span>
            </div>
          )}
          <button
            onClick={() => setShowDashboard(!showDashboard)}
            className={`neon-button flex items-center gap-2 ${showDashboard ? 'bg-[#9D4EDD]/20' : ''}`}
          >
            <BarChart3 className="w-4 h-4" />
            DASHBOARD
          </button>
          <button
            onClick={loadAgendamentos}
            className="neon-button flex items-center gap-2"
          >
            <Activity className="w-4 h-4" />
            ATUALIZAR
          </button>
        </div>
      </div>

      <div className="premium-card p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <h4 className="text-[#00D4FF] font-bold">VISÃO</h4>
            {user?.tipo !== 'tecnico' && tecnicos.length > 0 && (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#00D4FF]" />
                <select
                  value={selectedTecnico}
                  onChange={(e) => setSelectedTecnico(e.target.value)}
                  className="px-3 py-1.5 bg-[#0A0A0D]/50 border border-[#00D4FF]/30 rounded-lg text-white text-sm focus:outline-none focus:border-[#00D4FF]"
                >
                  <option value="todos">Todos os Técnicos</option>
                  {tecnicos.map(tec => (
                    <option key={tec.id} value={tec.id}>{tec.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`neon-button px-4 py-2 text-xs ${
                viewMode === 'list'
                  ? ''
                  : 'opacity-50 hover:opacity-100'
              }`}
            >
              <List className="w-4 h-4 inline mr-2" />
              LISTA
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`neon-button px-4 py-2 text-xs ${
                viewMode === 'calendar'
                  ? ''
                  : 'opacity-50 hover:opacity-100'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              CALENDÁRIO
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`neon-button px-4 py-2 text-xs ${
                viewMode === 'map'
                  ? ''
                  : 'opacity-50 hover:opacity-100'
              }`}
            >
              <MapPin className="w-4 h-4 inline mr-2" />
              MAPA
            </button>
          </div>
        </div>

        {showDashboard && (
          <div className="mb-6">
            <RouteDashboard
              tecnicoId={user?.tipo === 'tecnico' ? user.id : selectedTecnico !== 'todos' ? selectedTecnico : undefined}
              unidadeId={selectedUnidade}
              periodo="30dias"
            />
          </div>
        )}

        {viewMode === 'list' && (
          <AgendamentoLista
            agendamentos={agendamentos as any}
            onAgendamentoClick={(agendamento) => {
              if (agendamento.os_id) {
                setSelectedOSId(agendamento.os_id);
              }
            }}
            onCheckinClick={(agendamento) => {
              setAgendamentoCheckin(agendamento);
            }}
            onCheckoutClick={(agendamento) => {
              setAgendamentoCheckout(agendamento);
            }}
          />
        )}

        {viewMode === 'calendar' && (
          <AgendamentoCalendario
            agendamentos={agendamentos as any}
            onAgendamentoClick={(agendamento) => {
              if (agendamento.os_id) {
                setSelectedOSId(agendamento.os_id);
              }
            }}
          />
        )}

        {viewMode === 'map' && (
          <AgendamentosViewer
            unidadeId={selectedUnidade}
            showDashboard={false}
            allowTechnicianFilter={user?.tipo !== 'tecnico'}
          />
        )}
      </div>

      {agendamentoCheckin && (
        <CheckinModal
          agendamento={agendamentoCheckin}
          onClose={() => setAgendamentoCheckin(null)}
          onSuccess={() => {
            loadAgendamentos();
            setAgendamentoCheckin(null);
          }}
        />
      )}

      {agendamentoCheckout && (
        <CheckoutModal
          agendamento={agendamentoCheckout}
          onClose={() => setAgendamentoCheckout(null)}
          onSuccess={() => {
            loadAgendamentos();
            setAgendamentoCheckout(null);
          }}
        />
      )}

      {selectedOSId && (
        <OSDetailsModal
          osId={selectedOSId}
          onClose={() => setSelectedOSId(null)}
        />
      )}
    </div>
  );
}
