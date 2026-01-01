import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, CheckCircle, Clock, Package, Camera, FileText,
  AlertCircle, Send, ChevronDown, ChevronUp, Edit3
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AssinaturaCanvas } from '../../components/mobile/AssinaturaCanvas';

interface Peca {
  id: string;
  peca_id: string;
  quantidade: number;
  status: string;
  estoque_pecas: {
    sku: string;
    descricao: string;
  };
}

interface ChecklistItem {
  id: string;
  item: string;
  concluido: boolean;
  observacao: string;
}

interface AgendamentoDetalhes {
  id: string;
  os_id: string;
  checkin_realizado: boolean;
  checkout_realizado: boolean;
  checkin_hora: string | null;
  checkout_hora: string | null;
  checkin_latitude: number | null;
  checkin_longitude: number | null;
  os: {
    numero_os: string;
    cliente_nome: string;
    endereco_completo: string;
    tipo_servico: string;
    descricao_problema: string;
  };
}

type Step = 'checkin' | 'checklist' | 'pecas' | 'evidencias' | 'encerramento' | 'checkout';

export function ExecucaoOS() {
  const { agendamentoId } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [agendamento, setAgendamento] = useState<AgendamentoDetalhes | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('checkin');
  const [loading, setLoading] = useState(true);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [comentarios, setComentarios] = useState('');
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [selectedPecaActions, setSelectedPecaActions] = useState<Record<string, 'gi' | 'devolucao_nova' | 'devolucao_defeito'>>({});

  const [resultado, setResultado] = useState<'sucesso' | 'peca_defeito' | 'improdutiva'>('sucesso');
  const [showAssinaturaTecnico, setShowAssinaturaTecnico] = useState(false);
  const [showAssinaturaCliente, setShowAssinaturaCliente] = useState(false);
  const [assinaturaTecnico, setAssinaturaTecnico] = useState<string | null>(null);
  const [assinaturaCliente, setAssinaturaCliente] = useState<string | null>(null);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    checklist: true,
    pecas: true,
    evidencias: true,
    encerramento: true
  });

  const steps: { key: Step; label: string; icon: any }[] = [
    { key: 'checkin', label: 'Check-in', icon: MapPin },
    { key: 'checklist', label: 'Checklist', icon: CheckCircle },
    { key: 'pecas', label: 'Peças', icon: Package },
    { key: 'evidencias', label: 'Evidências', icon: Camera },
    { key: 'encerramento', label: 'Encerramento', icon: FileText },
    { key: 'checkout', label: 'Check-out', icon: Clock }
  ];

  const loadAgendamento = async () => {
    if (!agendamentoId) return;

    const { data } = await supabase
      .from('agendamentos')
      .select(`
        id,
        os_id,
        checkin_realizado,
        checkout_realizado,
        checkin_hora,
        checkout_hora,
        checkin_latitude,
        checkin_longitude,
        os:os_id (
          numero_os,
          cliente_nome,
          endereco_completo,
          tipo_servico,
          descricao_problema
        )
      `)
      .eq('id', agendamentoId)
      .single();

    if (data) {
      setAgendamento(data as unknown as AgendamentoDetalhes);

      if (data.checkin_realizado) {
        setCurrentStep('checklist');
      }

      await loadPecas(data.os_id);
      await loadChecklist(data.os_id);
      await loadComentarios(data.os_id);
    }

    setLoading(false);
  };

  const loadPecas = async (osId: string) => {
    const { data } = await supabase
      .from('requisicoes_pecas')
      .select(`
        id,
        peca_id,
        quantidade,
        status,
        estoque_pecas:peca_id (
          sku,
          descricao
        )
      `)
      .eq('os_id', osId)
      .eq('status', 'atendida');

    if (data) {
      setPecas(data as unknown as Peca[]);
    }
  };

  const loadChecklist = async (osId: string) => {
    const checklistItems: ChecklistItem[] = [
      { id: '1', item: 'Verificar equipamento', concluido: false, observacao: '' },
      { id: '2', item: 'Testar funcionalidades', concluido: false, observacao: '' },
      { id: '3', item: 'Limpar equipamento', concluido: false, observacao: '' },
      { id: '4', item: 'Instalar peças necessárias', concluido: false, observacao: '' },
      { id: '5', item: 'Testar após reparo', concluido: false, observacao: '' }
    ];
    setChecklist(checklistItems);
  };

  const loadComentarios = async (osId: string) => {
    const { data } = await supabase
      .from('os_comentarios')
      .select('comentario')
      .eq('os_id', osId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setComentarios(data.comentario);
    }
  };

  useEffect(() => {
    loadAgendamento();
  }, [agendamentoId]);

  const handleCheckin = async () => {
    if (!agendamento || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;

      await supabase
        .from('agendamentos')
        .update({
          checkin_realizado: true,
          checkin_hora: new Date().toISOString(),
          checkin_latitude: latitude,
          checkin_longitude: longitude
        })
        .eq('id', agendamento.id);

      setCurrentStep('checklist');
      loadAgendamento();
    }, (error) => {
      alert('Não foi possível obter sua localização. Ative o GPS e tente novamente.');
    });
  };

  const handleSaveChecklist = async () => {
    if (!agendamento) return;

    const checklistText = checklist
      .map(item => `[${item.concluido ? 'X' : ' '}] ${item.item}${item.observacao ? ` - ${item.observacao}` : ''}`)
      .join('\n');

    await supabase
      .from('os_comentarios')
      .insert({
        os_id: agendamento.os_id,
        usuario_id: usuario?.id,
        comentario: `CHECKLIST DE SERVIÇO:\n${checklistText}\n\nOBSERVAÇÕES:\n${comentarios}`,
        is_system: false
      });

    setCurrentStep('pecas');
  };

  const handlePecaAction = async (pecaId: string, action: 'gi' | 'devolucao_nova' | 'devolucao_defeito') => {
    setSelectedPecaActions(prev => ({ ...prev, [pecaId]: action }));
  };

  const handleSavePecas = async () => {
    for (const [pecaId, action] of Object.entries(selectedPecaActions)) {
      if (action === 'gi') {
        await supabase
          .from('requisicoes_pecas')
          .update({ status: 'gi_postado' })
          .eq('id', pecaId);
      } else if (action === 'devolucao_nova') {
        await supabase
          .from('requisicoes_pecas')
          .update({ status: 'devolvida' })
          .eq('id', pecaId);
      } else if (action === 'devolucao_defeito') {
        await supabase
          .from('requisicoes_pecas')
          .update({ status: 'devolvida', observacoes: 'Peça com defeito - RMA' })
          .eq('id', pecaId);
      }
    }

    setCurrentStep('evidencias');
  };

  const handleUploadEvidencia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!agendamento || !e.target.files?.[0]) return;

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${agendamento.os_id}_${Date.now()}.${fileExt}`;
    const filePath = `os-anexos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('os-anexos')
      .upload(filePath, file);

    if (!uploadError) {
      await supabase
        .from('os_anexos')
        .insert({
          os_id: agendamento.os_id,
          usuario_id: usuario?.id,
          tipo: 'evidencia',
          nome_arquivo: file.name,
          caminho_storage: filePath
        });

      alert('Evidência anexada com sucesso!');
    }
  };

  const handleCheckout = async () => {
    if (!agendamento || !assinaturaTecnico || !assinaturaCliente) {
      alert('Por favor, complete as assinaturas antes de fazer check-out.');
      return;
    }

    const tecnicoBlob = await fetch(assinaturaTecnico).then(r => r.blob());
    const clienteBlob = await fetch(assinaturaCliente).then(r => r.blob());

    const tecnicoPath = `assinaturas/${agendamento.os_id}_tecnico_${Date.now()}.png`;
    const clientePath = `assinaturas/${agendamento.os_id}_cliente_${Date.now()}.png`;

    await supabase.storage.from('os-anexos').upload(tecnicoPath, tecnicoBlob);
    await supabase.storage.from('os-anexos').upload(clientePath, clienteBlob);

    await supabase.from('os_anexos').insert([
      {
        os_id: agendamento.os_id,
        usuario_id: usuario?.id,
        tipo: 'assinatura_tecnico',
        nome_arquivo: 'Assinatura Técnico',
        caminho_storage: tecnicoPath
      },
      {
        os_id: agendamento.os_id,
        usuario_id: usuario?.id,
        tipo: 'assinatura_cliente',
        nome_arquivo: 'Assinatura Cliente',
        caminho_storage: clientePath
      }
    ]);

    await supabase
      .from('agendamentos')
      .update({
        checkout_realizado: true,
        checkout_hora: new Date().toISOString()
      })
      .eq('id', agendamento.id);

    const novoStatus = resultado === 'sucesso' ? 'finalizado' :
                       resultado === 'improdutiva' ? 'aguardando_pecas' : 'em_reparo';

    await supabase
      .from('os')
      .update({ status_kanban: novoStatus })
      .eq('id', agendamento.os_id);

    navigate('/mobile/agenda');
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!agendamento) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-950 p-4">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <p className="text-white text-lg mb-4">Agendamento não encontrado</p>
        <button
          onClick={() => navigate('/mobile/agenda')}
          className="px-6 py-3 bg-cyan-500 text-white font-medium rounded-xl"
        >
          Voltar para Agenda
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      <div className="sticky top-0 z-40 bg-gray-900 border-b border-gray-800">
        <div className="p-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/mobile/agenda')}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">OS #{agendamento.os.numero_os}</h1>
            <p className="text-gray-400 text-sm">{agendamento.os.cliente_nome}</p>
          </div>
        </div>

        <div className="flex overflow-x-auto hide-scrollbar px-4 pb-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.key === currentStep;
            const isPast = steps.findIndex(s => s.key === currentStep) > index;
            const isCompleted = (step.key === 'checkin' && agendamento.checkin_realizado) ||
                              (step.key === 'checkout' && agendamento.checkout_realizado);

            return (
              <div key={step.key} className="flex items-center flex-shrink-0">
                <div className={`flex flex-col items-center gap-1 px-3 ${isActive ? 'opacity-100' : 'opacity-50'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    isCompleted || isPast
                      ? 'bg-green-500/20 border-green-500 text-green-400'
                      : isActive
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                      : 'bg-gray-800 border-gray-700 text-gray-500'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs font-medium ${
                    isActive ? 'text-cyan-400' : 'text-gray-500'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-8 h-0.5 ${isPast ? 'bg-green-500' : 'bg-gray-700'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {currentStep === 'checkin' && !agendamento.checkin_realizado && (
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-cyan-500/20 rounded-xl">
                  <MapPin className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Fazer Check-in</h2>
                  <p className="text-gray-400 text-sm">Registre sua chegada no local</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="p-3 bg-gray-800 rounded-lg">
                  <p className="text-gray-400 text-sm mb-1">Endereço</p>
                  <p className="text-white">{agendamento.os.endereco_completo}</p>
                </div>
                <div className="p-3 bg-gray-800 rounded-lg">
                  <p className="text-gray-400 text-sm mb-1">Tipo de Serviço</p>
                  <p className="text-white">{agendamento.os.tipo_servico}</p>
                </div>
              </div>

              <button
                onClick={handleCheckin}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all"
              >
                <MapPin className="w-5 h-5" />
                Fazer Check-in
              </button>
            </div>

            <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
              <p className="text-cyan-400 text-sm">
                O check-in irá capturar sua localização atual e hora de chegada.
              </p>
            </div>
          </div>
        )}

        {currentStep === 'checklist' && (
          <div className="space-y-4">
            <button
              onClick={() => toggleSection('checklist')}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-cyan-400" />
                <h2 className="text-white font-bold text-lg">Checklist de Serviço</h2>
              </div>
              {expandedSections.checklist ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {expandedSections.checklist && (
              <div className="space-y-3">
                {checklist.map((item, index) => (
                  <div key={item.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.concluido}
                        onChange={(e) => {
                          const newChecklist = [...checklist];
                          newChecklist[index].concluido = e.target.checked;
                          setChecklist(newChecklist);
                        }}
                        className="mt-1 w-5 h-5 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500"
                      />
                      <div className="flex-1">
                        <p className={`text-white font-medium ${item.concluido ? 'line-through opacity-50' : ''}`}>
                          {item.item}
                        </p>
                        <input
                          type="text"
                          placeholder="Observações (opcional)"
                          value={item.observacao}
                          onChange={(e) => {
                            const newChecklist = [...checklist];
                            newChecklist[index].observacao = e.target.value;
                            setChecklist(newChecklist);
                          }}
                          className="mt-2 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </label>
                  </div>
                ))}

                <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                  <label className="block text-white font-medium mb-2">
                    Comentários Gerais
                  </label>
                  <textarea
                    value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                    placeholder="Descreva o resultado da visita, problemas encontrados, etc."
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>

                <button
                  onClick={handleSaveChecklist}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all"
                >
                  <Send className="w-5 h-5" />
                  Salvar e Continuar
                </button>
              </div>
            )}
          </div>
        )}

        {currentStep === 'pecas' && (
          <div className="space-y-4">
            <button
              onClick={() => toggleSection('pecas')}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Package className="w-6 h-6 text-cyan-400" />
                <h2 className="text-white font-bold text-lg">Gestão de Peças</h2>
              </div>
              {expandedSections.pecas ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {expandedSections.pecas && (
              <div className="space-y-3">
                {pecas.length === 0 ? (
                  <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 text-center">
                    <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">Nenhuma peça alocada para esta OS</p>
                  </div>
                ) : (
                  pecas.map(peca => (
                    <div key={peca.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
                      <div>
                        <p className="text-white font-medium">{peca.estoque_pecas.descricao}</p>
                        <p className="text-gray-400 text-sm">SKU: {peca.estoque_pecas.sku} | Qtd: {peca.quantidade}</p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-gray-400 text-sm font-medium">Selecione a ação:</p>
                        <div className="grid grid-cols-1 gap-2">
                          <button
                            onClick={() => handlePecaAction(peca.id, 'gi')}
                            className={`px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                              selectedPecaActions[peca.id] === 'gi'
                                ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-green-500/50'
                            }`}
                          >
                            ✓ Confirmar Uso (Postar GI)
                          </button>
                          <button
                            onClick={() => handlePecaAction(peca.id, 'devolucao_nova')}
                            className={`px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                              selectedPecaActions[peca.id] === 'devolucao_nova'
                                ? 'bg-blue-500/20 border-2 border-blue-500 text-blue-400'
                                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-blue-500/50'
                            }`}
                          >
                            ↩ Devolução - Peça Nova
                          </button>
                          <button
                            onClick={() => handlePecaAction(peca.id, 'devolucao_defeito')}
                            className={`px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                              selectedPecaActions[peca.id] === 'devolucao_defeito'
                                ? 'bg-red-500/20 border-2 border-red-500 text-red-400'
                                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-red-500/50'
                            }`}
                          >
                            ⚠ Devolução - Defeito (RMA)
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                <button
                  onClick={handleSavePecas}
                  disabled={pecas.length > 0 && Object.keys(selectedPecaActions).length !== pecas.length}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-5 h-5" />
                  {pecas.length === 0 ? 'Continuar' : 'Salvar Ações e Continuar'}
                </button>
              </div>
            )}
          </div>
        )}

        {currentStep === 'evidencias' && (
          <div className="space-y-4">
            <button
              onClick={() => toggleSection('evidencias')}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Camera className="w-6 h-6 text-cyan-400" />
                <h2 className="text-white font-bold text-lg">Evidências</h2>
              </div>
              {expandedSections.evidencias ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {expandedSections.evidencias && (
              <div className="space-y-3">
                <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                  <label className="flex flex-col items-center gap-3 cursor-pointer">
                    <Camera className="w-12 h-12 text-cyan-400" />
                    <span className="text-white font-medium">Anexar Fotos ou Arquivos</span>
                    <span className="text-gray-400 text-sm text-center">
                      Tire fotos do equipamento antes e depois do reparo
                    </span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      capture="environment"
                      onChange={handleUploadEvidencia}
                      className="hidden"
                      multiple
                    />
                    <div className="px-6 py-3 bg-cyan-500/20 border border-cyan-500/50 rounded-lg text-cyan-400 font-medium">
                      Escolher Arquivo
                    </div>
                  </label>
                </div>

                <button
                  onClick={() => setCurrentStep('encerramento')}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all"
                >
                  <Send className="w-5 h-5" />
                  Continuar
                </button>
              </div>
            )}
          </div>
        )}

        {currentStep === 'encerramento' && (
          <div className="space-y-4">
            <button
              onClick={() => toggleSection('encerramento')}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-cyan-400" />
                <h2 className="text-white font-bold text-lg">Encerramento</h2>
              </div>
              {expandedSections.encerramento ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {expandedSections.encerramento && (
              <div className="space-y-4">
                <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
                  <label className="block text-white font-medium mb-2">
                    Resultado do Atendimento
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setResultado('sucesso')}
                      className={`w-full px-4 py-3 rounded-lg font-medium transition-all ${
                        resultado === 'sucesso'
                          ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                          : 'bg-gray-800 border border-gray-700 text-gray-400'
                      }`}
                    >
                      ✓ Reparo com Sucesso
                    </button>
                    <button
                      onClick={() => setResultado('peca_defeito')}
                      className={`w-full px-4 py-3 rounded-lg font-medium transition-all ${
                        resultado === 'peca_defeito'
                          ? 'bg-yellow-500/20 border-2 border-yellow-500 text-yellow-400'
                          : 'bg-gray-800 border border-gray-700 text-gray-400'
                      }`}
                    >
                      ⚠ Peça com Defeito
                    </button>
                    <button
                      onClick={() => setResultado('improdutiva')}
                      className={`w-full px-4 py-3 rounded-lg font-medium transition-all ${
                        resultado === 'improdutiva'
                          ? 'bg-red-500/20 border-2 border-red-500 text-red-400'
                          : 'bg-gray-800 border border-gray-700 text-gray-400'
                      }`}
                    >
                      ✗ Improdutiva / Revisita
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => setShowAssinaturaTecnico(true)}
                    className={`w-full flex items-center justify-between px-4 py-4 rounded-xl font-medium transition-all ${
                      assinaturaTecnico
                        ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                        : 'bg-gray-900 border border-gray-700 text-white hover:border-cyan-500'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Edit3 className="w-5 h-5" />
                      Assinatura do Técnico
                    </span>
                    {assinaturaTecnico && <CheckCircle className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={() => setShowAssinaturaCliente(true)}
                    className={`w-full flex items-center justify-between px-4 py-4 rounded-xl font-medium transition-all ${
                      assinaturaCliente
                        ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                        : 'bg-gray-900 border border-gray-700 text-white hover:border-cyan-500'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Edit3 className="w-5 h-5" />
                      Assinatura do Cliente
                    </span>
                    {assinaturaCliente && <CheckCircle className="w-5 h-5" />}
                  </button>
                </div>

                <button
                  onClick={() => setCurrentStep('checkout')}
                  disabled={!assinaturaTecnico || !assinaturaCliente}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-5 h-5" />
                  Continuar para Check-out
                </button>
              </div>
            )}
          </div>
        )}

        {currentStep === 'checkout' && (
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-green-500/20 rounded-xl">
                  <Clock className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Fazer Check-out</h2>
                  <p className="text-gray-400 text-sm">Finalize o atendimento</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <span className="text-gray-400">Checklist</span>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <span className="text-gray-400">Peças</span>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <span className="text-gray-400">Evidências</span>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <span className="text-gray-400">Assinaturas</span>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
              </div>

              <button
                onClick={handleCheckout}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all"
              >
                <CheckCircle className="w-6 h-6" />
                Finalizar Atendimento
              </button>
            </div>
          </div>
        )}
      </div>

      {showAssinaturaTecnico && (
        <AssinaturaCanvas
          title="Assinatura do Técnico"
          onSave={(dataUrl) => {
            setAssinaturaTecnico(dataUrl);
            setShowAssinaturaTecnico(false);
          }}
          onCancel={() => setShowAssinaturaTecnico(false)}
        />
      )}

      {showAssinaturaCliente && (
        <AssinaturaCanvas
          title="Assinatura do Cliente"
          onSave={(dataUrl) => {
            setAssinaturaCliente(dataUrl);
            setShowAssinaturaCliente(false);
          }}
          onCancel={() => setShowAssinaturaCliente(false)}
        />
      )}
    </div>
  );
}
