import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  MessageCircle,
  Send,
  Loader2,
  Check,
  AlertTriangle,
  Eye,
  ChevronRight,
  Clock,
  Phone,
  Link as LinkIcon,
  Copy,
  RefreshCw
} from 'lucide-react';

interface WhatsAppSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  osData?: {
    id?: string;
    numero_os?: string;
    cliente_nome?: string;
    cliente_telefone?: string;
    aparelho_modelo?: string;
    valor_total?: number;
    data_agendamento?: string;
    periodo_agendamento?: string;
    unidade_id?: string;
  };
  defaultTemplateSlug?: string;
}

interface Template {
  id: string;
  nome: string;
  slug: string;
  categoria: string;
  conteudo: string;
  variaveis: string[];
  ativo: boolean;
}

interface EnvioLog {
  id: string;
  destinatario_nome: string;
  destinatario_telefone: string;
  mensagem_enviada: string;
  status: string;
  dry_run: boolean;
  created_at: string;
}

export function WhatsAppSendModal({ isOpen, onClose, osData, defaultTemplateSlug }: WhatsAppSendModalProps) {
  const { usuario } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [telefone, setTelefone] = useState('');
  const [nomeDestinatario, setNomeDestinatario] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; isDryRun: boolean; mensagem: string } | null>(null);
  const [recentLogs, setRecentLogs] = useState<EnvioLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [error, setError] = useState('');
  const [orcamentoLink, setOrcamentoLink] = useState<string | null>(null);
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [loadingLink, setLoadingLink] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      loadRecentLogs();
      prefillFromOS();
      if (osData?.id) {
        loadExistingLink();
      }
    } else {
      // Limpar estados ao fechar o modal
      setSelectedTemplate(null);
      setResult(null);
      setError('');
      setLinkCopied(false);
    }
  }, [isOpen, osData?.id]);

  const loadExistingLink = async () => {
    console.log('=== loadExistingLink chamado ===');
    console.log('osData:', osData);

    if (!osData?.id) {
      console.log('Sem osData.id, limpando links');
      setOrcamentoLink(null);
      setLinkExpiresAt(null);
      return;
    }

    console.log('Buscando link para OS:', osData.id);
    setLoadingLink(true);
    try {
      const { data, error } = await supabase
        .from('orcamento_links')
        .select('token, expires_at, status')
        .eq('os_id', osData.id)
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar link:', error);
        setOrcamentoLink(null);
        setLinkExpiresAt(null);
        return;
      }

      if (data?.token) {
        // Verificar se o link expirou
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          console.log('Link expirado:', data.expires_at);
          setOrcamentoLink(null);
          setLinkExpiresAt(null);
          return;
        }
        const baseUrl = window.location.origin;
        const fullLink = `${baseUrl}/orcamento/${data.token}`;
        console.log('Link encontrado:', fullLink);
        setOrcamentoLink(fullLink);
        setLinkExpiresAt(data.expires_at);
      } else {
        console.log('Nenhum link ativo encontrado para OS:', osData.id);
        setOrcamentoLink(null);
        setLinkExpiresAt(null);
      }
    } catch (err) {
      console.error('Erro ao carregar link:', err);
      setOrcamentoLink(null);
      setLinkExpiresAt(null);
    } finally {
      setLoadingLink(false);
    }
  };

  const handleGenerateLink = async (forceNew = false) => {
    if (!osData?.id) return;

    setGeneratingLink(true);
    try {
      const rpcName = forceNew ? 'regenerate_orcamento_link' : 'upsert_orcamento_link';
      console.log(`Chamando ${rpcName} para OS:`, osData.id);

      const { data, error } = await supabase.rpc(rpcName, {
        p_os_id: osData.id
      });

      if (error) {
        console.error('Erro na RPC:', error);
        throw error;
      }

      console.log('Resposta da RPC:', data);

      if (data && data.length > 0) {
        const token = data[0].token;
        const expiresAt = data[0].expires_at;
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/orcamento/${token}`;

        console.log('Link gerado:', link);
        setOrcamentoLink(link);
        setLinkExpiresAt(expiresAt);

        try {
          await supabase.from('os_comentarios').insert({
            os_id: osData.id,
            usuario_id: usuario?.id,
            comentario: `Link de orcamento ${forceNew ? 'REGENERADO' : 'gerado'} para o cliente. Valido por 72 horas (ate ${new Date(expiresAt).toLocaleString('pt-BR')})`,
            is_system: false
          });
        } catch (commentErr) {
          console.error('Erro ao adicionar comentario:', commentErr);
        }

        await loadExistingLink();
      } else {
        console.error('RPC nao retornou dados');
        throw new Error('Falha ao gerar link');
      }
    } catch (err: any) {
      console.error('Erro ao gerar link:', err);
      alert(`Erro ao gerar link: ${err.message}`);
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (!orcamentoLink) return;

    navigator.clipboard.writeText(orcamentoLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  useEffect(() => {
    if (defaultTemplateSlug && templates.length > 0) {
      const t = templates.find(t => t.slug === defaultTemplateSlug);
      if (t) selectTemplate(t);
    }
  }, [templates, defaultTemplateSlug]);

  const prefillFromOS = () => {
    if (!osData) return;
    setTelefone(osData.cliente_telefone || '');
    setNomeDestinatario(osData.cliente_nome || '');
  };

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('ativo', true)
      .order('categoria');
    setTemplates((data || []).filter(t => t.slug && t.slug !== ''));
  };

  const loadRecentLogs = async () => {
    let query = supabase
      .from('whatsapp_envios')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (osData?.id) {
      query = query.eq('os_id', osData.id);
    }
    const { data } = await query;
    setRecentLogs(data || []);
  };

  const selectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setResult(null);
    setError('');

    const vars: Record<string, string> = {};
    for (const v of template.variaveis || []) {
      if (v === 'cliente_nome') vars[v] = osData?.cliente_nome || '';
      else if (v === 'numero_os') vars[v] = osData?.numero_os || '';
      else if (v === 'equipamento') vars[v] = osData?.aparelho_modelo || '';
      else if (v === 'valor_total') vars[v] = osData?.valor_total?.toFixed(2) || '0.00';
      else if (v === 'data_agendamento') vars[v] = osData?.data_agendamento ? new Date(osData.data_agendamento).toLocaleDateString('pt-BR') : '';
      else if (v === 'periodo') vars[v] = osData?.periodo_agendamento || 'manha';
      else vars[v] = '';
    }
    setVarValues(vars);
  };

  const renderPreview = () => {
    if (!selectedTemplate) return '';
    let text = selectedTemplate.conteudo;
    for (const [key, val] of Object.entries(varValues)) {
      text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || `[${key}]`);
    }
    return text;
  };

  const handleSend = async () => {
    if (!selectedTemplate || !telefone) return;
    setSending(true);
    setError('');
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Sessao expirada');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-send`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          templateSlug: selectedTemplate.slug,
          destinatarioTelefone: telefone,
          destinatarioNome: nomeDestinatario,
          variaveis: varValues,
          osId: osData?.id || null,
          unidadeId: osData?.unidade_id || usuario?.unidade_id || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Erro ao enviar');
        return;
      }

      setResult({
        success: true,
        isDryRun: data.isDryRun,
        mensagem: data.mensagem,
      });
      loadRecentLogs();
    } catch (err) {
      setError('Erro de conexao');
    } finally {
      setSending(false);
    }
  };

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return phone;
  };

  const categoriaLabels: Record<string, string> = {
    agendamento: 'Agendamento',
    orcamento: 'Orcamento',
    conclusao: 'Conclusao',
    pecas: 'Pecas',
    geral: 'Geral',
  };

  const categoriaColors: Record<string, string> = {
    agendamento: '#0EA5E9',
    orcamento: '#F59E0B',
    conclusao: '#10B981',
    pecas: '#06B6D4',
    geral: '#6B7280',
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden" style={{
        background: 'var(--bg-card)',
        border: '1px solid rgba(var(--accent-rgb),0.3)',
        boxShadow: 'var(--card-shadow)'
      }}>
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{
              background: 'rgba(37,211,102,0.12)',
              border: '1px solid rgba(37,211,102,0.3)'
            }}>
              <MessageCircle className="w-5 h-5" style={{ color: '#25D366' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>WhatsApp</h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Enviar mensagem ao cliente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {osData?.id && (
            <div className="rounded-xl p-4" style={{
              background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.3)'
            }}>
              <div className="flex items-center gap-2 mb-3">
                <LinkIcon className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-bold text-blue-300">Link de Aprovação do Orçamento</span>
              </div>

              {loadingLink ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                  <span className="ml-2 text-sm text-gray-400">Carregando link...</span>
                </div>
              ) : orcamentoLink ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{
                    background: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.3)'
                  }}>
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-xs text-green-400 font-medium">Link ativo e valido</span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={orcamentoLink}
                      readOnly
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-mono"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(var(--accent-rgb),0.25)', color: 'var(--text-primary)' }}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-2 rounded-lg transition-all flex items-center gap-2"
                      style={{
                        background: linkCopied ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)',
                        border: `1px solid ${linkCopied ? 'rgba(16,185,129,0.4)' : 'rgba(59,130,246,0.4)'}`,
                        color: linkCopied ? '#10b981' : '#3b82f6'
                      }}
                    >
                      {linkCopied ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span className="text-xs font-medium">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span className="text-xs font-medium">Copiar</span>
                        </>
                      )}
                    </button>
                  </div>

                  {linkExpiresAt && (
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span className="text-amber-400">
                        Valido ate: {new Date(linkExpiresAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-blue-600/20">
                    <button
                      onClick={() => {
                        if (confirm('Isto irá INVALIDAR o link atual e gerar um NOVO link. O link antigo não funcionará mais. Deseja continuar?')) {
                          handleGenerateLink(true);
                        }
                      }}
                      disabled={generatingLink}
                      className="w-full py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-xs"
                      style={{
                        background: 'rgba(245,158,11,0.15)',
                        border: '1px solid rgba(245,158,11,0.4)',
                        color: '#f59e0b'
                      }}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${generatingLink ? 'animate-spin' : ''}`} />
                      <span className="font-medium">Gerar Novo Link (invalida o anterior)</span>
                    </button>
                  </div>

                  <p className="text-xs text-blue-400">
                    Este link permanece valido por 72 horas. O cliente pode aprovar, rejeitar ou negociar o orcamento. Gere um novo link apenas se o orcamento foi alterado.
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => handleGenerateLink(false)}
                  disabled={generatingLink}
                  className="w-full py-2.5 rounded-lg transition-all flex items-center justify-center gap-2"
                  style={{
                    background: 'rgba(59,130,246,0.2)',
                    border: '1px solid rgba(59,130,246,0.4)',
                    color: '#3b82f6'
                  }}
                >
                  {generatingLink ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm font-medium">Gerando link...</span>
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">Gerar Link de Aprovação</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {!selectedTemplate ? (
            <div className="space-y-3">
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Selecione um template:</p>
              {Object.entries(
                templates.reduce<Record<string, Template[]>>((acc, t) => {
                  const cat = t.categoria || 'geral';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(t);
                  return acc;
                }, {})
              ).map(([cat, tpls]) => (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: categoriaColors[cat] || '#6B7280' }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{categoriaLabels[cat] || cat}</span>
                  </div>
                  <div className="space-y-2">
                    {tpls.map(t => (
                      <button
                        key={t.id}
                        onClick={() => selectTemplate(t)}
                        className="w-full text-left p-3 rounded-xl transition-all"
                        style={{ background: 'rgba(var(--accent-rgb),0.04)', border: '1px solid rgba(var(--accent-rgb),0.12)' }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.08)';
                          e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb),0.25)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.04)';
                          e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb),0.12)';
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.nome}</span>
                          <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                        </div>
                        <p className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--text-secondary)' }}>{t.conteudo}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setSelectedTemplate(null); setResult(null); setError(''); }}
                  className="text-xs transition-colors"
                  style={{ color: 'var(--text-accent)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                >
                  ← Voltar aos templates
                </button>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{
                  background: `${categoriaColors[selectedTemplate.categoria] || '#6B7280'}20`,
                  color: categoriaColors[selectedTemplate.categoria] || '#6B7280',
                  border: `1px solid ${categoriaColors[selectedTemplate.categoria] || '#6B7280'}30`
                }}>
                  {selectedTemplate.nome}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Telefone</label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid rgba(var(--accent-rgb),0.25)'
                  }}>
                    <Phone className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                    <input
                      type="text"
                      value={telefone}
                      onChange={e => setTelefone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="flex-1 bg-transparent text-sm outline-none"
                      style={{ color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Nome</label>
                  <input
                    type="text"
                    value={nomeDestinatario}
                    onChange={e => setNomeDestinatario(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(var(--accent-rgb),0.25)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {(selectedTemplate.variaveis || []).filter(v => v !== 'cliente_nome').length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Variaveis:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(selectedTemplate.variaveis || []).filter(v => v !== 'cliente_nome').map(v => (
                      <div key={v}>
                        <label className="block text-[10px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>{v.replace(/_/g, ' ')}</label>
                        <input
                          type="text"
                          value={varValues[v] || ''}
                          onChange={e => setVarValues(prev => ({ ...prev, [v]: e.target.value }))}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
                          style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(var(--accent-rgb),0.2)', color: 'var(--text-primary)' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl p-4" style={{
                background: 'rgba(var(--accent-rgb),0.06)',
                border: '1px solid rgba(var(--accent-rgb),0.2)'
              }}>
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-3.5 h-3.5" style={{ color: 'var(--text-accent)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-accent)' }}>Pré-visualização</span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{renderPreview()}</p>
              </div>

              {result && (
                <div className="rounded-xl p-4" style={{
                  background: result.isDryRun ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                  border: `1px solid ${result.isDryRun ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`
                }}>
                  <div className="flex items-center gap-2">
                    {result.isDryRun ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span className="text-sm text-amber-300 font-medium">Modo Simulacao (Dry Run)</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-green-300 font-medium">Mensagem enviada com sucesso</span>
                      </>
                    )}
                  </div>
                  {result.isDryRun && (
                    <p className="text-xs text-gray-400 mt-1">A mensagem foi registrada mas não enviada (API WhatsApp não configurada)</p>
                  )}
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
            </div>
          )}

          {recentLogs.length > 0 && (
            <div>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="flex items-center gap-2 text-xs transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <Clock className="w-3.5 h-3.5" />
                {showLogs ? 'Ocultar histórico' : `Histórico de envios (${recentLogs.length})`}
              </button>
              {showLogs && (
                <div className="mt-2 space-y-1.5">
                  {recentLogs.map(log => (
                    <div key={log.id} className="p-2.5 rounded-lg text-xs" style={{
                      background: 'rgba(var(--accent-rgb),0.04)',
                      border: '1px solid rgba(var(--accent-rgb),0.12)'
                    }}>
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ color: 'var(--text-primary)' }}>{log.destinatario_nome || formatPhone(log.destinatario_telefone)}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          log.status === 'enviado' ? 'bg-green-500/20 text-green-400' :
                          log.status === 'dry_run' ? 'bg-amber-500/20 text-amber-400' :
                          log.status === 'falha' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {log.dry_run ? 'simulado' : log.status}
                        </span>
                      </div>
                      <p className="line-clamp-1" style={{ color: 'var(--text-secondary)' }}>{log.mensagem_enviada}</p>
                      <span className="text-[10px]" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            Fechar
          </button>
          {selectedTemplate && (
            <button
              onClick={handleSend}
              disabled={sending || !telefone}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              style={{
                background: sending ? 'rgba(37,211,102,0.1)' : 'linear-gradient(135deg, #25D366, #128C7E)',
                border: '1px solid rgba(37,211,102,0.4)',
                boxShadow: sending ? 'none' : '0 0 20px rgba(37,211,102,0.2)'
              }}
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-green-300" />
                  <span className="text-green-300">Enviando...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-white" />
                  <span className="text-white">Enviar WhatsApp</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
