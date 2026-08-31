import { X, MapPin, Phone, Mail, Package, DollarSign, Calendar, Clock, ExternalLink, FileText, RefreshCw, Activity, CheckCircle, XCircle, MessageCircle, Pencil, Route, AlertTriangle, History, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase, formatTipoAtendimento } from '../lib/supabase';
import { AnexoPreviewModal } from './AnexoPreviewModal';
import { WhatsAppSendModal } from './WhatsAppSendModal';
import { useGSPNSync } from '../hooks/useGSPNSync';
import { GSPNSyncIndicator } from './GSPNSyncIndicator';
import { GSPNSyncHistory } from './GSPNSyncHistory';
import { calcularESalvarKmCidade, getKmCidade } from '../lib/deslocamentoService';
import { getStoragePublicUrl } from '../lib/storageUtils';
import { useTheme } from '../contexts/ThemeContext';

interface OSDetailsModalProps {
  osId: string;
  onClose: () => void;
}

interface Job {
  id: string;
  unidade_id: string;
  os_id: string | null;
  modulo: string;
  status: string;
  is_running: boolean;
  created_at: string;
  finished_at: string | null;
  error_message: string | null;
  metadata: Record<string, any>;
}

interface OSDetails {
  id: string;
  numero_os_interna: string;
  numero_os_samsung: string | null;
  tipo_atendimento: 'IH' | 'CI';
  tipo_os: 'LP' | 'OW';
  rota: string;
  defeito_relatado: string | null;
  observacoes_internas: string | null;
  coluna_kanban: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  cliente_telefone_2: string | null;
  cliente_telefone_3: string | null;
  cliente_email: string | null;
  cliente_cep: string | null;
  cliente_logradouro: string | null;
  cliente_numero: string | null;
  cliente_complemento: string | null;
  cliente_bairro: string | null;
  cliente_cidade: string | null;
  cliente_estado: string | null;
  aparelho_marca: string | null;
  aparelho_modelo: string | null;
  aparelho_nserie: string | null;
  status_samsung_desc: string | null;
  status_samsung_reason: string | null;
  unidade_id: string;
  rota_id: string | null;
  agendamento?: {
    data_agendamento: string;
    confirmado_com_cliente: boolean;
    tecnico_nome?: string;
    checkout_pendente: boolean;
    status: string;
    horario_inicio?: string;
    horario_fim?: string;
  };
  status_pagamento: string;
  valor_total: number;
  valor_pago: number;
  saldo_restante: number;
  pagamentos?: Array<{
    valor: number;
    forma_pagamento: string;
    comprovante_url: string;
    data_lancamento: string;
  }>;
  pecas?: Array<{
    codigo_peca: string;
    descricao: string;
    pn: string;
    quantidade: number;
    valor_unitario: number;
    valor_gspn?: number;
    status: string;
    id_sequencial?: string;
    delivery?: string;
    tipo_peca?: 'gspn' | 'estoque';
  }>;
  anexos?: Array<{
    id: string;
    nome_arquivo: string;
    url: string;
    tipo: string;
    tamanho_bytes: number;
    created_at: string;
  }>;
}

const ROTA_COLORS: Record<string, string> = {
  'Rota 1': 'bg-red-100 text-red-700 border-red-300',
  'Rota 2': 'bg-orange-100 text-orange-700 border-orange-300',
  'Rota 3': 'bg-amber-100 text-amber-700 border-amber-300',
  'Rota 4': 'bg-lime-100 text-lime-700 border-lime-300',
  'Rota 5': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'Rota 6': 'bg-cyan-100 text-cyan-700 border-cyan-300',
  'Rota 7': 'bg-purple-100 text-purple-700 border-purple-300'
};

const normCidade = (c: string | null | undefined): string => {
  if (!c) return '';
  return c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
};

export default function OSDetailsModal({ osId, onClose }: OSDetailsModalProps) {
  const { isDark, themeInfo } = useTheme();
  const [osDetails, setOsDetails] = useState<OSDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [anexoPreview, setAnexoPreview] = useState<any>(null);
  const [showSyncHistory, setShowSyncHistory] = useState(false);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showRotaEditor, setShowRotaEditor] = useState(false);
  const [editCidade, setEditCidade] = useState('');
  const [selectedRotaColumn, setSelectedRotaColumn] = useState('');
  const [savingRota, setSavingRota] = useState(false);
  const [cidadeKm, setCidadeKm] = useState<{ distancia_km_ida_volta: number; receita_por_os: number } | null>(null);
  const [rotas, setRotas] = useState<Array<{ id: string; nome: string; coluna_kanban: string; cor: string; cidades: string[] }>>([]);
  const [showKmModal, setShowKmModal] = useState(false);
  const [kmInput, setKmInput] = useState('');
  const [editingTel2, setEditingTel2] = useState(false);
  const [tel2Value, setTel2Value] = useState('');
  const [savingTel2, setSavingTel2] = useState(false);
  const [editingTel3, setEditingTel3] = useState(false);
  const [tel3Value, setTel3Value] = useState('');
  const [savingTel3, setSavingTel3] = useState(false);

  const handleSaveTel2 = async () => {
    if (!osDetails) return;
    setSavingTel2(true);
    const val = tel2Value.trim() || null;
    const { data, error } = await supabase.from('os').update({ cliente_telefone_2: val }).eq('id', osDetails.id).select('cliente_telefone_2').single();
    if (!error && data) {
      setOsDetails({ ...osDetails, cliente_telefone_2: data.cliente_telefone_2 });
    }
    setEditingTel2(false);
    setSavingTel2(false);
  };

  const handleSaveTel3 = async () => {
    if (!osDetails) return;
    setSavingTel3(true);
    const val = tel3Value.trim() || null;
    const { data, error } = await supabase.from('os').update({ cliente_telefone_3: val }).eq('id', osDetails.id).select('cliente_telefone_3').single();
    if (!error && data) {
      setOsDetails({ ...osDetails, cliente_telefone_3: data.cliente_telefone_3 });
    }
    setEditingTel3(false);
    setSavingTel3(false);
  };

  const themeAccent = themeInfo.accent;
  const modalBg = isDark ? themeInfo.bg : '#ffffff';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const textPrimary = isDark ? '#f1f5f9' : '#111827';
  const textSecondary = isDark ? '#94a3b8' : '#6b7280';
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

  useEffect(() => {
    loadOSDetails();
    loadCurrentJob();
  }, [osId]);

  useEffect(() => {
    if (osDetails?.cliente_cidade && osDetails?.unidade_id && osDetails?.tipo_atendimento === 'IH') {
      getKmCidade(osDetails.unidade_id, osDetails.cliente_cidade).then(setCidadeKm);
    }
  }, [osDetails?.cliente_cidade, osDetails?.unidade_id]);

  useEffect(() => {
    if (!osDetails?.unidade_id) return;

    const channel = supabase
      .channel('jobs-changes-os')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `os_id=eq.${osId}`
        },
        () => {
          loadCurrentJob();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [osId, osDetails?.unidade_id]);

  async function loadCurrentJob() {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('os_id', osId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return;
    }

    setCurrentJob(data);
  }

  const hasSamsungOS = !!osDetails?.numero_os_samsung;
  const { isSyncing: syncingGSPN, syncError, mudancas, triggerSync, syncHistory, loadHistory } = useGSPNSync({
    osId: hasSamsungOS ? osId : null,
    autoRefreshOnOpen: true,
    onSyncComplete: () => { loadOSDetails(); },
  });

  async function loadOSDetails() {
    setLoading(true);
    try {
      const { data: os, error: osError } = await supabase
        .from('os')
        .select(`
          *,
          agendamentos (
            data_agendamento,
            confirmado_com_cliente,
            checkout_pendente,
            status,
            horario_inicio,
            horario_fim,
            tecnicos:tecnico_id (
              nome
            )
          ),
          pagamentos (
            valor,
            forma_pagamento,
            comprovante_url,
            data_lancamento
          )
        `)
        .eq('id', osId)
        .single();

      if (osError) throw osError;

      const { data: pecas } = await supabase
        .from('requisicoes_pecas')
        .select(`
          codigo_peca,
          descricao,
          quantidade_requisitada,
          status,
          estoque_pecas:peca_estoque_id (
            valor_gspn,
            pn,
            estoque_etiquetas (
              id_sequencial,
              delivery
            )
          )
        `)
        .eq('os_id', osId);

      const { data: osPecas } = await supabase
        .from('os_pecas')
        .select('*')
        .eq('os_id', osId);

      const { data: anexos } = await supabase
        .from('os_anexos')
        .select('id, nome_arquivo, url, tipo, tamanho_bytes, created_at')
        .eq('os_id', osId);

      const pecasRequisicao = pecas?.map((p: any) => ({
        codigo_peca: p.codigo_peca,
        descricao: p.descricao,
        pn: p.estoque_pecas?.pn || p.codigo_peca,
        quantidade: p.quantidade_requisitada || 1,
        valor_unitario: p.estoque_pecas?.valor_gspn || 0,
        status: p.status,
        id_sequencial: p.estoque_pecas?.estoque_etiquetas?.[0]?.id_sequencial,
        delivery: p.estoque_pecas?.estoque_etiquetas?.[0]?.delivery,
        tipo_peca: 'estoque' as const
      })) || [];

      const pecasGSPN = osPecas?.map((p: any) => ({
        codigo_peca: p.codigo || p.pn,
        descricao: p.descricao,
        pn: p.pn,
        quantidade: p.quantidade || 1,
        valor_unitario: p.valor_unitario || 0,
        valor_gspn: p.valor_gspn || 0,
        status: p.status || 'pendente',
        tipo_peca: 'gspn' as const
      })) || [];

      const pecasFormatted = [...pecasRequisicao, ...pecasGSPN];

      const osFormatted: OSDetails = {
        ...os,
        status_pagamento: os.status_pagamento || 'pendente',
        valor_total: os.valor_total || 0,
        valor_pago: os.valor_pago || 0,
        saldo_restante: os.saldo_restante || 0,
        agendamento: os.agendamentos?.[0] ? {
          data_agendamento: os.agendamentos[0].data_agendamento,
          confirmado_com_cliente: os.agendamentos[0].confirmado_com_cliente,
          tecnico_nome: os.agendamentos[0].tecnicos?.nome,
          checkout_pendente: os.agendamentos[0].checkout_pendente,
          status: os.agendamentos[0].status,
          horario_inicio: os.agendamentos[0].horario_inicio,
          horario_fim: os.agendamentos[0].horario_fim
        } : undefined,
        pagamentos: os.pagamentos || [],
        pecas: pecasFormatted,
        anexos: anexos || []
      };

      setOsDetails(osFormatted);
      if (osFormatted.unidade_id) loadRotas(osFormatted.unidade_id);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }

  async function loadRotas(unidadeId: string) {
    const { data } = await supabase
      .from('rotas')
      .select('id, nome, coluna_kanban, cor, cidades')
      .eq('unidade_id', unidadeId)
      .eq('ativa', true);
    if (data) setRotas(data);
  }

  async function handleSaveRotaCidade() {
    if (!osDetails || !selectedRotaColumn) return;
    setSavingRota(true);
    try {
      const cidadeCorrigida = editCidade.trim();
      const rotaExistente = rotas.find(r => r.coluna_kanban === selectedRotaColumn);

      let rotaId = rotaExistente?.id || null;

      if (rotaExistente && cidadeCorrigida) {
        const cidadesAtuais = rotaExistente.cidades || [];
        const cidadeNorm = cidadeCorrigida.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const jaExiste = cidadesAtuais.some(c => c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === cidadeNorm);
        if (!jaExiste) {
          await supabase
            .from('rotas')
            .update({ cidades: [...cidadesAtuais, cidadeCorrigida] })
            .eq('id', rotaExistente.id);
        }
      } else if (!rotaExistente) {
        const rotaColorMap: Record<string, { nome: string; cor: string }> = {
          'rota_preta': { nome: 'Rota Preta', cor: '#1a1a1a' },
          'rota_vermelha': { nome: 'Rota Vermelha', cor: '#EF4444' },
          'rota_azul': { nome: 'Rota Azul', cor: '#3B82F6' },
          'rota_verde': { nome: 'Rota Verde', cor: '#10B981' },
          'rota_rosa': { nome: 'Rota Rosa', cor: '#EC4899' },
          'rota_amarela': { nome: 'Rota Amarela', cor: '#EAB308' },
          'rota_laranja': { nome: 'Rota Laranja', cor: '#F97316' },
        };
        const rotaInfo = rotaColorMap[selectedRotaColumn];
        if (rotaInfo) {
          const { data: novaRota } = await supabase
            .from('rotas')
            .insert({
              nome: rotaInfo.nome,
              cor: rotaInfo.cor,
              coluna_kanban: selectedRotaColumn,
              cidades: cidadeCorrigida ? [cidadeCorrigida] : [],
              ativa: true,
              unidade_id: osDetails.unidade_id,
            })
            .select()
            .single();
          if (novaRota) rotaId = novaRota.id;
        }
      }

      const updateData: any = {
        rota_id: rotaId,
        updated_at: new Date().toISOString(),
      };
      if (cidadeCorrigida && cidadeCorrigida !== osDetails.cliente_cidade) {
        updateData.cliente_cidade = cidadeCorrigida;
      }

      await supabase.from('os').update(updateData).eq('id', osDetails.id);
      setOsDetails({ ...osDetails, ...updateData, rota_id: rotaId });
      setShowRotaEditor(false);
      await loadRotas(osDetails.unidade_id);

      if (cidadeCorrigida && osDetails.unidade_id) {
        const kmResult = await calcularESalvarKmCidade(osDetails.unidade_id, cidadeCorrigida, osDetails.cliente_estado || '');
        if (kmResult) {
          setCidadeKm(kmResult);
        } else {
          setKmInput('');
          setShowKmModal(true);
        }
      }
    } catch (err) {
      console.error('Erro ao salvar rota:', err);
    } finally {
      setSavingRota(false);
    }
  }

  async function handleSaveKmManual() {
    if (!osDetails?.unidade_id || !osDetails?.cliente_cidade) return;
    const kmIdaVolta = parseFloat(kmInput.replace(',', '.'));
    if (isNaN(kmIdaVolta) || kmIdaVolta <= 0) return;

    const TARIFA = 1.38;
    const receita = Math.round(kmIdaVolta * TARIFA * 100) / 100;
    const cidade = osDetails.cliente_cidade.trim();

    const { data: allKm } = await supabase
      .from('rotas_cidades_km')
      .select('id, cidade')
      .eq('unidade_id', osDetails.unidade_id);

    const normKmC = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const cidadeNormKm = normKmC(cidade);
    const existing = allKm?.find(row => normKmC(row.cidade) === cidadeNormKm) || null;

    if (existing) {
      await supabase
        .from('rotas_cidades_km')
        .update({
          distancia_km: Math.round(kmIdaVolta / 2 * 10) / 10,
          distancia_km_ida_volta: kmIdaVolta,
          receita_por_os: receita,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('rotas_cidades_km')
        .insert({
          unidade_id: osDetails.unidade_id,
          cidade,
          estado: osDetails.cliente_estado || null,
          distancia_km: Math.round(kmIdaVolta / 2 * 10) / 10,
          distancia_km_ida_volta: kmIdaVolta,
          receita_por_os: receita,
          calculado_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
    }

    setCidadeKm({ distancia_km_ida_volta: kmIdaVolta, receita_por_os: receita });
    setShowKmModal(false);
  }

  function handleOpenMaps(type: 'google' | 'waze') {
    if (!osDetails) return;

    const endereco = `${osDetails.cliente_logradouro}, ${osDetails.cliente_numero}, ${osDetails.cliente_bairro}, ${osDetails.cliente_cidade}, ${osDetails.cliente_estado}`;

    if (type === 'google') {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`, '_blank');
    } else {
      window.open(`https://waze.com/ul?q=${encodeURIComponent(endereco)}`, '_blank');
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)' }}>
        <div className="rounded-lg p-8" style={{ background: modalBg }}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!osDetails) {
    return null;
  }

  const enderecoCompleto = `${osDetails.cliente_logradouro}, ${osDetails.cliente_numero}${osDetails.cliente_complemento ? `, ${osDetails.cliente_complemento}` : ''}, ${osDetails.cliente_bairro}, ${osDetails.cliente_cidade} - ${osDetails.cliente_estado}, CEP: ${osDetails.cliente_cep}`;

  const getJobStatusIcon = () => {
    if (!currentJob) return null;
    if (currentJob.is_running) {
      return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />;
    }
    if (currentJob.status === 'concluido') {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    if (currentJob.status === 'erro') {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    return <Clock className="w-4 h-4 text-yellow-500" />;
  };

  const getJobStatusColor = () => {
    if (!currentJob) return '#9CA3AF';
    if (currentJob.is_running) return '#3B82F6';
    if (currentJob.status === 'concluido') return '#10B981';
    if (currentJob.status === 'erro') return '#EF4444';
    return '#F59E0B';
  };

  const getJobTimeElapsed = () => {
    if (!currentJob) return '-';
    const start = new Date(currentJob.created_at).getTime();
    const end = currentJob.finished_at
      ? new Date(currentJob.finished_at).getTime()
      : Date.now();
    const seconds = Math.floor((end - start) / 1000);

    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto" style={{ background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)' }}>
      <div className="rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" style={{ background: modalBg }}>
        <div className="sticky top-0 p-6 flex items-center justify-between z-10" style={{ background: modalBg, borderBottom: `1px solid ${borderColor}` }}>
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: textPrimary }}>OS {osDetails.numero_os_interna}</h2>
                {osDetails.numero_os_samsung && (
                  <p className="text-sm mt-1" style={{ color: textSecondary }}>Samsung: {osDetails.numero_os_samsung}</p>
                )}
              </div>
              {osDetails.cliente_telefone && (
                <button
                  onClick={() => setShowWhatsApp(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </button>
              )}
              {osDetails.numero_os_samsung && (
                <>
                  <button
                    onClick={triggerSync}
                    disabled={syncingGSPN || currentJob?.is_running}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncingGSPN || currentJob?.is_running ? 'animate-spin' : ''}`} />
                    {syncingGSPN || currentJob?.is_running ? 'Sincronizando...' : 'Atualizar GSPN'}
                  </button>
                  <button
                    onClick={() => { setShowSyncHistory(!showSyncHistory); if (!showSyncHistory) loadHistory(); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-white/10"
                    style={{ color: textSecondary }}
                    title="Histórico de sincronização"
                  >
                    <History className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: textSecondary }}
            onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* GSPN Sync Indicator */}
        {hasSamsungOS && (syncingGSPN || syncError || mudancas) && (
          <div className="px-6 pt-3 pb-3">
            <GSPNSyncIndicator isSyncing={syncingGSPN} syncError={syncError} mudancas={mudancas} />
          </div>
        )}

        {/* GSPN Sync History */}
        {showSyncHistory && (
          <div className="px-6 pt-3 pb-4">
            <div className="p-4 rounded-lg border" style={{ background: cardBg, borderColor: borderColor }}>
              <h4 className="text-sm font-semibold mb-3" style={{ color: textPrimary }}>Histórico de Sincronização</h4>
              <GSPNSyncHistory syncHistory={syncHistory} />
            </div>
          </div>
        )}

        {currentJob && (
          <div className="px-6 pt-4">
            <div
              className="p-3 rounded-lg border"
              style={{
                background: `linear-gradient(135deg, ${getJobStatusColor()}15 0%, ${getJobStatusColor()}05 100%)`,
                borderColor: `${getJobStatusColor()}40`
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{
                      background: `${getJobStatusColor()}20`,
                      border: `1px solid ${getJobStatusColor()}40`
                    }}
                  >
                    {getJobStatusIcon()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold" style={{ color: textPrimary }}>
                        {currentJob.is_running ? 'Sincronizando' : 'Última Sincronização'}
                      </h3>
                      {currentJob.is_running && (
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '200ms' }}></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '400ms' }}></div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs" style={{ color: textSecondary }}>
                        Status: <span className="font-medium" style={{ color: getJobStatusColor() }}>
                          {currentJob.is_running ? 'Em execução' : currentJob.status}
                        </span>
                      </p>
                      <span className="text-xs" style={{ color: textSecondary }}>•</span>
                      <p className="text-xs" style={{ color: textSecondary }}>
                        Tempo: <span className="font-medium" style={{ color: textPrimary }}>{getJobTimeElapsed()}</span>
                      </p>
                    </div>
                  </div>
                </div>
                {!currentJob.is_running && (
                  <div className="text-right">
                    <p className="text-[10px]" style={{ color: textSecondary }}>Finalizado em</p>
                    <p className="text-xs font-medium" style={{ color: textPrimary }}>
                      {currentJob.finished_at ? new Date(currentJob.finished_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '-'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="p-6 space-y-6">
          <div className="flex gap-2 flex-wrap items-center">
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${ROTA_COLORS[osDetails.rota] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
              {osDetails.rota}
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 border border-blue-300 rounded-full text-sm font-medium">
              {formatTipoAtendimento(osDetails.tipo_atendimento)}
            </span>
            <span className="px-3 py-1 bg-purple-100 text-purple-700 border border-purple-300 rounded-full text-sm font-medium">
              {osDetails.tipo_os}
            </span>
          </div>

          {osDetails.numero_os_samsung && (
            <div className="rounded-lg p-4 mb-6" style={{ background: isDark ? 'rgba(59,130,246,0.1)' : 'rgb(239,246,255)', border: isDark ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgb(191,219,254)' }}>
              <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: textPrimary }}>
                <FileText className="w-5 h-5 text-blue-500" />
                INFORMACAO DA OS
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span style={{ color: textSecondary }}>Status:</span>
                  <p className="font-medium" style={{ color: textPrimary }}>{osDetails.status_samsung_desc || '—'}</p>
                </div>
                <div>
                  <span style={{ color: textSecondary }}>Motivo:</span>
                  <p className="font-medium" style={{ color: textPrimary }}>{osDetails.status_samsung_reason || '—'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: textPrimary }}>
                  <Phone className="w-5 h-5" style={{ color: textSecondary }} />
                  Informações do Cliente
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span style={{ color: textSecondary }}>Nome:</span>
                    <p className="font-medium" style={{ color: textPrimary }}>{osDetails.cliente_nome}</p>
                  </div>
                  {osDetails.cliente_telefone && (
                    <div>
                      <span style={{ color: textSecondary }}>Telefone:</span>
                      <p className="font-medium" style={{ color: textPrimary }}>{osDetails.cliente_telefone}</p>
                    </div>
                  )}
                  <div>
                    <span style={{ color: textSecondary }}>Telefone 2:</span>
                    {editingTel2 ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={tel2Value}
                          onChange={(e) => setTel2Value(e.target.value)}
                          placeholder="(00) 00000-0000"
                          className="flex-1 px-2 py-1 text-sm rounded border outline-none"
                          style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: textPrimary }}
                          autoFocus
                        />
                        <button
                          onClick={handleSaveTel2}
                          disabled={savingTel2}
                          className="p-1 rounded hover:bg-green-500/20 text-green-400"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingTel2(false)}
                          className="p-1 rounded hover:bg-red-500/20 text-red-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="font-medium" style={{ color: textPrimary }}>
                          {osDetails.cliente_telefone_2 || '-'}
                        </p>
                        <button
                          onClick={() => { setTel2Value(osDetails.cliente_telefone_2 || ''); setEditingTel2(true); }}
                          className="p-1 rounded hover:bg-white/10"
                          title="Editar Telefone 2"
                        >
                          <Pencil className="w-3.5 h-3.5" style={{ color: textSecondary }} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <span style={{ color: textSecondary }}>Telefone 3:</span>
                    {editingTel3 ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={tel3Value}
                          onChange={(e) => setTel3Value(e.target.value)}
                          placeholder="(00) 00000-0000"
                          className="flex-1 px-2 py-1 text-sm rounded border outline-none"
                          style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: textPrimary }}
                          autoFocus
                        />
                        <button
                          onClick={handleSaveTel3}
                          disabled={savingTel3}
                          className="p-1 rounded hover:bg-green-500/20 text-green-400"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingTel3(false)}
                          className="p-1 rounded hover:bg-red-500/20 text-red-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="font-medium" style={{ color: textPrimary }}>
                          {osDetails.cliente_telefone_3 || '-'}
                        </p>
                        <button
                          onClick={() => { setTel3Value(osDetails.cliente_telefone_3 || ''); setEditingTel3(true); }}
                          className="p-1 rounded hover:bg-white/10"
                          title="Editar Telefone 3"
                        >
                          <Pencil className="w-3.5 h-3.5" style={{ color: textSecondary }} />
                        </button>
                      </div>
                    )}
                  </div>
                  {osDetails.cliente_email && (
                    <div>
                      <span style={{ color: textSecondary }}>Email:</span>
                      <p className="font-medium" style={{ color: textPrimary }}>{osDetails.cliente_email}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: textPrimary }}>
                  <MapPin className="w-5 h-5" style={{ color: textSecondary }} />
                  Endereco
                </h3>
                <p className="text-sm mb-2" style={{ color: textPrimary }}>{enderecoCompleto}</p>

                {/* Cidade + Rota inline editor */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {(() => {
                    const cidadeN = normCidade(osDetails.cliente_cidade);
                    const rotaAtual = cidadeN ? rotas.find(r => r.cidades?.some(c => normCidade(c) === cidadeN)) : null;
                    if (rotaAtual) {
                      return (
                        <span className="text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1" style={{ backgroundColor: `${rotaAtual.cor}20`, color: rotaAtual.cor }}>
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: rotaAtual.cor }} />
                          <Route className="w-3 h-3 inline" />
                          {osDetails.cliente_cidade || 'Sem cidade'}
                          <span className="ml-1">• {rotaAtual.nome}</span>
                        </span>
                      );
                    }
                    return (
                      <span className="text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1" style={{ backgroundColor: 'rgba(251,191,36,0.12)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.35)' }}>
                        <AlertTriangle className="w-3 h-3 inline" />
                        {osDetails.cliente_cidade || 'Sem cidade'}
                        <span className="ml-1">• Sem rota</span>
                      </span>
                    );
                  })()}
                  {cidadeKm && osDetails.tipo_atendimento === 'IH' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium cursor-pointer" onClick={() => { setKmInput(String(cidadeKm.distancia_km_ida_volta)); setShowKmModal(true); }}>
                      {cidadeKm.distancia_km_ida_volta} km i/v • R${cidadeKm.receita_por_os.toFixed(2)}
                    </span>
                  )}
                  {!cidadeKm && osDetails.tipo_atendimento === 'IH' && osDetails.cliente_cidade && (
                    <button
                      onClick={() => { setKmInput(''); setShowKmModal(true); }}
                      className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium hover:bg-amber-500/20 transition-colors"
                    >
                      + Adicionar KM
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditCidade(osDetails.cliente_cidade || '');
                      setSelectedRotaColumn(osDetails.coluna_kanban || '');
                      setShowRotaEditor(true);
                    }}
                    className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    style={{ color: textSecondary }}
                    title="Editar cidade e rota"
                  >
                    <Pencil className="w-3 h-3" />
                    Editar Rota
                  </button>
                </div>

                {showRotaEditor && (
                  <div className="mb-3 p-3 rounded-lg border" style={{ borderColor: `${textSecondary}30`, backgroundColor: `${textSecondary}05` }}>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: textSecondary }}>Cidade</label>
                        <input
                          type="text"
                          value={editCidade}
                          onChange={(e) => setEditCidade(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          style={{ borderColor: `${textSecondary}30`, color: textPrimary, backgroundColor: 'transparent' }}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: textSecondary }}>Rota</label>
                        <select
                          value={selectedRotaColumn}
                          onChange={(e) => setSelectedRotaColumn(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          style={{ borderColor: `${textSecondary}30`, color: textPrimary, backgroundColor: 'transparent' }}
                        >
                          <option value="">Selecionar rota...</option>
                          <option value="rota_preta">Rota Preta</option>
                          <option value="rota_vermelha">Rota Vermelha</option>
                          <option value="rota_azul">Rota Azul</option>
                          <option value="rota_verde">Rota Verde</option>
                          <option value="rota_rosa">Rota Rosa</option>
                          <option value="rota_amarela">Rota Amarela</option>
                          <option value="rota_laranja">Rota Laranja</option>
                        </select>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleSaveRotaCidade}
                          disabled={savingRota || !selectedRotaColumn}
                          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingRota ? 'Salvando...' : 'Confirmar'}
                        </button>
                        <button
                          onClick={() => setShowRotaEditor(false)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                          style={{ color: textSecondary }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenMaps('google')}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Google Maps
                  </button>
                  <button
                    onClick={() => handleOpenMaps('waze')}
                    className="flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Waze
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: textPrimary }}>
                  <Package className="w-5 h-5" style={{ color: textSecondary }} />
                  Aparelho
                </h3>
                <div className="space-y-2 text-sm">
                  {osDetails.aparelho_modelo && (
                    <div>
                      <span style={{ color: textSecondary }}>Modelo:</span>
                      <p className="font-medium" style={{ color: textPrimary }}>{osDetails.aparelho_modelo}</p>
                    </div>
                  )}
                  {osDetails.aparelho_nserie && (
                    <div>
                      <span style={{ color: textSecondary }}>Número de Série:</span>
                      <p className="font-medium" style={{ color: textPrimary }}>{osDetails.aparelho_nserie}</p>
                    </div>
                  )}
                </div>
              </div>

              {osDetails.defeito_relatado && (
                <div>
                  <h3 className="font-semibold mb-2" style={{ color: textPrimary }}>Defeito Relatado</h3>
                  <p className="text-sm p-3 rounded-lg" style={{ color: textPrimary, background: cardBg }}>
                    {osDetails.defeito_relatado}
                  </p>
                </div>
              )}

              {osDetails.observacoes_internas && (
                <div>
                  <h3 className="font-semibold mb-2" style={{ color: textPrimary }}>Observacoes Internas</h3>
                  <p className="text-sm p-3 rounded-lg" style={{ color: textPrimary, background: cardBg }}>
                    {osDetails.observacoes_internas}
                  </p>
                </div>
              )}
            </div>
          </div>

          {osDetails.agendamento && (
            <div className="pt-6" style={{ borderTop: `1px solid ${borderColor}` }}>
              <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: textPrimary }}>
                <Calendar className="w-5 h-5" style={{ color: textSecondary }} />
                Agendamento
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span style={{ color: textSecondary }}>Data:</span>
                  <p className="font-medium" style={{ color: textPrimary }}>
                    {new Date(osDetails.agendamento.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
                {osDetails.agendamento.tecnico_nome && (
                  <div>
                    <span style={{ color: textSecondary }}>Técnico:</span>
                    <p className="font-medium" style={{ color: textPrimary }}>{osDetails.agendamento.tecnico_nome}</p>
                  </div>
                )}
                <div>
                  <span style={{ color: textSecondary }}>Confirmacao:</span>
                  <p className="font-medium" style={{ color: textPrimary }}>
                    {osDetails.agendamento.confirmado_com_cliente ? 'Confirmado' : 'Nao confirmado'}
                  </p>
                </div>
                {osDetails.agendamento.horario_inicio && (
                  <div>
                    <span style={{ color: textSecondary }}>Horario:</span>
                    <p className="font-medium" style={{ color: textPrimary }}>
                      {osDetails.agendamento.horario_inicio.substring(0, 5)} - {osDetails.agendamento.horario_fim?.substring(0, 5) || ''}
                    </p>
                  </div>
                )}
                <div>
                  <span style={{ color: textSecondary }}>Status:</span>
                  <p className="font-medium capitalize" style={{ color: textPrimary }}>
                    {osDetails.agendamento.status?.replace('_', ' ') || 'Pendente'}
                  </p>
                </div>
                {osDetails.agendamento.checkout_pendente && (
                  <div className="md:col-span-2">
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 border border-yellow-300 rounded-full text-sm font-medium">
                      Aguardando movimentacao apos checkout
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pt-6" style={{ borderTop: `1px solid ${borderColor}` }}>
            <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: textPrimary }}>
              <DollarSign className="w-5 h-5" style={{ color: textSecondary }} />
              Informações Financeiras
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm mb-4">
              <div>
                <span style={{ color: textSecondary }}>Status:</span>
                <p className="font-medium capitalize" style={{ color: textPrimary }}>
                  {osDetails.status_pagamento.replace('_', ' ')}
                </p>
              </div>
              <div>
                <span style={{ color: textSecondary }}>Valor Total:</span>
                <p className="font-medium" style={{ color: textPrimary }}>
                  R$ {osDetails.valor_total.toFixed(2)}
                </p>
              </div>
              <div>
                <span style={{ color: textSecondary }}>Valor Pago:</span>
                <p className="font-medium text-green-500">
                  R$ {osDetails.valor_pago.toFixed(2)}
                </p>
              </div>
              <div>
                <span style={{ color: textSecondary }}>Saldo Restante:</span>
                <p className="font-medium text-orange-500">
                  R$ {osDetails.saldo_restante.toFixed(2)}
                </p>
              </div>
            </div>

            {osDetails.pagamentos && osDetails.pagamentos.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2" style={{ color: textSecondary }}>Pagamentos Recebidos</h4>
                <div className="space-y-2">
                  {osDetails.pagamentos.map((pagamento, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ background: cardBg }}
                    >
                      <div>
                        <p className="font-medium capitalize" style={{ color: textPrimary }}>
                          {pagamento.forma_pagamento.replace('_', ' ')}
                        </p>
                        <p className="text-sm" style={{ color: textSecondary }}>
                          {new Date(pagamento.data_lancamento).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-green-500">
                          R$ {pagamento.valor.toFixed(2)}
                        </p>
                        <a
                          href={pagamento.comprovante_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline"
                        >
                          Ver comprovante
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {osDetails.pecas && osDetails.pecas.length > 0 && (
            <div className="pt-6" style={{ borderTop: `1px solid ${borderColor}` }}>
              <h3 className="font-semibold mb-3" style={{ color: textPrimary }}>Peças Aprovadas</h3>
              <div className="space-y-2">
                {osDetails.pecas.map((peca, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg space-y-2"
                    style={{ background: cardBg }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-lg" style={{ color: textPrimary }}>{peca.pn}</p>
                          {peca.tipo_peca === 'gspn' && (
                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-medium rounded border border-blue-500/40">
                              GSPN
                            </span>
                          )}
                        </div>
                        <p className="text-sm mt-1" style={{ color: textSecondary }}>{peca.descricao}</p>
                        <div className="flex items-center gap-3 mt-2">
                          {peca.id_sequencial && (
                            <>
                              <span className="text-xs text-cyan-500 font-medium">ID: {peca.id_sequencial}</span>
                              <span style={{ color: textSecondary }}>•</span>
                            </>
                          )}
                          {peca.delivery && (
                            <>
                              <span className="text-xs text-orange-500 font-medium">Delivery: {peca.delivery}</span>
                              <span style={{ color: textSecondary }}>•</span>
                            </>
                          )}
                          <span className="text-xs" style={{ color: textSecondary }}>Codigo: {peca.codigo_peca}</span>
                          <span style={{ color: textSecondary }}>•</span>
                          <span className="text-xs" style={{ color: textSecondary }}>Qtd: {peca.quantidade}</span>
                        </div>
                        <div className="mt-2">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            peca.status === 'atendida' ? 'bg-green-500/20 text-green-400' :
                            peca.status === 'pendente' ? 'bg-yellow-500/20 text-yellow-400' :
                            peca.status === 'gi_postada' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {peca.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        {peca.tipo_peca === 'gspn' && peca.valor_gspn && peca.valor_gspn > 0 ? (
                          <>
                            <div className="mb-1">
                              <p className="text-xs" style={{ color: textSecondary }}>Valor GSPN:</p>
                              <p className="text-sm line-through" style={{ color: textSecondary }}>
                                R$ {peca.valor_gspn.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs" style={{ color: textSecondary }}>Valor Cobrado:</p>
                              <p className="font-medium text-green-500">
                                R$ {peca.valor_unitario.toFixed(2)}
                              </p>
                            </div>
                            <p className="text-sm mt-1" style={{ color: textSecondary }}>
                              Total: R$ {(peca.quantidade * peca.valor_unitario).toFixed(2)}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-medium" style={{ color: textPrimary }}>
                              R$ {peca.valor_unitario.toFixed(2)}
                            </p>
                            <p className="text-sm" style={{ color: textSecondary }}>
                              Total: R$ {(peca.quantidade * peca.valor_unitario).toFixed(2)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {osDetails.anexos && osDetails.anexos.length > 0 && (
            <div className="pt-6" style={{ borderTop: `1px solid ${borderColor}` }}>
              <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: textPrimary }}>
                <FileText className="w-5 h-5" style={{ color: textSecondary }} />
                Anexos
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {osDetails.anexos.map((anexo) => {
                  const publicUrl = getStoragePublicUrl(anexo.url);

                  return (
                    <button
                      key={anexo.id}
                      onClick={() => setAnexoPreview({ ...anexo, url: publicUrl })}
                      className="p-3 rounded-lg transition-colors"
                      style={{ border: `1px solid ${borderColor}`, background: cardBg }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = cardBg; }}
                    >
                      <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: textSecondary }} />
                      <p className="text-sm text-center truncate" style={{ color: textPrimary }}>
                        {anexo.nome_arquivo}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {anexoPreview && (
        <AnexoPreviewModal
          anexo={anexoPreview}
          onClose={() => setAnexoPreview(null)}
        />
      )}

      <WhatsAppSendModal
        isOpen={showWhatsApp}
        onClose={() => setShowWhatsApp(false)}
        osData={{
          id: osDetails.id,
          numero_os: osDetails.numero_os_interna,
          cliente_nome: osDetails.cliente_nome,
          cliente_telefone: osDetails.cliente_telefone || undefined,
          aparelho_modelo: osDetails.aparelho_modelo || undefined,
          valor_total: osDetails.valor_total,
          data_agendamento: osDetails.agendamento?.data_agendamento,
          unidade_id: osDetails.unidade_id,
        }}
      />

      {showKmModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e1e2e] border border-white/10 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-semibold text-lg mb-2">Distância KM (ida e volta)</h3>
            <p className="text-sm text-gray-400 mb-4">
              Cidade: <span className="text-white font-medium">{osDetails.cliente_cidade}</span>
            </p>
            <input
              type="text"
              value={kmInput}
              onChange={(e) => setKmInput(e.target.value)}
              placeholder="Ex: 320"
              className="w-full px-4 py-3 bg-[#2a2a3e] border border-white/10 rounded-lg text-white text-lg focus:outline-none focus:border-blue-500 mb-2"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveKmManual(); }}
            />
            {kmInput && !isNaN(parseFloat(kmInput.replace(',', '.'))) && parseFloat(kmInput.replace(',', '.')) > 0 && (
              <p className="text-sm text-emerald-400 mb-4">
                Receita: R$ {(parseFloat(kmInput.replace(',', '.')) * 1.38).toFixed(2)}
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowKmModal(false)}
                className="flex-1 px-4 py-2.5 border border-white/10 rounded-lg text-gray-300 hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveKmManual}
                disabled={!kmInput || isNaN(parseFloat(kmInput.replace(',', '.'))) || parseFloat(kmInput.replace(',', '.')) <= 0}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
