import { useEffect, useState } from 'react';
import { Calendar, User, CheckCircle, Clock, Sun, Moon, Wrench } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const TIPOS_REPARO_IH = [
  'Troca de placa',
  'Troca de painel',
  'Troca de Open Cell',
  'Troca de compressor',
  'Troca de cesto',
  'Troca de serpentina',
  'Troca de peca (simples)'
];

interface OSAgendamentoTabProps {
  osId: string;
  unidadeId: string;
  tipoAtendimento: string;
  dataAgendamento?: string | null;
  tecnicoAgendadoId?: string | null;
  confirmadoComCliente?: boolean;
  periodoAgendamento?: string | null;
  tipoReparo?: string | null;
  colunaKanban: string;
  onSave: () => void;
}

export function OSAgendamentoTab({
  osId,
  unidadeId,
  tipoAtendimento,
  dataAgendamento,
  tecnicoAgendadoId,
  confirmadoComCliente,
  periodoAgendamento,
  tipoReparo,
  colunaKanban,
  onSave
}: OSAgendamentoTabProps) {
  const { usuario } = useAuth();
  const [tecnicos, setTecnicos] = useState<Array<{ id: string; nome: string }>>([]);
  const [formData, setFormData] = useState({
    data_agendamento: dataAgendamento || '',
    tecnico_agendado_id: '',
    confirmado_com_cliente: confirmadoComCliente || false,
    periodo_agendamento: periodoAgendamento || '',
    tipo_reparo: tipoReparo || ''
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [agendamento, setAgendamento] = useState<any>(null);

  useEffect(() => {
    loadTecnicos();
    loadAgendamento();
  }, [osId, tipoAtendimento]);

  useEffect(() => {
    if (agendamento) {
      setFormData({
        data_agendamento: agendamento.data_agendamento || '',
        tecnico_agendado_id: agendamento.tecnico_id || '',
        confirmado_com_cliente: agendamento.confirmado_com_cliente || false,
        periodo_agendamento: agendamento.periodo_agendamento || '',
        tipo_reparo: agendamento.tipo_reparo || ''
      });
    }
  }, [agendamento]);

  const loadTecnicos = async () => {
    try {
      const { data: tecnicosUnidade, error: error1 } = await supabase
        .from('usuarios')
        .select('id, nome')
        .eq('tipo', 'tecnico')
        .eq('unidade_id', unidadeId)
        .eq('ativo', true);

      const { data: tecnicosIH, error: error2 } = await supabase
        .from('usuarios')
        .select('id, nome')
        .eq('tipo', 'tecnico_ih')
        .eq('ativo', true);

      if (error1) throw error1;
      if (error2) throw error2;

      const todosTecnicos = [...(tecnicosUnidade || []), ...(tecnicosIH || [])];
      todosTecnicos.sort((a, b) => a.nome.localeCompare(b.nome));

      setTecnicos(todosTecnicos);
    } catch (error) {
      console.error('Erro ao carregar técnicos:', error);
    }
  };

  const loadAgendamento = async () => {
    try {
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*, tecnico:usuarios!agendamentos_tecnico_id_fkey(nome)')
        .eq('os_id', osId)
        .in('status', ['confirmado', 'em_andamento'])
        .maybeSingle();

      if (error) throw error;
      setAgendamento(data);
    } catch (error) {
      console.error('Erro ao carregar agendamento:', error);
    }
  };

  const handleSave = async () => {
    setErro('');
    setSalvando(true);

    try {
      if (!formData.data_agendamento) {
        setErro('Data do agendamento é obrigatória');
        return;
      }

      if (!formData.tecnico_agendado_id) {
        setErro('Tecnico designado e obrigatorio');
        return;
      }

      if (tipoAtendimento === 'IH' && !formData.tipo_reparo) {
        setErro('Tipo de Reparo e obrigatorio para atendimentos IH');
        return;
      }

      const { error } = await supabase
        .from('os')
        .update({
          data_agendamento: formData.data_agendamento,
          tecnico_agendado_id: formData.tecnico_agendado_id,
          confirmado_com_cliente: formData.confirmado_com_cliente,
          periodo_agendamento: formData.periodo_agendamento || null,
          tipo_reparo: tipoAtendimento === 'IH' ? (formData.tipo_reparo || null) : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', osId);

      if (error) throw error;

      onSave();
    } catch (error: any) {
      console.error('Erro ao salvar agendamento:', error);
      setErro(error.message || 'Erro ao salvar agendamento');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      {agendamento && (
        <div className="premium-card p-4 bg-[#00D4FF10] border border-[#00D4FF30]">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-[#39FF14]" />
            <h4 className="text-[#39FF14] font-bold">Agendamento Ativo</h4>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Data:</span>
              <p className="text-white font-semibold">
                {new Date(agendamento.data_agendamento).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div>
              <span className="text-gray-400">Técnico:</span>
              <p className="text-white font-semibold">{agendamento.tecnico?.nome}</p>
            </div>
            <div>
              <span className="text-gray-400">Status:</span>
              <p className="text-white font-semibold capitalize">
                {agendamento.status.replace('_', ' ')}
              </p>
            </div>
            <div>
              <span className="text-gray-400">Confirmado:</span>
              <p className={`font-semibold ${agendamento.confirmado_com_cliente ? 'text-[#39FF14]' : 'text-[#FFBF00]'}`}>
                {agendamento.confirmado_com_cliente ? 'Sim' : 'Não'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-[#00D4FF] mb-2">
            <Calendar className="w-4 h-4 inline mr-2" />
            Data do Agendamento *
          </label>
          <input
            type="date"
            value={formData.data_agendamento}
            onChange={(e) => setFormData({ ...formData, data_agendamento: e.target.value })}
            className="neon-input w-full"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#00D4FF] mb-2">
            <Clock className="w-4 h-4 inline mr-2" />
            Período
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, periodo_agendamento: 'manha' })}
              className={`p-3 rounded-lg border-2 transition-all ${
                formData.periodo_agendamento === 'manha'
                  ? 'border-[#00D4FF] bg-[#00D4FF20] text-[#00D4FF]'
                  : 'border-gray-600 bg-gray-700/30 text-gray-400 hover:border-gray-500'
              }`}
            >
              <Sun className="w-5 h-5 mx-auto mb-1" />
              <span className="text-sm font-semibold">Manhã</span>
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, periodo_agendamento: 'tarde' })}
              className={`p-3 rounded-lg border-2 transition-all ${
                formData.periodo_agendamento === 'tarde'
                  ? 'border-[#00D4FF] bg-[#00D4FF20] text-[#00D4FF]'
                  : 'border-gray-600 bg-gray-700/30 text-gray-400 hover:border-gray-500'
              }`}
            >
              <Moon className="w-5 h-5 mx-auto mb-1" />
              <span className="text-sm font-semibold">Tarde</span>
            </button>
          </div>
        </div>

        {tipoAtendimento === 'IH' && (
          <div>
            <label className="block text-sm font-semibold text-[#00D4FF] mb-2">
              <Wrench className="w-4 h-4 inline mr-2" />
              Tipo de Reparo *
            </label>
            <select
              value={formData.tipo_reparo}
              onChange={(e) => setFormData({ ...formData, tipo_reparo: e.target.value })}
              className="neon-input w-full"
            >
              <option value="">Selecione o tipo de reparo</option>
              {TIPOS_REPARO_IH.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-[#00D4FF] mb-2">
            <User className="w-4 h-4 inline mr-2" />
            Tecnico Designado *
          </label>
          <select
            value={formData.tecnico_agendado_id}
            onChange={(e) => setFormData({ ...formData, tecnico_agendado_id: e.target.value })}
            className="neon-input w-full"
          >
            <option value="">Selecione um tecnico</option>
            {tecnicos.map((tecnico) => (
              <option key={tecnico.id} value={tecnico.id}>
                {tecnico.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.confirmado_com_cliente}
              onChange={(e) => setFormData({ ...formData, confirmado_com_cliente: e.target.checked })}
              className="w-5 h-5 rounded border-[#00D4FF] bg-transparent checked:bg-[#00D4FF]"
            />
            <span className="text-sm font-semibold text-[#00D4FF]">
              <CheckCircle className="w-4 h-4 inline mr-2" />
              Visita Confirmada com o Cliente
            </span>
          </label>
        </div>

        {erro && (
          <div className="premium-card p-3 bg-[#FF006410] border border-[#FF006430]">
            <p className="text-[#FF0064] text-sm">{erro}</p>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={salvando}
            className="neon-button flex-1 flex items-center justify-center gap-2"
          >
            {salvando ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Salvar Agendamento
              </>
            )}
          </button>
        </div>
      </div>

      <div className="premium-card p-4 bg-[#00D4FF05]">
        <h4 className="text-[#00D4FF] font-bold mb-3 text-sm">Informações</h4>
        <ul className="space-y-2 text-xs text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-[#00D4FF] mt-0.5">•</span>
            <span>Ao salvar, um agendamento será criado automaticamente no sistema</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#00D4FF] mt-0.5">•</span>
            <span>O técnico designado receberá a notificação e verá na aba Agendamento</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#00D4FF] mt-0.5">•</span>
            <span>A confirmação com cliente é importante para o técnico saber se pode ir direto</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
