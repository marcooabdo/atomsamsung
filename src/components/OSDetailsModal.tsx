import { X, MapPin, Phone, Mail, Package, DollarSign, Calendar, Clock, ExternalLink, FileText, RefreshCw, Activity, CheckCircle, XCircle, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase, formatTipoAtendimento } from '../lib/supabase';
import { AnexoPreviewModal } from './AnexoPreviewModal';
import { WhatsAppSendModal } from './WhatsAppSendModal';
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

export default function OSDetailsModal({ osId, onClose }: OSDetailsModalProps) {
  const { isDark, themeInfo } = useTheme();
  const [osDetails, setOsDetails] = useState<OSDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [anexoPreview, setAnexoPreview] = useState<any>(null);
  const [syncingGSPN, setSyncingGSPN] = useState(false);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [showWhatsApp, setShowWhatsApp] = useState(false);

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

  async function syncGSPN() {
    if (!osDetails?.numero_os_samsung) {
      alert('Esta OS não possui número Samsung para sincronizar');
      return;
    }

    if (currentJob?.is_running) {
      alert('Já existe uma sincronização em andamento para esta OS');
      return;
    }

    setSyncingGSPN(true);
    try {
      const { data: unidadeData } = await supabase
        .from('unidades')
        .select('nome, samsung_asccode, samsung_token')
        .eq('id', osDetails.unidade_id)
        .single();

      if (!unidadeData) {
        alert('Unidade não encontrada');
        return;
      }

      if (!unidadeData.samsung_asccode || !unidadeData.samsung_token) {
        alert('Unidade sem configuração Samsung (ASC Code ou Token não configurados)');
        return;
      }

      const response = await fetch('https://atom-n8n.2vhnbz.easypanel.host/webhook/atualizar-os/one', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ascCode: unidadeData.samsung_asccode,
          tokenApi: unidadeData.samsung_token,
          filial: unidadeData.nome.toLowerCase(),
          unidade_id: osDetails.unidade_id,
          numero_os: osDetails.numero_os_samsung
        }),
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        await loadOSDetails();
        await loadCurrentJob();
      } else {
        alert(`Erro na sincronização: ${result.message || 'Erro desconhecido'}`);
      }
    } catch (error) {
      alert(`Erro ao sincronizar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setSyncingGSPN(false);
    }
  }

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
    } catch (error) {
    } finally {
      setLoading(false);
    }
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
                <button
                  onClick={syncGSPN}
                  disabled={syncingGSPN || currentJob?.is_running}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${syncingGSPN || currentJob?.is_running ? 'animate-spin' : ''}`} />
                  {syncingGSPN || currentJob?.is_running ? 'Sincronizando...' : 'Atualizar GSPN'}
                </button>
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
                  Informacoes do Cliente
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
                <p className="text-sm mb-3" style={{ color: textPrimary }}>{enderecoCompleto}</p>
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
                      <span style={{ color: textSecondary }}>Numero de Serie:</span>
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
                    <span style={{ color: textSecondary }}>Tecnico:</span>
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
              Informacoes Financeiras
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
              <h3 className="font-semibold mb-3" style={{ color: textPrimary }}>Pecas Aprovadas</h3>
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
    </div>
  );
}
