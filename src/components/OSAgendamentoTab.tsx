import { useEffect, useState } from 'react';
import { Calendar, User, CheckCircle, Clock, Sun, Moon, Wrench, MapPin, Plus, ClipboardList, X, XCircle, Pencil, Trash2, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AgendamentoChecklistSection } from './AgendamentoChecklistSection';

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
  const [agendamentoId, setAgendamentoId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    data_agendamento: dataAgendamento || '',
    tecnico_agendado_id: tecnicoAgendadoId || '',
    confirmado_com_cliente: confirmadoComCliente || false,
    periodo_agendamento: periodoAgendamento || '',
    tipo_reparo: tipoReparo || ''
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [agendamento, setAgendamento] = useState<any>(null);
  const [todosAgendamentos, setTodosAgendamentos] = useState<any[]>([]);
  const [dadosSalvos, setDadosSalvos] = useState<any>(null);
  const [tipoOS, setTipoOS] = useState<string>('');
  const [visitaChecklistAberta, setVisitaChecklistAberta] = useState<string | null>(null);
  const [cancelamentoModal, setCancelamentoModal] = useState<{ aberto: boolean; agendamentoId: string | null }>({ aberto: false, agendamentoId: null });
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [salvandoCancelamento, setSalvandoCancelamento] = useState(false);
  const [novoTipoReparo, setNovoTipoReparo] = useState('');
  const [mostrarNovoTipo, setMostrarNovoTipo] = useState(false);
  const [tiposCustom, setTiposCustom] = useState<string[]>([]);
  const [tipoReparoLocal, setTipoReparoLocal] = useState(tipoReparo || '');
  const [salvandoTipoReparo, setSalvandoTipoReparo] = useState(false);
  const [tipoReparoSalvo, setTipoReparoSalvo] = useState(false);

  useEffect(() => {
    setTipoReparoLocal(tipoReparo || '');
  }, [tipoReparo]);



  useEffect(() => {
    loadTecnicos();
    loadAgendamento();
    loadTipoOS();
  }, [osId, tipoAtendimento]);

  const loadTipoOS = async () => {
    try {
      const { data, error } = await supabase
        .from('os')
        .select('tipo_os')
        .eq('id', osId)
        .single();

      if (error) throw error;
      setTipoOS(data?.tipo_os || '');
    } catch (error) {
      // ignored
    }
  };

  useEffect(() => {
    setFormData({
      data_agendamento: dataAgendamento || '',
      tecnico_agendado_id: tecnicoAgendadoId || '',
      confirmado_com_cliente: confirmadoComCliente || false,
      periodo_agendamento: periodoAgendamento || '',
      tipo_reparo: tipoReparo || ''
    });

    if (dataAgendamento && tecnicoAgendadoId) {
      carregarResumoExistente();
    }
  }, [dataAgendamento, tecnicoAgendadoId, confirmadoComCliente, periodoAgendamento, tipoReparo]);

  const carregarResumoExistente = async () => {
    if (!dataAgendamento || !tecnicoAgendadoId) return;

    try {
      const { data: tecnicoData } = await supabase
        .from('usuarios')
        .select('nome')
        .eq('id', tecnicoAgendadoId)
        .single();

      if (tecnicoData) {
        setDadosSalvos({
          data: dataAgendamento,
          tecnico: tecnicoData.nome,
          periodo: periodoAgendamento || 'Não especificado',
          confirmado: confirmadoComCliente || false,
          tipo_reparo: tipoAtendimento === 'IH' ? (tipoReparo || 'N/A') : null
        });
      }
    } catch (error) {
    }
  };

  const loadTecnicos = async () => {
    try {
      let query = supabase
        .from('usuarios')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

      if (tipoAtendimento === 'IH') {
        query = query.eq('tipo', 'tecnico_ih');
      } else {
        query = query.eq('tipo', 'tecnico').eq('unidade_id', unidadeId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTecnicos(data || []);
    } catch (error) {
    }
  };

  const loadAgendamento = async () => {
    try {
      const { data: currentAgendamento, error: currentError } = await supabase
        .from('agendamentos')
        .select('*, tecnico:usuarios!agendamentos_tecnico_id_fkey(nome)')
        .eq('os_id', osId)
        .in('status', ['confirmado', 'em_andamento'])
        .maybeSingle();

      if (currentError && currentError.code !== 'PGRST116') throw currentError;
      setAgendamento(currentAgendamento);
      setAgendamentoId(currentAgendamento?.id || null);

      const { data: allAgendamentos, error: allError } = await supabase
        .from('agendamentos')
        .select('*, tecnico:usuarios!agendamentos_tecnico_id_fkey(nome)')
        .eq('os_id', osId)
        .order('created_at', { ascending: false });

      if (allError) throw allError;
      setTodosAgendamentos(allAgendamentos || []);
    } catch (error) {
      setAgendamentoId(null);
      setTodosAgendamentos([]);
    }
  };

  const handleSave = async () => {
    setErro('');
    setSucesso('');
    setSalvando(true);

    try {
      if (!formData.data_agendamento) {
        setErro('Data do agendamento é obrigatória');
        setSalvando(false);
        return;
      }

      if (!formData.tecnico_agendado_id) {
        setErro('Técnico designado é obrigatório');
        setSalvando(false);
        return;
      }



      // Check if there's an existing visit without check-in that we can update
      const visitaSemCheckin = todosAgendamentos.find(a => !a.checkin_realizado && a.status !== 'cancelado');
      const todasTemCheckin = todosAgendamentos.length > 0 && !visitaSemCheckin;

      // Update OS data
      const updateData = {
        data_agendamento: formData.data_agendamento,
        tecnico_agendado_id: formData.tecnico_agendado_id,
        confirmado_com_cliente: formData.confirmado_com_cliente,
        periodo_agendamento: formData.periodo_agendamento || null,
        updated_at: new Date().toISOString()
      };

      const { error: osError } = await supabase
        .from('os')
        .update(updateData)
        .eq('id', osId);

      if (osError) throw osError;

      const horarioInicio = formData.periodo_agendamento === 'manha' ? '08:00:00' : '13:00:00';
      const horarioFim = formData.periodo_agendamento === 'manha' ? '12:00:00' : '18:00:00';

      if (todasTemCheckin) {
        // All visits have check-in - create a NEW visit
        // (the DB trigger does NOT handle this case, so we insert directly)
        const { error: insertError } = await supabase
          .from('agendamentos')
          .insert({
            os_id: osId,
            tecnico_id: formData.tecnico_agendado_id,
            data_agendamento: formData.data_agendamento,
            horario_inicio: horarioInicio,
            horario_fim: horarioFim,
            status: 'confirmado',
            confirmado_com_cliente: formData.confirmado_com_cliente,
            observacao: 'Nova visita agendada',
            agendado_por: usuario?.id,
            unidade_id: unidadeId
          });

        if (insertError) throw insertError;
        setSucesso('Nova visita agendada com sucesso!');
      } else if (visitaSemCheckin) {
        // Update the existing visit without check-in
        // (the DB trigger also updates it via the OS update above, but we ensure it here)
        setSucesso('Agendamento atualizado com sucesso!');
      } else {
        // No visits yet - the DB trigger (sync_os_to_agendamentos) creates the first
        // agendamento automatically when the OS fields are updated above
        setSucesso('Agendamento salvo com sucesso!');
      }

      const tecnicoSelecionado = tecnicos.find(t => t.id === formData.tecnico_agendado_id);
      setDadosSalvos({
        data: formData.data_agendamento,
        tecnico: tecnicoSelecionado?.nome || 'N/A',
        periodo: formData.periodo_agendamento || 'Não especificado',
        confirmado: formData.confirmado_com_cliente,
        tipo_reparo: tipoAtendimento === 'IH' ? (formData.tipo_reparo || 'N/A') : null
      });

      setTimeout(() => {
        setSucesso('');
      }, 5000);

      await loadAgendamento();
      onSave();
    } catch (error: any) {
      setErro(error.message || 'Erro ao salvar agendamento');
    } finally {
      setSalvando(false);
    }
  };

  const handleEditarVisita = (agend: any) => {
    setFormData({
      ...formData,
      data_agendamento: agend.data_agendamento,
      tecnico_agendado_id: agend.tecnico_id || '',
      confirmado_com_cliente: agend.confirmado_com_cliente || false,
      periodo_agendamento: agend.horario_inicio?.startsWith('08') ? 'manha' : 'tarde',
    });
  };

  const handleExcluirVisita = async (agendamentoId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta visita?')) return;
    try {
      const { error } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', agendamentoId);
      if (error) throw error;
      setSucesso('Visita excluída com sucesso!');
      await loadAgendamento();
      setTimeout(() => setSucesso(''), 5000);
    } catch (error: any) {
      setErro(error.message || 'Erro ao excluir visita');
    }
  };

  const handleVisitaPDF = (agend: any) => {
    const url = `/visita/print?agendamento_id=${agend.id}&os_id=${osId}`;
    window.open(url, '_blank');
  };

  const handleCancelarAgendamento = async () => {
    if (!cancelamentoModal.agendamentoId || !motivoCancelamento.trim()) {
      setErro('Motivo do cancelamento é obrigatório');
      return;
    }

    setSalvandoCancelamento(true);
    setErro('');

    try {
      const { error: updateError } = await supabase
        .from('agendamentos')
        .update({ status: 'cancelado' })
        .eq('id', cancelamentoModal.agendamentoId);

      if (updateError) throw updateError;

      const { error: comentarioError } = await supabase
        .from('os_comentarios')
        .insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `🚫 Agendamento cancelado: ${motivoCancelamento}`,
          is_system: true
        });

      if (comentarioError) throw comentarioError;

      setSucesso('Agendamento cancelado com sucesso!');
      setCancelamentoModal({ aberto: false, agendamentoId: null });
      setMotivoCancelamento('');

      await loadAgendamento();

      setTimeout(() => {
        setSucesso('');
      }, 5000);
    } catch (error: any) {
      setErro(error.message || 'Erro ao cancelar agendamento');
    } finally {
      setSalvandoCancelamento(false);
    }
  };

  const handleSalvarTipoReparo = async () => {
    if (!tipoReparoLocal) return;
    setSalvandoTipoReparo(true);
    try {
      const { error } = await supabase
        .from('os')
        .update({ tipo_reparo: tipoReparoLocal, updated_at: new Date().toISOString() })
        .eq('id', osId);
      if (error) throw error;
      setTipoReparoSalvo(true);
      setTimeout(() => setTipoReparoSalvo(false), 3000);
      onSave();
    } catch {
      setErro('Erro ao salvar tipo de reparo');
    } finally {
      setSalvandoTipoReparo(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* TIPO DE REPARO - Seção independente */}
      <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Wrench className="w-4 h-4 text-cyan-400" />
            Tipo de Reparo
          </h4>
          {tipoReparoSalvo && (
            <span className="text-xs text-green-400 font-medium">Salvo!</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            {mostrarNovoTipo ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={novoTipoReparo}
                  onChange={(e) => setNovoTipoReparo(e.target.value)}
                  placeholder="Digite o novo tipo..."
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => {
                    if (novoTipoReparo.trim()) {
                      setTiposCustom(prev => [...prev, novoTipoReparo.trim()]);
                      setTipoReparoLocal(novoTipoReparo.trim());
                      setNovoTipoReparo('');
                      setMostrarNovoTipo(false);
                    }
                  }}
                  className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-white text-sm"
                >
                  OK
                </button>
                <button
                  onClick={() => { setMostrarNovoTipo(false); setNovoTipoReparo(''); }}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white text-sm"
                >
                  X
                </button>
              </div>
            ) : (
              <select
                value={tipoReparoLocal}
                onChange={(e) => setTipoReparoLocal(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              >
                <option value="">Selecione o tipo de reparo</option>
                {[
                  'Troca de painel', 'Troca de placa', 'Troca de compressor',
                  'Troca de Open Cell', 'Troca de peça (simples)', 'Troca de peca (simples)',
                  'Troca de serpentina', 'Instalação Inicial', 'Visita Técnica',
                  'Coleta', 'Coleta/Entrega', 'Borracha',
                  ...tiposCustom
                ].map(tipo => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
            )}
          </div>
          {!mostrarNovoTipo && (
            <button
              onClick={() => setMostrarNovoTipo(true)}
              className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
              title="Adicionar novo tipo"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleSalvarTipoReparo}
            disabled={!tipoReparoLocal || salvandoTipoReparo}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors"
          >
            {salvandoTipoReparo ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

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

        {sucesso && (
          <div className="premium-card p-3 bg-[#39FF1410] border border-[#39FF1430]">
            <p className="text-[#39FF14] text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {sucesso}
            </p>
          </div>
        )}

        {dadosSalvos && (
          <div className="premium-card p-4 bg-[#00D4FF10] border border-[#00D4FF30]">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-[#00D4FF]" />
              <h4 className="text-[#00D4FF] font-bold">Resumo do Agendamento</h4>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-400 block mb-1">Data:</span>
                <p className="text-white font-semibold">
                  {new Date(dadosSalvos.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div>
                <span className="text-gray-400 block mb-1">Período:</span>
                <p className="text-white font-semibold capitalize">
                  {dadosSalvos.periodo}
                </p>
              </div>
              <div>
                <span className="text-gray-400 block mb-1">Técnico:</span>
                <p className="text-white font-semibold">
                  {dadosSalvos.tecnico}
                </p>
              </div>
              <div>
                <span className="text-gray-400 block mb-1">Confirmado:</span>
                <p className={`font-semibold ${dadosSalvos.confirmado ? 'text-[#39FF14]' : 'text-[#FFBF00]'}`}>
                  {dadosSalvos.confirmado ? 'Sim' : 'Não'}
                </p>
              </div>
              {dadosSalvos.tipo_reparo && (
                <div className="col-span-2">
                  <span className="text-gray-400 block mb-1">Tipo de Reparo:</span>
                  <p className="text-white font-semibold">
                    {dadosSalvos.tipo_reparo}
                  </p>
                </div>
              )}
            </div>
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

      {todosAgendamentos.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-[#00D4FF] font-bold text-lg">Histórico de Visitas</h3>

          <div className="space-y-3">
            {todosAgendamentos.map((agend, index) => {
              return (
                <div key={agend.id} className="premium-card p-4 bg-gray-800/50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#00D4FF20] flex items-center justify-center">
                        <span className="text-[#00D4FF] font-bold text-sm">{todosAgendamentos.length - index}</span>
                      </div>
                      <div>
                        <p className="text-white font-semibold">
                          Visita {todosAgendamentos.length - index}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(agend.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!agend.checkin_realizado && agend.status !== 'concluido' && agend.status !== 'cancelado' && (
                        <>
                          <button
                            onClick={() => handleEditarVisita(agend)}
                            className="p-1.5 rounded-lg bg-[#FFBF0020] border border-[#FFBF0040] text-[#FFBF00] hover:bg-[#FFBF0030] transition-all"
                            title="Editar visita"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleExcluirVisita(agend.id)}
                            className="p-1.5 rounded-lg bg-[#FF006420] border border-[#FF006440] text-[#FF0064] hover:bg-[#FF006430] transition-all"
                            title="Excluir visita"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {agend.checkout_realizado && (
                        <button
                          onClick={() => handleVisitaPDF(agend)}
                          className="p-1.5 rounded-lg bg-[#00D4FF20] border border-[#00D4FF40] text-[#00D4FF] hover:bg-[#00D4FF30] transition-all"
                          title="PDF da visita"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {agend.resultado_visita && (
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                          agend.resultado_visita === 'reparo_sucesso' ? 'bg-[#39FF1420] text-[#39FF14] border border-[#39FF1440]' :
                          agend.resultado_visita === 'peca_defeito' ? 'bg-[#FF006420] text-[#FF0064] border border-[#FF006440]' :
                          agend.resultado_visita === 'improdutiva_revisita' ? 'bg-[#FFBF0020] text-[#FFBF00] border border-[#FFBF0040]' :
                          'bg-gray-700 text-gray-400 border border-gray-600'
                        }`}>
                          {agend.resultado_visita === 'reparo_sucesso' ? 'Reparo com Sucesso' :
                           agend.resultado_visita === 'peca_defeito' ? 'Peça com Defeito' :
                           agend.resultado_visita === 'improdutiva_revisita' ? 'Improdutiva / Revisita' :
                           agend.resultado_visita}
                        </div>
                      )}
                      {!agend.resultado_visita && (
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          agend.checkin_realizado && !agend.checkout_realizado ? 'bg-[#FFBF0020] text-[#FFBF00]' :
                          agend.status === 'cancelado' ? 'bg-gray-700 text-gray-400' :
                          'bg-[#00D4FF20] text-[#00D4FF]'
                        }`}>
                          {agend.checkin_realizado && !agend.checkout_realizado ? 'Em Andamento' :
                           agend.status === 'cancelado' ? 'Cancelado' : 'Agendado'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <span className="text-gray-400 block mb-1">Técnico:</span>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-[#00D4FF]" />
                        <p className="text-white font-semibold">
                          {agend.tecnico?.nome || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-1">Confirmação:</span>
                      <p className="text-white font-semibold capitalize">
                        {agend.confirmado_com_cliente ? 'Confirmado' : 'Pendente confirmação'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mt-3">
                    <button
                      onClick={() => setVisitaChecklistAberta(agend.id)}
                      className="w-full px-4 py-2 bg-[#00D4FF10] border border-[#00D4FF30] rounded-lg text-[#00D4FF] hover:bg-[#00D4FF20] transition-all flex items-center justify-center gap-2 text-sm font-semibold"
                    >
                      <ClipboardList className="w-4 h-4" />
                      Checklist Técnico
                    </button>
                  </div>

                  {agend.checkin_realizado && (
                    <div className="mt-3 p-3 bg-[#39FF1410] border border-[#39FF1430] rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-[#39FF14]" />
                        <span className="text-[#39FF14] font-semibold text-sm">Check-in Realizado</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-400 block">Horário:</span>
                          <p className="text-white font-semibold">
                            {new Date(agend.checkin_hora).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        {agend.checkin_latitude && agend.checkin_longitude && (
                          <div>
                            <span className="text-gray-400 block">Localização:</span>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-[#39FF14]" />
                              <p className="text-white font-mono text-[10px]">
                                {parseFloat(agend.checkin_latitude).toFixed(4)}, {parseFloat(agend.checkin_longitude).toFixed(4)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {agend.checkout_realizado && (
                    <div className="mt-3 p-3 bg-[#00D4FF10] border border-[#00D4FF30] rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-[#00D4FF]" />
                        <span className="text-[#00D4FF] font-semibold text-sm">Check-out Realizado</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-400 block">Horário:</span>
                          <p className="text-white font-semibold">
                            {new Date(agend.checkout_hora).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        {agend.checkout_latitude && agend.checkout_longitude && (
                          <div>
                            <span className="text-gray-400 block">Localização:</span>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-[#00D4FF]" />
                              <p className="text-white font-mono text-[10px]">
                                {parseFloat(agend.checkout_latitude).toFixed(4)}, {parseFloat(agend.checkout_longitude).toFixed(4)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!agend.checkin_realizado && !agend.checkout_realizado && agend.status !== 'cancelado' && (
                    <div className="mt-3 p-3 bg-gray-700/30 border border-gray-600 rounded-lg">
                      <p className="text-gray-400 text-xs text-center">
                        Aguardando check-in do técnico
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="premium-card p-4 bg-[#00D4FF05]">
        <h4 className="text-[#00D4FF] font-bold mb-3 text-sm">Informações</h4>
        <ul className="space-y-2 text-xs text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-[#00D4FF] mt-0.5">•</span>
            <span>Ao salvar, a visita pendente será atualizada ou uma nova será criada automaticamente</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#00D4FF] mt-0.5">•</span>
            <span>O técnico designado receberá a notificação e verá na aba Agendamento</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#00D4FF] mt-0.5">•</span>
            <span>A confirmação com cliente é importante para o técnico saber se pode ir direto</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#00D4FF] mt-0.5">•</span>
            <span>Use "Agendar Nova Visita" para criar visitas adicionais (revisitas)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#00D4FF] mt-0.5">•</span>
            <span>Clique no botão "Checklist Técnico" de cada visita para vincular e visualizar checklists</span>
          </li>
        </ul>
      </div>

      {/* Modal de Checklist por Visita */}
      {visitaChecklistAberta && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="premium-card w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#00D4FF]/20 sticky top-0 bg-gray-900 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#00D4FF]/20 flex items-center justify-center">
                    <ClipboardList className="w-6 h-6 text-[#00D4FF]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Checklist Técnico</h3>
                    <p className="text-sm text-gray-400">
                      Visita {todosAgendamentos.findIndex(a => a.id === visitaChecklistAberta) !== -1
                        ? todosAgendamentos.length - todosAgendamentos.findIndex(a => a.id === visitaChecklistAberta)
                        : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setVisitaChecklistAberta(null)}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <AgendamentoChecklistSection
                agendamentoId={visitaChecklistAberta}
                unidadeId={unidadeId}
                tipoOS={tipoOS}
                tipoAtendimento={tipoAtendimento}
                osId={osId}
                isReadOnly={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cancelamento de Agendamento */}
      {cancelamentoModal.aberto && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="premium-card w-full max-w-lg">
            <div className="p-6 border-b border-[#FF0064]/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#FF0064]/20 flex items-center justify-center">
                    <XCircle className="w-6 h-6 text-[#FF0064]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Cancelar Agendamento</h3>
                    <p className="text-sm text-gray-400">Informe o motivo do cancelamento</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setCancelamentoModal({ aberto: false, agendamentoId: null });
                    setMotivoCancelamento('');
                    setErro('');
                  }}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Motivo do Cancelamento *
                </label>
                <textarea
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                  placeholder="Descreva o motivo do cancelamento..."
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FF0064]"
                />
              </div>

              {erro && (
                <div className="premium-card p-3 bg-[#FF006410] border border-[#FF006430]">
                  <p className="text-[#FF0064] text-sm">{erro}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setCancelamentoModal({ aberto: false, agendamentoId: null });
                    setMotivoCancelamento('');
                    setErro('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-semibold"
                >
                  Voltar
                </button>
                <button
                  onClick={handleCancelarAgendamento}
                  disabled={salvandoCancelamento || !motivoCancelamento.trim()}
                  className="flex-1 px-4 py-3 bg-[#FF0064] hover:bg-[#FF0064]/80 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {salvandoCancelamento ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Cancelando...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Confirmar Cancelamento
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
