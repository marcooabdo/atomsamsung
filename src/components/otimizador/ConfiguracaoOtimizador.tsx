import { useState, useEffect } from 'react';
import { Cog, Save, Clock, MapPin, Bell, Eye, Settings, AlertTriangle } from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ConfiguracaoPrioridades from './ConfiguracaoPrioridades';

interface ConfigOtimizador {
  tempo_medio_ih: number;
  raio_busca_km: number;
  horario_inicio: string;
  horario_fim: string;
  duracao_almoco: number;
  horario_almoco: string;
  notificar_novos_agendamentos: boolean;
  notificar_checkout_pendente: boolean;
  modo_visualizacao_mapa: string;
}

export default function ConfiguracaoOtimizador() {
  const { selectedUnidade, loading } = useOtimizador();
  const { usuario } = useAuth();
  const [config, setConfig] = useState<ConfigOtimizador>({
    tempo_medio_ih: 120,
    raio_busca_km: 50,
    horario_inicio: '08:00',
    horario_fim: '18:00',
    duracao_almoco: 60,
    horario_almoco: '12:00',
    notificar_novos_agendamentos: true,
    notificar_checkout_pendente: true,
    modo_visualizacao_mapa: 'padrao',
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'geral' | 'prioridades'>('geral');

  useEffect(() => {
    if (selectedUnidade) {
      loadConfig();
    }
  }, [selectedUnidade]);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_unidade')
        .select('*')
        .eq('unidade_id', selectedUnidade)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setConfig({
          tempo_medio_ih: data.tempo_medio_ih || 120,
          raio_busca_km: data.raio_busca_km || 50,
          horario_inicio: data.horario_inicio || '08:00',
          horario_fim: data.horario_fim || '18:00',
          duracao_almoco: data.duracao_almoco || 60,
          horario_almoco: data.horario_almoco || '12:00',
          notificar_novos_agendamentos: data.notificar_novos_agendamentos ?? true,
          notificar_checkout_pendente: data.notificar_checkout_pendente ?? true,
          modo_visualizacao_mapa: data.modo_visualizacao_mapa || 'padrao',
        });
      }
    } catch (error) {
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      const { error } = await supabase.from('configuracoes_unidade').upsert(
        {
          unidade_id: selectedUnidade,
          ...config,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'unidade_id',
        }
      );

      if (error) throw error;

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      alert('Erro ao salvar configurações. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const canEdit = usuario?.tipo === 'master' || usuario?.tipo === 'gerente' || usuario?.tipo === 'administrador';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-400 via-slate-500 to-gray-600">
            Configurações
          </h2>
          <p className="text-gray-400 mt-1">Parâmetros de otimização e preferências</p>
        </div>

        {canEdit && activeTab === 'geral' && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 rounded-lg text-white font-medium transition-all disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Salvando...' : saveSuccess ? 'Salvo!' : 'Salvar Configurações'}
          </button>
        )}
      </div>

      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-2 flex gap-2">
        <button
          onClick={() => setActiveTab('geral')}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-all flex-1 ${
            activeTab === 'geral'
              ? 'bg-gradient-to-r from-gray-700 to-gray-600 text-white'
              : 'text-gray-400 hover:bg-gray-700/50'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium">Configurações Gerais</span>
        </button>
        <button
          onClick={() => setActiveTab('prioridades')}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-all flex-1 ${
            activeTab === 'prioridades'
              ? 'bg-gradient-to-r from-orange-700 to-red-600 text-white'
              : 'text-gray-400 hover:bg-gray-700/50'
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">Regras de Prioridade</span>
        </button>
      </div>

      {activeTab === 'geral' ? (
        <>
          {!canEdit && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <p className="text-yellow-400 text-sm">
                Apenas gerentes e administradores podem alterar as configurações.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-6 h-6 text-cyan-400" />
            <h3 className="text-xl font-bold text-white">Tempo Médio de Atendimento</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Tempo Médio IH - em minutos</label>
              <input
                type="number"
                value={config.tempo_medio_ih}
                onChange={(e) => setConfig({ ...config, tempo_medio_ih: Number(e.target.value) })}
                disabled={!canEdit}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
                min="30"
                max="480"
              />
              <p className="text-gray-500 text-xs mt-2">Tempo médio estimado para cada atendimento In Home</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-6 h-6 text-blue-400" />
            <h3 className="text-xl font-bold text-white">Horário de Expediente</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Horário de Início</label>
              <input
                type="time"
                value={config.horario_inicio}
                onChange={(e) => setConfig({ ...config, horario_inicio: e.target.value })}
                disabled={!canEdit}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-2 block">Horário de Término</label>
              <input
                type="time"
                value={config.horario_fim}
                onChange={(e) => setConfig({ ...config, horario_fim: e.target.value })}
                disabled={!canEdit}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-2 block">Horário de Almoço</label>
              <input
                type="time"
                value={config.horario_almoco}
                onChange={(e) => setConfig({ ...config, horario_almoco: e.target.value })}
                disabled={!canEdit}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-2 block">Duração do Almoço - em minutos</label>
              <input
                type="number"
                value={config.duracao_almoco}
                onChange={(e) => setConfig({ ...config, duracao_almoco: Number(e.target.value) })}
                disabled={!canEdit}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
                min="30"
                max="120"
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <MapPin className="w-6 h-6 text-green-400" />
            <h3 className="text-xl font-bold text-white">Otimização de Rotas</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Raio de busca geográfica - em km</label>
              <input
                type="number"
                value={config.raio_busca_km}
                onChange={(e) => setConfig({ ...config, raio_busca_km: Number(e.target.value) })}
                disabled={!canEdit}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
                min="10"
                max="500"
              />
              <p className="text-gray-500 text-xs mt-2">Define o raio máximo para agrupar OSs na mesma rota</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Eye className="w-6 h-6 text-purple-400" />
            <h3 className="text-xl font-bold text-white">Preferências de Visualização</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Modo de visualização do mapa</label>
              <select
                value={config.modo_visualizacao_mapa}
                onChange={(e) => setConfig({ ...config, modo_visualizacao_mapa: e.target.value })}
                disabled={!canEdit}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
              >
                <option value="padrao">Padrão (OpenStreetMap)</option>
                <option value="satelite">Satélite</option>
                <option value="terreno">Terreno</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-6 h-6 text-yellow-400" />
          <h3 className="text-xl font-bold text-white">Notificações</h3>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.notificar_novos_agendamentos}
              onChange={(e) => setConfig({ ...config, notificar_novos_agendamentos: e.target.checked })}
              disabled={!canEdit}
              className="w-5 h-5 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 disabled:opacity-50"
            />
            <div>
              <p className="text-white">Notificar sobre novos agendamentos</p>
              <p className="text-gray-400 text-sm">Receba alertas quando novos agendamentos forem criados</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.notificar_checkout_pendente}
              onChange={(e) => setConfig({ ...config, notificar_checkout_pendente: e.target.checked })}
              disabled={!canEdit}
              className="w-5 h-5 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 disabled:opacity-50"
            />
            <div>
              <p className="text-white">Notificar sobre checkouts pendentes</p>
              <p className="text-gray-400 text-sm">Alertas quando técnicos não completarem o checkout</p>
            </div>
          </label>
        </div>
      </div>

          {saveSuccess && (
            <div className="fixed bottom-8 right-8 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg animate-fadeIn">
              ✓ Configurações salvas com sucesso!
            </div>
          )}
        </>
      ) : (
        <ConfiguracaoPrioridades />
      )}
    </div>
  );
}
