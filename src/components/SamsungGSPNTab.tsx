import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Download, CheckCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react';

interface SamsungConfig {
  id: string;
  asc_code: string;
  ambiente_ativo: 'dev' | 'prod';
  dias_historico: number;
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
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        .eq('auth_id', session.user.id)
        .single();

      if (!usuario) return;

      const { data: configData } = await supabase
        .from('samsung_api_configs')
        .select('*')
        .eq('unidade_id', usuario.unidade_id)
        .maybeSingle();

      setConfig(configData);

      const { data: logsData } = await supabase
        .from('samsung_sync_logs')
        .select('*')
        .eq('unidade_id', usuario.unidade_id)
        .order('created_at', { ascending: false })
        .limit(10);

      setSyncLogs(logsData || []);
    } catch (error) {
      console.error('Erro ao carregar dados Samsung:', error);
    } finally {
      setLoading(false);
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
      console.error('Erro na importação:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro desconhecido ao importar OS'
      });
    } finally {
      setImporting(false);
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

  if (!config) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Configuração não encontrada</h3>
        <p className="text-gray-400">
          A integração com Samsung GSPN não está configurada para esta unidade.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="premium-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Sincronização Samsung GSPN</h3>
            <p className="text-gray-400">
              Importe ordens de serviço diretamente da API Samsung GSPN
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">ASC Code</div>
            <div className="text-lg font-bold text-[#00D4FF]">{config.asc_code}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-sm text-gray-400 mb-1">Ambiente</div>
            <div className="text-lg font-bold text-white uppercase">
              {config.ambiente_ativo}
            </div>
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
              IMPORTAR OS DOS ÚLTIMOS {config.dias_historico} DIAS
            </>
          )}
        </button>
      </div>

      <div className="premium-card">
        <h3 className="text-lg font-bold text-white mb-4">Histórico de Sincronizações</h3>

        {syncLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            Nenhuma sincronização realizada ainda
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
