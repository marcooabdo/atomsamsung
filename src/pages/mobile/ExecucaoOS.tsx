import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, CheckCircle, Clock, Package, Camera, FileText, AlertCircle, Send, ChevronDown, ChevronUp, CreditCard as Edit3, Navigation } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AssinaturaCanvas } from '../../components/mobile/AssinaturaCanvas';
import { updateTrackingState } from '../../lib/geoTracker';

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
    );
    const data = await response.json();
    if (data.display_name) {
      return data.display_name;
    }
    return `${lat}, ${lng}`;
  } catch {
    return `${lat}, ${lng}`;
  }
}

interface Peca {
  id: string;
  peca_estoque_id: string;
  codigo_peca: string;
  descricao: string;
  quantidade: number;
  status: string;
  estoque_pecas: {
    id_unico: string;
    pn: string;
    descricao: string;
    estoque_etiquetas: Array<{
      id_sequencial: string;
      delivery: string;
    }>;
  } | null;
}

interface Evidencia {
  id: string;
  path: string;
  nome: string;
  tipo: string | null;
  url?: string;
  size?: number;
  fileType?: string;
}

interface ChecklistItem {
  ordem: number;
  texto: string;
  checked: boolean;
  updated_at?: string;
  updated_by?: string;
  updated_by_name?: string;
}

interface ChecklistVinculado {
  id: string;
  checklist_template_id: string;
  respostas: ChecklistItem[];
  checklist_template: {
    id: string;
    nome: string;
    descricao: string | null;
    itens: Array<{
      ordem: number;
      texto: string;
    }>;
  };
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
    tipo_os: string;
  };
}

type Step = 'checkin' | 'checklist' | 'pecas' | 'evidencias' | 'encerramento' | 'checkout';

export function ExecucaoOS() {
  const { agendamentoId: osId } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [agendamento, setAgendamento] = useState<AgendamentoDetalhes | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('checkin');
  const [loading, setLoading] = useState(true);
  const [hasActiveOS, setHasActiveOS] = useState(false);

  const [checklistsVinculados, setChecklistsVinculados] = useState<ChecklistVinculado[]>([]);
  const [defeitoEncontrado, setDefeitoEncontrado] = useState('');
  const [diagnostico, setDiagnostico] = useState('');
  const [acaoRealizada, setAcaoRealizada] = useState('');
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [expandedPecas, setExpandedPecas] = useState<Record<string, boolean>>({});
  const [selectedPecaActions, setSelectedPecaActions] = useState<Record<string, 'gi' | 'devolucao_nova' | 'devolucao_defeito'>>({});
  const [pecaPhotos, setPecaPhotos] = useState<Record<string, { nova: string[]; velha: string[] }>>({});
  const [uploadedEvidencias, setUploadedEvidencias] = useState<Evidencia[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [resultado, setResultado] = useState<'sucesso' | 'peca_defeito' | 'improdutiva'>('sucesso');
  const [showAssinaturaTecnico, setShowAssinaturaTecnico] = useState(false);
  const [showAssinaturaCliente, setShowAssinaturaCliente] = useState(false);
  const [assinaturaTecnico, setAssinaturaTecnico] = useState<string | null>(null);
  const [assinaturaCliente, setAssinaturaCliente] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

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

  const checkForActiveOS = async () => {
    if (!usuario) return false;

    const { data } = await supabase
      .from('agendamentos')
      .select('os_id, checkin_realizado, checkout_realizado, os:os_id(coluna_kanban)')
      .eq('tecnico_id', usuario.id)
      .eq('checkin_realizado', true)
      .eq('checkout_realizado', false)
      .neq('os_id', osId || '')
      .limit(10);

    if (data && data.length > 0) {
      return true;
    }
    return false;
  };

  const loadAgendamento = async () => {
    if (!osId || !usuario) return;

    const activeOSExists = await checkForActiveOS();
    setHasActiveOS(activeOSExists);

    const { data: agendamentosData, error: agendamentoError } = await supabase
      .from('agendamentos')
      .select('id, tecnico_id, checkin_realizado, checkout_realizado, checkin_hora, checkout_hora, checkin_latitude, checkin_longitude, created_at')
      .eq('os_id', osId)
      .eq('tecnico_id', usuario.id)
      .order('created_at', { ascending: false });

    if (agendamentoError) {
    }

    let agendamentoData = null;
    if (agendamentosData && agendamentosData.length > 0) {
      const agendamentoPendente = agendamentosData.find(a => !a.checkout_realizado);
      agendamentoData = agendamentoPendente || agendamentosData[0];
    }

    const { data, error } = await supabase
      .from('os')
      .select('id, numero_os_interna, numero_os_samsung, cliente_nome, cliente_endereco, cliente_bairro, cliente_cidade, tipo_atendimento, tipo_reparo, defeito_relatado, diagnostico_tecnico, reparo_efetuado, coluna_kanban, tecnico_agendado_id, tipo_os')
      .eq('id', osId)
      .maybeSingle();

    if (error) {
      setLoading(false);
      return;
    }

    if (!data) {
      setLoading(false);
      return;
    }

    const isAuthorized = agendamentoData?.tecnico_id === usuario.id || data.tecnico_agendado_id === usuario.id;

    if (!isAuthorized) {
      setLoading(false);
      return;
    }

    const checkinRealizado = agendamentoData?.checkin_realizado ||
      data.coluna_kanban === 'em_reparo_ci' ||
      data.coluna_kanban === 'em_rota_ih';

    const agendamentoObj = {
      id: agendamentoData?.id || data.id,
      os_id: data.id,
      checkin_realizado: checkinRealizado,
      checkout_realizado: agendamentoData?.checkout_realizado || false,
      checkin_hora: agendamentoData?.checkin_hora || null,
      checkout_hora: agendamentoData?.checkout_hora || null,
      checkin_latitude: agendamentoData?.checkin_latitude || null,
      checkin_longitude: agendamentoData?.checkin_longitude || null,
      os: {
        numero_os: data.numero_os_samsung || data.numero_os_interna || 'S/N',
        cliente_nome: data.cliente_nome,
        endereco_completo: `${data.cliente_endereco}, ${data.cliente_bairro || ''}, ${data.cliente_cidade}`.trim(),
        tipo_servico: data.tipo_atendimento === 'IH' ? `IH - ${data.tipo_reparo || ''}` : data.tipo_atendimento || '',
        descricao_problema: data.defeito_relatado || '',
        tipo_os: data.tipo_os || data.tipo_atendimento || ''
      }
    };

    setAgendamento(agendamentoObj as unknown as AgendamentoDetalhes);

    if (checkinRealizado) {
      setCurrentStep('checklist');
    }

    await loadPecas(data.id);
    await loadChecklist(agendamentoData?.id || '');
    await loadComentarios(data.id, !checkinRealizado);

    setLoading(false);
  };

  const loadPecas = async (osId: string) => {
    const { data } = await supabase
      .from('requisicoes_pecas')
      .select(`
        id,
        peca_estoque_id,
        codigo_peca,
        descricao,
        quantidade_requisitada,
        status,
        estoque_pecas:peca_estoque_id (
          id_unico,
          pn,
          descricao,
          estoque_etiquetas (
            id_sequencial,
            delivery
          )
        )
      `)
      .eq('os_id', osId)
      .in('status', ['atendida', 'em_uso', 'gi_postada', 'devolvida']);

    if (data) {
      const pecasFormatted = data.map(p => ({
        ...p,
        quantidade: p.quantidade_requisitada
      }));
      setPecas(pecasFormatted as unknown as Peca[]);
    }
  };

  const loadChecklist = async (agendamentoId: string) => {
    if (!usuario) return;

    try {
      const { data: vinculados, error } = await supabase
        .from('agendamento_checklist_vinculados')
        .select(`
          id,
          checklist_template_id,
          respostas,
          checklist_template:checklist_templates(
            id,
            nome,
            descricao,
            itens
          )
        `)
        .eq('agendamento_id', agendamentoId);

      if (error) {
        return;
      }

      setChecklistsVinculados((vinculados as any) || []);
    } catch (error) {
      setChecklistsVinculados([]);
    }
  };

  const loadComentarios = async (osId: string, isNewVisit: boolean) => {
    // For a new visit (not yet checked-in), start with blank fields
    if (isNewVisit) {
      setDefeitoEncontrado('');
      setDiagnostico('');
      setAcaoRealizada('');
      return;
    }

    const { data } = await supabase
      .from('os')
      .select('diagnostico_tecnico, reparo_efetuado, defeito_relatado')
      .eq('id', osId)
      .maybeSingle();

    if (data) {
      setDefeitoEncontrado(data.defeito_relatado || '');
      setDiagnostico(data.diagnostico_tecnico || '');
      setAcaoRealizada(data.reparo_efetuado || '');
    }
  };

  useEffect(() => {
    if (usuario && osId) {
      loadAgendamento();
    }
  }, [osId, usuario]);

  const handleCheckin = async () => {
    if (!agendamento || !navigator.geolocation) return;

    if (hasActiveOS) {
      alert('Você tem um atendimento em andamento. Finalize o check-out antes de iniciar outro.');
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      const checkinTime = new Date();

      const enderecoTecnico = await reverseGeocode(latitude, longitude);

      await supabase
        .from('os')
        .update({
          coluna_kanban: 'em_rota_ih'
        })
        .eq('id', agendamento.os_id);

      await supabase
        .from('agendamentos')
        .update({
          checkin_realizado: true,
          checkin_hora: checkinTime.toISOString(),
          checkin_latitude: latitude,
          checkin_longitude: longitude
        })
        .eq('id', agendamento.id);

      await supabase
        .from('os_comentarios')
        .insert({
          os_id: agendamento.os_id,
          usuario_id: usuario?.id,
          comentario: `CHECK-IN REALIZADO\nData/Hora: ${checkinTime.toLocaleString('pt-BR')}\nCoordenadas: ${latitude}, ${longitude}\nEndereço do Técnico: ${enderecoTecnico}`,
          is_system: true
        });

      updateTrackingState(true, agendamento.os_id);
      setCurrentStep('checklist');
      loadAgendamento();
    }, (error) => {
      alert('Não foi possível obter sua localização. Ative o GPS e tente novamente.');
    });
  };

  const handleSaveChecklist = async () => {
    if (!agendamento) return;

    let comentario = '';

    // Salvar respostas dos checklists técnicos vinculados
    for (const vinculo of checklistsVinculados) {
      const respostas = vinculo.respostas || [];

      await supabase
        .from('agendamento_checklist_vinculados')
        .update({ respostas })
        .eq('id', vinculo.id);
    }

    // Adicionar comentário com informações do checklist
    if (checklistsVinculados.length > 0) {
      let checklistTexts: string[] = [];

      checklistsVinculados.forEach(vinculo => {
        const respostas = vinculo.respostas || [];
        const template = vinculo.checklist_template;
        const itens = template.itens || [];

        const checklistText = itens.map(item => {
          const resposta = respostas.find(r => r.ordem === item.ordem);
          return `[${resposta?.checked ? 'X' : ' '}] ${item.texto}`;
        }).join('\n');

        checklistTexts.push(`${template.nome}:\n${checklistText}`);
      });

      comentario = `CHECKLISTS TÉCNICOS:\n${checklistTexts.join('\n\n')}\n\n`;
    }

    comentario += `DEFEITO ENCONTRADO:\n${defeitoEncontrado || 'Não informado'}\n\nDIAGNÓSTICO:\n${diagnostico || 'Não informado'}\n\nAÇÃO REALIZADA:\n${acaoRealizada || 'Não informado'}`;

    await supabase
      .from('os')
      .update({
        defeito_relatado: defeitoEncontrado || null,
        diagnostico_tecnico: diagnostico || null,
        reparo_efetuado: acaoRealizada || null
      })
      .eq('id', agendamento.os_id);

    await supabase
      .from('os_comentarios')
      .insert({
        os_id: agendamento.os_id,
        usuario_id: usuario?.id,
        comentario,
        is_system: false
      });

    const isIH = agendamento.os.tipo_os === 'IH' || agendamento.os.tipo_servico.includes('IH');

    if (!isIH) {
      await supabase
        .from('os')
        .update({
          coluna_kanban: 'em_reparo_ci'
        })
        .eq('id', agendamento.os_id);
    }

    setCurrentStep('pecas');
  };

  const isChecklistValid = () => {
    // Verificar se todos os checklists vinculados estão completos
    const todosChecklistsCompletos = checklistsVinculados.every(vinculo => {
      const template = vinculo.checklist_template;
      const itens = template.itens || [];
      const respostas = vinculo.respostas || [];

      // Todos os itens devem estar marcados
      return itens.every(item => {
        const resposta = respostas.find(r => r.ordem === item.ordem);
        return resposta?.checked === true;
      });
    });

    const camposObrigatorios = defeitoEncontrado.trim() && diagnostico.trim() && acaoRealizada.trim();
    return todosChecklistsCompletos && camposObrigatorios;
  };

  const isEncerramentoValid = () => {
    return !!assinaturaTecnico && !!assinaturaCliente;
  };

  const canCheckout = () => {
    return agendamento?.checkin_realizado && isChecklistValid() && isEncerramentoValid();
  };

  const handlePecaAction = async (pecaId: string, action: 'gi' | 'devolucao_nova' | 'devolucao_defeito') => {
    setSelectedPecaActions(prev => ({ ...prev, [pecaId]: action }));
  };

  const handleSavePecas = async () => {
    for (const [pecaId, action] of Object.entries(selectedPecaActions)) {
      if (action === 'gi') {
        await supabase
          .from('requisicoes_pecas')
          .update({
            status: 'gi_postada',
            tipo_devolucao: 'usada',
            motivo_devolucao: 'Peça consumida durante o reparo'
          })
          .eq('id', pecaId);
      } else if (action === 'devolucao_nova') {
        await supabase
          .from('requisicoes_pecas')
          .update({
            status: 'devolucao_pendente',
            tipo_devolucao: 'nova',
            motivo_devolucao: 'Peça não utilizada no reparo'
          })
          .eq('id', pecaId);
      } else if (action === 'devolucao_defeito') {
        await supabase
          .from('requisicoes_pecas')
          .update({
            status: 'devolucao_pendente',
            tipo_devolucao: 'nova_com_defeito',
            motivo_devolucao: 'Peça apresentou defeito de fábrica - RMA'
          })
          .eq('id', pecaId);
      }
    }

    setCurrentStep('evidencias');
  };

  const handleUploadPecaPhoto = async (pecaId: string, tipo: 'nova' | 'velha', files: FileList) => {
    if (!agendamento || !files || files.length === 0) return;

    const peca = pecas.find(p => p.id === pecaId);
    if (!peca) return;

    setUploadingPhoto(true);

    try {
      const pecaDescricao = peca.estoque_pecas?.descricao || peca.descricao;
      const pecaPN = peca.estoque_pecas?.pn || peca.codigo_peca;
      const tipoTexto = tipo === 'nova' ? 'Nova' : 'Usada';

      const uploadedPaths: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const timestamp = Date.now() + i;
        const fileName = `peca_${tipo}_${pecaPN}_${timestamp}.${fileExt}`;
        const filePath = `os-anexos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('os-anexos')
          .upload(filePath, file);

        if (uploadError) {
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('os-anexos')
          .getPublicUrl(filePath);

        const descricaoAnexo = `Foto da Peça ${tipoTexto}: ${pecaPN} - ${pecaDescricao}`;

        const { error: insertError } = await supabase
          .from('os_anexos')
          .insert({
            os_id: agendamento.os_id,
            usuario_id: usuario?.id || null,
            tipo: `peca_${tipo}`,
            nome_arquivo: fileName,
            url: publicUrl,
            tamanho_bytes: file.size,
            descricao: descricaoAnexo
          });

        if (insertError) {
          continue;
        }

        uploadedPaths.push(filePath);
      }

      if (uploadedPaths.length > 0) {
        setPecaPhotos(prev => ({
          ...prev,
          [pecaId]: {
            nova: tipo === 'nova' ? [...(prev[pecaId]?.nova || []), ...uploadedPaths] : (prev[pecaId]?.nova || []),
            velha: tipo === 'velha' ? [...(prev[pecaId]?.velha || []), ...uploadedPaths] : (prev[pecaId]?.velha || [])
          }
        }));

        alert(`${uploadedPaths.length} foto(s) da peça ${tipoTexto} anexada(s) com sucesso!`);
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleUploadEvidencia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!agendamento || !e.target.files?.[0]) return;

    setUploadingPhoto(true);

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `evidencia_${Date.now()}.${fileExt}`;
    const filePath = `os-anexos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('os-anexos')
      .upload(filePath, file);

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage
        .from('os-anexos')
        .getPublicUrl(filePath);

      const newEvidencia: Evidencia = {
        id: Date.now().toString(),
        path: filePath,
        nome: fileName,
        tipo: null,
        url: publicUrl,
        size: file.size,
        fileType: file.type
      };

      setUploadedEvidencias(prev => [...prev, newEvidencia]);
      alert('Foto anexada! Agora selecione o tipo da evidência.');
    }

    setUploadingPhoto(false);
  };

  const handleUpdateEvidenciaTipo = async (evidenciaId: string, tipo: string) => {
    if (!agendamento) return;

    const evidencia = uploadedEvidencias.find(e => e.id === evidenciaId);
    if (!evidencia) return;

    const tipoNomeMap: Record<string, string> = {
      'defeito': 'Defeito',
      'reparo': 'Reparo',
      'etiqueta_serial': 'Etiqueta_Serial',
      'nota_fiscal': 'Nota_Fiscal',
      'menu_servico': 'Menu_Servico',
      'contador_erros': 'Contador_Erros',
      'qrcode_barras': 'QRCode',
      'fachada': 'Fachada'
    };

    const tipoNome = tipoNomeMap[tipo] || tipo;
    const fileExt = evidencia.nome.split('.').pop();
    const timestamp = Date.now();
    const novoNome = `${tipoNome}_${timestamp}.${fileExt}`;

    const { error: insertError } = await supabase
      .from('os_anexos')
      .insert({
        os_id: agendamento.os_id,
        usuario_id: usuario?.id || null,
        tipo: tipo,
        nome_arquivo: novoNome,
        url: evidencia.url || '',
        tamanho_bytes: evidencia.size
      });

    if (insertError) {
      alert(`Erro ao salvar evidencia: ${insertError.message}`);
      return;
    }

    setUploadedEvidencias(prev =>
      prev.map(e => e.id === evidenciaId ? { ...e, tipo, nome: novoNome } : e)
    );
  };

  const handleRemoveEvidencia = (evidenciaId: string) => {
    setUploadedEvidencias(prev => prev.filter(e => e.id !== evidenciaId));
  };

  const handleCheckout = async () => {
    if (isCheckingOut) return;

    if (!canCheckout()) {
      if (!agendamento?.checkin_realizado) {
        alert('É necessário fazer check-in primeiro.');
        return;
      }
      if (!isChecklistValid()) {
        const pendencias: string[] = [];

        checklistsVinculados.forEach(vinculo => {
          const template = vinculo.checklist_template;
          const itens = template.itens || [];
          const respostas = vinculo.respostas || [];

          const itensIncompletos = itens.filter(item => {
            const resposta = respostas.find(r => r.ordem === item.ordem);
            return !resposta?.checked;
          });

          if (itensIncompletos.length > 0) {
            pendencias.push(`${template.nome}: ${itensIncompletos.length} item(ns) pendente(s)`);
          }
        });

        if (!defeitoEncontrado.trim()) pendencias.push('Defeito Encontrado');
        if (!diagnostico.trim()) pendencias.push('Diagnóstico');
        if (!acaoRealizada.trim()) pendencias.push('Ação Realizada');

        alert('Complete os seguintes campos:\n\n' + pendencias.join('\n'));
        return;
      }
      if (!isEncerramentoValid()) {
        alert('Complete as assinaturas do técnico e do cliente antes de fazer check-out.');
        return;
      }
      return;
    }

    if (!navigator.geolocation) {
      alert('Geolocalização não disponível no seu dispositivo.');
      return;
    }

    setIsCheckingOut(true);

    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const checkoutTime = new Date();

        const enderecoTecnico = await reverseGeocode(latitude, longitude);

        const tecnicoBlob = await fetch(assinaturaTecnico).then(r => r.blob());
        const clienteBlob = await fetch(assinaturaCliente).then(r => r.blob());

        const tecnicoPath = `assinaturas/${agendamento.os_id}_tecnico_${Date.now()}.png`;
        const clientePath = `assinaturas/${agendamento.os_id}_cliente_${Date.now()}.png`;

        await supabase.storage.from('os-anexos').upload(tecnicoPath, tecnicoBlob);
        await supabase.storage.from('os-anexos').upload(clientePath, clienteBlob);

        const { data: { publicUrl: tecnicoUrl } } = supabase.storage
          .from('os-anexos')
          .getPublicUrl(tecnicoPath);

        const { data: { publicUrl: clienteUrl } } = supabase.storage
          .from('os-anexos')
          .getPublicUrl(clientePath);

        const { error: anexosError } = await supabase.from('os_anexos').insert([
          {
            os_id: agendamento.os_id,
            usuario_id: usuario?.id || null,
            tipo: 'assinatura_tecnico',
            nome_arquivo: 'Assinatura Técnico',
            url: tecnicoUrl,
            tamanho_bytes: tecnicoBlob.size
          },
          {
            os_id: agendamento.os_id,
            usuario_id: usuario?.id || null,
            tipo: 'assinatura_cliente',
            nome_arquivo: 'Assinatura Cliente',
            url: clienteUrl,
            tamanho_bytes: clienteBlob.size
          }
        ]);

        if (anexosError) {
          // ignored
        }

        await supabase
          .from('agendamentos')
          .update({
            checkout_realizado: true,
            checkout_hora: checkoutTime.toISOString(),
            checkout_latitude: latitude,
            checkout_longitude: longitude
          })
          .eq('id', agendamento.id);

        await supabase
          .from('os_comentarios')
          .insert({
            os_id: agendamento.os_id,
            usuario_id: usuario?.id,
            comentario: `CHECK-OUT REALIZADO\nData/Hora: ${checkoutTime.toLocaleString('pt-BR')}\nResultado: ${resultado === 'sucesso' ? 'Reparo com Sucesso' : resultado === 'improdutiva' ? 'Improdutiva/Revisita' : 'Peça com Defeito'}\nCoordenadas: ${latitude}, ${longitude}\nEndereço do Técnico: ${enderecoTecnico}`,
            is_system: true
          });

        const isIH = agendamento.os.tipo_os === 'IH' || agendamento.os.tipo_servico.includes('IH');

        let novoStatus: string;
        if (resultado === 'sucesso') {
          novoStatus = isIH ? 'aguardando_fechamento' : 'reparo_concluido';
        } else {
          novoStatus = 'aguardando_peca';
        }

        await supabase
          .from('os')
          .update({ coluna_kanban: novoStatus })
          .eq('id', agendamento.os_id);

        updateTrackingState(false, null);
        navigate('/mobile/agenda');
      } catch (error) {
        alert('Erro ao realizar check-out. Tente novamente.');
        setIsCheckingOut(false);
      }
    }, (error) => {
      alert('Não foi possível obter sua localização. Ative o GPS e tente novamente.');
      setIsCheckingOut(false);
    });
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
            const isCompleted =
              (step.key === 'checkin' && agendamento.checkin_realizado) ||
              (step.key === 'checklist' && isChecklistValid()) ||
              (step.key === 'encerramento' && isEncerramentoValid()) ||
              (step.key === 'checkout' && agendamento.checkout_realizado);

            const canNavigate =
              agendamento.checkin_realizado ||
              step.key === 'checkin';

            return (
              <div key={step.key} className="flex items-center flex-shrink-0">
                <button
                  onClick={() => canNavigate && setCurrentStep(step.key)}
                  disabled={!canNavigate}
                  className={`flex flex-col items-center gap-1 px-3 ${
                    canNavigate ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                  } ${isActive ? 'opacity-100' : 'opacity-70'}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    isCompleted
                      ? 'bg-green-500/20 border-green-500 text-green-400'
                      : isActive
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                      : 'bg-gray-800 border-gray-700 text-gray-500'
                  }`}>
                    {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs font-medium ${
                    isCompleted ? 'text-green-400' : isActive ? 'text-cyan-400' : 'text-gray-500'
                  }`}>
                    {step.label}
                  </span>
                </button>
                {index < steps.length - 1 && (
                  <div className={`w-8 h-0.5 ${isCompleted ? 'bg-green-500' : 'bg-gray-700'}`} />
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
                  <p className="text-gray-400 text-sm mb-1">Endereco do Cliente</p>
                  <p className="text-white">{agendamento.os.endereco_completo}</p>
                </div>
                <div className="p-3 bg-gray-800 rounded-lg">
                  <p className="text-gray-400 text-sm mb-1">Tipo de Serviço</p>
                  <p className="text-white">{agendamento.os.tipo_servico}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => {
                    const endereco = encodeURIComponent(agendamento.os.endereco_completo);
                    window.open(`https://waze.com/ul?q=${endereco}`, '_blank');
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500/20 border border-cyan-500/50 rounded-xl text-cyan-400 font-medium hover:bg-cyan-500/30 transition-all"
                >
                  <Navigation className="w-5 h-5" />
                  Waze
                </button>
                <button
                  onClick={() => {
                    const endereco = encodeURIComponent(agendamento.os.endereco_completo);
                    window.open(`https://www.google.com/maps/search/?api=1&query=${endereco}`, '_blank');
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/20 border border-blue-500/50 rounded-xl text-blue-400 font-medium hover:bg-blue-500/30 transition-all"
                >
                  <MapPin className="w-5 h-5" />
                  Maps
                </button>
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
                O check-in ira capturar sua localizacao atual e hora de chegada.
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
              <div className="space-y-4">
                {checklistsVinculados.length === 0 ? (
                  <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 text-center">
                    <CheckCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">Nenhum checklist técnico vinculado a esta OS</p>
                    <p className="text-gray-500 text-sm mt-2">Os checklists devem ser adicionados na aba de Agendamento da OS</p>
                  </div>
                ) : (
                  checklistsVinculados.map((vinculo, vinculoIndex) => {
                    const template = vinculo.checklist_template;
                    const itens = template.itens || [];
                    const respostas = vinculo.respostas || [];

                    return (
                      <div key={vinculo.id} className="bg-gray-900 border border-cyan-500/30 rounded-xl p-4">
                        <h3 className="text-cyan-400 font-bold mb-1">{template.nome}</h3>
                        {template.descricao && (
                          <p className="text-gray-400 text-sm mb-3">{template.descricao}</p>
                        )}

                        <div className="space-y-2">
                          {itens.map((item) => {
                            const resposta = respostas.find(r => r.ordem === item.ordem);
                            const checked = resposta?.checked || false;

                            return (
                              <label key={item.ordem} className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-800/50 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const novosVinculos = [...checklistsVinculados];
                                    const respostas = novosVinculos[vinculoIndex].respostas || [];

                                    const respostaIndex = respostas.findIndex(r => r.ordem === item.ordem);

                                    if (respostaIndex >= 0) {
                                      respostas[respostaIndex] = {
                                        ...respostas[respostaIndex],
                                        checked: e.target.checked,
                                        updated_at: new Date().toISOString(),
                                        updated_by: usuario?.id,
                                        updated_by_name: usuario?.nome
                                      };
                                    } else {
                                      respostas.push({
                                        ordem: item.ordem,
                                        texto: item.texto,
                                        checked: e.target.checked,
                                        updated_at: new Date().toISOString(),
                                        updated_by: usuario?.id,
                                        updated_by_name: usuario?.nome
                                      });
                                    }

                                    novosVinculos[vinculoIndex].respostas = respostas;
                                    setChecklistsVinculados(novosVinculos);
                                  }}
                                  className="mt-1 w-5 h-5 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500"
                                />
                                <div className="flex-1">
                                  <p className={`text-white font-medium ${checked ? 'line-through opacity-50' : ''}`}>
                                    {item.texto}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}

                <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-4">
                  <div>
                    <label className="block text-white font-medium mb-2">
                      Defeito Encontrado <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={defeitoEncontrado}
                      onChange={(e) => setDefeitoEncontrado(e.target.value)}
                      placeholder="Descreva o defeito encontrado no equipamento"
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-white font-medium mb-2">
                      Diagnóstico <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={diagnostico}
                      onChange={(e) => setDiagnostico(e.target.value)}
                      placeholder="Descreva o diagnóstico técnico do problema"
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-white font-medium mb-2">
                      Ação Realizada <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={acaoRealizada}
                      onChange={(e) => setAcaoRealizada(e.target.value)}
                      placeholder="Descreva o que foi feito no atendimento"
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
                    />
                  </div>
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
                  pecas.map(peca => {
                    const etiqueta = peca.estoque_pecas?.estoque_etiquetas?.[0];
                    const isExpanded = expandedPecas[peca.id];

                    return (
                      <div key={peca.id} className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedPecas(prev => ({ ...prev, [peca.id]: !prev[peca.id] }))}
                          className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
                        >
                          <div className="flex-1 text-left">
                            <p className="text-white font-bold text-lg">{peca.estoque_pecas?.pn || peca.codigo_peca}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-gray-400 text-sm">{peca.estoque_pecas?.descricao || peca.descricao}</p>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              {etiqueta && (
                                <>
                                  <span className="text-cyan-400 text-xs">ID: {etiqueta.id_sequencial}</span>
                                  <span className="text-gray-500">•</span>
                                  <span className="text-orange-400 text-xs">Delivery: {etiqueta.delivery}</span>
                                </>
                              )}
                              <span className="text-gray-500">•</span>
                              <span className="text-gray-400 text-xs">Qtd: {peca.quantidade}</span>
                            </div>
                            <div className="mt-2">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                peca.status === 'atendida' ? 'bg-green-500/20 text-green-400' :
                                peca.status === 'gi_postada' ? 'bg-blue-500/20 text-blue-400' :
                                peca.status === 'devolvida' ? 'bg-orange-500/20 text-orange-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {peca.status === 'atendida' ? 'Atendida' :
                                 peca.status === 'gi_postada' ? 'GI Postado' :
                                 peca.status === 'devolvida' ? 'Devolvida' :
                                 peca.status === 'em_uso' ? 'Em Uso' : peca.status}
                              </span>
                            </div>
                          </div>
                          <div>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 space-y-3 border-t border-gray-700 pt-3">
                            {peca.status === 'atendida' && (
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
                                    ⚠ Devolução - Defeito
                                  </button>
                                </div>
                              </div>
                            )}

                            {peca.status !== 'atendida' && (
                              <div className="p-3 bg-gray-800/50 rounded-lg">
                                <p className="text-gray-400 text-sm">
                                  {peca.status === 'gi_postada' && '✓ GI já postado - Peça consumida'}
                                  {peca.status === 'devolvida' && '↩ Peça já devolvida ao estoque'}
                                  {peca.status === 'em_uso' && '⚙ Peça em uso'}
                                </p>
                              </div>
                            )}

                            {peca.status === 'atendida' && (
                              <div className="space-y-2 pt-2">
                                <label className="flex flex-col items-center gap-2 px-3 py-3 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:border-cyan-500/50 transition-colors">
                                  <Camera className="w-5 h-5 text-cyan-400" />
                                  <span className="text-xs text-gray-400">
                                    Fotos Peça Nova {pecaPhotos[peca.id]?.nova?.length > 0 && `(${pecaPhotos[peca.id].nova.length})`}
                                  </span>
                                  {pecaPhotos[peca.id]?.nova?.length > 0 && <CheckCircle className="w-4 h-4 text-green-400" />}
                                  {uploadingPhoto && <div className="text-xs text-cyan-400">Enviando...</div>}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    multiple
                                    onChange={(e) => e.target.files && handleUploadPecaPhoto(peca.id, 'nova', e.target.files)}
                                    className="hidden"
                                    disabled={uploadingPhoto}
                                  />
                                </label>

                                <label className="flex flex-col items-center gap-2 px-3 py-3 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:border-cyan-500/50 transition-colors">
                                  <Camera className="w-5 h-5 text-cyan-400" />
                                  <span className="text-xs text-gray-400">
                                    Fotos Peça Usada {pecaPhotos[peca.id]?.velha?.length > 0 && `(${pecaPhotos[peca.id].velha.length})`}
                                  </span>
                                  {pecaPhotos[peca.id]?.velha?.length > 0 && <CheckCircle className="w-4 h-4 text-green-400" />}
                                  {uploadingPhoto && <div className="text-xs text-cyan-400">Enviando...</div>}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    multiple
                                    onChange={(e) => e.target.files && handleUploadPecaPhoto(peca.id, 'velha', e.target.files)}
                                    className="hidden"
                                    disabled={uploadingPhoto}
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                <button
                  onClick={handleSavePecas}
                  disabled={pecas.filter(p => p.status === 'atendida').length > 0 && Object.keys(selectedPecaActions).length !== pecas.filter(p => p.status === 'atendida').length}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-5 h-5" />
                  {pecas.length === 0 ? 'Continuar' : pecas.filter(p => p.status === 'atendida').length > 0 ? 'Salvar Ações e Continuar' : 'Continuar'}
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
                    <span className="text-white font-medium">
                      Anexar Fotos <span className="text-red-400">*</span>
                    </span>
                    <span className="text-gray-400 text-sm text-center">
                      Tire as fotos e categorize cada uma
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleUploadEvidencia}
                      className="hidden"
                      disabled={uploadingPhoto}
                    />
                    <div className={`px-6 py-3 bg-cyan-500/20 border border-cyan-500/50 rounded-lg text-cyan-400 font-medium ${uploadingPhoto ? 'opacity-50' : ''}`}>
                      {uploadingPhoto ? 'Enviando...' : 'Adicionar Foto'}
                    </div>
                  </label>
                </div>

                {uploadedEvidencias.length > 0 && (
                  <div className="space-y-3">
                    <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3">
                      <p className="text-cyan-400 font-medium text-sm">
                        {uploadedEvidencias.length} foto(s) anexada(s)
                      </p>
                    </div>

                    {uploadedEvidencias.map((evidencia) => (
                      <div key={evidencia.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Camera className="w-4 h-4 text-cyan-400" />
                            <span className="text-white text-sm">{evidencia.nome}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveEvidencia(evidencia.id)}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            Remover
                          </button>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-gray-400 text-xs font-medium">
                            Tipo de Foto: {evidencia.tipo ? '✓' : '(selecione)'}
                          </label>
                          <select
                            value={evidencia.tipo || ''}
                            onChange={(e) => handleUpdateEvidenciaTipo(evidencia.id, e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                          >
                            <option value="">Selecione o tipo</option>
                            <option value="defeito">DEFEITO</option>
                            <option value="reparo">REPARO</option>
                            <option value="etiqueta_serial">ETIQUETA SERIAL</option>
                            <option value="nota_fiscal">NOTA FISCAL</option>
                            <option value="menu_servico">MENU DE SERVIÇO</option>
                            <option value="contador_erros">CONTADOR DE ERROS</option>
                            <option value="qrcode_barras">QR CODE/CÓDIGO DE BARRAS</option>
                            <option value="fachada">FACHADA</option>
                          </select>
                        </div>

                        {evidencia.tipo && (
                          <div className="flex items-center gap-2 text-xs text-green-400">
                            <CheckCircle className="w-4 h-4" />
                            <span>Categorizada</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => {
                    if (uploadedEvidencias.length === 0) {
                      alert('Por favor, anexe pelo menos uma foto antes de continuar.');
                      return;
                    }
                    const todasCategorizadas = uploadedEvidencias.every(e => e.tipo !== null);
                    if (!todasCategorizadas) {
                      alert('Por favor, categorize todas as fotos antes de continuar.');
                      return;
                    }
                    setCurrentStep('encerramento');
                  }}
                  disabled={uploadedEvidencias.length === 0 || !uploadedEvidencias.every(e => e.tipo !== null)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                disabled={isCheckingOut}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isCheckingOut ? (
                  <>
                    <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                    Processando Check-out...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-6 h-6" />
                    Finalizar Atendimento
                  </>
                )}
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
