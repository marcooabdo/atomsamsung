import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Download, CheckCircle, AlertCircle, Clock, RefreshCw, Save, Edit, Smartphone, Settings } from 'lucide-react';

interface SamsungConfig {
  id: string;
  asc_code: string;
  token_api: string;
  dias_historico: number;
  company_code: string;
  country_code: string;
  language_code: string;
  ativo: boolean;
  ultima_sincronizacao: string | null;
}

interface SyncLog {
  id: string;
  iniciado_em: string;
  finalizado_em: string | null;
  status: string;
  total_os_encontradas: number | null;
  total_os_criadas: number | null;
  total_os_ignoradas: number | null;
  mensagem_erro: string | null;
}

export function SamsungGSPNTab() {
  const [config, setConfig] = useState<SamsungConfig | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    asc_code: '',
    token_api: '',
    dias_historico: 7,
    company_code: 'C820',
    country_code: 'BR',
    language_code: 'EN',
    ativo: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('unidade_id')
        .eq('auth_user_id', session.user.id)
        .single();

      if (!usuario) return;

      const { data: configData } = await supabase
        .from('samsung_api_configs')
        .select('*')
        .eq('unidade_id', usuario.unidade_id)
        .maybeSingle();

      if (configData) {
        setConfig(configData);
        setFormData({
          asc_code: configData.asc_code,
          token_api: configData.token_api,
          dias_historico: configData.dias_historico,
          company_code: configData.company_code,
          country_code: configData.country_code,
          language_code: configData.language_code,
          ativo: configData.ativo
        });
      } else {
        setEditing(true);
      }

      const { data: logsData } = await supabase
        .from('samsung_sync_logs')
        .select('*')
        .eq('unidade_id', usuario.unidade_id)
        .order('created_at', { ascending: false })
        .limit(10);

      setSyncLogs(logsData || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.asc_code || !formData.token_api) {
      setMessage({ type: 'error', text: 'AscCode e Token API são obrigatórios' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('unidade_id')
        .eq('auth_user_id', session.user.id)
        .single();

      if (!usuario) return;

      if (config) {
        await supabase
          .from('samsung_api_configs')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', config.id);
      } else {
        await supabase
          .from('samsung_api_configs')
          .insert({
            ...formData,
            unidade_id: usuario.unidade_id
          });
      }

      setMessage({ type: 'success', text: 'Configuração salva com sucesso!' });
      setEditing(false);
      loadData();
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao salvar configuração'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    if (!config || importing) return;

    setImporting(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage({ type: 'error', text: 'Sessão não encontrada' });
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-samsung-gspn`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage({
          type: 'error',
          text: result.error || 'Erro ao importar OS Samsung'
        });
        return;
      }

      setMessage({
        type: 'success',
        text: `Importação concluída! ${result.total_criadas} OS criadas, ${result.total_ignoradas} já existentes de ${result.total_encontradas} encontradas.`
      });

      loadData();
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro desconhecido ao importar OS'
      });
    } finally {
      setImporting(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (updatingStatus) return;

    setUpdatingStatus(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage({ type: 'error', text: 'Sessão não encontrada' });
        return;
      }

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('unidade_id')
        .eq('auth_user_id', session.user.id)
        .single();

      if (!usuario?.unidade_id) {
        setMessage({ type: 'error', text: 'Usuário sem unidade vinculada' });
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-samsung-status`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ unidade_id: usuario.unidade_id })
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage({
          type: 'error',
          text: result.error || 'Erro ao atualizar status Samsung'
        });
        return;
      }

      setMessage({
        type: 'success',
        text: `Atualização concluída! ${result.total_atualizadas} OS atualizadas de ${result.total_os_sistema} no sistema.`
      });

      loadData();
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro desconhecido ao atualizar status'
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'concluido':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'erro':
      case 'concluido_com_erros':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'em_progresso':
        return <Clock className="w-5 h-5 text-yellow-400 animate-pulse" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'concluido':
        return 'Concluído';
      case 'erro':
        return 'Erro';
      case 'concluido_com_erros':
        return 'Concluído com erros';
      case 'em_progresso':
        return 'Em progresso';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="premium-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#1428A0]/20 border-2 border-[#1428A0] flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-[#1428A0]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Configuração Samsung GSPN</h3>
              <p className="text-gray-400 text-sm">
                Configure a integração com a API Samsung para sua unidade
              </p>
            </div>
          </div>
          {config && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#00D4FF]/30 text-[#00D4FF] hover:bg-[#00D4FF]/10 transition-colors"
            >
              <Edit className="w-4 h-4" />
              EDITAR
            </button>
          )}
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              message.type === 'success'
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {message.text}
          </div>
        )}

        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  AscCode <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.asc_code}
                  onChange={(e) => setFormData({ ...formData, asc_code: e.target.value })}
                  placeholder="Ex: 5959883"
                  className="neon-input"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Token API <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.token_api}
                  onChange={(e) => setFormData({ ...formData, token_api: e.target.value })}
                  placeholder="Ex: 886c22d6-3c82-338e-9359-45f0dbd53c70"
                  className="neon-input"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Dias de Histórico</label>
                <input
                  type="number"
                  value={formData.dias_historico}
                  onChange={(e) => setFormData({ ...formData, dias_historico: parseInt(e.target.value) })}
                  min="1"
                  max="30"
                  className="neon-input"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Company Code</label>
                <input
                  type="text"
                  value={formData.company_code}
                  onChange={(e) => setFormData({ ...formData, company_code: e.target.value })}
                  className="neon-input"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Country Code</label>
                <input
                  type="text"
                  value={formData.country_code}
                  onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                  className="neon-input"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Language Code</label>
                <input
                  type="text"
                  value={formData.language_code}
                  onChange={(e) => setFormData({ ...formData, language_code: e.target.value })}
                  className="neon-input"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ativo"
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#00D4FF]"
              />
              <label htmlFor="ativo" className="text-sm text-gray-300">
                Integração ativa
              </label>
            </div>

            <div className="flex gap-3 pt-4 border-t border-white/10">
              <button
                onClick={handleSave}
                disabled={saving}
                className="neon-button flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    SALVANDO...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    SALVAR CONFIGURAÇÃO
                  </>
                )}
              </button>
              {config && (
                <button
                  onClick={() => {
                    setEditing(false);
                    setFormData({
                      asc_code: config.asc_code,
                      token_api: config.token_api,
                      dias_historico: config.dias_historico,
                      company_code: config.company_code,
                      country_code: config.country_code,
                      language_code: config.language_code,
                      ativo: config.ativo
                    });
                  }}
                  className="px-6 py-3 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800/60 transition-colors"
                >
                  CANCELAR
                </button>
              )}
            </div>
          </div>
        ) : config ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="text-sm text-gray-400 mb-1">AscCode</div>
                <div className="text-lg font-bold text-[#1428A0]">{config.asc_code}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="text-sm text-gray-400 mb-1">Dias de histórico</div>
                <div className="text-lg font-bold text-white">{config.dias_historico} dias</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="text-sm text-gray-400 mb-1">Última sincronização</div>
                <div className="text-sm font-bold text-white">
                  {formatDateTime(config.ultima_sincronizacao)}
                </div>
              </div>
            </div>

            <button
              onClick={handleImport}
              disabled={importing || !config.ativo}
              className="neon-button w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  IMPORTANDO...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  ATUALIZAR - IMPORTAR OS DOS ÚLTIMOS {config.dias_historico} DIAS
                </>
              )}
            </button>

            <button
              onClick={handleUpdateStatus}
              disabled={updatingStatus || !config.ativo}
              className="neon-button-secondary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updatingStatus ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  ATUALIZANDO STATUS...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  ATUALIZAR STATUS/MOTIVO DAS OS EXISTENTES
                </>
              )}
            </button>
          </>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">Nenhuma configuração encontrada</p>
            <p className="text-sm text-gray-500 mb-6">Configure a integração Samsung GSPN para começar a sincronizar ordens de serviço</p>
            <button
              onClick={() => setEditing(true)}
              className="neon-button inline-flex items-center gap-2"
            >
              <Settings className="w-5 h-5" />
              ADICIONAR CONFIGURAÇÃO
            </button>
          </div>
        )}
      </div>

      {syncLogs.length > 0 && (
        <div className="premium-card">
          <h3 className="text-lg font-bold text-white mb-4">Histórico de Sincronizações</h3>

          <div className="space-y-3">
            {syncLogs.map((log) => (
              <div
                key={log.id}
                className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-[#00D4FF]/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(log.status)}
                    <span className="font-bold text-white">{getStatusText(log.status)}</span>
                  </div>
                  <div className="text-sm text-gray-400">{formatDateTime(log.iniciado_em)}</div>
                </div>

                {log.status !== 'em_progresso' && (
                  <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-white/10">
                    <div>
                      <div className="text-xs text-gray-400">Encontradas</div>
                      <div className="text-lg font-bold text-white">
                        {log.total_os_encontradas || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Criadas</div>
                      <div className="text-lg font-bold text-green-400">
                        {log.total_os_criadas || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Ignoradas</div>
                      <div className="text-lg font-bold text-yellow-400">
                        {log.total_os_ignoradas || 0}
                      </div>
                    </div>
                  </div>
                )}

                {log.mensagem_erro && (
                  <div className="mt-3 pt-3 border-t border-red-500/20">
                    <div className="text-xs text-gray-400 mb-1">Erro:</div>
                    <div className="text-sm text-red-400">{log.mensagem_erro}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
